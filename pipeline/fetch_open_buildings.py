"""Stream Google Open Buildings V3 (points) for the two S2 tiles that cover Bakool and keep
only the buildings inside the region's box, so 2 to 4 GB of download becomes a few MB on disk.

    python pipeline/fetch_open_buildings.py [--bbox 3.1 42.9 4.9 44.8] [--tiles 17d 17f]

Source: Google Research, Open Buildings V3 (inference on satellite imagery, May 2023),
https://sites.research.google/gr/open-buildings/ ; files
https://storage.googleapis.com/open-buildings-data/v3/points_s2_level_4_gzip/<tile>_buildings.csv.gz
(S2 level-4 tiles; 17d spans lat 3.58-8.18, lon 39.98-45.00 and 17f lat 0-3.88, lon 39.98-45.00,
so both are needed for Bakool). Licence: CC BY 4.0 or ODbL 1.0, user's choice; we cite CC BY 4.0.
Columns: latitude, longitude, area_in_meters, confidence (0.65-1.0), full_plus_code.

Output: pipeline/raw/open_buildings_bakool.csv with the same columns plus the tile, and a
.meta.json with counts. Nothing is modelled here: this is a filter. Run from a normal connection;
each tile is up to 2.1 GB and streams in 10 to 40 minutes depending on the line.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import io
import json
import time
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "pipeline" / "raw"
URL = "https://storage.googleapis.com/open-buildings-data/v3/points_s2_level_4_gzip/{tile}_buildings.csv.gz"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bbox", nargs=4, type=float, default=[3.1, 42.9, 4.9, 44.8], metavar=("SOUTH", "WEST", "NORTH", "EAST"))
    ap.add_argument("--tiles", nargs="+", default=["17d", "17f"])
    ap.add_argument("--out", default=str(RAW / "open_buildings_bakool.csv"))
    args = ap.parse_args()
    south, west, north, east = args.bbox
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    meta = {"source": "Google Open Buildings V3 points", "licence": "CC BY 4.0", "bbox": args.bbox, "tiles": {}, "kept": 0}
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["latitude", "longitude", "area_in_meters", "confidence", "full_plus_code", "tile"])
        for tile in args.tiles:
            url = URL.format(tile=tile)
            print(f"[{tile}] streaming {url}")
            t0 = time.time()
            seen = kept = 0
            req = Request(url, headers={"User-Agent": "geo-health-somalia/0.1"})
            with urlopen(req, timeout=600) as r:
                gz = gzip.GzipFile(fileobj=r)
                reader = csv.reader(io.TextIOWrapper(gz, encoding="utf-8", newline=""))
                header = next(reader)
                col = {name: i for i, name in enumerate(header)}
                ilat, ilon = col["latitude"], col["longitude"]
                iarea, iconf, iplus = col["area_in_meters"], col["confidence"], col.get("full_plus_code")
                for row in reader:
                    seen += 1
                    try:
                        lat = float(row[ilat])
                        lon = float(row[ilon])
                    except (ValueError, IndexError):
                        continue
                    if south <= lat <= north and west <= lon <= east:
                        w.writerow([row[ilat], row[ilon], row[iarea], row[iconf], row[iplus] if iplus is not None else "", tile])
                        kept += 1
                    if seen % 2_000_000 == 0:
                        print(f"  {seen:,} rows read, {kept:,} kept, {time.time()-t0:,.0f} s")
            meta["tiles"][tile] = {"rows_read": seen, "rows_kept": kept, "seconds": round(time.time() - t0)}
            meta["kept"] += kept
            print(f"[{tile}] done: {seen:,} rows read, {kept:,} in the box, {time.time()-t0:,.0f} s")
    Path(str(out) + ".meta.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    print(f"\nwrote {out} ({meta['kept']:,} buildings) and {out.name}.meta.json")


if __name__ == "__main__":
    main()
