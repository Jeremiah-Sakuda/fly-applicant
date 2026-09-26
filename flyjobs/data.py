"""Download MaleCNS v1.0 and compile it into arrays the simulator and viewer use.

Data prep follows the approach in github.com/ornata/fly (Fly64): all neurons with
a superclass annotation, raw synapse counts signed by consensus neurotransmitter,
normalized by each neuron's total absolute input.
"""
from __future__ import annotations

import argparse
import json
import struct
import subprocess
import urllib.request
from pathlib import Path

import numpy as np
import pyarrow.feather as feather
from scipy import sparse

BUCKET = "https://storage.googleapis.com/flyem-male-cns"
FLAT = f"{BUCKET}/v1.0/connectome-data/flat-connectome"
FILES = {
    "annotations.feather": f"{FLAT}/body-annotations-male-cns-v1.0-minconf-0.5.feather",
    "transmitters.feather": f"{FLAT}/body-neurotransmitters-male-cns-v1.0.feather",
    "weights.feather": f"{FLAT}/connectome-weights-male-cns-v1.0-minconf-0.5.feather",
}
SKELETONS = f"{BUCKET}/v1.0/segmentation/skeletons-malecns/skeletons-precomputed"

# Pins. Sensory identities from the 2026 gustatory connectome (Cell), which matched
# Gr64f-GAL4 lbGRNs to LB3b-c and Gr33a-GAL4 lbGRNs to LB1a-d. LB3b is shared with
# low-salt cells, so only LB3c is used for sugar.
APPLY_TYPES = ["DNg100"]            # forward walking command -> click the primary button
SCROLL_TYPES = ["DNa02", "DNg13"]   # steering descending neurons -> scroll the feed
SUGAR_TYPES = ["LB3c"]              # Gr64f sugar GRNs <- interview
BITTER_TYPES = ["LB1a", "LB1b", "LB1c", "LB1d"]  # Gr33a bitter GRNs <- rejection

# Viewer point classes
K_OTHER, K_OPTIC, K_VNC, K_SUGAR, K_BITTER, K_APPLY, K_SCROLL, K_DN = range(8)


def download(url: str, dest: Path) -> None:
    if dest.exists():
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_suffix(dest.suffix + ".part")
    print(f"downloading {url}")
    subprocess.run(["curl", "--fail", "--location", "--continue-at", "-", "--output", str(part), url], check=True)
    part.replace(dest)


def read_skeleton(raw: bytes) -> tuple[np.ndarray, np.ndarray]:
    """Neuroglancer precomputed skeleton: nv, ne, float32 verts, uint32 edges."""
    nv, ne = struct.unpack_from("<II", raw, 0)
    verts = np.frombuffer(raw, "<f4", nv * 3, 8).reshape(nv, 3)
    edges = np.frombuffer(raw, "<u4", ne * 2, 8 + nv * 12).reshape(ne, 2)
    return verts.copy(), edges.copy()


def skeleton_polylines(verts: np.ndarray, edges: np.ndarray, root: np.ndarray, min_len: int = 6) -> list[np.ndarray]:
    """Split a skeleton tree into polylines, starting from the vertex nearest the soma."""
    n = len(verts)
    adj: list[list[int]] = [[] for _ in range(n)]
    for a, b in edges:
        adj[a].append(int(b)); adj[b].append(int(a))
    start = int(np.argmin(((verts - root) ** 2).sum(1)))
    seen = np.zeros(n, bool)
    lines: list[list[int]] = []
    stack = [(start, [start])]
    seen[start] = True
    while stack:
        node, path = stack.pop()
        nxt = [m for m in adj[node] if not seen[m]]
        if not nxt:
            lines.append(path); continue
        for i, m in enumerate(nxt):
            seen[m] = True
            stack.append((m, path + [m] if i == 0 else [node, m]))
    return [verts[l] for l in lines if len(l) >= min_len]


def fetch_skeletons(cache: Path, ids, pos, measured, groups: dict) -> None:
    """Traced skeletons for the pinned neurons, for the viewer. Vertices converted to 8 nm voxels."""
    from concurrent.futures import ThreadPoolExecutor

    def get(idx):
        body = int(ids[idx])
        with urllib.request.urlopen(f"{SKELETONS}/{body}", timeout=60) as r:
            v, e = read_skeleton(r.read())
        v = v / 8.0
        root = pos[idx] if measured[idx] else v[0]
        return str(body), [l.round(1).tolist() for l in skeleton_polylines(v, e, root, min_len=2)]

    out = {}
    with ThreadPoolExecutor(8) as ex:
        for g, idxs in groups.items():
            out[g] = dict(ex.map(get, [int(i) for i in idxs]))
            nv = sum(len(b) for br in out[g].values() for b in br)
            print(f"skeletons {g}: {len(idxs)} neurons, {nv:,} vertices")
    (cache / "skeletons.json").write_text(json.dumps(out))


