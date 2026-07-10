import { defineConfig, devices } from "@playwright/test";

const port = 5199;
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
    command: `npx vite --port ${port} --host 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: process.env["CI"] === undefined,
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
