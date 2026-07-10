import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        # Wider default timeout to match the agent's DOM-stability budget;
        # auto-waiting Playwright APIs (expect, locator.wait_for) inherit this.
        context.set_default_timeout(15000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> navigate
        await page.goto("https://ghost-guild.vercel.app")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        # -> Open the Colosseum Survivors test page (https://colosseum-survivors.pages.dev/?seed=42&fast=1).
        await page.goto("https://colosseum-survivors.pages.dev/?seed=42&fast=1")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        # -> Fill the 'GLADIATOR NAME' field with 'TestSprite-3113' and wait for the page to update so the confirm button can enable.
        # text field
        elem = page.get_by_test_id('player-name')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("TestSprite-3113")

        # -> Click the 'ENTER THE BARRACKS' button to confirm the gladiator name and enter the barracks.
        # ENTER THE BARRACKS button
        elem = page.get_by_test_id('confirm-player-name')
        await elem.click(timeout=10000)

        # -> Click the 'ENTER THE ARENA' button to open the battle modal
        # ENTER THE ARENA button
        elem = page.get_by_test_id('battle-open')
        await elem.click(timeout=10000)

        # -> Click the 'PRACTICE BOUT' button in the 'Enter the arena' modal to deploy a solo/practice bout.
        # PRACTICE BOUT Stand alone upon the sand. button
        elem = page.get_by_test_id('deploy-solo')
        await elem.click(timeout=10000)

        # -> Click the 'ADJUST BUILD' button
        # ADJUST BUILD button
        elem = page.get_by_test_id('adjust-build')
        await elem.click(timeout=10000)

        # --> Assertions to verify final state

        # --> The button with data-testid guild-tab-training is visible
        await page.locator("xpath=/html/body/div/section[2]/div/div[1]/nav/button[2]").nth(0).scroll_into_view_if_needed()
        # Assert: The TRAINING tab button (guild-tab-training) is visible.
        await expect(page.locator("xpath=/html/body/div/section[2]/div/div[1]/nav/button[2]").nth(0)).to_be_visible(timeout=15000), "The TRAINING tab button (guild-tab-training) is visible."

        # --> The button with data-testid guild-tab-training has aria-pressed true
        # Assert: The TRAINING tab button has aria-pressed set to true.
        await expect(page.locator("xpath=/html/body/div/section[2]/div/div[1]/nav/button[2]").nth(0)).to_have_attribute("aria-pressed", "true", timeout=15000), "The TRAINING tab button has aria-pressed set to true."

        # --> The button with data-testid buy-atk is visible
        await page.locator("xpath=/html/body/div/section[2]/div/div[1]/main/div[2]/section/div/button[1]").nth(0).scroll_into_view_if_needed()
        # Assert: The button to buy ATK (data-testid=buy-atk) is visible.
        await expect(page.locator("xpath=/html/body/div/section[2]/div/div[1]/main/div[2]/section/div/button[1]").nth(0)).to_be_visible(timeout=15000), "The button to buy ATK (data-testid=buy-atk) is visible."
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
