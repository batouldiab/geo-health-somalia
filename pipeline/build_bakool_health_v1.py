"""Build the Bakool health-access files in data/ from the inputs in pipeline/raw/.

    python pipeline/build_bakool_health_v1.py [--raw DIR] [--out DIR] [--region Bakool]
                                               [--tstar 120] [--skip-landcover]

Outputs (all deterministic: sorted keys, gzip mtime 0; never overwrite a version
that is already deployed, bump _vN instead):

    data/adm2_bakool_v1.json.gz    districts of the region (GeoJSON) + cell -> district
    data/facilities_v1.json.gz     facilities in the region, one record per source row
    data/access10_v1.json.gz       per 10x10 km cell: people, travel time, land cover,
                                   nearest facility, underserved index U and its rank;
                                   district totals (incl. COD-PS 2021 population)
    data/schools_v1.json.gz        schools (UNICEF/OCHA 2022 list + OSM), with source
    data/places_bakool_v1.json.gz  OSM places (town/village/hamlet): the finder's gazetteer
    data/mpi_regions_v1.json       hand-transcribed OPHI 2024 Table 3.3 (see seed below)

Inputs as they really are (inspected 2026-10-04):
  * som_admin_boundaries.shp.zip  COD-AB Jan 2026: som_admin1.shp (18), som_admin2.shp (91);
                                  fields adm1_name, adm2_name, adm2_pcode (+ *_em variants)
  * who_health_facilities_2021.xlsx  WHO/MoH list, 520 rows; header row + an HXL tag row
                                  (#adm1+name ...) that must be skipped; columns " Region ",
                                  " District", "Health Facility name", "Type:", "Latiitude",
                                  "Longititude" (sic); some rows have no coordinates
  * WHO_health_sites.zip          HDX "WHO health sites" SHP (2023), 716 points: this is the
                                  WHO/KEMRI (Maina et al. 2019) database, Somalia subset,
                                  fields Country, Admin1, facility_n, facility_t, Ownership,
                                  Lat, Long, ll_source. 68 rows in Bakool.
  * maina_2019_ssa_mfl.xlsx       the same database for 50 countries; sheet 0 is a legend,
                                  the data sheet is the one with a "Country" column
  * som_pplp_adm2_v2.csv          COD-PS 2021: admin1Name_en, Admin2Name_en, T_TL, U_TL,
                                  R_TL, IDP_TL (+ 2005 columns)

The grid is the platform's own (data/som_grid_v1.json.gz, cell_deg 0.09): a cell's
centre is (col*cell_deg, row*cell_deg), so a point falls in cell
(round(lon/cell_deg), round(lat/cell_deg)).

Method (plan, Section 5): U_c = P_c * H_r * min(1, T_c / T*), P_c = WorldPop 2020
people in the cell, H_r = the region's MPI incidence, T_c = population-weighted
walking minutes to the nearest facility (MAP 2020), T* = 120 by default.

Nothing is interpolated or invented: a cell with no WorldPop pixels has no people, a
facility with no coordinates is dropped and counted, two sources that list the same
facility are kept as two records with their own source and licence.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import json
import math
import sys
import zipfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_RAW = ROOT / "pipeline" / "raw"
DEFAULT_OUT = ROOT / "data"

# OPHI / SNBS, Multidimensional Poverty Index for Somalia report 2024, Table 3.3 (p.14),
# 2022 SIHBS data. Only the rows read from the report on 2026-10-03 are filled; the
# other regions are None until transcribed from the same table. Middle Juba was not
# surveyed. H = incidence (% poor), A = intensity (% of weighted deprivations).
MPI_SEED = {
    "source": "https://ophi.org.uk/sites/default/files/2024-12/Somalia_MPI_report_2024.pdf",
    "table": "Table 3.3, p.14",
    "year": 2022,
    "national": {"mpi": 0.363, "h": 67.0, "a": 54.3},
    "regions": {
        "Bakool": {"mpi": 0.669, "h": 97.4, "a": 68.7},
        "Hiiraan": {"mpi": 0.517, "h": 90.1, "a": None},
        "Bay": {"mpi": 0.511, "h": 88.8, "a": None},
        "Gedo": {"mpi": 0.489, "h": 85.3, "a": None},
        "Lower Shebelle": {"mpi": 0.230, "h": 47.4, "a": None},
        "Awdal": {"mpi": 0.232, "h": 46.2, "a": None},
        "Middle Juba": None,  # not surveyed (security)
        # TODO transcribe from Table 3.3: Banadir, Bari, Galgaduud, Lower Juba,
        # Middle Shebelle, Mudug, Nugaal, Sanaag, Sool, Togdheer, Woqooyi Galbeed
    },
}

WORLDCOVER_CLASSES = {10: "tree", 20: "shrub", 30: "grass", 40: "crop", 50: "built",
                      60: "bare", 70: "snow", 80: "water", 90: "wetland", 95: "mangrove", 100: "moss"}

SRC_WHO2021 = "WHO / MoH Somalia Health Facilities XLSX (HDX, 2021-06-18)"
SRC_MAINA_SHP = "WHO health sites SHP (HDX, 2023) = WHO/KEMRI Maina et al. 2019 database, Somalia subset"
SRC_MAINA_XLSX = "Maina et al. 2019 XLSX (figshare, inputs 2005-2013)"
SRC_OSM = "OpenStreetMap via Overpass"


# ----------------------------------------------------------------------------- helpers
def write_gz(path: Path, obj) -> None:
    raw = json.dumps(obj, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode("utf-8")
    with open(path, "wb") as f:
        with gzip.GzipFile(fileobj=f, mode="wb", mtime=0) as gz:
            gz.write(raw)
    print(f"  wrote {path.name}  {path.stat().st_size/1024:.0f} KB gz")


def load_grid(data_dir: Path):
    with gzip.open(data_dir / "som_grid_v1.json.gz") as f:
        return json.load(f)


def pick(cols: list[str], *keywords: str) -> str | None:
    """First column whose lowercase, stripped name contains any keyword, in keyword order."""
    low = {str(c).lower().strip(): c for c in cols}
    for kw in keywords:
        for lc, c in low.items():
            if kw in lc:
                return c
    return None


def same_region(value, region: str) -> bool:
    """Tolerant region match: 'Bakool' == ' bakool ' == 'Bakool Region'."""
    v = str(value).strip().lower()
    r = region.lower()
    return v == r or v.startswith(r) or r.startswith(v[:5]) if v else False


def cell_of(lon: float, lat: float, cd: float) -> tuple[int, int]:
    return int(round(lon / cd)), int(round(lat / cd))


def haversine_km(lon1, lat1, lon2, lat2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _text(v) -> str:
    """a cell as text; pandas NaN and None become an empty string instead of 'nan'"""
    return "" if v is None or (isinstance(v, float) and v != v) else str(v).strip()


def _coords(r, c_lon, c_lat):
    try:
        lon, lat = float(r[c_lon]), float(r[c_lat])
    except (TypeError, ValueError, KeyError):
        return None
    if not (-2 < lat < 13 and 40 < lon < 52):
        return None
    return round(lon, 5), round(lat, 5)


# ----------------------------------------------------------------------------- inputs
def read_adm2(raw: Path, region: str):
    import geopandas as gpd

    zips = sorted(raw.glob("som_adm*.zip")) + sorted(raw.glob("*adm*SHP*.zip"))
    if not zips:
        sys.exit("COD-AB shapefile zip not found in raw/ (som_admin_boundaries.shp.zip)")
    z = zipfile.ZipFile(zips[0])
    names = z.namelist()

    def find(level: int) -> str | None:
        cands = [n for n in names if n.lower().endswith(".shp")
                 and (f"admin{level}" in n.lower() or f"adm{level}" in n.lower() or f"admbnda_adm{level}" in n.lower())
                 and "line" not in n.lower() and "point" not in n.lower()]
        cands.sort(key=lambda n: ("_em" in n.lower(), len(n)))  # plain layer before the _em variant
        return cands[0] if cands else None

    shp1, shp2 = find(1), find(2)
    if not shp1 or not shp2:
        sys.exit(f"adm1/adm2 shapefiles not found inside {zips[0].name}: {names[:10]} ...")
    print(f"  COD-AB: {zips[0].name} -> {shp1}, {shp2}")
    g1 = gpd.read_file(f"zip://{zips[0]}!{shp1}").to_crs(4326)
    g2 = gpd.read_file(f"zip://{zips[0]}!{shp2}").to_crs(4326)
    a1_2 = pick(list(g2.columns), "adm1_name", "adm1_en", "admin1")
    a2 = pick(list(g2.columns), "adm2_name", "adm2_en", "admin2")
    p2 = pick(list(g2.columns), "adm2_pcode", "adm2_pc")
    a1_1 = pick(list(g1.columns), "adm1_name", "adm1_en", "admin1")
    print(f"  COD-AB columns: region={a1_2} district={a2} pcode={p2}")
    g2 = g2[g2[a1_2].apply(lambda v: same_region(v, region))].copy()
    g1 = g1[g1[a1_1].apply(lambda v: same_region(v, region))].copy()
    if g2.empty or g1.empty:
        sys.exit(f"region {region!r} not found in COD-AB; adm1 names: {sorted(set(g1[a1_1]))}")
    ren = {a2: "district"}
    if p2:
        ren[p2] = "pcode"
    g2 = g2.rename(columns=ren)
    keep = ["district", "geometry"] + (["pcode"] if p2 else [])
    return g1[[a1_1, "geometry"]].rename(columns={a1_1: "region"}), g2[keep]


def read_who_2021(raw: Path, region: str) -> list[dict]:
    import pandas as pd

    p = raw / "who_health_facilities_2021.xlsx"
    if not p.exists():
        print("  WHO 2021 XLSX not present, skipping")
        return []
    df = pd.read_excel(p)
    df = df[~df.iloc[:, 0].astype(str).str.startswith("#")]  # drop the HXL tag row
    cols = list(df.columns)
    c_reg, c_dis = pick(cols, "region", "adm1"), pick(cols, "district", "adm2")
    c_name = pick(cols, "health fac", "facility", "name")
    c_type = pick(cols, "type", "level", "category")
    c_lat, c_lon = pick(cols, "latitude", "latiitude", "lat"), pick(cols, "longitude", "longititude", "lon")
    print(f"  WHO 2021: region={c_reg!r} district={c_dis!r} name={c_name!r} type={c_type!r} lat={c_lat!r} lon={c_lon!r}")
    sub = df[df[c_reg].apply(lambda v: same_region(v, region))] if c_reg else df
    out, dropped = [], 0
    for _, r in sub.iterrows():
        xy = _coords(r, c_lon, c_lat)
        if xy is None:
            dropped += 1
            continue
        out.append({"name": str(r[c_name]).strip(), "type": str(r[c_type]).strip() if c_type else "",
                    "owner": "", "district": str(r[c_dis]).strip() if c_dis else "",
                    "lon": xy[0], "lat": xy[1], "source": SRC_WHO2021, "source_key": "who2021",
                    "licence": "CC BY-IGO"})
    print(f"    {len(sub)} rows in {region}, {len(out)} with coordinates, {dropped} dropped")
    return out


def read_maina_shp(raw: Path, region: str) -> list[dict]:
    import geopandas as gpd

    p = raw / "WHO_health_sites.zip"
    if not p.exists():
        print("  WHO_health_sites.zip not present, skipping")
        return []
    z = zipfile.ZipFile(p)
    shp = [n for n in z.namelist() if n.lower().endswith(".shp")][0]
    g = gpd.read_file(f"zip://{p}!{shp}").to_crs(4326)
    cols = list(g.columns)
    c_reg = pick(cols, "admin1", "region", "adm1")
    c_name, c_type, c_own = pick(cols, "facility_n", "facility name", "name"), pick(cols, "facility_t", "type"), pick(cols, "owner")
    print(f"  WHO health sites SHP: region={c_reg!r} name={c_name!r} type={c_type!r} owner={c_own!r}; {len(g)} points nationally")
    sub = g[g[c_reg].apply(lambda v: same_region(v, region))]
    out = []
    for _, r in sub.iterrows():
        lon, lat = float(r.geometry.x), float(r.geometry.y)
        if not (-2 < lat < 13 and 40 < lon < 52):
            continue
        out.append({"name": str(r[c_name]).strip(), "type": str(r[c_type]).strip() if c_type else "",
                    "owner": _text(r[c_own]) if c_own else "", "district": "",
                    "lon": round(lon, 5), "lat": round(lat, 5), "source": SRC_MAINA_SHP,
                    "source_key": "maina2019", "licence": "CC BY-IGO (HDX) / CC0 (figshare original)"})
    print(f"    {len(out)} points in {region}")
    return out


def read_maina_xlsx(raw: Path, region: str, already: list[dict]) -> list[dict]:
    """Rows of the figshare XLSX for the region that are not already in the HDX SHP."""
    import pandas as pd

    p = raw / "maina_2019_ssa_mfl.xlsx"
    if not p.exists():
        print("  Maina 2019 XLSX not present, skipping")
        return []
    sheets = pd.read_excel(p, sheet_name=None)
    df = next((s for s in sheets.values() if pick(list(s.columns), "country")), None)
    if df is None:
        print("  Maina 2019 XLSX: no sheet with a Country column, skipping")
        return []
    cols = list(df.columns)
    c_cty, c_a1 = pick(cols, "country"), pick(cols, "admin1", "admin 1", "adm1")
    c_name, c_type, c_own = pick(cols, "facility name", "facility_n", "name"), pick(cols, "facility type", "type"), pick(cols, "owner")
    c_lat, c_lon = pick(cols, "lat"), pick(cols, "long", "lon")
    print(f"  Maina 2019 XLSX: country={c_cty!r} admin1={c_a1!r} name={c_name!r} type={c_type!r} lat={c_lat!r} lon={c_lon!r}")
    sub = df[df[c_cty].astype(str).str.lower().str.strip() == "somalia"]
    if c_a1:
        sub = sub[sub[c_a1].apply(lambda v: same_region(v, region))]
    out, dup, nocoord = [], 0, 0
    for _, r in sub.iterrows():
        xy = _coords(r, c_lon, c_lat)
        if xy is None:
            nocoord += 1
            continue
        # the same facility appears in the SHP and the XLSX with coordinates that differ in the
        # 4th decimal (a few metres), so a rounded key misses them: a row within 50 m of a SHP
        # row of the same type is the same facility (postprocess_v1.py applied this on 4 Oct 2026)
        xtype = str(r[c_type]).strip() if c_type else ""
        if any(haversine_km(xy[0], xy[1], f["lon"], f["lat"]) <= 0.05 and f.get("type", "") == xtype for f in already):
            dup += 1
            continue
        out.append({"name": str(r[c_name]).strip(), "type": str(r[c_type]).strip() if c_type else "",
                    "owner": _text(r[c_own]) if c_own else "", "district": "",
                    "lon": xy[0], "lat": xy[1], "source": SRC_MAINA_XLSX, "source_key": "maina2019",
                    "licence": "CC0"})
    print(f"    {len(sub)} Somalia rows in {region}: {len(out)} new, {dup} already in the SHP, {nocoord} without coordinates")
    return out


def read_osm(raw: Path) -> tuple[list[dict], list[dict], list[dict]]:
    p = raw / "osm_bakool.json"
    if not p.exists():
        print("  OSM Overpass JSON not present, skipping")
        return [], [], []
    els = json.loads(p.read_text(encoding="utf-8")).get("elements", [])
    health, schools, places = [], [], []
    for e in els:
        t = e.get("tags", {})
        lon = e.get("lon") or e.get("center", {}).get("lon")
        lat = e.get("lat") or e.get("center", {}).get("lat")
        if lon is None or lat is None:
            continue
        rec = {"name": t.get("name", ""), "osm": f"{e['type']}/{e['id']}", "lon": round(lon, 5), "lat": round(lat, 5),
               "source": SRC_OSM, "licence": "ODbL"}
        if t.get("healthcare") or t.get("amenity") in {"hospital", "clinic", "doctors", "health_post", "pharmacy"}:
            health.append({**rec, "type": t.get("healthcare") or t.get("amenity", ""), "owner": t.get("operator", ""),
                           "district": "", "source_key": "osm"})
        elif t.get("amenity") in {"school", "kindergarten", "college", "university"}:
            schools.append({**rec, "type": t.get("amenity")})
        elif t.get("place") in {"city", "town", "village", "hamlet"}:
            places.append({**rec, "place": t.get("place"), "name_so": t.get("name:so", "")})
    print(f"  OSM: {len(health)} health, {len(schools)} schools, {len(places)} places")
    return health, schools, places


def read_schools_2022(raw: Path, region: str) -> list[dict]:
    p = raw / "education_facilities_2022.geojson"
    if not p.exists():
        print("  UNICEF/OCHA 2022 education GeoJSON not present, skipping")
        return []
    fc = json.loads(p.read_text(encoding="utf-8"))
    out = []
    for f in fc.get("features", []):
        pr = f.get("properties", {})
        if not same_region(pr.get("region", ""), region):
            continue
        lon, lat = f["geometry"]["coordinates"][:2]
        out.append({"name": pr.get("sch_name", ""), "district": pr.get("district", ""), "village": pr.get("village", ""),
                    "type": pr.get("sch_type", ""), "enrolment": (pr.get("enr_boys") or 0) + (pr.get("enr_girls") or 0),
                    "teachers": (pr.get("tch_male") or 0) + (pr.get("tch_fem") or 0),
                    "lon": round(lon, 5), "lat": round(lat, 5),
                    "source": "UNICEF / OCHA Somalia Education Facilities 2022 (HDX)", "licence": "CC BY"})
    print(f"  schools 2022: {len(out)} in {region} (the national list has 667; Bakool is under-represented)")
    return out


def read_codps(raw: Path, region: str) -> dict[str, dict]:
    p = raw / "som_pplp_adm2_v2.csv"
    if not p.exists():
        print("  COD-PS csv not present, skipping district population")
        return {}
    out = {}
    with open(p, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    cols = list(rows[0].keys()) if rows else []
    c_a1, c_a2 = pick(cols, "admin1name", "adm1"), pick(cols, "admin2name", "adm2")
    c_t, c_u, c_r, c_i = pick(cols, "t_tl"), pick(cols, "u_tl"), pick(cols, "r_tl"), pick(cols, "idp_tl")
    # exact "T_TL" (2021) rather than "T_TL_2005": pick() takes the first containing match, so check
    for c in cols:
        if c.strip().upper() == "T_TL":
            c_t = c
        if c.strip().upper() == "U_TL":
            c_u = c
        if c.strip().upper() == "R_TL":
            c_r = c
    for r in rows:
        if not same_region(r.get(c_a1, ""), region):
            continue
        def num(c):
            try:
                return int(float(r[c]))
            except (TypeError, ValueError, KeyError):
                return None
        out[r[c_a2].strip()] = {"pop2021_codps": num(c_t), "urban": num(c_u), "rural": num(c_r), "idp": num(c_i)}
    print(f"  COD-PS 2021: {len(out)} districts in {region}: " + ", ".join(f"{k} {v['pop2021_codps']:,}" for k, v in sorted(out.items()) if v['pop2021_codps']))
    return out


# ----------------------------------------------------------------------------- rasters
def map_raster_path(raw: Path, mode: str) -> str | None:
    """The MAP 'DirectDownload' link returns a ZIP holding one .geotiff. Accept any of:
    map_2020_<mode>_travel_time.tif (a real GeoTIFF, or a zip saved under that name),
    map_2020_<mode>_travel_time.zip, or the extracted 2020_*_travel_time_to_healthcare.geotiff.
    A zip is read in place through GDAL's /vsizip/ (rasterio 'zip://' path), no extraction."""
    inner = {"walking": "2020_walking_only_travel_time_to_healthcare.geotiff",
             "motorized": "2020_motorized_travel_time_to_healthcare.geotiff"}[mode]
    for cand in (raw / inner, raw / f"map_2020_{mode}_travel_time.tif", raw / f"map_2020_{mode}_travel_time.zip"):
        if not cand.exists():
            continue
        with open(cand, "rb") as f:
            magic = f.read(4)
        if magic[:2] == b"PK":
            with zipfile.ZipFile(cand) as z:
                members = [n for n in z.namelist() if n.lower().endswith((".tif", ".tiff", ".geotiff"))]
            if not members:
                continue
            print(f"  MAP {mode}: reading {members[0]} inside {cand.name}")
            return f"/vsizip/{cand.resolve().as_posix()}/{members[0]}"  # GDAL virtual path, works on Windows
        if magic[:4] in (b"II*\x00", b"MM\x00*", b"II+\x00", b"MM\x00+"):
            return str(cand)
    return None


