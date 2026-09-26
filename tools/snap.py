"""Headless snapshots of each studio shot, for framing work: python tools/snap.py [shots...]"""
import asyncio, sys
from playwright.async_api import async_playwright

async def main(shots):
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=["--use-angle=metal", "--ignore-gpu-blocklist"])
        ctx = await b.new_context(viewport={"width": 540, "height": 960}, device_scale_factor=1)
        for s in shots:
            p = await ctx.new_page()
            await p.goto(f"http://127.0.0.1:8765/studio.html?rec=1&shot={s}")
            await p.wait_for_function("window.__studio && window.__studio.ready")
            await p.wait_for_timeout(4000)
            fps = await p.evaluate("window.__studio.fps")
            await p.screenshot(path=f"out/frames/shot_{s}.png")
            print(s, "fps", round(fps, 1))
            await p.close()
        await b.close()

asyncio.run(main(sys.argv[1:] or ["desk", "screen", "brain"]))
