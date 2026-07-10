import { test as base, expect } from "@playwright/test";

/**
 * Autouse fixture: fails a test if the page threw any uncaught error while it
 * ran. This enforces Plan 001 Step 2 flow 6 ("no uncaught page errors") across
 * every browser flow test without needing a dedicated test case per flow.
 */
export const test = base.extend<{ failOnPageErrors: void }>({
  failOnPageErrors: [
    async ({ page }, use) => {
      const errors: Error[] = [];
      page.on("pageerror", (error) => {
        errors.push(error);
      });

      await use();

      expect(
        errors,
        errors.length === 0
          ? undefined
          : `Uncaught page error(s):\n${errors.map((error) => error.stack ?? error.message).join("\n")}`,
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
