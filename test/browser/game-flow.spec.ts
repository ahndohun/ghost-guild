import {
  expect,
  expectImagesLoaded,
  finishNameOnboarding,
  startArenaFromGuild,
  startSoloFromGuild,
  test,
} from "./helpers";

// Screen containers (#screen-*) are the documented DOM surface from
// DESIGN.md section 9 and are used the same way by the TestSprite plans in
// plans/*.json. Every interactive control uses its data-testid instead.
const resultsTimeoutMs = 15000;

test.describe("Colosseum Survivors core flow", () => {
  test("root URL shows the title screen; PRESS START opens the Guild", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("#screen-title")).toBeVisible();
    await expect(page.locator("#screen-guild")).toBeHidden();
    await expect(page.getByTestId("start-game")).toBeVisible();

    await page.getByTestId("start-game").click();
    await finishNameOnboarding(page);

    await expect(page.locator("#screen-guild")).toBeVisible();
    await expect(page.locator("#screen-title")).toBeHidden();
    await expect(page.getByTestId("battle-open")).toBeVisible();
  });

  test("seed and fast query params skip the title and expose the Guild directly", async ({ page }) => {
    await page.goto("/?seed=7&fast=1");
    await finishNameOnboarding(page);

    await expect(page.locator("#screen-guild")).toBeVisible();
    await expect(page.locator("#screen-title")).toBeHidden();
    await expect(page.getByTestId("battle-open")).toBeVisible();
  });

  test("selecting Mage updates the selected class and its specialization text", async ({ page }) => {
    await page.goto("/?seed=7&fast=1");
    await finishNameOnboarding(page);

    const knightCard = page.getByTestId("class-knight");
    const mageCard = page.getByTestId("class-mage");
    const firstPerkCard = page.getByTestId("perk-t1-a");

    // Fresh save opens Class for coach step one; Training stays behind its tab.
    const perkTextBeforeSelect = (await firstPerkCard.textContent()) ?? "";

    await page.getByTestId("guild-tab-class").click();
    // Fresh save defaults to Knight.
    await expect(knightCard).toHaveClass(/\bselected\b/);
    await expect(mageCard).not.toHaveClass(/\bselected\b/);

    await mageCard.click();

    await expect(mageCard).toHaveClass(/\bselected\b/);
    await expect(knightCard).not.toHaveClass(/\bselected\b/);
    await expect(mageCard).toHaveAttribute("aria-pressed", "true");
    await expect(knightCard).toHaveAttribute("aria-pressed", "false");

    await expect(page.getByTestId("selected-class-portrait")).toHaveAttribute(
      "src",
      "/assets/art/portraits/mage.png",
    );

    // The specialization tree re-renders per class (Knight "Bulwark" vs Mage
    // "Edge Study" on tier 1a) inside CLASS & TREE.
    await expect(firstPerkCard).not.toHaveText(perkTextBeforeSelect);
    const perkIcons = page.locator("#guild-section-class .perk-card img.perk-icon");
    await expect(perkIcons).toHaveCount(10);
    await expectImagesLoaded(perkIcons, 32);
    await expect(firstPerkCard).toHaveAttribute("data-perk-family", /^(attack|defense|movement|economy|behavior|signature)$/);

    await page.getByTestId("guild-tab-training").click();
    await expect(page.getByTestId("buy-atk")).toBeVisible();
    await expect(firstPerkCard).toBeHidden();
  });

  test("Guild sections expose one active pane and support pointer and keyboard navigation", async ({ page }) => {
    await page.goto("/?seed=7&fast=1");
    await finishNameOnboarding(page);

    const classTab = page.getByTestId("guild-tab-class");
    const trainingTab = page.getByTestId("guild-tab-training");
    const inventoryTab = page.getByTestId("guild-tab-gear");

    await expect(classTab).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#guild-section-class")).toBeVisible();

    await trainingTab.focus();
    await trainingTab.press("Enter");
    await expect(trainingTab).toHaveAttribute("aria-pressed", "true");
    await expect(classTab).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#guild-section-training")).toBeVisible();
    await expect(page.locator("#guild-section-class")).toBeHidden();

    await inventoryTab.click();
    await expect(inventoryTab).toHaveAttribute("aria-pressed", "true");
    await expect(trainingTab).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#guild-section-gear")).toBeVisible();
    await expect(page.locator(".lobby-stage")).toBeVisible();

    const primaryAction = page.locator(".guild-actions button.primary");
    await expect(primaryAction).toHaveCount(1);
    await expect(primaryAction).toHaveAttribute("data-testid", "battle-open");
  });

  test("Gear shows item-specific art and effects before equip", async ({ page }) => {
    await page.goto("/?seed=7&fast=1");
    await finishNameOnboarding(page);
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
    await expectImagesLoaded(stashIcons, 32);
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

  test("DEPLOY SOLO reports rewards, supports Run Again, then Adjust Build", async ({ page }) => {
    await page.goto("/?seed=7&fast=1");
    await finishNameOnboarding(page);

    await startSoloFromGuild(page);

    await expect(page.locator("#screen-results")).toBeVisible({ timeout: resultsTimeoutMs });
    await expect(page.getByTestId("result-score")).toHaveText(/^\d+$/);
    await expect(page.getByTestId("result-outcome")).toHaveText(/^(DEFEATED AT \d+s|SURVIVED 180s)$/);
    await expect(page.getByTestId("result-rank-cell")).toBeHidden();
    await expect(page.getByTestId("match-ranking-section")).toBeHidden();
    await expect(page.getByTestId("leaderboard-section")).toBeHidden();
    await expect(page.getByTestId("result-gold-before")).toHaveText("0");
    await expect(page.getByTestId("result-gold-earned")).toHaveText(/^\d+$/);
    await expect(page.getByTestId("result-gold-after")).toHaveText(/^\d+$/);
    await expect(page.getByTestId("result-loot")).not.toHaveText("");

    const firstGoldAfter = Number(await page.getByTestId("result-gold-after").textContent());
    await expect(page.getByTestId("run-again")).toHaveClass(/\bprimary\b/);
    await expect(page.getByTestId("run-again")).toBeFocused();
    await page.getByTestId("run-again").click();
    await expect.poll(async () => Number(await page.getByTestId("result-gold-before").textContent())).toBe(firstGoldAfter);
    await expect(page.locator("#game-state")).toHaveAttribute("data-mode", "solo");
    await expect(page.locator("#game-state")).toHaveAttribute("data-seed", "7");

    await page.getByTestId("adjust-build").click();

    await expect(page.locator("#screen-guild")).toBeVisible();
    await expect(page.getByTestId("guild-tab-training")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("guild-tab-training")).toBeFocused();
  });

  test("DEPLOY ARENA produces at least two match ranking rows", async ({ page }) => {
    await page.goto("/?seed=7&fast=1");

    await finishNameOnboarding(page);
    await startArenaFromGuild(page);

    await expect(page.locator("#screen-results")).toBeVisible({ timeout: resultsTimeoutMs });
    await expect(page.getByTestId("result-outcome")).toHaveText(/^ARENA PLACEMENT #\d+$/);
    await expect(page.getByTestId("result-rank-cell")).toBeVisible();
    await expect(page.getByTestId("match-ranking-section")).toBeVisible();
    await expect(page.getByTestId("leaderboard-section")).toBeVisible();
    const rankingRows = page.getByTestId("result-ranking").locator("li");
    await expect.poll(() => rankingRows.count()).toBeGreaterThanOrEqual(2);
    await expect(page.getByTestId("leaderboard-status")).toHaveText(/(UNAVAILABLE|NO WORLD ENTRIES|WORLD RANKINGS LIVE)/);
  });
});
