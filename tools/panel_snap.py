import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=["--use-angle=metal"])
        p = await b.new_page(viewport={"width": 1440, "height": 900})
        await p.goto("http://127.0.0.1:8777/office/index.html")
        await p.wait_for_function("window.__office && window.__office.B.ready", timeout=90_000)
        await p.wait_for_timeout(4000)
        await p.locator("#panel").screenshot(path="out/panel.png")
        await b.close()
asyncio.run(main())
