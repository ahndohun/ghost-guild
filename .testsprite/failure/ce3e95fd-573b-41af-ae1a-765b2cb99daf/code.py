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
        
        # -> Click the 'PRESS START' button on the central dialog.
        # PRESS START button
        elem = page.get_by_test_id('start-game')
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> The guild screen shows all five class choices
        # Assert: Expected the Mage class choice to not be visible.
        await expect(page.locator("xpath=/html/body/div[1]/section[2]/div/main/section[1]/div/button[6]").nth(0)).not_to_be_visible(timeout=15000), "Expected the Mage class choice to not be visible."
        # Assert: Expected the Priest class choice to not be visible.
        await expect(page.locator("xpath=/html/body/div[1]/section[2]/div/main/section[1]/div/button[7]").nth(0)).not_to_be_visible(timeout=15000), "Expected the Priest class choice to not be visible."
        # Assert: Expected the Warlock class choice to not be visible.
        await expect(page.locator("xpath=/html/body/div[1]/section[2]/div/main/section[1]/div/button[8]").nth(0)).not_to_be_visible(timeout=15000), "Expected the Warlock class choice to not be visible."
        # Assert: Expected the Elf class choice to not be visible.
        await expect(page.locator("xpath=/html/body/div[1]/section[2]/div/main/section[1]/div/button[9]").nth(0)).not_to_be_visible(timeout=15000), "Expected the Elf class choice to not be visible."
        # Assert: Expected the Thief class choice to not be visible.
        await expect(page.locator("xpath=/html/body/div[1]/section[2]/div/main/section[1]/div/button[10]").nth(0)).not_to_be_visible(timeout=15000), "Expected the Thief class choice to not be visible."
        # Assert: Expected the Monk class choice to not be visible.
        await expect(page.locator("xpath=/html/body/div[1]/section[2]/div/main/section[1]/div/button[11]").nth(0)).not_to_be_visible(timeout=15000), "Expected the Monk class choice to not be visible."
        
        # --> The guild screen shows a class specialization tree
        # Assert: Expected the class specialization node "T1A Bulwark" to be expanded (aria-pressed="true").
        await expect(page.locator("xpath=/html/body/div[1]/section[2]/div/main/section[3]/div/button[1]").nth(0)).to_have_attribute("aria-pressed", "true", timeout=15000), "Expected the class specialization node \"T1A Bulwark\" to be expanded (aria-pressed=\"true\")."
        # Assert: Expected the class specialization node "T5A Immovable" to be expanded (aria-pressed="true").
        await expect(page.locator("xpath=/html/body/div[1]/section[2]/div/main/section[3]/div/button[9]").nth(0)).to_have_attribute("aria-pressed", "true", timeout=15000), "Expected the class specialization node \"T5A Immovable\" to be expanded (aria-pressed=\"true\")."
        # Assert: The guild screen has no standalone temperament choices
        assert False, "Expected: The guild screen has no standalone temperament choices (could not be verified on the page)"
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    