import { defineConfig, devices } from "@playwright/test";

const resolvedPortKey = "PLAYWRIGHT_RUN_PORT";
const configuredPort = process.env["PLAYWRIGHT_PORT"] ?? process.env[resolvedPortKey];
const port = configuredPort === undefined
  ? 10_000 + (process.pid % 40_000)
  : Number(configuredPort);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`PLAYWRIGHT_PORT must be an integer from 1 to 65535; received ${configuredPort}`);
}
process.env[resolvedPortKey] = String(port);

const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "test/browser",
  fullyParallel: true,
  retries: process.env["CI"] !== undefined ? 1 : 0,
  reporter: "list",
  use: {
    baseURL,
  },
  webServer: {
    command: `npx vite --port ${port} --strictPort --host 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "desktop-tall",
      use: { ...devices["Desktop Chrome"], viewport: { width: 875, height: 909 } },
    },
    {
      name: "screenshot-source",
      use: { ...devices["Desktop Chrome"], viewport: { width: 875, height: 717 } },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
});