def people_and_time_per_cell(raw: Path, bbox, cd: float):
    """Sum WorldPop 2020 per cell; population-weighted mean travel time per cell and the
    share of people beyond 60 / 120 minutes, for every MAP raster present."""
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.warp import reproject
    from rasterio.windows import from_bounds

    pop_path = raw / "som_ppp_2020_constrained.tif"
    if not pop_path.exists():
        sys.exit("WorldPop raster not found in raw/")
    south, west, north, east = bbox
    with rasterio.open(pop_path) as src:
        win = from_bounds(west, south, east, north, src.transform)
        pop = src.read(1, window=win, masked=True).filled(0).astype("float64")
        tr = src.window_transform(win)
        pop[pop < 0] = 0
        h, w = pop.shape
        lons = tr.c + (np.arange(w) + 0.5) * tr.a
        lats = tr.f + (np.arange(h) + 0.5) * tr.e
        cell_col = np.rint(lons / cd).astype(int)
        cell_row = np.rint(lats / cd).astype(int)
        key = (cell_col[None, :] * 100000 + cell_row[:, None])  # unique int per cell
        print(f"  WorldPop window {w}x{h} px, people in box: {pop.sum():,.0f}")

    surfaces = {}
    for mode in ("walking", "motorized"):
        src_path = map_raster_path(raw, mode)
        if src_path is None:
            print(f"  MAP {mode} raster not present, skipping")
            continue
        with rasterio.open(src_path) as src:
            # read only the window of the global file, then resample onto the WorldPop grid
            swin = from_bounds(west - 0.05, south - 0.05, east + 0.05, north + 0.05, src.transform)
            arr = src.read(1, window=swin).astype("float32")
            str_ = src.window_transform(swin)
            dst = np.full(pop.shape, np.nan, dtype="float32")
            reproject(arr, dst, src_transform=str_, src_crs=src.crs, dst_transform=tr, dst_crs="EPSG:4326",
                      src_nodata=src.nodata, resampling=Resampling.bilinear, dst_nodata=np.nan)
            dst[dst < 0] = np.nan
            surfaces[mode] = dst
            ok = ~np.isnan(dst)
            print(f"  MAP {mode}: window {arr.shape[1]}x{arr.shape[0]} px; pop-weighted mean in box "
                  f"{(dst[ok] * pop[ok]).sum() / max(pop[ok].sum(), 1):.0f} min")

    keys, inv = np.unique(key.ravel(), return_inverse=True)
    popsum = np.bincount(inv, weights=pop.ravel(), minlength=len(keys))
    out = {}
    for i, k in enumerate(keys):
        c, r = int(k // 100000), int(k % 100000)
        out[f"{c}_{r}"] = {"pop2020c": int(round(popsum[i]))}
    for mode, arr in surfaces.items():
        flat = arr.ravel()
        ok = ~np.isnan(flat)
        pw = pop.ravel()
        wsum = np.bincount(inv[ok], weights=(pw * flat)[ok], minlength=len(keys))
        psum = np.bincount(inv[ok], weights=pw[ok], minlength=len(keys))
        gt60 = np.bincount(inv[ok], weights=(pw * (flat > 60))[ok], minlength=len(keys))
        gt120 = np.bincount(inv[ok], weights=(pw * (flat > 120))[ok], minlength=len(keys))
        for i, k in enumerate(keys):
            c, r = int(k // 100000), int(k % 100000)
            d = out[f"{c}_{r}"]
            if psum[i] > 0:
                d[f"tt_{mode}_mean"] = round(float(wsum[i] / psum[i]), 1)
                d[f"share_{mode}_gt60"] = round(float(gt60[i] / psum[i]), 3)
                d[f"share_{mode}_gt120"] = round(float(gt120[i] / psum[i]), 3)
    return out, sorted(surfaces)


def landcover_per_cell(raw: Path, cells: list[tuple[int, int]], cd: float):
    """Class shares per cell from ESA WorldCover 2021 (10 m), one window per cell."""
    import rasterio
    from rasterio.windows import from_bounds

    p = raw / "ESA_WorldCover_10m_2021_v200_N03E042_Map.tif"
    if not p.exists():
        print("  WorldCover tile not present, skipping land cover")
        return {}
    out = {}
    with rasterio.open(p) as src:
        for c, r in cells:
            w, s = (c - 0.5) * cd, (r - 0.5) * cd
            win = from_bounds(w, s, w + cd, s + cd, src.transform)
            arr = src.read(1, window=win)
            n = arr.size
            if n == 0:
                continue
            vals, counts = np.unique(arr, return_counts=True)
            shares = {WORLDCOVER_CLASSES.get(int(v), str(int(v))): round(float(k / n), 4)
                      for v, k in zip(vals, counts) if int(v) != 0}
            out[f"{c}_{r}"] = shares
    print(f"  land cover: {len(out)} cells")
    return out


# ----------------------------------------------------------------------------- main
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default=str(DEFAULT_RAW))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--region", default="Bakool")
    ap.add_argument("--tstar", type=float, default=120.0, help="T* in walking minutes")
    ap.add_argument("--skip-landcover", action="store_true")
    args = ap.parse_args()
    raw, out, region = Path(args.raw), Path(args.out), args.region
    out.mkdir(parents=True, exist_ok=True)

    import geopandas as gpd
    from shapely.geometry import Point

    print("grid")
    grid = load_grid(out)
    cd = grid["meta"]["cell_deg"]
    ridx = next(i for i, p in enumerate(grid["provinces"]) if p["name"].lower() == region.lower())
    gcells = {f"{c[0]}_{c[1]}": c for c in grid["cells"] if c[2] == ridx}
    print(f"  {region}: province idx {ridx}, {len(gcells)} cells, pop2025 {sum(c[5] for c in gcells.values()):,}")

    print("boundaries")
    g1, g2 = read_adm2(raw, region)
    bounds = g1.total_bounds  # minx miny maxx maxy
    bbox = (float(bounds[1]) - 0.1, float(bounds[0]) - 0.1, float(bounds[3]) + 0.1, float(bounds[2]) + 0.1)
    cell_pts = gpd.GeoDataFrame(
        {"cell": list(gcells)}, geometry=[Point(c[0] * cd, c[1] * cd) for c in gcells.values()], crs=4326)
    joined = gpd.sjoin(cell_pts, g2[["district", "geometry"]], how="left", predicate="within")
    joined = joined[~joined.index.duplicated(keep="first")]
    cell_district = {row.cell: (row.district if isinstance(row.district, str) else None) for row in joined.itertuples()}
    districts = sorted(g2["district"].unique())
    print(f"  districts: {districts}")
    codps = read_codps(raw, region)

    print("facilities")
    who2021 = read_who_2021(raw, region)
    maina_shp = read_maina_shp(raw, region)
    maina_xlsx = read_maina_xlsx(raw, region, maina_shp)
    osm_health, osm_schools, places = read_osm(raw)
    facilities = who2021 + maina_shp + maina_xlsx + osm_health
    referral_words = ("hospital", "health centre", "health center", "(hc)", "referral", "maternal", "mch")
    fac_pts = gpd.GeoDataFrame({"i": range(len(facilities))},
                               geometry=[Point(f["lon"], f["lat"]) for f in facilities], crs=4326)
    fj = gpd.sjoin(fac_pts, g2[["district", "geometry"]], how="left", predicate="within")
    fj = fj[~fj.index.duplicated(keep="first")]
    for row in fj.itertuples():
        f = facilities[row.i]
        f["id"] = f"f{row.i:04d}"
        f["cell"] = "%d_%d" % cell_of(f["lon"], f["lat"], cd)
        f["district_adm2"] = row.district if isinstance(row.district, str) else None
        f["referral"] = any(wd in f["type"].lower() for wd in referral_words)
    # the Overpass box reaches into Bay, Gedo and Hiiraan: OpenStreetMap sites outside the five
    # districts are not Bakool's (the registers' rows are kept: their source says Bakool)
    n_osm_out = sum(1 for f in facilities if f["source_key"] == "osm" and not f["district_adm2"])
    facilities = [f for f in facilities if not (f["source_key"] == "osm" and not f["district_adm2"])]
    print(f"  {n_osm_out} OpenStreetMap sites outside the districts dropped; {len(facilities)} facility records")
    # places: inside which district, if any; the finder answers only for in-region places
    pl_pts = gpd.GeoDataFrame({"i": range(len(places))}, geometry=[Point(p["lon"], p["lat"]) for p in places], crs=4326)
    pj = gpd.sjoin(pl_pts, g2[["district", "geometry"]], how="left", predicate="within")
    pj = pj[~pj.index.duplicated(keep="first")]
    for row in pj.itertuples():
        p = places[row.i]
        p["in_region"] = isinstance(row.district, str)
        if p["in_region"]:
            p["district"] = row.district
    print(f"  places: {sum(1 for p in places if p['in_region'])} of {len(places)} inside the five districts")

    print("people and travel time")
    cells, modes = people_and_time_per_cell(raw, bbox, cd)

    lc = {} if args.skip_landcover else landcover_per_cell(raw, [(c[0], c[1]) for c in gcells.values()], cd)

    print("index")
    h_r = MPI_SEED["regions"][region]["h"] / 100.0 if MPI_SEED["regions"].get(region) else None
    register = [f for f in facilities if f["source_key"] in ("who2021", "maina2019")]
    rows = {}
    for key, c in gcells.items():
        d = cells.get(key, {"pop2020c": 0})
        lon, lat = c[0] * cd, c[1] * cd
        rec = {"col": c[0], "row": c[1], "district": cell_district.get(key), "pop2025": c[5], **d,
               "lc": lc.get(key, {}), "built_share": lc.get(key, {}).get("built", 0.0)}
        for src_key in ("who2021", "maina2019"):
            pool = [f for f in register if f["source_key"] == src_key]
            if pool:
                nearest = min(pool, key=lambda f: haversine_km(lon, lat, f["lon"], f["lat"]))
                rec[f"nearest_{src_key}"] = nearest["id"]
                rec[f"nearest_{src_key}_km"] = round(haversine_km(lon, lat, nearest["lon"], nearest["lat"]), 1)
        t = d.get("tt_walking_mean")
        if h_r is not None and t is not None:
            rec["U"] = round(d["pop2020c"] * h_r * min(1.0, t / args.tstar), 1)
        rows[key] = rec
    ranked = sorted((k for k in rows if "U" in rows[k]), key=lambda k: -rows[k]["U"])
    for n, k in enumerate(ranked, 1):
        rows[k]["rank"] = n

    dist_tot: dict[str, dict] = {}

    def tot(name):
        return dist_tot.setdefault(name, {"cells": 0, "pop2020c": 0, "pop2025": 0, "U": 0.0,
                                          "pop_gt60_walk": 0, "pop_gt120_walk": 0,
                                          "facilities_who2021": 0, "facilities_maina2019": 0, "facilities_osm": 0})

    for k, r in rows.items():
        t = tot(r["district"] or "outside ADM2")
        t["cells"] += 1
        t["pop2020c"] += r.get("pop2020c", 0)
        t["pop2025"] += r["pop2025"]
        t["U"] += r.get("U", 0.0)
        t["pop_gt60_walk"] += int(round(r.get("pop2020c", 0) * r.get("share_walking_gt60", 0)))
        t["pop_gt120_walk"] += int(round(r.get("pop2020c", 0) * r.get("share_walking_gt120", 0)))
    for f in facilities:
        tot(f.get("district_adm2") or "outside ADM2")[f"facilities_{f['source_key']}"] += 1
    for dname, t in dist_tot.items():
        t["U"] = round(t["U"], 0)
        if dname in codps:
            t.update(codps[dname])

    meta_common = {"region": region, "cell_deg": cd, "built": "pipeline/build_bakool_health_v1.py", "asof": "2026-10-04"}

    print("write")
    write_gz(out / "adm2_bakool_v1.json.gz", {
        "meta": {**meta_common, "source": "OCHA COD-AB Somalia (HDX, edition 2026-01-26)", "licence": "CC BY-IGO"},
        "adm1": json.loads(g1.to_json()), "adm2": json.loads(g2.to_json()), "cell_district": cell_district})
    write_gz(out / "facilities_v1.json.gz", {
        "meta": {**meta_common, "count": len(facilities),
                 "by_source": {k: sum(1 for f in facilities if f["source_key"] == k) for k in ("who2021", "maina2019", "osm")},
                 "sources": sorted({f["source"] for f in facilities}),
                 "note": "No functional status in any source; show the source and its date on every screen. "
                         "who2021 and maina2019 list many of the same facilities under different names and coordinates; "
                         "they are kept as separate records, never merged."},
        "facilities": facilities})
    write_gz(out / "access10_v1.json.gz", {
        "meta": {**meta_common, "tstar_min": args.tstar, "h_region": h_r, "travel_modes": modes,
                 "population": "WorldPop 2020 constrained 100 m (CC BY 4.0); pop2025 = platform grid; pop2021_codps = OCHA COD-PS",
                 "travel_time": "Malaria Atlas Project 2020 (CC BY), population-weighted per cell",
                 "landcover": "ESA WorldCover 2021 v200 (CC BY 4.0) class shares per cell",
                 "index": "U = pop2020c * H_region * min(1, tt_walking_mean / tstar); our estimate",
                 "mpi_source": MPI_SEED["source"]},
        "cells": rows, "districts": dist_tot})
    write_gz(out / "schools_v1.json.gz", {
        "meta": {**meta_common, "note": "UNICEF/OCHA 2022 list is partner-supported, not a census"},
        "schools": read_schools_2022(raw, region) + osm_schools})
    write_gz(out / "places_bakool_v1.json.gz", {
        "meta": {**meta_common, "source": SRC_OSM, "licence": "ODbL",
                 "in_region": sum(1 for p in places if p.get("in_region")),
                 "note": "in_region: the point falls inside one of Bakool's five districts (OCHA COD-AB). The finder answers for those; "
                         "places outside are kept only so that a question about them can be refused by name."},
        "places": sorted(places, key=lambda p: (p["place"], p["name"]))})
    (out / "mpi_regions_v1.json").write_text(json.dumps(MPI_SEED, indent=1, sort_keys=True), encoding="utf-8")
    print("  wrote mpi_regions_v1.json (seed; transcribe the remaining regions from Table 3.3)")

    print("\nsummary")
    print(f"  cells {len(rows)}, with index {len(ranked)}; facilities who2021 {len(who2021)}, maina2019 {len(maina_shp) + len(maina_xlsx)}, osm {len(osm_health)}")
    print(f"  {'district':16s} {'cells':>5s} {'pop2020c':>9s} {'pop2025':>9s} {'codps21':>9s} {'>60min':>8s} {'>120min':>8s} {'U':>10s} {'who21':>5s} {'maina':>5s}")
    for dname, t in sorted(dist_tot.items()):
        print(f"  {dname:16s} {t['cells']:>5d} {t['pop2020c']:>9,} {t['pop2025']:>9,} {str(t.get('pop2021_codps') or '-'):>9s} "
              f"{t['pop_gt60_walk']:>8,} {t['pop_gt120_walk']:>8,} {t['U']:>10,.0f} {t['facilities_who2021']:>5d} {t['facilities_maina2019']:>5d}")
    for k in ranked[:10]:
        r = rows[k]
        print(f"  top cell {k:8s} {str(r['district'] or '-'):12s} people {r.get('pop2020c', 0):>7,}  walk {r.get('tt_walking_mean', '-'):>6} min  "
              f"nearest 2019-db facility {r.get('nearest_maina2019_km', '-'):>5} km  built {r.get('built_share', 0):.3f}  U {r['U']:>9,.0f}")
    tot_people = sum(r.get("pop2020c", 0) for r in rows.values())
    gt60 = sum(round(r.get("pop2020c", 0) * r.get("share_walking_gt60", 0)) for r in rows.values())
    gt120 = sum(round(r.get("pop2020c", 0) * r.get("share_walking_gt120", 0)) for r in rows.values())
    mgt60 = sum(round(r.get("pop2020c", 0) * r.get("share_motorized_gt60", 0)) for r in rows.values())
    if tot_people:
        print(f"\n  {region} cells, WorldPop 2020: {tot_people:,} people; walking >60 min {gt60:,} ({gt60/tot_people:.0%}), "
              f">120 min {gt120:,} ({gt120/tot_people:.0%}); motorized >60 min {mgt60:,} ({mgt60/tot_people:.0%}). "
              f"Our estimate from WorldPop 2020 x MAP 2020; label it so.")


if __name__ == "__main__":
    main()
