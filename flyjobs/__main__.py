"""python -m flyjobs {prepare|serve|run|cut}"""
from __future__ import annotations

import argparse
import asyncio
from pathlib import Path


def main() -> None:
    ap = argparse.ArgumentParser(prog="flyjobs")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("prepare", help="download MaleCNS v1.0 and compile it")
    p.add_argument("--cache", type=Path, default=Path("data"))
    s = sub.add_parser("serve", help="brain + board + studio, no browser automation")
    s.add_argument("--cache", type=Path, default=Path("data"))
    s.add_argument("--port", type=int, default=8765)
    r = sub.add_parser("run", help="serve and let the fly drive a real browser")
    r.add_argument("--cache", type=Path, default=Path("data"))
    r.add_argument("--port", type=int, default=8765)
    r.add_argument("--target", type=int, default=1000)
    r.add_argument("--interview-at", type=int, default=612)
    r.add_argument("--record", type=Path, help="write a 1080x1920 capture of the studio to this .mp4")
    r.add_argument("--headless", action="store_true")
    r.add_argument("--autostart", action="store_true", help="start applying immediately")
    w = sub.add_parser("export-web", help="write the browser-sized brain for the Fly Office page")
    w.add_argument("--cache", type=Path, default=Path("data"))
    o = sub.add_parser("office", help="serve the Fly Office page (brain runs in the browser)")
    o.add_argument("--port", type=int, default=8780)
    c = sub.add_parser("cut", help="edit a recorded run into the 35 s reel")
    c.add_argument("run", type=Path, help="recording .mp4 (its .events.json must sit beside it)")
    c.add_argument("--out", type=Path, default=Path("out/reel.mp4"))
    c.add_argument("--no-captions", action="store_true", help="skip burned-in captions (add them in your editor)")
    a = ap.parse_args()

    if a.cmd == "prepare":
        from .data import prepare
        prepare(a.cache)
    elif a.cmd == "serve":
        from .server import FlyServer

        async def go():
            srv = FlyServer(a.cache)
            await srv.start(a.port)
            print(f"studio: http://127.0.0.1:{a.port}/studio.html   board: http://127.0.0.1:{a.port}/board.html")
            await asyncio.Event().wait()
        asyncio.run(go())
    elif a.cmd == "run":
        from .driver import run
        asyncio.run(run(a))
    elif a.cmd == "export-web":
        from .web_export import export
        export(a.cache)
    elif a.cmd == "office":
        from aiohttp import web
        root = Path(__file__).resolve().parent.parent / "web"
        app = web.Application()
        app.router.add_get("/", lambda r: web.HTTPFound("/office/index.html"))
        app.router.add_static("/", root)
        print(f"Fly Office: http://127.0.0.1:{a.port}/")
        web.run_app(app, host="127.0.0.1", port=a.port, print=None)
    elif a.cmd == "cut":
        from .cut import cut
        cut(a.run, a.out, captions=not a.no_captions)


if __name__ == "__main__":
    main()
