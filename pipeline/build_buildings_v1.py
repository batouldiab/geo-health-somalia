"""Buildings, settlements and facility plausibility from Google Open Buildings V3 (AI-detected).

    python pipeline/build_buildings_v1.py [--raw DIR] [--out DIR] [--min-conf 0.7]
                                           [--cluster-m 250] [--min-cluster 20] [--near-m 500]

Inputs:  pipeline/raw/open_buildings_bakool.csv   (pipeline/fetch_open_buildings.py)
         data/som_grid_v1.json.gz, data/adm2_bakool_v1.json.gz, data/access10_v1.json.gz,
         data/facilities_v1.json.gz                (earlier pipeline steps)
Outputs: data/buildings10_v1.json.gz   per 10x10 km cell: building count, built area, people per
                                       building (WorldPop 2020 and the platform 2025 grid), and
                                       per district totals
         data/settlements_v1.json.gz   clusters of >= min-cluster buildings (grid clustering at
                                       cluster-m), each with its size, district, the nearest listed
                                       facility (straight line) and the cell's modelled walking time:
                                       the mobile-outreach shortlist is the clusters far from care
         data/facility_checks_v1.json  per listed facility: buildings within near-m metres; a
                                       facility with none is flagged "no buildings detected nearby"

Source: Google Research, Open Buildings V3 (inference on satellite imagery, May 2023),
https://sites.research.google/gr/open-buildings/ , CC BY 4.0. The model's own confidence
score (0.65-1.0) is kept; buildings below --min-conf are counted separately and not used.
Nothing here is modelled by us: counts, areas, distances and components only. Deterministic.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_RAW = ROOT / "pipeline" / "raw"
DEFAULT_OUT = ROOT / "data"


def write_gz(path: Path, obj) -> None:
    raw = json.dumps(obj, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode("utf-8")
    with open(path, "wb") as f:
        with gzip.GzipFile(fileobj=f, mode="wb", mtime=0) as gz:
            gz.write(raw)
    print(f"  wrote {path.name}  {path.stat().st_size/1024:.0f} KB gz")


def load_gz(path: Path):
    with gzip.open(path) as f:
        return json.load(f)


def haversine_km(lon1, lat1, lon2, lat2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default=str(DEFAULT_RAW))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--min-conf", type=float, default=0.7)
    ap.add_argument("--cluster-m", type=float, default=250.0, help="grid size for clustering, metres")
    ap.add_argument("--min-cluster", type=int, default=20, help="buildings for a cluster to count as a settlement")
    ap.add_argument("--near-m", type=float, default=500.0, help="radius for the facility plausibility check, metres")
    args = ap.parse_args()
    raw, out = Path(args.raw), Path(args.out)

    src = raw / "open_buildings_bakool.csv"
    if not src.exists():
        sys.exit(f"{src} not found: run pipeline/fetch_open_buildings.py first")
    meta_in = {}
    mp = Path(str(src) + ".meta.json")
    if mp.exists():
        meta_in = json.loads(mp.read_text(encoding="utf-8"))

    print("buildings")
    lats, lons, areas, confs = [], [], [], []
    with open(src, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            try:
                lats.append(float(row["latitude"]))
                lons.append(float(row["longitude"]))
                areas.append(float(row["area_in_meters"]))
                confs.append(float(row["confidence"]))
            except (ValueError, KeyError):
                continue
    lat = np.array(lats)
    lon = np.array(lons)
    area = np.array(areas)
    conf = np.array(confs)
    ok = conf >= args.min_conf
    print(f"  {len(lat):,} buildings in the box, {ok.sum():,} at confidence >= {args.min_conf}, {(~ok).sum():,} below (not used)")
    lat, lon, area = lat[ok], lon[ok], area[ok]

    grid = load_gz(out / "som_grid_v1.json.gz")
    cd = grid["meta"]["cell_deg"]
    adm2 = load_gz(out / "adm2_bakool_v1.json.gz")
    access = load_gz(out / "access10_v1.json.gz")
    fac = load_gz(out / "facilities_v1.json.gz")
    cell_district = adm2["cell_district"]
    region_cells = set(access["cells"].keys())

    # ---- per 10x10 km cell -------------------------------------------------------------
    col = np.rint(lon / cd).astype(int)
    row = np.rint(lat / cd).astype(int)
    keys = np.char.add(np.char.add(col.astype(str), "_"), row.astype(str))
    cells = {}
    in_region = np.isin(keys, list(region_cells))
    uk, inv = np.unique(keys[in_region], return_inverse=True)
    n_per = np.bincount(inv, minlength=len(uk))
    a_per = np.bincount(inv, weights=area[in_region], minlength=len(uk))
    for i, k in enumerate(uk):
        a = access["cells"].get(k, {})
        n = int(n_per[i])
        cells[k] = {
            "n": n,
            "area_m2": int(round(a_per[i])),
            "district": cell_district.get(k),
            "pop2020c": a.get("pop2020c", 0),
            "pop2025": a.get("pop2025", 0),
            "ppb_2020": round(a.get("pop2020c", 0) / n, 1) if n else None,
            "ppb_2025": round(a.get("pop2025", 0) / n, 1) if n else None,
        }
    inside = int(in_region.sum())
    print(f"  {inside:,} buildings fall in the region's {len(uk)} cells ({len(region_cells)} cells in the region)")

    dist = defaultdict(lambda: {"n": 0, "area_m2": 0, "cells_with_buildings": 0})
    for k, c in cells.items():
        d = dist[c["district"] or "outside ADM2"]
        d["n"] += c["n"]
        d["area_m2"] += c["area_m2"]
        d["cells_with_buildings"] += 1
    # cells with people but no detected building, and the reverse
    pop_no_b = [k for k, a in access["cells"].items() if a.get("pop2020c", 0) > 100 and k not in cells]
    b_no_pop = [k for k, c in cells.items() if c["n"] >= 20 and access["cells"].get(k, {}).get("pop2020c", 0) == 0]

    # ---- settlements: grid clustering ------------------------------------------------
    print("settlements")
    lat0 = float(lat.mean()) if len(lat) else 4.0
    dlat = args.cluster_m / 111_320.0
    dlon = args.cluster_m / (111_320.0 * math.cos(math.radians(lat0)))
    gx = np.floor(lon / dlon).astype(np.int64)
    gy = np.floor(lat / dlat).astype(np.int64)
    occupied = {}
    for i, (x, y) in enumerate(zip(gx, gy)):
        occupied.setdefault((int(x), int(y)), []).append(i)
    # connected components over 8-neighbour occupied fine cells
    comp = {}
    comps = []
    for start in occupied:
        if start in comp:
            continue
        cid = len(comps)
        stack = [start]
        comp[start] = cid
        members = []
        while stack:
            x, y = stack.pop()
            members.append((x, y))
            for ddx in (-1, 0, 1):
                for ddy in (-1, 0, 1):
                    nb = (x + ddx, y + ddy)
                    if nb in occupied and nb not in comp:
                        comp[nb] = cid
                        stack.append(nb)
        comps.append(members)
    listed = [f for f in fac["facilities"] if f.get("source_key") != "osm"]
    settlements = []
    for cid, members in enumerate(comps):
        idx = np.concatenate([occupied[m] for m in members])
        if len(idx) < args.min_cluster:
            continue
        clon, clat = float(lon[idx].mean()), float(lat[idx].mean())
        key = f"{int(round(clon / cd))}_{int(round(clat / cd))}"
        if key not in region_cells:
            continue
        a = access["cells"].get(key, {})
        near = min(listed, key=lambda f: haversine_km(clon, clat, f["lon"], f["lat"]), default=None)
        near_km = round(haversine_km(clon, clat, near["lon"], near["lat"]), 1) if near else None
        settlements.append({
            "id": f"s{cid:05d}",
            "lon": round(clon, 5),
            "lat": round(clat, 5),
            "n": int(len(idx)),
            "area_m2": int(round(float(area[idx].sum()))),
            "cell": key,
            "district": cell_district.get(key),
            "nearest_fac": near["id"] if near else None,
            "nearest_km": near_km,
            "tt_walking_mean": a.get("tt_walking_mean"),
            "builtup_share": (a.get("lc") or {}).get("built", 0.0),
            # the outreach shortlist: no listed facility within 5 km and the cell's modelled walk over an hour
            "far_from_care": bool(near_km is not None and near_km > 5 and (a.get("tt_walking_mean") or 0) > 60),
        })
    settlements.sort(key=lambda s: -s["n"])
    far = [s for s in settlements if s["far_from_care"]]
    print(f"  {len(comps):,} clusters at {args.cluster_m:.0f} m; {len(settlements)} with >= {args.min_cluster} buildings in the region; "
          f"{len(far)} of them more than 5 km from any listed facility and over an hour's walk")

    # ---- facility plausibility: buildings within near-m -------------------------------
    print("facility checks")
    checks = {}
    rad_lat = args.near_m / 111_320.0
    for f in fac["facilities"]:
        rad_lon = args.near_m / (111_320.0 * math.cos(math.radians(f["lat"])))
        m = (np.abs(lat - f["lat"]) <= rad_lat) & (np.abs(lon - f["lon"]) <= rad_lon)
        cand = np.where(m)[0]
        n = 0
        for i in cand:
            if haversine_km(f["lon"], f["lat"], float(lon[i]), float(lat[i])) * 1000 <= args.near_m:
                n += 1
        checks[f["id"]] = {"buildings_within_m": int(n), "radius_m": args.near_m, "flag": "no buildings detected nearby" if n == 0 else None}
    none = sum(1 for c in checks.values() if c["buildings_within_m"] == 0)
    print(f"  {len(checks)} facilities checked; {none} have no detected building within {args.near_m:.0f} m")

    meta = {
        "region": access["meta"]["region"],
        "cell_deg": cd,
        "source": "Google Open Buildings V3 (points), inference May 2023, CC BY 4.0",
        "source_url": "https://sites.research.google/gr/open-buildings/",
        "tiles": list((meta_in.get("tiles") or {}).keys()),
        "min_confidence": args.min_conf,
        "buildings_in_box": len(lats),
        "buildings_used": int(len(lat)),
        "buildings_in_region_cells": inside,
        "built": "pipeline/build_buildings_v1.py",
        "asof": "2026-10-04",
        "note": "Counts of AI-detected buildings; a building is not a household and detection misses small or temporary shelters, so counts are a lower bound in pastoral areas.",
    }
    print("write")
    write_gz(out / "buildings10_v1.json.gz", {"meta": meta, "cells": cells, "districts": dict(dist),
                                              "cells_people_no_buildings": sorted(pop_no_b), "cells_buildings_no_people": sorted(b_no_pop)})
    write_gz(out / "settlements_v1.json.gz", {"meta": {**meta, "cluster_m": args.cluster_m, "min_cluster": args.min_cluster,
                                                        "far_rule": "no listed facility within 5 km and modelled walk > 60 min"},
                                              "settlements": settlements})
    (out / "facility_checks_v1.json").write_text(json.dumps({"meta": {**meta, "radius_m": args.near_m}, "checks": checks}, indent=1, sort_keys=True), encoding="utf-8")
    print("  wrote facility_checks_v1.json")

    print("\nsummary")
    for dname, d in sorted(dist.items()):
        print(f"  {dname:16s} buildings {d['n']:>8,}  built area {d['area_m2']/1e6:6.2f} km2  cells with buildings {d['cells_with_buildings']:3d}")
    print(f"  cells with >100 people (WorldPop 2020) but no detected building: {len(pop_no_b)}; cells with >=20 buildings but no WorldPop people: {len(b_no_pop)}")
    for s in far[:10]:
        print(f"  far-from-care settlement {s['id']} {s['district'] or '-':12s} {s['n']:>5} buildings  nearest listed facility {s['nearest_km']} km  walk {s['tt_walking_mean']} min")


if __name__ == "__main__":
    main()
