# Geo-Health Somalia — tech video script (max 1 minute)

What the form asks: *explain the technical architecture, models/APIs used, and how you built it.*
Runtime 0:58 · 166 words of voiceover (≈170 wpm, brisk). Narrator: Batoul, voice over screen recording; the two
diagrams in `docs/data-integration.png` and `docs/architecture.png` (one artifact, two figures) carry the
structure so the voice can stay short. Everything in the "built" column is in the repo today; the last
eight seconds are labelled "next" on screen and in the voice.

## The script

| Time | Voiceover | On screen | Lower-third |
|---|---|---|---|
| **0:00–0:08 · Shape** | "One static site, one data pipeline, no server code. A Vite–TypeScript app; the finder installs on the phone and runs with the radio off." | The architecture figure, left to right: pipeline → data files → static site → map and finder → phone. Highlight the "no backend" edge. | *Vite 5 · TypeScript · Leaflet 1.9 · PWA (service worker, two caches) · Nginx container* |
| **0:08–0:20 · Data** | "The pipeline is Python, geopandas and rasterio: WorldPop, Malaria Atlas travel time, WHO and OpenStreetMap facilities, ESA land cover, Google Open Buildings — snapped onto NexaSEE's ten-kilometre grid: 272 squares, 250 kilobytes." | The data-integration figure: pixels and points rise into the grid band (sum, population-weighted mean, nearest, count); national and regional figures come down into it as weights. Then a 4-second terminal clip: `python pipeline/build_bakool_health_v1.py` printing the district table. | *HDX (WHO, OCHA COD-AB/PS) · WorldPop 100 m · Malaria Atlas 1 km · ESA WorldCover 10 m · Open Buildings V3 · Overpass API · 272 squares, `data/*.json.gz` ≈ 250 KB* |
| **0:20–0:36 · Models** | "On the phone, one model: Whisper tiny, 41 megabytes, in the browser via transformers.js and ONNX Runtime. It only transcribes. A spelling-tolerant matcher over 444 place names, twelve fixed sentences and a slot-filled slip do the rest: nothing on the phone can invent a fact." | The finder in aeroplane mode: Speak → "I heard: … 2.8 s" → "Did you mean Kulunjerer? · match 100%" → the answer → the slip and "Open SMS app". Overlay the model box: encoder 10.1 MB + decoder 30.7 MB. | *Whisper tiny, 8-bit ONNX (onnx-community, MIT) · @huggingface/transformers 4.3 · onnxruntime-web (WASM, 1 thread) · matcher: Somali spelling key + Dice bigram similarity, thresholds 0.92 / 0.60 · 12 answer + 4 fail-safe sentences · slip: 3 who × 5 why × urgent, GSM-7, ≤ 160 chars* |
| **0:36–0:50 · How we built and tested it** | "Built in a weekend on NexaSEE's open-source geo-somalia map. Google's building detector checks every listed facility and finds villages far from care. A test pushes 5,593 questions through the matcher: zero wrong answers without a confirmation. CI runs it on every push." | Split screen: the map's "Villages with no care nearby" layer with a hollow dashed facility dot; then the matcher test table from `docs/evaluation.md` and the green CI run. | *Open Buildings V3: 55,985 detections ≥ 0.7 confidence inside Bakool · 279 clusters, 99 far from care · 7 of 73 facilities with no building within 500 m · `test-matcher.mjs`: 5,593 questions, 0 wrong direct answers · GitHub Actions: typecheck, build, test* |
| **0:50–0:58 · Next** | "Next: an SMS short code carries a clinic's question to a volunteer doctor and back; de-identified answers become an offline protocol library." | The dashed amber part of the architecture figure: gateway → triage → doctors → reply → store → monthly sync → offline library. Keep "PROPOSED" visible for the whole eight seconds. | *Proposed · SMS gateway with a Somali short code · NLLB-200 Somali↔English draft · no names or numbers in transit · volunteer doctors answer, identities logged · monthly categorisation when online* |

## Pace and cuts

166 words in 58 seconds is about 170 words a minute, brisk but clear for a tech explainer because the lower-thirds carry the numbers. If you read nearer 145, cut these without losing a fact: "no server code" (the figure says it), "CI runs it on every push" (the green run is on screen), and "in the browser via transformers.js and ONNX Runtime" → "in the browser" (the credits card names them). That brings it to about 148 words.

## What the voice claims, and where it is true in the repo

