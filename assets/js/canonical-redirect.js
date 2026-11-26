// GitHub Pages can serve one HTML file at both the clean and .html URLs.
(() => {
  const link = document.querySelector('link[rel="canonical"]');
  if (!link) return;

  const canonical = new URL(link.href);
  if (location.origin !== canonical.origin || location.pathname === canonical.pathname) return;

  const path = location.pathname.toLowerCase();
  const target = canonical.pathname;
  const isAlias = target === "/"
    ? path === "/index.html" || path === "/index"
    : path === target || path === target + ".html";
  if (!isAlias) return;

  canonical.search = location.search;
  canonical.hash = location.hash;
  location.replace(canonical.href);
})();
