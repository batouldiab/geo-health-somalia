"""Post-process the v1 data files in data/ (idempotent). Applied on 4 October 2026.

What it fixes, and why (both are now also done inside build_bakool_health_v1.py, so a
rebuild from pipeline/raw/ gives the same result):

1. Four rows of the Maina et al. 2019 figshare XLSX duplicated rows of the HDX SHP of the
   same database (same name, 1 to 6 m apart). The builder's dedup key rounded the two
   coordinate sources differently (4.0775 vs 4.07754 round to different 3-decimal keys).
   The duplicates are removed from facilities_v1 and every reference to their ids
   (access10 nearest_maina2019, settlements nearest_fac, facility_checks) is remapped
   to the surviving record. Counts fall from 72 to 68 records on the 2019 database.
2. OpenStreetMap health sites and places that lie outside Bakool's five districts
   (the Overpass bounding box reaches into Bay, Gedo and Hiiraan): OSM facility records
   outside the districts are dropped; OSM places get an `in_region` flag and the
   district they fall in, from a point-in-polygon test against OCHA COD-AB. The finder
   answers only for places inside Bakool and refuses the others by name.

Run from the repo root:  python pipeline/postprocess_v1.py
"""
from __future__ import annotations

import gzip
import json
import math
from pathlib import Path

from shapely.geometry import Point, shape

DATA = Path(__file__).resolve().parents[1] / "data"


def load_gz(name: str) -> dict:
    with gzip.open(DATA / name, "rt", encoding="utf-8") as f:
        return json.load(f)


def write_gz(name: str, obj: dict) -> None:
    raw = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    with open(DATA / name, "wb") as fh, gzip.GzipFile(fileobj=fh, mode="wb", compresslevel=9, mtime=0) as f:
        f.write(raw)
    print(f"  wrote {name} ({(DATA / name).stat().st_size:,} bytes)")


def haversine_m(a: dict, b: dict) -> float:
    r = 6371000.0
    p1, p2 = math.radians(a["lat"]), math.radians(b["lat"])
    dl = math.radians(b["lon"] - a["lon"])
    x = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(x))


def main() -> None:
    fac = load_gz("facilities_v1.json.gz")
    acc = load_gz("access10_v1.json.gz")
    adm2 = load_gz("adm2_bakool_v1.json.gz")
    places = load_gz("places_bakool_v1.json.gz")
    stl_path, chk_path = DATA / "settlements_v1.json.gz", DATA / "facility_checks_v1.json"
    stl = load_gz("settlements_v1.json.gz") if stl_path.exists() else None
    chk = json.loads(chk_path.read_text(encoding="utf-8")) if chk_path.exists() else None

    facilities = fac["facilities"]
    remap: dict[str, str] = {}

    # 1. within-source duplicates of the 2019 database (XLSX row within 50 m of a SHP row, same name)
    shp = [f for f in facilities if f["source_key"] == "maina2019" and "XLSX" not in f["source"]]
    for f in [f for f in facilities if f["source_key"] == "maina2019" and "XLSX" in f["source"]]:
        twin = min(shp, key=lambda s: haversine_m(f, s), default=None)
        if twin and haversine_m(f, twin) <= 50 and twin["type"] == f["type"]:
            remap[f["id"]] = twin["id"]
            print(f"  duplicate {f['id']} {f['name']!r} -> {twin['id']} {twin['name']!r} ({haversine_m(f, twin):.0f} m)")

    # 2. OSM health sites outside the five districts
    dropped_osm = [f["id"] for f in facilities if f["source_key"] == "osm" and not f.get("district_adm2")]
    for i in dropped_osm:
        print(f"  outside Bakool: OSM facility {i} dropped")

    gone = set(remap) | set(dropped_osm)
    if not gone and all(("in_region" in p) for p in places["places"]):
        print("nothing to do")
        return
    facilities = [f for f in facilities if f["id"] not in gone]
    fac["facilities"] = facilities
    fac["meta"]["count"] = len(facilities)
    fac["meta"]["by_source"] = {k: sum(1 for f in facilities if f["source_key"] == k) for k in ("who2021", "maina2019", "osm")}
    fac["meta"]["postprocess"] = ("pipeline/postprocess_v1.py, 2026-10-04: 4 XLSX rows that duplicated SHP rows of the same 2019 database removed "
                                  "(ids " + ", ".join(sorted(remap)) + "); OpenStreetMap sites outside the five districts removed "
                                  "(ids " + ", ".join(dropped_osm) + ").")

    # references: access cells, district totals, settlements, checks
    for key, c in acc["cells"].items():
        for k in ("nearest_who2021", "nearest_maina2019"):
            if c.get(k) in remap:
                c[k] = remap[c[k]]
    for d in acc["districts"].values():
        for k in ("facilities_who2021", "facilities_maina2019", "facilities_osm"):
            d[k] = 0
    for f in facilities:
        acc["districts"].setdefault(f.get("district_adm2") or "outside ADM2", {})[f"facilities_{f['source_key']}"] = \
            acc["districts"][f.get("district_adm2") or "outside ADM2"].get(f"facilities_{f['source_key']}", 0) + 1
    acc["meta"]["postprocess"] = "facility ids remapped and district facility counts recomputed by pipeline/postprocess_v1.py, 2026-10-04"
    if stl:
        for s in stl["settlements"]:
            if s.get("nearest_fac") in remap:
                s["nearest_fac"] = remap[s["nearest_fac"]]
    if chk:
        for i in gone:
            chk["checks"].pop(i, None)

    # 3. places: inside which district, if any
    polys = [(f["properties"]["district"], shape(f["geometry"])) for f in adm2["adm2"]["features"]]
    n_in = 0
    for p in places["places"]:
        pt = Point(p["lon"], p["lat"])
        hit = next((name for name, g in polys if g.contains(pt)), None)
        p["in_region"] = hit is not None
        if hit:
            p["district"] = hit
            n_in += 1
        else:
            p.pop("district", None)
    places["meta"]["in_region"] = n_in
    places["meta"]["note"] = ("in_region: the point falls inside one of Bakool's five districts (OCHA COD-AB). The finder answers for those; "
                              "places outside are kept only so that a question about them can be refused by name.")
    print(f"  places: {n_in} of {len(places['places'])} inside the five districts")

    print("write")
    write_gz("facilities_v1.json.gz", fac)
    write_gz("access10_v1.json.gz", acc)
    write_gz("places_bakool_v1.json.gz", places)
    if stl:
        write_gz("settlements_v1.json.gz", stl)
    if chk:
        chk_path.write_text(json.dumps(chk, indent=1, sort_keys=True), encoding="utf-8")
        print("  wrote facility_checks_v1.json")
    print(f"  facilities: {fac['meta']['by_source']}")


if __name__ == "__main__":
    main()
