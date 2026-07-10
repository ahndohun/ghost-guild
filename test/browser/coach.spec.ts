import { expect, expectImagesLoaded, finishNameOnboarding, startSoloFromGuild, test } from "./helpers";

test.describe("Guild first-session coaching", () => {
  test("Class shows the full roster and updates one shared detail panel without scrolling", async ({ page }) => {
    await page.goto("/?seed=7&fast=1");
    await finishNameOnboarding(page);

    await expect(page.locator("#guild-section-class")).toBeVisible();
    const allClassCards = page.getByTestId("class-roster").locator(".class-card");
    await expect(allClassCards).toHaveCount(11);
    for (let index = 0; index < (await allClassCards.count()); index += 1) {
      await expect(allClassCards.nth(index)).toBeVisible();
      await expect(allClassCards.nth(index)).toBeEnabled();
    }
    const portraits = allClassCards.locator("img.class-portrait");
    await expect(portraits).toHaveCount(11);
    await expectImagesLoaded(portraits, 64);
    await expect(page.getByTestId("selected-class-name")).toHaveText("Knight");
    await page.getByTestId("class-mage").click();
    await expect(page.getByTestId("selected-class-name")).toHaveText("Mage");
    await expect(page.getByTestId("selected-class-weapons")).not.toHaveText("");
    await expect(page.getByTestId("selected-class-strength")).not.toHaveText("");
    await expect(page.getByTestId("selected-class-weakness")).not.toHaveText("");
    await expect(page.getByTestId("selected-class-behavior")).not.toHaveText("");

    const paneMetrics = await page.locator(".guild-pane").evaluate((pane) => ({
      clientHeight: pane.clientHeight,
      scrollHeight: pane.scrollHeight,
      scrollTop: pane.scrollTop,
    }));
    expect(paneMetrics.scrollTop).toBe(0);
    expect(paneMetrics.scrollHeight).toBeLessThanOrEqual(paneMetrics.clientHeight);
  });

  test("fresh save completes the four coach steps through real actions", async ({ page }) => {
    await page.goto("/?seed=7&fast=1");
    await finishNameOnboarding(page);

    const coach = page.getByTestId("coach-panel");
    await expect(coach).toBeVisible();
    await expect(coach).toContainText("Choose a class");
    await expect(page.getByTestId("guild-tab-class")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#guild-section-class")).toBeVisible();

    await page.getByTestId("class-fighter").click();
    await expect(coach).toContainText("Read Fighter's behavior");

    await startSoloFromGuild(page);
    await expect(page.locator("#screen-results")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("coach-results-panel")).toBeVisible();
    await expect(page.getByTestId("coach-results-skip")).toBeVisible();
    await page.getByTestId("back-to-guild").click();

    await expect(coach).toBeVisible();
    await expect(coach).toContainText("Open Training");
    await page.getByTestId("guild-tab-training").click();
    await expect(coach).toBeHidden();

    const savedCoach = await page.evaluate(() => {
      const raw = localStorage.getItem("ghost-guild-save-v1");
      return raw === null ? null : (JSON.parse(raw) as { coachCompleted?: boolean; coachStep?: number });
    });
    expect(savedCoach?.coachCompleted).toBe(true);
    expect(savedCoach?.coachStep).toBe(4);
  });

  test("run coach step keeps Skip available while the gladiator fights", async ({ page }) => {
    await page.goto("/?seed=7");
    await finishNameOnboarding(page);
    await page.getByTestId("guild-tab-class").click();
    await page.getByTestId("class-fighter").click();
    await startSoloFromGuild(page);

    await expect(page.locator("#screen-run")).toBeVisible();
    const runCoach = page.getByTestId("coach-run-panel");
    await expect(runCoach).toBeVisible();
    await expect(runCoach).toContainText("Watch the run");
    await page.getByTestId("coach-run-skip").click();
    await expect(runCoach).toBeHidden();

    const savedCoach = await page.evaluate(() => {
      const raw = localStorage.getItem("ghost-guild-save-v1");
      return raw === null ? null : (JSON.parse(raw) as { coachCompleted?: boolean; coachStep?: number });
    });
    expect(savedCoach?.coachCompleted).toBe(true);
    expect(savedCoach?.coachStep).toBe(4);
  });

  test("fresh save can skip the coach without blocking play", async ({ page }) => {
    await page.goto("/?seed=7&fast=1");
    await finishNameOnboarding(page);

    const coach = page.getByTestId("coach-panel");
    await expect(coach).toBeVisible();
    await page.getByTestId("coach-skip").click();
    await expect(coach).toBeHidden();
    await expect(page.getByTestId("battle-open")).toBeEnabled();

    const savedCoach = await page.evaluate(() => {
      const raw = localStorage.getItem("ghost-guild-save-v1");
      return raw === null ? null : (JSON.parse(raw) as { coachCompleted?: boolean; coachStep?: number });
    });
    expect(savedCoach?.coachCompleted).toBe(true);
    expect(savedCoach?.coachStep).toBe(4);
  });

  test("returning save stays quiet until Replay Tutorial is chosen", async ({ page }) => {
    await page.goto("/?seed=7&fast=1");
    await finishNameOnboarding(page);
    await page.getByTestId("coach-skip").click();
    await page.reload();

    const coach = page.getByTestId("coach-panel");
    await expect(coach).toBeHidden();
    await expect(page.getByTestId("guild-tab-class")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#guild-section-class")).toBeVisible();

    await page.getByTestId("settings-open").click();
    await page.getByTestId("coach-replay").click();
    await expect(coach).toBeVisible();
    await expect(coach).toContainText("Choose a class");
    await expect(page.getByTestId("guild-tab-class")).toHaveAttribute("aria-pressed", "true");

    const savedCoach = await page.evaluate(() => {
      const raw = localStorage.getItem("ghost-guild-save-v1");
      return raw === null ? null : (JSON.parse(raw) as { coachCompleted?: boolean; coachStep?: number });
    });
    expect(savedCoach?.coachCompleted).toBe(false);
    expect(savedCoach?.coachStep).toBe(1);
  });
});