def prepare(cache: Path) -> None:
    raw = cache / "raw"
    for name, url in FILES.items():
        download(url, raw / name)

    ann = feather.read_table(raw / "annotations.feather").to_pandas()
    ann = ann.loc[ann["superclass"].notna() & ann["superclass"].ne("")]
    ids = np.sort(ann["bodyId"].drop_duplicates().to_numpy(np.int64))
    if len(ids) != 166_700:
        raise RuntimeError(f"unexpected MaleCNS neuron count {len(ids)}")
    ann = ann.drop_duplicates("bodyId").set_index("bodyId").reindex(ids)

    nt = feather.read_table(raw / "transmitters.feather", columns=["body", "consensus_nt"]).to_pandas()
    nt = nt.drop_duplicates("body").set_index("body").reindex(ids)
    labels = nt["consensus_nt"].fillna("unclear").astype(str).str.lower()
    sign = np.where(labels.str.contains("gaba|glutamate|histamine", regex=True), -1.0, 1.0).astype(np.float32)

    table = feather.read_table(raw / "weights.feather", columns=["body_pre", "body_post", "weight"], memory_map=True)
    pres, posts, ws = [], [], []
    for i, batch in enumerate(table.to_batches(max_chunksize=4_000_000), 1):
        pid = batch.column(0).to_numpy(zero_copy_only=False).astype(np.int64, copy=False)
        qid = batch.column(1).to_numpy(zero_copy_only=False).astype(np.int64, copy=False)
        p = np.searchsorted(ids, pid); q = np.searchsorted(ids, qid)
        ok = (p < len(ids)) & (q < len(ids))
        ok &= ids[np.minimum(p, len(ids) - 1)] == pid
        ok &= ids[np.minimum(q, len(ids) - 1)] == qid
        p = p[ok].astype(np.int32); q = q[ok].astype(np.int32)
        w = batch.column(2).to_numpy(zero_copy_only=False)[ok].astype(np.float32) * sign[p]
        pres.append(p); posts.append(q); ws.append(w)
        if i % 5 == 0:
            print(f"mapped {min(i * 4_000_000, table.num_rows):,} / {table.num_rows:,} edges")
    del table
    pre = np.concatenate(pres); post = np.concatenate(posts); w = np.concatenate(ws)
    del pres, posts, ws
    incoming = np.bincount(post, weights=np.abs(w), minlength=len(ids)).astype(np.float32)
    w /= np.maximum(incoming[post], 1.0)
    # CSC with columns = presynaptic cells: a spike in column j adds column j to V.
    mat = sparse.csc_matrix((w, (post, pre)), shape=(len(ids), len(ids)), dtype=np.float32)
    del pre, post, w
    sparse.save_npz(cache / "weights.npz", mat, compressed=False)

    ctype = ann["flywireType"].fillna(ann["type"]).fillna("").astype(str)
    mtype = ann["type"].fillna("").astype(str)

    def pick(types):
        return np.flatnonzero((ctype.isin(types) | mtype.isin(types)).to_numpy()).astype(np.int32)

    apply_ = pick(APPLY_TYPES); scroll = pick(SCROLL_TYPES)
    sugar = np.flatnonzero(mtype.isin(SUGAR_TYPES).to_numpy()).astype(np.int32)
    bitter = np.flatnonzero(mtype.isin(BITTER_TYPES).to_numpy()).astype(np.int32)
    side = ann["somaSide"].fillna(ann["rootSide"]).fillna("").astype(str).str.upper().to_numpy()
    scroll_l = scroll[side[scroll] == "L"]; scroll_r = scroll[side[scroll] == "R"]
    for name, arr in [("apply", apply_), ("scroll_l", scroll_l), ("scroll_r", scroll_r), ("sugar", sugar), ("bitter", bitter)]:
        if len(arr) == 0:
            raise RuntimeError(f"pin {name} resolved to zero neurons")
        print(f"pin {name}: {len(arr)} neurons")

    # Real soma positions (8 nm voxels). Missing somas fall back to the tosoma point.
    pos = np.full((len(ids), 3), np.nan, np.float32)
    for i, (s, t) in enumerate(zip(ann["somaLocation"], ann["tosomaLocation"])):
        loc = s if isinstance(s, (list, np.ndarray)) and len(s) == 3 else t
        if isinstance(loc, (list, np.ndarray)) and len(loc) == 3:
            pos[i] = loc
    measured = ~np.isnan(pos[:, 0])

    sc = ann["superclass"].astype(str).to_numpy()
    kind = np.full(len(ids), K_OTHER, np.uint8)
    kind[np.char.startswith(sc.astype(str), "ol_") | np.char.startswith(sc.astype(str), "visual")] = K_OPTIC
    kind[np.char.startswith(sc.astype(str), "vnc_")] = K_VNC
    kind[np.char.find(sc.astype(str), "descending") >= 0] = K_DN
    kind[sugar] = K_SUGAR; kind[bitter] = K_BITTER; kind[scroll] = K_SCROLL; kind[apply_] = K_APPLY

    fetch_skeletons(cache, ids, pos, measured, dict(apply=apply_, sugar=sugar, bitter=bitter))

    np.savez_compressed(
        cache / "model.npz", ids=ids, apply=apply_, scroll_l=scroll_l, scroll_r=scroll_r,
        sugar=sugar, bitter=bitter, positions=pos, measured=measured, kind=kind,
        superclass=sc.astype("U32"), ctype=ctype.to_numpy().astype("U40"),
    )
    manifest = dict(
        dataset="MaleCNS v1.0", neurons=int(len(ids)), edges=int(mat.nnz),
        measured_positions=int(measured.sum()),
        pins={k: [int(ids[i]) for i in v] for k, v in
              dict(apply=apply_, scroll_l=scroll_l, scroll_r=scroll_r, sugar=sugar, bitter=bitter).items()},
        pin_types=dict(apply=APPLY_TYPES, scroll=SCROLL_TYPES, sugar=SUGAR_TYPES, bitter=BITTER_TYPES),
        sources=FILES,
    )
    (cache / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"prepared {len(ids):,} neurons, {mat.nnz:,} edges -> {cache}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", type=Path, default=Path("data"))
    prepare(ap.parse_args().cache)


if __name__ == "__main__":
    main()
