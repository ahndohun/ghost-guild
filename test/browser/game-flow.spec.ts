import { expect, test } from "./helpers";

// Screen containers (#screen-*) are the documented DOM surface from
// DESIGN.md section 9 and are used the same way by the TestSprite plans in
// plans/*.json. Every interactive control uses its data-testid instead.
const resultsTimeoutMs = 15000;

test.describe("Ghost Guild core flow", () => {
  test("root URL shows the title screen; PRESS START opens the Guild", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("#screen-title")).toBeVisible();
    await expect(page.locator("#screen-guild")).toBeHidden();
    await expect(page.getByTestId("start-game")).toBeVisible();

    await page.getByTestId("start-game").click();

    await expect(page.locator("#screen-guild")).toBeVisible();
    await expect(page.locator("#screen-title")).toBeHidden();
    await expect(page.getByTestId("deploy-solo")).toBeVisible();
  });

  test("seed and fast query params skip the title and expose the Guild directly", async ({ page }) => {
    await page.goto("/?seed=7&fast=1");

    await expect(page.locator("#screen-guild")).toBeVisible();
    await expect(page.locator("#screen-title")).toBeHidden();
    await expect(page.getByTestId("deploy-solo")).toBeVisible();
  });

  test("selecting Mage updates the selected class and its specialization text", async ({ page }) => {
    await page.goto("/?seed=7&fast=1");

    const knightCard = page.getByTestId("class-knight");
    const mageCard = page.getByTestId("class-mage");
    const firstPerkCard = page.getByTestId("perk-t1-a");

    // Fresh save defaults to Knight.
    await expect(knightCard).toHaveClass(/\bselected\b/);
    await expect(mageCard).not.toHaveClass(/\bselected\b/);
    const perkTextBeforeSelect = (await firstPerkCard.textContent()) ?? "";

    await mageCard.click();

    await expect(mageCard).toHaveClass(/\bselected\b/);
    await expect(knightCard).not.toHaveClass(/\bselected\b/);
    // The specialization tree re-renders per class (Knight "Bulwark" vs Mage
    // "Edge Study" on tier 1a) — this is the Guild's class identity signal.
    await expect(firstPerkCard).not.toHaveText(perkTextBeforeSelect);
  });

  test("DEPLOY SOLO reaches Results; BACK TO GUILD returns to the Guild", async ({ page }) => {
    await page.goto("/?seed=7&fast=1");

    await page.getByTestId("deploy-solo").click();

    await expect(page.locator("#screen-results")).toBeVisible({ timeout: resultsTimeoutMs });
    await expect(page.getByTestId("result-score")).toHaveText(/^\d+$/);

    await page.getByTestId("back-to-guild").click();

    await expect(page.locator("#screen-guild")).toBeVisible();
  });

  test("DEPLOY ARENA produces at least two match ranking rows", async ({ page }) => {
    await page.goto("/?seed=7&fast=1");

    await page.getByTestId("deploy-arena").click();

    await expect(page.locator("#screen-results")).toBeVisible({ timeout: resultsTimeoutMs });
    const rankingRows = page.getByTestId("result-ranking").locator("li");
    await expect.poll(() => rankingRows.count()).toBeGreaterThanOrEqual(2);
  });
});
