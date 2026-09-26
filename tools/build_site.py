"""Build a standalone static site from web/office into dist/fly-office (deployable to any static host)."""
import re, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "web/office", ROOT / "dist/fly-office"

page = (SRC / "index.html").read_text()
page = re.sub(r'^<meta charset="utf-8">\n', "", page)
title = re.search(r"<title>(.*?)</title>", page).group(1)
head_end = page.index("<canvas")
head, body = page[:head_end], page[head_end:]
desc = "A cartoon fruit fly driven by a real 166,700-neuron connectome, simulated in your browser, applies to jobs forever."
doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="description" content="{desc}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta name="theme-color" content="#07080c">
{head.strip()}
</head>
<body>
{body.strip()}
</body>
</html>
"""
# clear old build output but keep .vercel, which links this folder to the deployed project
if OUT.exists():
    for item in OUT.iterdir():
        if item.name != ".vercel":
            shutil.rmtree(item) if item.is_dir() else item.unlink()
(OUT / "data").mkdir(parents=True, exist_ok=True)
(OUT / "index.html").write_text(doc)
for f in SRC.glob("*.js"):  # every script the page loads
    shutil.copy(f, OUT / f.name)
for f in (SRC / "data").iterdir():
    shutil.copy(f, OUT / "data" / f.name)
(OUT / "vercel.json").write_text('{\n  "headers": [{ "source": "/data/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=604800, immutable" }] }]\n}\n')
size = sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file())
print(f"built {OUT} · {size / 1e6:.1f} MB")