| Claim | Where |
|---|---|
| Static site, no server code; Vite + TypeScript; Leaflet map; finder as an installable PWA with a service worker and two caches (data vs models) | `frontend/`, `frontend/public/sw.js`, `docs/offline-package.md` |
| Pipeline in Python (geopandas, rasterio, shapely); sources with link, date, licence, size and gaps; checksum manifest | `pipeline/build_bakool_health_v1.py`, `build_buildings_v1.py`, `postprocess_v1.py`, `fetch_sources.py`, `sources.yaml` |
| 272 squares on NexaSEE's grid (`cell_deg 0.09`), five districts, about 250 KB of `data/*.json.gz` | `data/`, `pipeline/README.md` |
| Whisper tiny, 8-bit ONNX, 41 MB (10.1 + 30.7 MB), transformers.js 4.3 + ONNX Runtime Web, language fixed to Somali or English, one thread | `frontend/src/finder/speech.ts`, `pipeline/fetch_models.py`, `docs/offline-package.md` |
| Matcher: Somali spelling key, Dice similarity over bigrams, thresholds 0.92 and 0.60; 444 named places inside Bakool, 72 named facilities, 5 districts; 12 answer sentences + 4 fail-safes; slip 3 × 5 × urgent, GSM-7, ≤ 160 characters, opened in the phone's SMS app | `frontend/src/finder/match.ts`, `answer.ts`, `referral.ts`, `strings.ts`; `docs/evaluation.md` |
| Open Buildings: 55,985 detections inside Bakool's squares, 279 clusters, 99 far from care, 7 of 73 listed facilities with no building within 500 m | `data/settlements_v1.json.gz`, `facility_checks_v1.json`, README |
| Matcher test: 5,593 questions, 0 typed questions answered directly with the wrong place; CI runs typecheck, build and the test | `frontend/scripts/test-matcher.mjs`, `docs/evaluation.md`, `.github/workflows/ci.yml` |
| "Next": SMS short code, volunteer doctors, de-identified answers, offline protocol library | Proposed. Not in the repo. Say "next", show "proposed". |

## Models and APIs, the exact list for the on-screen credits card (hold 3 s at the end)

**Built with:** OpenAI Whisper tiny (MIT), 8-bit ONNX export by onnx-community · @huggingface/transformers 4.3.0 (Apache-2.0) · onnxruntime-web (MIT) · Leaflet 1.9.4 · Vite 5 · Python: geopandas, rasterio, shapely · Data APIs and downloads: HDX (WHO Somalia health facilities; OCHA COD-AB 2026-01-26, COD-PS), WorldPop data server (2020 constrained 100 m), Malaria Atlas Project geoserver (2020 walking and motorized), ESA WorldCover 2021 on public S3, Google Open Buildings V3 (S2 tiles 17d, 17f), OpenStreetMap Overpass API · Maina et al. 2019 (figshare) · OPHI/SNBS MPI 2024 (Table 3.3) · NexaSEE geo-somalia grid (`som_grid_v1`).

**On the NexaSEE platform (geo-philanthropy.nexasee.com), not in this submission:** VIIRS night lights and HDX-OSM roads by class per square; Our World in Data, 32 Somalia series; iSEE Analytics and Sentiment through one provider layer (Gemini 2.5 Flash, Claude, OpenRouter, Groq gpt-oss-120b, with web search), figures computed server-side and the model only captioning them.

**Proposed, with the open pieces they would use:** SMS gateway with a Somali short code (operator or aggregator; sponsor to be found) · NLLB-200 for the Somali↔English draft (CC BY-NC 4.0) · Meta MMS ASR (1,100+ languages, CC BY-NC 4.0) or Whisper for community voice messages · the platform's existing LLM provider layer for the monthly categorisation of answered questions · WorldPop constrained age-and-sex rasters 2015–2030, 100 m, CC BY 4.0 (files such as `som_f_10_2025_CN_100m_R2024B_v1.tif`, females 10–14) for the girls 10–14, under-5 and 60+ layers · UN SDG Global Database API (series such as SH_STA_MORT for Somalia, area 706) for the national series and their sex/age/location breakdowns where they exist · a health-worker registry built from registrations on the SMS line (no public dataset of individual doctors' locations exists).

## Recording notes

- Record the terminal clip at a large font (18 pt) on a dark terminal; eight lines is enough.
- The phone footage can be the same take as the demo video's segment 2; reuse it, do not re-record.
- Keep the "PROPOSED" tag burned in for the last segment; it protects the Responsible AI pass/fail and the "evidence it works" score.
- Credits card: the "Built with" list above, 3 seconds, small type, no voice.
