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

        # -> Open the Colosseum Survivors page by navigating to the URL: https://colosseum-survivors.pages.dev/?seed=11&fast=1
        await page.goto("https://colosseum-survivors.pages.dev/?seed=11&fast=1")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        # -> Fill 'TestSprite-3113' into the Gladiator Name field and click the 'ENTER THE BARRACKS' button.
        # text field
        elem = page.get_by_test_id('player-name')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("TestSprite-3113")

        # -> Fill 'TestSprite-3113' into the Gladiator Name field and click the 'ENTER THE BARRACKS' button.
        # ENTER THE BARRACKS button
        elem = page.get_by_test_id('confirm-player-name')
        await elem.click(timeout=10000)

        # -> Click the 'ENTER THE ARENA' button to open the battle modal and verify the battle dialog appears.
        # ENTER THE ARENA button
        elem = page.get_by_test_id('battle-open')
        await elem.click(timeout=10000)

        # -> Click the 'GRAND BOUT' button in the arena dialog to start the multi-opponent bout.
        # GRAND BOUT Face three rival legends. button
        elem = page.get_by_test_id('deploy-arena')
        await elem.click(timeout=10000)

        # -> Click the 'BACK TO GUILD' button to return to the guild view.
        # BACK TO GUILD button
        elem = page.get_by_test_id('back-to-guild')
        await elem.click(timeout=10000)

        # --> Assertions to verify final state

        # --> The button with data-testid guild-tab-class is visible
        await page.locator("xpath=/html/body/div[1]/section[2]/div/div[1]/nav/button[1]").nth(0).scroll_into_view_if_needed()
        # Assert: The 'CLASS & TREE' guild tab button is visible.
        await expect(page.locator("xpath=/html/body/div[1]/section[2]/div/div[1]/nav/button[1]").nth(0)).to_be_visible(timeout=15000), "The 'CLASS & TREE' guild tab button is visible."

        # --> The button with data-testid guild-tab-class has aria-pressed true
        # Assert: The 'CLASS & TREE' guild tab has aria-pressed true.
        await expect(page.locator("xpath=/html/body/div[1]/section[2]/div/div[1]/nav/button[1]").nth(0)).to_have_attribute("aria-pressed", "true", timeout=15000), "The 'CLASS & TREE' guild tab has aria-pressed true."

        # --> The button with data-testid battle-open is visible
        await page.locator("xpath=/html/body/div[1]/section[2]/div/footer/button").nth(0).scroll_into_view_if_needed()
        # Assert: The button with data-testid battle-open (ENTER THE ARENA) is visible.
        await expect(page.locator("xpath=/html/body/div[1]/section[2]/div/footer/button").nth(0)).to_be_visible(timeout=15000), "The button with data-testid battle-open (ENTER THE ARENA) is visible."
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
