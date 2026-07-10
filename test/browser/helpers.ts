import { test as base, expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

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

/** Completes the first-save identity gate when present; returning saves are untouched. */
export async function finishNameOnboarding(page: Page, name = "Gladiator-3113"): Promise<void> {
  const modal = page.getByTestId("name-modal");
  if (await modal.isVisible()) {
    await page.getByTestId("player-name").fill(name);
    await page.getByTestId("confirm-player-name").click();
    await expect(modal).toBeHidden();
  }
}

export async function startSoloFromGuild(page: Page): Promise<void> {
  await page.getByTestId("battle-open").click();
  await page.getByTestId("deploy-solo").click();
}

export async function startArenaFromGuild(page: Page): Promise<void> {
  await page.getByTestId("battle-open").click();
  await page.getByTestId("deploy-arena").click();
}

/** Polls until every expected image has decoded to the intended source width. */
export async function expectImagesLoaded(images: Locator, naturalWidth: number): Promise<void> {
  await expect.poll(async () => images.evaluateAll((elements, expectedWidth) => {
    return elements.length > 0 && elements.every((element) => {
      return element instanceof HTMLImageElement
        && element.complete
        && element.naturalWidth === expectedWidth;
    });
  }, naturalWidth)).toBe(true);
}
