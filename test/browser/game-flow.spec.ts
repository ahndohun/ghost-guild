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

    // Fresh save defaults to Overview; Class and Training are behind tabs.
    const perkTextBeforeSelect = (await firstPerkCard.textContent()) ?? "";

    await page.getByTestId("guild-tab-class").click();
    // Fresh save defaults to Knight.
    await expect(knightCard).toHaveClass(/\bselected\b/);
    await expect(mageCard).not.toHaveClass(/\bselected\b/);

    await mageCard.click();

    await expect(mageCard).toHaveClass(/\bselected\b/);
    await expect(knightCard).not.toHaveClass(/\bselected\b/);

    await page.getByTestId("guild-tab-overview").click();
    await expect(page.getByTestId("overview-class-portrait")).toHaveAttribute(
      "src",
      "/assets/art/portraits/mage.png",
    );

    await page.getByTestId("guild-tab-training").click();
    // The specialization tree re-renders per class (Knight "Bulwark" vs Mage
    // "Edge Study" on tier 1a) — this is the Guild's class identity signal.
    await expect(firstPerkCard).not.toHaveText(perkTextBeforeSelect);
    const perkIcons = page.locator(".perk-card img.perk-icon");
    await expect(perkIcons).toHaveCount(10);
    expect(
      await perkIcons.evaluateAll((images) => images.every((image) => {
        return image instanceof HTMLImageElement && image.complete && image.naturalWidth === 32;
      })),
    ).toBe(true);
    await expect(firstPerkCard).toHaveAttribute("data-perk-family", /^(attack|defense|movement|economy|behavior|signature)$/);
  });

  test("Guild sections expose one active pane and support pointer and keyboard navigation", async ({ page }) => {
    await page.goto("/?seed=7&fast=1");

    const overviewTab = page.getByTestId("guild-tab-overview");
    const classTab = page.getByTestId("guild-tab-class");
    const trainingTab = page.getByTestId("guild-tab-training");

    await expect(overviewTab).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#guild-section-overview")).toBeVisible();
    await expect(page.locator("#guild-section-class")).toBeHidden();

    await classTab.click();
    await expect(classTab).toHaveAttribute("aria-pressed", "true");
    await expect(overviewTab).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#guild-section-class")).toBeVisible();

    await trainingTab.focus();
    await trainingTab.press("Enter");
    await expect(trainingTab).toHaveAttribute("aria-pressed", "true");
    await expect(classTab).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#guild-section-training")).toBeVisible();
    await expect(page.locator("#guild-section-class")).toBeHidden();

    const primaryActions = page.locator(".guild-actions button.primary");
    await expect(primaryActions).toHaveCount(1);
    await expect(primaryActions).toHaveAttribute("data-testid", "deploy-solo");
  });

  test("Gear shows item-specific art and effects before equip", async ({ page }) => {
    await page.goto("/?seed=7&fast=1");
    await page.evaluate(() => {
      const key = "ghost-guild-save-v1";
      const raw = localStorage.getItem(key);
      if (raw === null) {
        throw new Error("Expected initialized Guild save");
      }
      const save = JSON.parse(raw) as {
        equippedItems: { relicWeapon: string | null; armor: string | null; trinket: string | null };
        stash: string[];
      };
      save.equippedItems.armor = "unique_aegisOfTheLine";
      save.stash = [
        "ironBlade_common",
        "ironBlade_magic",
        "ironBlade_rare",
        "unique_reliableSteel",
        "set_veteranBlade",
      ];
      localStorage.setItem(key, JSON.stringify(save));
    });
    await page.reload();
    await page.getByTestId("guild-tab-gear").click();

    const equippedIcon = page.getByTestId("item-slot-armor").locator("img.item-icon");
    await expect(equippedIcon).toHaveAttribute("src", "/assets/art/icons/items/aegis-of-the-line.png");
    await expect(equippedIcon).toBeVisible();
    await expect(page.getByTestId("item-slot-armor")).toHaveAttribute("data-rarity", "unique");

    const stashCards = page.locator("#stash-list .stash-item");
    await expect(stashCards).toHaveCount(5);
    const stashIcons = stashCards.locator("img.item-icon");
    await expect(stashIcons).toHaveCount(5);
    expect(
      await stashIcons.evaluateAll((images) => images.every((image) => {
        return image instanceof HTMLImageElement && image.complete && image.naturalWidth === 32;
      })),
    ).toBe(true);
    expect(await stashCards.evaluateAll((cards) => cards.map((card) => card.getAttribute("data-rarity")))).toEqual([
      "common",
      "magic",
      "rare",
      "unique",
      "set",
    ]);
    await expect(page.getByTestId("stash-item-0")).toContainText("ATK +4%.");

    const emptyCopy = page.getByTestId("item-slot-relicWeapon").locator(".item-copy");
    expect(await emptyCopy.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(120);
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
