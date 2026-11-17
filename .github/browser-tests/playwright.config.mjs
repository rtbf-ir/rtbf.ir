import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:4173";

export default defineConfig({
  testMatch: "*.spec.mjs",
  use: {
    baseURL,
    browserName: "chromium",
    launchOptions: { executablePath: process.env.RTBF_CHROMIUM_EXECUTABLE },
  },
  webServer: {
    command: "python3 -m http.server 4173 --bind 127.0.0.1",
    cwd: fileURLToPath(new URL("../../", import.meta.url)),
    url: baseURL + "/directory.html",
    reuseExistingServer: false,
  },
});
