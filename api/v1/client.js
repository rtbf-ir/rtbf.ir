const defaultBase = new URL("./", import.meta.url);

export class RtbfApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "RtbfApiError";
    this.status = status;
  }
}

export function normalizeSearch(value) {
  return value.toLowerCase().replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/[\s\u200c]+/g, " ").trim();
}

export function hostnameFrom(input) {
  if (typeof input !== "string" || !input.trim()) throw new TypeError("A URL or domain is required.");
  const value = input.trim();
  const url = new URL(value.startsWith("//") ? "https:" + value :
    /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : "https://" + value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new TypeError("Use an HTTP(S) URL without credentials.");
  }
  return url.hostname.toLowerCase().replace(/\.$/, "");
}

export function createClient({ baseURL = defaultBase, fetch: fetcher = globalThis.fetch } = {}) {
  const base = new URL(baseURL);
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  let snapshot;

  async function request(path) {
    let response;
    try {
      response = await fetcher(new URL(path, base));
    } catch {
      throw new RtbfApiError("RTBF API network request failed.");
    }
    if (!response.ok) throw new RtbfApiError("RTBF API request failed.", response.status);
    return response.json();
  }

  function all() {
    if (!snapshot) {
      snapshot = request("all.json").catch(error => {
        snapshot = undefined;
        throw error;
      });
    }
    return snapshot;
  }

  async function lookup(input) {
    const host = hostnameFrom(input);
    const { data, revision } = await all();
    const service = data.filter(item => host === item.domain || host.endsWith("." + item.domain))
      .sort((left, right) => right.domain.length - left.domain.length)[0];
    return { api_version: "1", revision, data: service ?? null };
  }

  async function list({
    q = "", category = "all", status = "all", priority = "all",
    sort = "newest", page = 1, pageSize = 20,
  } = {}) {
    if (typeof q !== "string" || !["oldest", "newest"].includes(sort) ||
        !Number.isInteger(page) || page < 1 ||
        !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new TypeError("Invalid search, sort, page, or pageSize (1–100).");
    }
    const { data, revision } = await all();
    const filters = { category, status, priority: String(priority) };
    for (const key of Object.keys(filters)) {
      if (filters[key] !== "all" && !data.some(item => String(item[key]) === filters[key])) {
        throw new TypeError("Invalid " + key + " filter.");
      }
    }
    const query = normalizeSearch(q);
    const selected = data.filter(item =>
      (category === "all" || item.category === category) &&
      (status === "all" || item.status === status) &&
      (filters.priority === "all" || item.priority === Number(priority)) &&
      (!query || normalizeSearch(item.name).includes(query) || item.domain.includes(query)));
    if (sort === "newest") selected.reverse();
    const totalPages = Math.max(1, Math.ceil(selected.length / pageSize));
    if (page > totalPages) throw new RangeError("Page exceeds total_pages.");
    return {
      api_version: "1", revision,
      data: selected.slice((page - 1) * pageSize, page * pageSize),
      meta: {
        total: selected.length, page, page_size: pageSize, total_pages: totalPages,
        filters, sort, q,
        next_page: page < totalPages ? page + 1 : null,
        previous_page: page > 1 ? page - 1 : null,
      },
    };
  }

  return { list, lookup };
}
