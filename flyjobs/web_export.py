"""Export a browser-sized MaleCNS brain for the Fly Office page.

All 166,700 neurons are kept. Connections with fewer than MIN_SYN synapses are
dropped, then each neuron's input is renormalized over what remains, so total
drive per neuron matches the full model.
"""
from __future__ import annotations

import base64
import gzip
import json
from pathlib import Path

import numpy as np
import pyarrow.feather as feather

from .server import viewer_points

MIN_SYN = 10
TYPES = {  # panel rows: label -> annotation types
    "DNg100 · walk forward": ["DNg100"],
    "DNa02 · steer": ["DNa02"],
    "DNg13 · steer": ["DNg13"],
    "LB1a–d · bitter taste": ["LB1a", "LB1b", "LB1c", "LB1d"],
    "LB3c · sugar taste": ["LB3c"],
    "JO-B · hearing": ["JO-B"],
    "PAM · reward dopamine": ["PAM*"],
    "MBONs · mushroom body output": ["MBON*"],
    "LC10a · visual": ["LC10a"],
}


def export(cache: Path = Path("data"), out: Path = Path("web/office/data")) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    m = np.load(cache / "model.npz", allow_pickle=False)
    ids = m["ids"]; n = len(ids)
    ann = feather.read_table(cache / "raw/annotations.feather").to_pandas()
    ann = ann.loc[ann["superclass"].notna() & ann["superclass"].ne("")].drop_duplicates("bodyId").set_index("bodyId").reindex(ids)
    nt = feather.read_table(cache / "raw/transmitters.feather", columns=["body", "consensus_nt"]).to_pandas()
    nt = nt.drop_duplicates("body").set_index("body").reindex(ids)
    sign = np.where(nt["consensus_nt"].fillna("unclear").astype(str).str.lower().str.contains("gaba|glutamate|histamine"), -1, 1).astype(np.int8)

    t = feather.read_table(cache / "raw/weights.feather", columns=["body_pre", "body_post", "weight"], memory_map=True)
    pres, posts, ws = [], [], []
    for b in t.to_batches(max_chunksize=4_000_000):
        w = b.column(2).to_numpy(zero_copy_only=False)
        keep = w >= MIN_SYN
        pid = b.column(0).to_numpy(zero_copy_only=False)[keep]; qid = b.column(1).to_numpy(zero_copy_only=False)[keep]
        p = np.searchsorted(ids, pid); q = np.searchsorted(ids, qid)
        ok = (p < n) & (q < n)
        ok &= ids[np.minimum(p, n - 1)] == pid
        ok &= ids[np.minimum(q, n - 1)] == qid
        pres.append(p[ok].astype(np.int32)); posts.append(q[ok].astype(np.int32)); ws.append(w[keep][ok].astype(np.float32))
    pre = np.concatenate(pres); post = np.concatenate(posts); w = np.concatenate(ws) * sign[pre]
    incoming = np.bincount(post, weights=np.abs(w), minlength=n)
    w = w / np.maximum(incoming[post], 1.0)
    order = np.lexsort((post, pre))           # CSR by presynaptic cell: a spike walks its outgoing row
    pre, post, w = pre[order], post[order], w[order]
    indptr = np.zeros(n + 1, np.uint32); np.cumsum(np.bincount(pre, minlength=n), out=indptr[1:])
    wq = np.clip(np.round(w * 32767), -32767, 32767).astype(np.int16)   # |w| <= 1 after normalization
    for old in out.glob("*.bin"):
        old.unlink()
    packed = {}

    def pack(name, arr):
        # artifacts only serve web types, so binary data ships as gzip inside base64 text
        txt = base64.b64encode(gzip.compress(np.ascontiguousarray(arr).tobytes(), 9, mtime=0))
        (out / f"{name}.b64.txt").write_bytes(txt)
        packed[name] = len(txt)

    pack("indptr", indptr); pack("indices", post.astype(np.uint32)); pack("weights", wq)

    buf, meta = viewer_points(cache)
    pos = np.frombuffer(buf[:n * 12], np.float32).reshape(n, 3)
    kind = np.frombuffer(buf[n * 12:n * 13], np.uint8)
    vis = kind != 255
    lo, hi = pos[vis].min(0), pos[vis].max(0)
    q = np.zeros((n, 3), np.uint16)
    q[vis] = np.round((pos[vis] - lo) / (hi - lo) * 65535)
    pack("positions", q); pack("kind", kind)

    ctype = m["ctype"]; mtype = ann["type"].fillna("").astype(str).to_numpy()
    groups = {}
    def select(types):
        mask = np.zeros(n, bool)
        for t in types:
            if t.endswith("*"):  # prefix match, e.g. every PAM type
                mask |= np.char.startswith(ctype.astype(str), t[:-1]) | np.char.startswith(mtype.astype(str), t[:-1])
            else:
                mask |= (ctype == t) | (mtype == t)
        return np.flatnonzero(mask)

    for label, types in TYPES.items():
        sel = select(types)
        if len(sel):
            groups[label] = sel.tolist()
    jo = np.flatnonzero(np.char.startswith(mtype.astype(str), "JO-B"))
    dopamine = np.flatnonzero(nt["consensus_nt"].fillna("").astype(str).str.lower().eq("dopamine").to_numpy())
    pam = select(["PAM*"])
    manifest = dict(
        dataset="MaleCNS v1.0", neurons=int(n), edges=int(len(post)), min_synapses=MIN_SYN,
        synapse_share=None, bounds=[lo.tolist(), hi.tolist()],
        pins=dict(apply=m["apply"].tolist(), scroll_l=m["scroll_l"].tolist(), scroll_r=m["scroll_r"].tolist(),
                  sugar=m["sugar"].tolist(), bitter=m["bitter"].tolist(), hearing=jo.tolist(),
                  dopamine=dopamine.tolist(), pam=pam.tolist()),
        groups=groups, packed=packed,
    )
    (out / "manifest.json").write_text(json.dumps(manifest))
    sizes = {p.name: p.stat().st_size for p in out.iterdir()}
    print(f"{n:,} neurons, {len(post):,} edges (>= {MIN_SYN} synapses)", sizes)
    return manifest


if __name__ == "__main__":
    export()
