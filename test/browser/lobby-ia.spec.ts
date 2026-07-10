import type { Page } from "@playwright/test";
import { expect, test } from "./helpers";

async function nameFreshGladiator(page: Page, name = "Aurelia"): Promise<void> {
  const modal = page.getByTestId("name-modal");
  await expect(modal).toBeVisible();
  await page.getByTestId("player-name").fill(name);
  await page.getByTestId("confirm-player-name").click();
  await expect(modal).toBeHidden();
}

test.describe("Guild lobby information architecture", () => {
  test("a first-time player names the gladiator once before using the lobby", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("start-game").click();

    await expect(page.locator("#screen-guild")).toBeVisible();
    await expect(page.getByTestId("name-modal")).toBeVisible();
    await expect(page.getByTestId("player-name")).toBeFocused();
    await expect(page.locator(".guild-topstrip input")).toHaveCount(0);

    await page.getByTestId("player-name").fill("Aurelia");
    await page.getByTestId("confirm-player-name").click();

    await expect(page.getByTestId("name-modal")).toBeHidden();
    await expect(page.getByTestId("rename-player")).toContainText("Aurelia");
    await expect(page.locator("#screen-guild input:visible")).toHaveCount(0);

    await page.reload();
    await page.getByTestId("start-game").click();
    await expect(page.getByTestId("name-modal")).toBeHidden();
    await expect(page.getByTestId("rename-player")).toContainText("Aurelia");
  });

  test("the stage and identity stay visible above three growth tabs", async ({ page }) => {
    await page.goto("/?seed=7&fast=1");
    await nameFreshGladiator(page);

    await expect(page.getByTestId("guild-tab-overview")).toHaveCount(0);
    await expect(page.getByTestId("guild-tab-class")).toHaveText("CLASS & TREE");
    await expect(page.getByTestId("guild-tab-training")).toHaveText("TRAINING");
    await expect(page.getByTestId("guild-tab-gear")).toHaveText("INVENTORY");
    await expect(page.locator(".guild-nav .guild-tab")).toHaveCount(3);
    await expect(page.locator("#guild-section-class").getByTestId("perk-t1-a")).toHaveCount(1);
    await expect(page.locator("#guild-section-training").getByTestId("perk-t1-a")).toHaveCount(0);

    for (const section of ["class", "training", "gear"] as const) {
      await page.getByTestId(`guild-tab-${section}`).click();
      await expect(page.locator(".lobby-stage")).toBeVisible();
      await expect(page.getByTestId("rename-player")).toBeVisible();
      await expect(page.locator(`#guild-section-${section}`)).toBeVisible();
    }

    await page.evaluate(() => {
      const key = "ghost-guild-save-v1";
      const raw = localStorage.getItem(key);
      if (raw === null) {
        throw new Error("Expected initialized save");
      }
      const save = JSON.parse(raw) as { bestSurvivalSeconds?: number };
      save.bestSurvivalSeconds = 123;
      localStorage.setItem(key, JSON.stringify(save));
    });
    await page.reload();
    await expect(page.getByTestId("nameplate-best")).toHaveText("BEST · 123s SURVIVED");
    await expect(page.getByTestId("best-survival-guild")).toHaveCount(0);
  });

  test("one dominant battle action opens the mode chooser and owns auto-run", async ({ page }) => {
    await page.goto("/?seed=7&fast=1");
    await nameFreshGladiator(page);

    await expect(page.getByTestId("battle-open")).toBeVisible();
    await expect(page.getByTestId("deploy-solo")).toBeHidden();
    await expect(page.getByTestId("deploy-arena")).toBeHidden();
    await expect(page.getByTestId("toggle-autorun")).toBeHidden();

    await page.getByTestId("battle-open").click();
    await expect(page.getByTestId("battle-modal")).toBeVisible();
    await expect(page.getByTestId("deploy-solo")).toContainText("PRACTICE BOUT");
    await expect(page.getByTestId("deploy-arena")).toContainText("GRAND BOUT");
    await expect(page.getByTestId("toggle-autorun")).toBeVisible();
    await page.getByTestId("toggle-autorun").click();
    await expect(page.getByTestId("toggle-autorun")).toHaveAttribute("aria-pressed", "true");

    await page.getByTestId("battle-close").click();
    await expect(page.getByTestId("battle-modal")).toBeHidden();
    await expect(page.getByTestId("battle-open")).toBeFocused();
  });

  test("settings contains Sound and Tutorial instead of a bottom utility rail", async ({ page }) => {
    await page.goto("/?seed=7&fast=1");
    await nameFreshGladiator(page);
    await page.getByTestId("coach-skip").click();

    await expect(page.locator(".guild-actions").getByTestId("sound-toggle")).toHaveCount(0);
    await expect(page.locator(".guild-actions").getByTestId("coach-replay")).toHaveCount(0);
    await page.getByTestId("settings-open").click();
    await expect(page.getByTestId("settings-popover")).toBeVisible();
    await expect(page.getByTestId("settings-popover").getByTestId("sound-toggle")).toBeVisible();
    await expect(page.getByTestId("coach-replay")).toHaveText("TUTORIAL");

    await page.getByTestId("coach-replay").click();
    await expect(page.getByTestId("settings-popover")).toBeHidden();
    await expect(page.getByTestId("coach-panel")).toBeVisible();
    await expect(page.getByTestId("guild-tab-class")).toHaveAttribute("aria-pressed", "true");
  });

  test("all eleven class choices remain readable and available without scrolling", async ({ page }) => {
    await page.goto("/?seed=7&fast=1");
    await nameFreshGladiator(page);

    const cards = page.getByTestId("class-roster").locator(".class-card");
    await expect(cards).toHaveCount(11);
    for (let index = 0; index < 11; index += 1) {
      const card = cards.nth(index);
      await expect(card).toBeVisible();
      const fonts = await card.evaluate((node) => {
        const name = node.querySelector("strong");
        const status = node.querySelector("small");
        return {
          name: name === null ? 0 : Number.parseFloat(getComputedStyle(name).fontSize),
          status: status === null ? 0 : Number.parseFloat(getComputedStyle(status).fontSize),
        };
      });
      expect(fonts.name).toBeGreaterThanOrEqual(8);
      expect(fonts.status).toBeGreaterThanOrEqual(8);
    }
    const pane = page.locator(".guild-pane");
    expect(await pane.evaluate((node) => node.scrollHeight <= node.clientHeight)).toBe(true);

    for (let index = 0; index < 11; index += 1) {
      await cards.nth(index).click();
      for (const testId of [
        "selected-class-weapons",
        "selected-class-strength",
        "selected-class-weakness",
        "selected-class-behavior",
      ] as const) {
        const field = page.getByTestId(testId);
        await expect(field).not.toHaveText("");
        const metrics = await field.evaluate((node) => ({
          clientWidth: node.clientWidth,
          clientHeight: node.clientHeight,
          scrollWidth: node.scrollWidth,
          scrollHeight: node.scrollHeight,
        }));
        expect(metrics.scrollWidth, `class ${index + 1} ${testId} horizontal clipping`).toBeLessThanOrEqual(
          metrics.clientWidth + 1,
        );
        expect(metrics.scrollHeight, `class ${index + 1} ${testId} vertical clipping`).toBeLessThanOrEqual(
          metrics.clientHeight + 1,
        );
      }
    }
    await page.getByTestId("class-elf").click();
    await expect(page.getByTestId("selected-class-name")).toHaveText("Elf Archer");
  });

  test("Arena deployment is guarded while matchmaking is pending", async ({ page }) => {
    let matchRequests = 0;
    await page.route("**/api/match**", async (route) => {
      matchRequests += 1;
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.abort();
    });
    await page.route("**/api/loadout", (route) => route.fulfill({ status: 204, body: "" }));
    await page.goto("/?seed=7");
    await nameFreshGladiator(page);
    await page.getByTestId("battle-open").click();

    await page.getByTestId("deploy-arena").evaluate((button) => {
      if (!(button instanceof HTMLButtonElement)) {
        throw new Error("Expected Arena button");
      }
      button.click();
      button.click();
    });

    await expect(page.getByTestId("deploy-arena")).toBeDisabled();
    await expect(page.getByTestId("deploy-arena")).toHaveAttribute("aria-busy", "true");
    await expect(page.getByTestId("deploy-arena")).toContainText("SUMMONING");
    await expect(page.locator("#screen-run")).toBeVisible({ timeout: 5000 });
    expect(matchRequests).toBe(1);
  });

  test("combat HUD and coach stay anchored inside the canvas without covering its dialog zone", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?seed=7");
    await nameFreshGladiator(page);
    await page.getByTestId("class-fighter").click();
    await page.getByTestId("battle-open").click();
    await page.getByTestId("deploy-solo").click();

    await expect(page.locator("#screen-run")).toBeVisible();
    await expect(page.locator(".run-canvas-frame > .hud")).toHaveCount(1);
    const frame = page.locator(".run-canvas-frame");
    const hp = page.locator(".hud-hp-orb");
    const xp = page.locator(".hud-xp");
    const coach = page.getByTestId("coach-run-panel");
    const [frameBox, hpBox, xpBox, coachBox] = await Promise.all([
      frame.boundingBox(),
      hp.boundingBox(),
      xp.boundingBox(),
      coach.boundingBox(),
    ]);
    expect(frameBox).not.toBeNull();
    expect(hpBox).not.toBeNull();
    expect(xpBox).not.toBeNull();
    expect(coachBox).not.toBeNull();
    const right = (frameBox?.x ?? 0) + (frameBox?.width ?? 0);
    const bottom = (frameBox?.y ?? 0) + (frameBox?.height ?? 0);
    expect(hpBox?.x ?? 0).toBeGreaterThanOrEqual(frameBox?.x ?? 0);
    expect((hpBox?.x ?? 0) + (hpBox?.width ?? 0)).toBeLessThanOrEqual(right);
    expect((hpBox?.y ?? 0) + (hpBox?.height ?? 0)).toBeLessThanOrEqual(bottom);
    expect(xpBox?.x ?? 0).toBeGreaterThanOrEqual(frameBox?.x ?? 0);
    expect((xpBox?.x ?? 0) + (xpBox?.width ?? 0)).toBeLessThanOrEqual(right);
    expect((xpBox?.y ?? 0) + (xpBox?.height ?? 0)).toBeLessThanOrEqual(bottom);
    expect((coachBox?.y ?? 0) + (coachBox?.height ?? 0)).toBeLessThanOrEqual(
      (frameBox?.y ?? 0) + (frameBox?.height ?? 0) * 0.48,
    );
  });

  test("an offline Arena result is labeled offline and is never submitted", async ({ page }) => {
    let resultRequests = 0;
    await page.route("**/api/match**", (route) => route.abort());
    await page.route("**/api/loadout", (route) => route.abort());
    await page.route("**/api/result", (route) => {
      resultRequests += 1;
      return route.abort();
    });
    await page.goto("/?seed=7&fast=1");
    await nameFreshGladiator(page);
    await page.getByTestId("battle-open").click();
    await page.getByTestId("deploy-arena").click();

    await expect(page.locator("#screen-results")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("leaderboard-status")).toContainText("OFFLINE MATCH");
    expect(resultRequests).toBe(0);
  });
});
