import { expect, finishNameOnboarding, startSoloFromGuild, test } from "./helpers";

const simulationChunkMs = 600;
const maximumSimulationChunks = Math.ceil(180_000 / simulationChunkMs) + 2;
const deathPresentationMs = 720;

test.describe("Solo final-death presentation", () => {
  test("keeps the finished solo run visible for the 720ms death animation without advancing the simulation", async ({ page }) => {
    test.setTimeout(60_000);
    await page.clock.install({ time: 1_000 });
    await page.goto("/?seed=7");
    const currentBrowserTime = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(currentBrowserTime + 10_000);
    await finishNameOnboarding(page);

    await page.getByTestId("guild-tab-class").click();
    await page.getByTestId("class-mage").click();
    await startSoloFromGuild(page);

    const gameState = page.locator("#game-state");
    await gameState.evaluate((element) => {
      new MutationObserver(() => {
        if (element.getAttribute("data-phase") === "finished") {
          element.setAttribute("data-observed-finished-at", String(performance.now()));
        }
      }).observe(element, { attributes: true, attributeFilter: ["data-phase"] });
    });

    for (let chunk = 0; chunk < maximumSimulationChunks; chunk += 1) {
      await page.clock.runFor(simulationChunkMs);
      if (await gameState.getAttribute("data-phase") === "finished") {
        break;
      }
    }

    await expect(gameState).toHaveAttribute("data-phase", "finished");
    await expect(gameState).toHaveAttribute("data-hp", "0");
    await expect(page.locator("#screen-run")).toBeVisible();
    await expect(page.locator("#screen-results")).toBeHidden();

    const finishedState = await gameState.evaluate((element) => ({
      phase: element.getAttribute("data-phase"),
      time: element.getAttribute("data-time"),
      hp: element.getAttribute("data-hp"),
      kills: element.getAttribute("data-kills"),
      gold: element.getAttribute("data-gold"),
    }));
    const finishedAt = Number(await gameState.getAttribute("data-observed-finished-at"));
    const observedAt = await page.evaluate(() => performance.now());
    const elapsedPresentationMs = observedAt - finishedAt;

    await page.clock.runFor(deathPresentationMs - 1 - elapsedPresentationMs);

    await expect(page.locator("#screen-run")).toBeVisible();
    expect(await gameState.evaluate((element) => ({
      phase: element.getAttribute("data-phase"),
      time: element.getAttribute("data-time"),
      hp: element.getAttribute("data-hp"),
      kills: element.getAttribute("data-kills"),
      gold: element.getAttribute("data-gold"),
    }))).toEqual(finishedState);

    await page.clock.runFor(1);

    await expect(page.locator("#screen-results")).toBeVisible();
  });

  test("keeps fast-mode solo runs immediate for E2E and autoplay flows", async ({ page }) => {
    await page.goto("/?seed=7&fast=1");
    await finishNameOnboarding(page);

    const gameState = page.locator("#game-state");
    await gameState.evaluate((element) => {
      const runScreen = document.querySelector("#screen-run");
      const resultsScreen = document.querySelector("#screen-results");
      new MutationObserver(() => {
        if (element.getAttribute("data-phase") === "finished") {
          element.setAttribute("data-run-hidden-at-finish", String(runScreen?.classList.contains("hidden")));
          element.setAttribute("data-results-visible-at-finish", String(!resultsScreen?.classList.contains("hidden")));
        }
      }).observe(element, { attributes: true, attributeFilter: ["data-phase"] });
    });

    await page.getByTestId("guild-tab-class").click();
    await page.getByTestId("class-mage").click();
    await startSoloFromGuild(page);

    await expect(page.locator("#screen-results")).toBeVisible({ timeout: 15_000 });
    await expect(gameState).toHaveAttribute("data-run-hidden-at-finish", "true");
    await expect(gameState).toHaveAttribute("data-results-visible-at-finish", "true");
  });
});
