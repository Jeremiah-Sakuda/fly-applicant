"""Check the simulation keeps real time, with and without the 3D viewer attached."""
import asyncio, time
from pathlib import Path
from playwright.async_api import async_playwright
from flyjobs.server import FlyServer

async def main():
    srv = FlyServer(Path("data")); await srv.start(8766)
    await asyncio.sleep(1)
    t0 = time.time(); s0 = srv.brain.steps
    await asyncio.sleep(6)
    print("no viewer:   sim/wall", round((srv.brain.steps - s0) * 0.02 / (time.time() - t0), 2), flush=True)
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=["--use-angle=metal"])
        p = await b.new_page(viewport={"width": 540, "height": 960}, device_scale_factor=2)
        await p.goto("http://127.0.0.1:8766/studio.html?rec=1")
        await p.wait_for_function("window.__studio && window.__studio.ready")
        t0 = time.time(); s0 = srv.brain.steps
        await asyncio.sleep(6)
        print("with viewer: sim/wall", round((srv.brain.steps - s0) * 0.02 / (time.time() - t0), 2), "fps", round(await p.evaluate("window.__studio.fps"), 1), flush=True)
        await b.close()
    srv.stop_flag.set()

asyncio.run(main())
