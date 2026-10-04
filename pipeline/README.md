# Data pipeline

Scripts that produce the versioned files in `data/` (about 250 KB, committed) from open sources listed
with link, date, licence, size and gaps in `sources.yaml`. Nothing synthetic; every number the app shows
can be traced to one of these files and from there to a public page.

## Scripts

- `fetch_sources.py` — downloads the inputs into `pipeline/raw/` (git-ignored, about 3 GB) and writes a
  checksum manifest; prints which HDX files must be saved by hand from their dataset pages when HDX refuses
  automated downloads.
- `fetch_open_buildings.py` — streams Google Open Buildings V3 for the two S2 tiles over Bakool and keeps
  the rows inside the box.
- `fetch_models.py` — Whisper tiny, 8-bit ONNX (onnx-community/whisper-tiny), into
  `frontend/public/models/whisper-tiny/` (44 MB; MIT).
- `overpass_bakool.ql` — the OpenStreetMap query (health sites, schools, places in the Bakool box).
- `build_bakool_health_v1.py` — the 10 × 10 km squares of the region with people (WorldPop 2020), travel
  time to care (Malaria Atlas Project 2020, population-weighted per square), land-cover shares (ESA
  WorldCover 2021), the nearest listed facility per square, and the score U; the facility records from the
  two WHO lists and OpenStreetMap (within-source duplicates removed, OSM sites outside the districts
  dropped); the district polygons; the places gazetteer with an `in_region` flag. Writes `access10_v1`,
  `facilities_v1`, `adm2_bakool_v1`, `places_bakool_v1`, `mpi_regions_v1`.
- `build_buildings_v1.py` — buildings per square, settlement clusters (≥ 20 buildings within 250 m) and
  which of them are far from care, and the plausibility check around each listed facility (buildings within
  500 m). Writes `buildings10_v1`, `settlements_v1`, `facility_checks_v1`.
- `postprocess_v1.py` — the two fixes applied to the shipped v1 files on 4 October 2026 (duplicate rows,
  region flag); idempotent; the builder now does the same, so a full rebuild gives the same result.
- `synth_clips.py` — voice clips for the finder's answer sentences (Meta MMS TTS Somali, CC BY-NC 4.0);
  run only after a Somali speaker has cleared the sentences. Not run for the submission.

`data/som_grid_v1.json.gz` (the national 10 × 10 km grid with province outlines and population per square,
from the geo-somalia platform) is the one file not produced here; the health files are built on its cell
ids.

## Rebuilding

```
pip install -r requirements.txt
python pipeline/fetch_sources.py
python pipeline/fetch_open_buildings.py
python pipeline/build_bakool_health_v1.py
python pipeline/build_buildings_v1.py
python pipeline/postprocess_v1.py
```

When a source changes, write a new version (`_v2`) rather than overwriting: the files are served with
immutable cache headers, and the finder's service worker caches them by name (bump `VERSION` in
`frontend/public/sw.js`). Then point `frontend/src/config.ts` and `sw.js` at the new names.
