import { expect, test } from "./helpers";

test.describe("Guild first-session coaching", () => {
  test("Class starts with three recommendations and expands the remaining roster", async ({ page }) => {
    await page.goto("/?seed=7&fast=1");
    await page.getByTestId("guild-tab-class").click();

    const recommended = page.locator("[data-class-group='recommended'] .class-card");
    await expect(recommended).toHaveCount(3);
    await expect(page.getByTestId("class-fighter")).toBeVisible();
    await expect(page.getByTestId("class-knight")).toBeVisible();
    await expect(page.getByTestId("class-mage")).toBeVisible();
    await expect(page.getByTestId("class-berserker")).toBeHidden();

    const toggle = page.getByTestId("toggle-all-classes");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();

    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const allClassCards = page.locator("#guild-section-class .class-card");
    await expect(allClassCards).toHaveCount(11);
    for (let index = 0; index < (await allClassCards.count()); index += 1) {
      await expect(allClassCards.nth(index)).toBeEnabled();
    }
    await expect(page.getByTestId("class-berserker")).toBeVisible();
  });

  test("fresh save completes the four coach steps through real actions", async ({ page }) => {
    await page.goto("/?seed=7&fast=1");

    const coach = page.getByTestId("coach-panel");
    await expect(coach).toBeVisible();
    await expect(coach).toContainText("Choose a recommended class");

    await page.getByTestId("guild-tab-class").click();
    await page.getByTestId("class-fighter").click();
    await expect(coach).toContainText("Read Fighter's behavior");

    await page.getByTestId("deploy-solo").click();
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
    await page.getByTestId("guild-tab-class").click();
    await page.getByTestId("class-fighter").click();
    await page.getByTestId("deploy-solo").click();

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

    const coach = page.getByTestId("coach-panel");
    await expect(coach).toBeVisible();
    await page.getByTestId("coach-skip").click();
    await expect(coach).toBeHidden();
    await expect(page.getByTestId("deploy-solo")).toBeEnabled();

    const savedCoach = await page.evaluate(() => {
      const raw = localStorage.getItem("ghost-guild-save-v1");
      return raw === null ? null : (JSON.parse(raw) as { coachCompleted?: boolean; coachStep?: number });
    });
    expect(savedCoach?.coachCompleted).toBe(true);
    expect(savedCoach?.coachStep).toBe(4);
  });

  test("returning save stays quiet until Replay Tutorial is chosen", async ({ page }) => {
    await page.goto("/?seed=7&fast=1");
    await page.getByTestId("coach-skip").click();
    await page.reload();

    const coach = page.getByTestId("coach-panel");
    await expect(coach).toBeHidden();

    await page.getByTestId("coach-replay").click();
    await expect(coach).toBeVisible();
    await expect(coach).toContainText("Choose a recommended class");
    await expect(page.getByTestId("guild-tab-class")).toHaveAttribute("aria-pressed", "true");

    const savedCoach = await page.evaluate(() => {
      const raw = localStorage.getItem("ghost-guild-save-v1");
      return raw === null ? null : (JSON.parse(raw) as { coachCompleted?: boolean; coachStep?: number });
    });
    expect(savedCoach?.coachCompleted).toBe(false);
    expect(savedCoach?.coachStep).toBe(1);
  });
});
