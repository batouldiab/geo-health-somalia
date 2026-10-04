"""Download the open inputs for the Bakool health-access layers into pipeline/raw/.

    python pipeline/fetch_sources.py [--raw DIR] [--skip-large] [--only KEY,KEY]

Reads pipeline/sources.yaml. Direct URLs (WorldCover, WorldPop, figshare, SWALIM
WFS, Overpass) are fetched here. HDX resources sit behind the dataset page and
HDX refuses some automated clients: when a download fails the script prints the
dataset page so the file can be saved by hand into pipeline/raw/ under the name
listed in sources.yaml. Nothing is generated or filled in; every file is the
publisher's own.

Run it from a normal internet connection (the Cowork VM has no network).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from urllib.request import Request, urlopen

try:
    import yaml  # PyYAML, in requirements.txt
except ImportError:  # pragma: no cover
    sys.exit("pip install pyyaml")

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "pipeline" / "sources.yaml"
UA = "geo-health-somalia/0.1 (hackathon pipeline; contact via repository)"


def _get(url: str, dest: Path, data: bytes | None = None) -> bool:
    req = Request(url, data=data, headers={"User-Agent": UA})
    try:
        with urlopen(req, timeout=300) as r, open(dest, "wb") as f:
            total = 0
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                f.write(chunk)
                total += len(chunk)
        print(f"  ok  {dest.name}  {total/1e6:.1f} MB")
        return True
    except Exception as exc:  # noqa: BLE001 - report and carry on
        print(f"  FAILED {dest.name}: {exc}")
        if dest.exists():
            dest.unlink()
        return False


def _sha(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default=str(ROOT / "pipeline" / "raw"))
    ap.add_argument("--skip-large", action="store_true", help="skip files over 50 MB (WorldCover, MAP, Esri)")
    ap.add_argument("--only", default="", help="comma-separated source keys")
    args = ap.parse_args()

    raw = Path(args.raw)
    raw.mkdir(parents=True, exist_ok=True)
    spec = yaml.safe_load(SOURCES.read_text(encoding="utf-8"))
    bbox = spec["bbox_bakool"]
    only = {k for k in args.only.split(",") if k}
    manifest: dict[str, dict] = {}
    by_hand: list[tuple[str, str, str]] = []

    for key, src in spec["sources"].items():
        if only and key not in only:
            continue
        print(f"\n[{key}] {src.get('title', '')}")
        files = src.get("files", [])

        # --- direct single-file downloads -------------------------------------
        if "download" in src and files:
            dest = raw / files[0]["name"]
            big = files[0].get("size_bytes", 0) > 50e6
            if args.skip_large and big:
                print("  skipped (large)")
            elif dest.exists():
                print(f"  present {dest.name}")
            elif not _get(src["download"], dest):
                by_hand.append((key, src.get("page", src["download"]), dest.name))

        # --- MAP: two global rasters, served as a ZIP holding one .geotiff ---------
        elif "downloads" in src:
            for mode, url in src["downloads"].items():
                dest = raw / f"map_2020_{mode}_travel_time.zip"
                have = [p for p in (dest, raw / f"map_2020_{mode}_travel_time.tif",
                                    raw / f"2020_{'walking_only' if mode == 'walking' else mode}_travel_time_to_healthcare.geotiff")
                        if p.exists()]
                if have:
                    print(f"  present {have[0].name}")
                    continue
                if args.skip_large:
                    print(f"  skipped (large) {dest.name}; export the Bakool window from GEE instead")
                    continue
                if not _get(url, dest):
                    by_hand.append((key, src["page"], dest.name))

        # --- Esri yearly tiles (optional) --------------------------------------
        elif "download_template" in src:
            if args.skip_large:
                print("  skipped (optional, large)")
            else:
                for year in src["years"]:
                    dest = raw / f"io_lulc_38N_{year}.tif"
                    if not dest.exists():
                        _get(src["download_template"].format(year=year), dest)

        # --- SWALIM WFS with bbox (optional) -----------------------------------
        elif "wfs_template" in src:
            dest = raw / "swalim_cultivated_2025_bakool.geojson"
            url = src["wfs_template"].format(**bbox)
            if not dest.exists():
                _get(url, dest)

        # --- Overpass -----------------------------------------------------------
        elif "endpoint" in src:
            dest = raw / files[0]["name"]
            q = (ROOT / src["query_file"]).read_text(encoding="utf-8").encode("utf-8")
            if not dest.exists() and not _get(src["endpoint"], dest, data=b"data=" + q):
                by_hand.append((key, "https://overpass-turbo.eu (paste pipeline/overpass_bakool.ql, Export > raw JSON)", dest.name))

        # --- HDX page-only resources --------------------------------------------
        elif files:
            for f in files:
                dest = raw / f["name"]
                if dest.exists():
                    print(f"  present {dest.name}")
                else:
                    by_hand.append((key, src.get("page", ""), f["name"]))
                    print(f"  by hand: {f['name']}  <-  {src.get('page', '')}")

        for f in files:
            p = raw / f["name"]
            if p.exists():
                manifest[f["name"]] = {"source": key, "bytes": p.stat().st_size, "sha256": _sha(p)}

    (raw / "MANIFEST.json").write_text(json.dumps(manifest, indent=1, sort_keys=True), encoding="utf-8")
    print(f"\nManifest: {raw / 'MANIFEST.json'} ({len(manifest)} files)")
    if by_hand:
        print("\nSave these in a browser into", raw)
        for key, page, name in by_hand:
            print(f"  {name:45s} {page}   [{key}]")


if __name__ == "__main__":
    main()
