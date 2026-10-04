# Bakool Health Access — Challenge Project Plan

> **4 October 2026, afternoon.** The plan below was written on 3 October. During the day the project was
> simplified to what the challenge asks for and nothing else: the Lite and Pro tabs, the iSEE Analytics and
> Sentiment features, the FastAPI backend, the night-light, road and MPI layers and the visit beacon were
> removed; the app is now the Bakool map (the landing page) and the phone finder with its referral slip,
> served as static files. The facility records were de-duplicated (72 → 68 on the 2019 database), the
> OpenStreetMap gazetteer was limited to Bakool (444 named places; places outside are refused by name), the
> "nearest facility that is open and offers the service" wording was dropped everywhere, the "referral-level"
> label became "health centre / MCH, a level above a health post", the index was relabelled "people far from
> care", the patient-data account was rewritten honestly (README, responsible-ai.md), and a matcher test was
> added (docs/evaluation.md). Section 3's "keep everything from geo-philanthropy" decision is therefore
> superseded; the rest of the plan (sources, methods, deliverables, risks) still describes the project,
> with three retractions: the sentences "no patient data is captured or stored" and "a lost phone exposes
> nothing" (Sections 2, 5 and 6) are replaced by the account in `docs/responsible-ai.md` (the referral slip
> and the kept recordings are on the phone, by the worker's choice, and the slip is minimal patient data);
> spoken answers (MMS TTS, Section 5 and the "Mouth" row) are not shipped, the finder shows text until a
> Somali speaker has cleared the sentences; and the schools layer is no longer shown. Where the plan and the
> README differ, the README is current.


Oct 3, 2026 · @Batoul Diab
> Export of the living plan. The two diagrams (architecture, build timeline) render only in the Claude Doc: https://claude.ai/code/artifact/9f561afb-9968-4f1e-983c-a6367f68d9d0

## 1. What the challenge asks (Health, Annex A)

The entry is one working Small AI prototype for the health sector plus a 2–5 minute video, submitted by the end of the competition weekend (3–4 October 2026); shortlists follow on 5–6 October and the winner presents in Seoul on 21 October. Source: Hack-Nation × World Bank Youth Summit concept note, Challenge 04 "Small AI for Development" (the attached PDF, 20 pages).

**The health brief (Annex A).** Design and demonstrate a Small AI solution that improves one meaningful part of Noor's access to primary care, or a frontline worker's ability to serve her: screening support, documentation, referral, follow-up or continuity of care. The annex deliberately lists no medical imaging or diagnosis datasets; interpreting them is out of bounds. It also asks every entry that touches patient data to state where the data sits, who can read it, and what happens when the phone is lost or shared.

**The four hard rules (section 06)** — every one must be visibly true in the demo:

1. It runs on a device the user already has.
2. Its core feature works offline.
3. Its model files are small enough to side-load or send over a weak connection.
4. At least one interaction is in a local language, by voice or text; name the language and expect the question of how it fares in a less-supported one.

**AI guardrails (pass/fail).** A person makes the final call; the tool informs a decision and flags what it is unsure of. Every entry needs a fail-safe: "not sure — ask a person" rather than a guess. Avoid hallucinations. The judges call this "Responsible AI, data and safety" and score it pass/fail.

**Data rules (section 07).** Cite every data source. Two kinds of data are expected: data that shows the problem (travel time to the nearest facility, absence rates, phone ownership, with source, year and country) and data the tool is built with (name each dataset, its source, licence and size). You must state what your data does not cover; this is scored. Synthetic data is allowed only if labelled as such. The provided lists are suggestions; finding better data is encouraged.

**What is submitted (section 08).** The prototype (code or a link) and a 2–5 minute video; entries without the video are not shortlisted. The video must contain, in order: a one-sentence problem statement in the template "Because of this tool, \[user\] will \[action\] by \[when\] that they would otherwise \[not do / do late / do worse\]; we know because \[evidence\]"; the AI capabilities and why SMS, a spreadsheet or a search would not do the same job, with the guardrails; a tool demo of the user journey end to end (slide deck or screen recording); the challenge or gap addressed, where the tool sits in the user's day, with tech-stack details; and "your take" on what localizing AI development means.

| Judging criterion | Weight | The question the panel asks |
| --- | --- | --- |
| The built solution (Small AI fidelity) | 25% | Does the tool work end to end within the constraints of the sector? |
| Development relevance and impact | 20% | Is this a real problem from the sector brief, and does the outcome matter to the person it is built for? |
| Data grounding | 15% | Does the tool address an identified gap in the data, and is the data modelling sound? |
| Evidence it works | 15% | Does the solution fit the challenges identified in the sector without adding constraints? |
| Clarity, design, inclusivity and value proposition for AI | 15% | What does the tool do with AI, and would a simpler tool do the same job? |
| Scalability, replicability, what happens next | 10% | Could another setting reuse this innovation? |
| Responsible AI, data and safety | Pass/fail | Are the limits respected; is the account of privacy, consent, bias and human oversight credible? |

**Datasets named in the PDF for health** (Annex A.2): [Service Delivery Indicators](https://www.sdindicators.org/) (World Bank; the annex calls it the strongest single source), [healthsites.io](https://healthsites.io/), [Maina et al. 2019](https://www.nature.com/articles/s41597-019-0142-2) (about 98,000 geolocated public facilities in sub-Saharan Africa), [DHS Program](https://dhsprogram.com/) and Service Provision Assessments, [Malaria Atlas Project travel-time surfaces](https://malariaatlas.org/), [AccessMod](https://www.accessmod.org/) (WHO), [DHIS2](https://dhis2.org/), [WHO Global Health Observatory](https://www.who.int/data/gho) and [IHME Global Health Data Exchange](https://ghdx.healthdata.org/). **Common datasets for every sector** (section 7.3): WorldPop, OpenStreetMap, VIIRS night lights, HDX, World Bank Data360, WDI, Microdata Library, GSMA Mobile Gender Gap, OpenCelliD, Global Findex, and for language Mozilla Common Voice, FLEURS, Meta MMS, FLORES-200/NLLB-200, OPUS, MASSIVE and Masakhane. Section 4 below says which of these are actually usable for Bakool.

## 2. The problem we take on: reaching a health facility in Bakool

The project answers one question for one region: **where in Bakool do the poorest people live furthest from a functioning health facility, and what is the nearest realistic option for each of them?** It does not diagnose, it does not read images, and it does not try to fix Somalia's health system. It helps a community health worker or a household in Bakool decide where to go, and helps a planner see where a new or restored service would reach the most poor people.

**Why Bakool.** Bakool is the poorest region in the [Somalia MPI report 2024](https://ophi.org.uk/sites/default/files/2024-12/Somalia_MPI_report_2024.pdf) (OPHI and the Somalia National Bureau of Statistics, 2022 survey data): 97.4% of its people are multidimensionally poor, deprived on average in 68.7% of indicators, MPI 0.669, against a national MPI of 0.363 and a national incidence of 67.0%. It ranks first of the 17 regions the report covers (Middle Juba was not surveyed for security reasons); the next poorest are Hiraan (0.517) and Bay (0.511). The geo-philanthropy platform already carries this as the point value 67 for Bakool in `data/mpi_points_v1.json`. Bakool is also where the platform's road layer is thinnest and night light is near zero, and where Al-Shabaab blockades cut road access to Xudur and Waajid for over a decade until a partial lifting in 2025 (Section 4 gives the sources). It is the region where "the clinic near where she lives" is least likely to be near, open or reachable.

**Who the tool is for.** Two users, one device: a community health worker or facility nurse with a basic Android phone and intermittent 2G/3G, and the household she serves, reached by voice or text in the local language (Af-Maay is the first language across most of Bakool, Standard Somali the second; Section 4 confirms the language evidence and which open speech models cover Somali). The planner's view is the geo-philanthropy map, used on a laptop with a connection.

**The one-sentence problem statement (challenge template):** *Because of this tool, a community health worker in Bakool will send a sick child or a pregnant woman to the nearest facility that is open and offers the service she needs, on the day, instead of to a closed or distant one; we know because 62% of Somali women name distance as a barrier to care and only 21% of births happen in a facility (SHDS 2020), Somalia has 0.65 doctors per 10,000 people (WHO 2024), and in Bakool, the poorest region of Somalia (97.4% multidimensionally poor, OPHI 2024), the nearest facility on the map is often not the nearest working one.* Every number in the clause is cited in Section 4.

**In scope for the hackathon hours**

- A Bakool health-access layer set added on top of the geo-philanthropy stack: facilities, travel time, population, poverty, land cover, schools (as community anchor points), on the 10x10 km grid and at ADM2 district level (Xudur, Waajid, Tayeeglow, Ceel Barde, Rab Dhuure).
- An underserved-population index per cell: people x poverty x travel time, with facility functionality where the data has it.
- A small, offline, on-device assistant (text and voice, Somali, Af-Maay where a model allows it) that answers "where is the nearest facility that offers X" from a side-loaded facility file, and says "not sure, ask a person" when the register is stale or the service is unknown.
- The demo video and the submission package.

**Out of scope, said plainly in the submission**

- Any diagnosis, triage scoring or image reading.
- Live facility status; the tool uses the latest published register and shows its date.
- Routing on live roads or security conditions; travel time comes from published surfaces and road data, and the tool says so.
- Patient records; the assistant stores no personal data on the phone.

## 3. What we keep from geo-philanthropy and what we add

The new project is a copy of the `geo-somalia` repository under a new name, with every existing layer kept and the health layers added beside them; nothing in `geo-somalia` itself changes and geo-philanthropy.nexasee.com keeps running as it is.

&#91;embedded content: architecture · four layers, kept parts left, new parts right\]

Each band keeps its left box exactly as it is today and gains the right box; the arrows are the same flow the platform already has, from open sources through the pipeline into versioned static files and on to the map.

**Decisions**

- **New repository, not a branch.** Copy `geo-somalia` at its current commit (`be836bf`) into a sibling folder, working name `geo-health-somalia`, and delete `.git`, `.env`, `.env.droplet`, `CF_Origin_Certificate.txt` and `ssh.txt` from the copy before the first commit. The suggested public name is `geo-health.nexasee.com`; the droplet and Cloudflare steps are the ones in `docs/project-playbook.md`, Part B.
- **Reused unchanged.** The Vite + TypeScript + Leaflet frontend (Lite and Pro views, router and deep links, layers panel, cell dashboard, charts, legends, print brief), the FastAPI backend (datasets seam, file cache, LLM provider layer with fallbacks, the figures-versus-visual split of iSEE Analytics), the `data/*_vN.json.gz` convention with immutable caching, the Docker, Nginx and Cloudflare deploy and the GitHub Actions workflow.
- **Adapted.** `frontend/src/config.ts` (new dataset names; the map opens on Bakool), `backend/app/services/insights_figures.py` (the four dimensions become poverty, people, travel time to care and facility reach, replacing night light and roads), the Brief card's four tiles and its one written sentence, and the 18-province ranking, which ranks by the new access index.
- **Switched off for the submission, code kept.** The iSEE Sentiment tiers and the nightly jobs: they cost provider credit and add nothing to the health story. `GEOSOM_AUTO_REFRESH=false`, the Sentiment button hidden behind a config flag.
- **New.** One pipeline script, five data files, two API routes, the health layers and index symbology, the Bakool facility finder as an installable offline PWA with Somali voice and text (Section 5), and the submission package (Section 6).

## 4. Data stack: what we build with, what proves the problem, and what is missing

Six open layers are enough for Bakool and every one has a direct download that needs no account; the three gaps (no public facility-status register, 4 schools in Bakool in the 2022 list, no Af-Maay speech model) are reported as findings in the submission, which the challenge scores under "what your data does not cover". Every page below was opened on 3 October 2026; HDX record counts come from the HDX datastore mirror because HDX's own API refused automated reads.

**A. Data the tool is built with**

| Layer | Source and link | Date | Format, size | Licence | Bakool coverage | Does not cover |
| --- | --- | --- | --- | --- | --- | --- |
| Health facilities, primary | [WHO · Somalia Health Facilities on HDX](https://data.humdata.org/dataset/somalia-health-facilities-data) | XLSX Jun 2021; SHP Oct 2023 | XLSX 33 KB, SHP 36 KB; 520 points; Region, District, name, Type, lat, lon | CC BY-IGO | National, filter `Region = Bakool` | Functional status, services, staff, IDs; the 2023 SHP may differ from the 2021 XLSX |
| Health facilities, attributes | [Maina et al. 2019, Scientific Data](https://www.nature.com/articles/s41597-019-0142-2); file on [figshare](https://ndownloader.figshare.com/files/14379593) | Feb 2019 | XLSX 5.5 MB; 879 Somalia facilities, 96% geocoded; type, ownership | CC0 | National | Public sector only; inputs date from 2005–2013; 39 facilities lack coordinates |
| Health facilities, cross-check | [healthsites.io Somalia on HDX](https://data.humdata.org/dataset/e9d3a67f-08c4-4465-9a0f-e9ab67d38bb4) and OSM via Overpass (query below) | Feb 2024 / live | CSV, GeoJSON; 92 records, 35 fields | ODbL | Sparse | Most attribute fields empty; keep as a separate attributed layer, do not merge into CC BY files |
| Population | [WorldPop Somalia 2020, constrained, 100 m](https://hub.worldpop.org/geodata/summary?id=49662); [direct GeoTIFF](https://data.worldpop.org/GIS/Population/Global_2000_2020_Constrained/2020/maxar_v1/SOM/som_ppp_2020_constrained.tif) | 2020 | GeoTIFF 16.5 MB, 3 arc-sec | CC BY 4.0 | National | A modelled projection, not a census; the platform's own 2015–2030 grid is the other reference |
| Travel time to care | [Malaria Atlas Project, accessibility to healthcare 2020](https://malariaatlas.org/project-resources/accessibility-to-healthcare/) (motorized and walking) or the same on [Google Earth Engine](https://developers.google.com/earth-engine/datasets/catalog/projects_malariaatlasproject_assets_accessibility_accessibility_to_healthcare_2019_walking_only) | 2019–2020 | GeoTIFF, 1 km (927.67 m) | CC BY 3.0 on the MAP explorer, CC BY 4.0 on GEE | Global | Uses a 2019 global facility list, not Bakool's register; no security or seasonal road closures |
| Travel time, Somalia-specific | Data for Children Collaborative via HDX: walking and motorised time to nearest health centre, 100 m ([mirror page](https://sodma-dev.okfn.org/dataset/somalia-walking-travel-time-to-nearest-level-iv-health-centre)) | Not stated | GeoTIFF, 100 m, EPSG:4326 | Not stated | National | Input facility layer undocumented; use for a sensitivity check, not as the primary surface |
| Land cover | [ESA WorldCover 2021 v200](https://esa-worldcover.org/en/data-access), tile N03E042 on [public S3](https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N03E042_Map.tif) | 2021 | COG GeoTIFF 103 MB, 10 m, EPSG:4326, 11 classes | CC BY 4.0 | One tile covers all of Bakool (3–6N, 42–45E) | 2021 and 2020 maps use different algorithms; no year-to-year change |
| Land cover change (optional) | [Esri / Impact Observatory 10 m annual LULC](https://registry.opendata.aws/io-lulc/), supercell 38N, e.g. [38N\_2024.tif](https://io-10m-annual-lulc.s3.us-west-2.amazonaws.com/38N_2024.tif) | 2017–2024 | COG per year, 82–127 MB, EPSG:32638 | CC BY 4.0 | Covers Bakool | Needs reprojection; "Rangeland" merges shrub and grass; has a Clouds class |
| Cropland, Somalia-specific (optional) | [FAO SWALIM geoportal](https://spatial.faoswalim.org/), layer `2025_ver3_agric_clean` via WFS | 2025 | Vector, 2.1 M polygons; fetch with a bbox filter | Not specified | National | Licence unspecified; ask swalim@fao.org before redistributing |
| Schools | [UNICEF / OCHA Somalia Education Facilities on HDX](https://data.humdata.org/dataset/somalia-education-facilities); GeoJSON from the [SWALIM WFS](https://spatial.faoswalim.org/geoserver/ows?service=WFS&version=1.0.0&request=GetFeature&typename=geonode:education_facilities&outputFormat=json&srs=EPSG:4326) | Jan–Aug 2022 | 667 points; name, region, district, type, enrolment, teachers | CC BY (HDX) | **4 points in Bakool** (2 in Waajid, 2 in Xudur) | A partner-supported list, not a school census; no open georeferenced EMIS list exists |
| Admin boundaries | [OCHA COD-AB Somalia](https://data.humdata.org/dataset/cod-ab-som), `som_adm_ocha_itos_20230308_SHP.zip` | Mar 2023 | SHP 2.2 MB, ADM0–2 | CC BY-IGO | Bakool and its 5 districts | — |
| District population | [OCHA COD-PS Somalia](https://data.humdata.org/dataset/cod-ps-som), `som_pplp_adm2_v2.csv` | Sep 2022 | CSV, 2005–2021 | CC BY-IGO | 5 Bakool districts | Estimates from humanitarian partners; PESS 2014 gave Bakool 367,226, IPC 2024 uses 543,371 |
| Speech to text, on device | [OpenAI Whisper](https://github.com/openai/whisper) tiny or base, quantized (Somali `so` is in the tokenizer) | 2022 | 40–75 MB | MIT | Standard Somali | No published Whisper Somali WER; a Whisper-large fine-tune ([BuzzASR/somali](https://huggingface.co/BuzzASR/somali)) reports 50.96% WER on FLEURS, so the design confirms every heard name with yes/no |
| Text to speech, on device | [Meta MMS TTS Somali](https://huggingface.co/facebook/mms-tts-som) (VITS) | 2023 | \~36 M parameters | CC BY-NC 4.0 | Standard Somali | Non-commercial licence: fine for the hackathon, to be replaced by recorded prompts for a deployment |
| Test speech | [FLEURS `so_so`](https://huggingface.co/datasets/google/fleurs) | 2022 | \~4,600 clips | CC BY 4.0 | Standard Somali | No Af-Maay; studio-read sentences, not clinic speech |
| Af-Maay | Only [MMS language ID](https://huggingface.co/facebook/mms-lid-4017) lists `ymm` | 2023 | — | CC BY-NC 4.0 | Can detect Maay, cannot transcribe or speak it | **Gap we report**: no ASR, TTS or translation model for Af-Maay exists; prompts would have to be recorded by a Maay speaker |

Overpass QL for OSM health sites and schools in the Bakool box (south, west, north, east; run at overpass-turbo.eu or POST to `https://overpass-api.de/api/interpreter`):

```
[out:json][timeout:120];
(
  nwr["amenity"~"^(hospital|clinic|doctors|health_post|pharmacy)$"](3.1,42.9,4.9,44.8);
  nwr["healthcare"](3.1,42.9,4.9,44.8);
  nwr["amenity"~"^(school|kindergarten|college|university)$"](3.1,42.9,4.9,44.8);
);
out center tags;
```

**B. Evidence that the problem is real** (the challenge's first kind of data; each line is ready for the video)

| Fact | Value | Year | Source |
| --- | --- | --- | --- |
| Bakool multidimensional poverty | 97.4% poor, intensity 68.7%, MPI 0.669; national MPI 0.363, incidence 67.0%; poorest of 17 regions covered | 2022 | [OPHI / SNBS Somalia MPI report 2024](https://ophi.org.uk/sites/default/files/2024-12/Somalia_MPI_report_2024.pdf), Table 3.3 |
| Distance as a barrier to care | 62% of women nationally (48% urban, 73% rural, 79% nomadic); 73% report at least one barrier | 2020 | [SHDS 2020](https://somalia.unfpa.org/sites/default/files/pub-pdf/shds_report_2020_1.pdf), Table 5.9 |
| Births in a health facility | 21% nationally (28% urban, 15% rural, 3% nomadic); 21% in Bakool's urban domain | 2020 | SHDS 2020 Table 5.6; [SHDS South West State report](https://nbs.gov.so/wp-content/uploads/2023/07/SHDS-South-West-Report-2020.pdf) |
| Skilled attendance at birth | 32%; antenatal care from a skilled provider 31% | 2020 | SHDS 2020 |
| Doctors per 10,000 people | 0.65 | 2024 | [WHO GHO HWF\_0001](https://ghoapi.azureedge.net/api/HWF_0001?$filter=SpatialDim%20eq%20%27SOM%27) |
| Nurses and midwives per 10,000 | 3.16 | 2024 | [WHO GHO HWF\_0006](https://ghoapi.azureedge.net/api/HWF_0006?$filter=SpatialDim%20eq%20%27SOM%27) |
| UHC service coverage index | 30 of 100 | 2023 | [WHO GHO UHC\_INDEX\_REPORTED](https://ghoapi.azureedge.net/api/UHC_INDEX_REPORTED?$filter=SpatialDim%20eq%20%27SOM%27) |
| Functional facilities | "only 1/3 of the existing health facilities are functional" (national) | 2025 | [EUAA Somalia healthcare COI, June 2025](https://coi.euaa.europa.eu/administration/ireland/PLib/2025_06_Somalia_Healthcare.pdf), quoting the European Commission |
| Road access to Xudur | Al-Shabaab blockade of the main supply routes since 2012, aid airlifted or carried by donkey cart (OCHA, Aug 2024); partially lifted in 2025 | 2021–2025 | [UN Somalia 2021](https://somalia.un.org/en/140217-somalia-hunger-and-struggle-displaced-communities-besieged-xudur-town); [EUAA 2025, Bakool](https://www.euaa.europa.eu/coi/somalia/2025/security-situation/22-south-west/221-bakool); [Radio Ergo, May 2025](https://radioergo.org/en/2025/05/transport-flows-and-trade-revives-as-13-year-long-al-shabaab-road-blockade-in-bay-and-bakool-is-lifted/) |
| Bakool Regional Hospital, Xudur | Services restored by WHO and AICS; "Health clinics that once provided basic services have fallen apart" | Jan 2026 | [WHO EMRO](https://www.emro.who.int/somalia/news/who-and-aics-restore-lifesaving-services-at-bakool-regional-hospital-renewing-hope-for-families.html) |
| Bakool population | 367,226 (PESS 2014); 543,371 (IPC projection Oct–Dec 2024) | 2014 / 2024 | [UNFPA PESS](https://somalia.unfpa.org/sites/default/files/pub-pdf/Population-Estimation-Survey-of-Somalia-PESS-2013-2014.pdf), Table 2.1; [FSNAU/IPC post-Gu 2024](https://fsnau.org/downloads/Somalia-2024-Post-Gu-Acute-Food-Insecurity-Rural-Urban-and-IDP-Population-Stressed-Crisis-and-Emergency-%28Projection-Oct-Dec-2024%29.pdf) |
| Mobile subscriptions per 100 people | 53.96 | 2023 | [World Bank WDI IT.CEL.SETS.P2](https://fred.stlouisfed.org/data/ITCELSETSP2SOM) |
| Network population coverage | 2G 90%, 3G 80%, 4G 50% (ITU 2023, as cited by Ecofin); internet users 27.6% | 2023 / 2025 | [DataReportal Digital 2026 Somalia](https://datareportal.com/reports/digital-2026-somalia); ITU figure is second-hand, mark it so |
| Language | Af-Maay is the language of the Rahanweyn of Bay and Bakool; Maay-only speakers "do not fully understand most of the health messages" | 1998 / 2023 | [IRB Canada SOM30133.E](https://www.ecoi.net/de/dokument/1212283.html); [Minority Rights Group and CLEAR Global](https://minorityrights.org/publications/language-barriers-somalia/) |

**Not found anywhere public, so the project computes or reports it:** the share of Bakool's population more than one or two hours from a facility (we compute it from WorldPop x MAP travel time; that is the project's own result), the number of functional facilities in Bakool, Bakool rows of SHDS 2020, Hormuud or Somtel coverage in Bakool, and OpenCelliD tower counts (download needs a token). WHO HeRAMS holds 419 Somali health service delivery units but is behind a login, and the Federal Ministry of Health's new Master Health Facility List (1,455 facilities, [reported launched 25 August 2026](https://www.pressenza.com/2026/08/somalia-launches-its-first-unified-national-registry-of-health-facilities/), press report only) has no public download yet: both go in the "what happens next" slide as the data this tool is built to receive. The World Bank Service Delivery Indicators, which the annex calls the strongest source, has [no Somalia survey](https://www.worldbank.org/en/programs/service-delivery-indicators/health/country-reports-and-data); say so in the video.

## 5. Analytics layers and methods

Three computed layers turn the raw files into one answer per 10x10 km cell and per district: how long people need to reach care, how many people that is, and how poor they are; the planner's map ranks cells by that answer, and the facility finder on the phone reads the same files offline. The index itself is arithmetic and the submission says so; the AI sits in the speech interaction on the phone, in the modelled travel-time surfaces, and, optionally and online, in the iSEE Analytics reading for the planner.

**Pipeline, in order** (`pipeline/build_bakool_health_v1.py`; geopandas, rasterio, shapely; one run, deterministic)

1. **Grid and boundaries.** Reuse the platform's `cell_deg` grid and cell ids; keep the cells whose centre falls in Bakool (COD-AB ADM1) and tag each with its ADM2 district (Xudur, Waajid, Tayeeglow, Ceel Barde, Rab Dhuure). Write `adm2_bakool_v1.json.gz`.
2. **People per cell.** Sum WorldPop 2020 constrained pixels per cell (`pop2020c`); keep the platform's `pop2025` beside it so the two can be compared. Sum per district as well.
3. **Travel time per cell.** Window the MAP 2020 motorized and walking surfaces to the Bakool box, resample to 100 m to match WorldPop, and compute per cell the population-weighted mean travel time (minutes) and the share of people beyond 60 and 120 minutes, for both modes. Repeat with the Somalia-specific 100 m surface as a sensitivity check and report where the two disagree.
4. **Facilities.** Load the WHO register (2023 SHP, with the 2021 XLSX as a check), filter Bakool, geocode nothing, and join Maina 2019 by name and district for type and ownership where it matches. For each cell record the nearest facility by straight-line distance, its name, type and the register date; label the distance "as the crow flies" in every screen. Flag facilities whose Type is a hospital or health centre as referral points. Write `facilities_v1.json.gz`.
5. **Land cover per cell.** Window ESA WorldCover 2021 to Bakool, count pixels per class per cell and store the shares of built-up, cropland, grassland, shrubland, bare and wetland. Two uses: built-up share is the settlement proxy that tells a planner whether a high-travel-time cell is a village or empty rangeland, and a cell with people but no built-up pixels marks a pastoral population that a fixed facility will not serve, so a mobile outreach point is the realistic option. Write `access10_v1.json.gz` with steps 2, 3 and 5 together.
6. **Schools and settlements.** Load the 2022 education list (4 points in Bakool) and the OSM schools and places (`place=town|village|hamlet`) from the Overpass query; store them as the gazetteer the facility finder matches spoken place names against, each with its source and licence. Write `schools_v1.json.gz` and `places_bakool_v1.json.gz`.
7. **Index.** For each cell, the underserved index is the number of poor people weighted by how far beyond reach they are, with the regional poverty incidence as the weight because no sub-regional poverty figure exists for Bakool:

```latex
U_c = P_c \cdot H_r \cdot \min\!\left(1, \frac{T_c}{T^{*}}\right), \qquad T^{*} = 120 \text{ min walking}
```

Here P\_c is the cell's 2020 population, H\_r the region's MPI incidence (0.974 for Bakool, Table 3.3 of the OPHI report) and T\_c the cell's population-weighted walking time to the nearest facility. T\* is a parameter shown in the panel; the dashboard also shows the 60-minute case. Within Bakool H\_r is constant, so the ranking is driven by people and travel time; across regions, once the layer is extended, poverty starts to separate them. Store U\_c, its rank within Bakool, and the district totals.

**The facility finder (Small AI on the phone)**

- One installable web app (the existing Vite frontend plus a service worker) that caches the Bakool subset of `facilities_v1`, `access10_v1`, `places_bakool_v1` and the Bakool map tiles on first load, about 2 to 4 MB, then works with the radio off. It runs in Chrome on any Android phone the health worker already has; no app store, no account.
- Voice in: Whisper tiny or base, quantized, running in the browser (transformers.js, WebAssembly, model file 40 to 75 MB side-loaded once); language fixed to Somali. Text in: the same screen typed. The recognised words are matched against three fixed lists: places, facility names and service keywords (delivery, child vaccination, malnutrition, emergency referral). Every match is read back for a yes or no before any answer, because Somali speech recognition is weak (about 50% word error even for a large fine-tuned model) and a wrong village is a wrong answer.
- Voice out: Meta MMS TTS Somali for the answer, which is composed from a fixed set of sentence templates filled from the data files: facility name, type, straight-line distance and modelled walking time from the matched place, the register date, and the referral point for the district. A fixed list of answers means every sentence the tool can say was written by a person and can be checked.
- No personal data: nothing about the patient is typed, spoken into storage or sent anywhere; the phone holds only public data files. Losing or sharing the phone exposes nothing, which answers the annex's question directly.

| Situation | What the tool says |
| --- | --- |
| Speech confidence low, or no place or facility matches above the threshold | "Not sure, ask a person", then offers the typed list of places |
| The service asked for is not in the register | "The register does not say which services this facility offers; ask at the facility or the district health office" |
| Register older than 24 months, or the nearest facility is in a district flagged as access-restricted | Gives the answer with its date and the flag, and names the next facility as well |
| Any question outside places, facilities and services (symptoms, medicines, doses) | "This tool only finds facilities; please speak to a health worker" |

**Evidence it works, within the weekend**

- The ranking is checked against published narrative: Xudur and Waajid districts, blockaded until 2025, and the pastoral east of the region should surface near the top; if they do not, the method, not the narrative, is questioned first.
- Speech recognition is tested on Bakool place names spoken by the team and on FLEURS Somali clips; the confirmation step is shown catching a wrong match on camera.
- Offline operation is shown with aeroplane mode on, in the video, end to end.
- The "nearest on the map is not the nearest working one" claim is stated as a published national figure (one third of facilities functional) plus the register's silence on status, not as a Bakool measurement we do not have.

## 6. Deliverables mapped to the challenge

Every rule, submission item and judging question in the PDF has one line here with the thing that answers it; tick the status as the weekend goes.

| Challenge requirement (PDF section) | What we submit | Where it lives | Status |
| --- | --- | --- | --- |
| Prototype: the working tool, with code or a link (08) | The geo-health web app with the Bakool health layers and index, plus the facility finder PWA, from one repository | New GitHub repo `geo-health-somalia`; live at `geo-health.nexasee.com` | Not started |
| Video, 2 to 5 minutes (08) | Screen recording of the planner map, phone footage of the finder in aeroplane mode, five title cards for the five required parts | `docs/video-script.md`; MP4 uploaded to the Hack-Nation form | Not started |
| Problem statement in the template sentence (08) | The sentence in Section 2, with its three cited numbers | Title card 1 of the video; README | In progress |
| AI capabilities and why SMS, a spreadsheet or a search would not do (08, 09 at 15%) | On-device Somali speech in and out, fixed-list answers, modelled travel-time surfaces; SMS cannot hear Somali or work without a tower, a spreadsheet cannot be spoken to on a round, a search needs a connection | Title card 2; `docs/ai-capabilities.md` | Not started |
| Tool demo, user journey end to end (08) | Planner: Somalia, Bakool, district, cell, index. Health worker: aeroplane mode on, spoken question, yes/no confirmation, spoken answer, fail-safe case | Video body; deep links prepared with `?p=bakool&layers=...` | Not started |
| Challenge or gap addressed, where it sits in the user's day, tech stack (08) | A morning round in a Bakool village: the worker meets a referral case and asks the phone where to send her; stack listed | Title card 3; README section Tech stack | Not started |
| Your take on localizing AI (08) | Localizing means the language people speak (Af-Maay has no model, we say so), data owned by the Ministry (the finder is built to load the Master Facility List when it is released), and answers a person can check | Title card 5, 20 seconds | Not started |
| Rule: runs on a device the user already has (06) | Installable web app in Chrome on any Android phone; no store, no account | Finder; shown on a low-end phone in the video | Not started |
| Rule: core feature works offline (06) | Service worker caches data and tiles on first load; every finder function works with the radio off | Finder; aeroplane-mode demo | Not started |
| Rule: model files small enough to side-load (06) | Whisper tiny quantized about 40 MB, MMS TTS Somali about 36 MB, data 2 to 4 MB; shared by Bluetooth or SD card | `docs/offline-package.md` with file sizes measured, not estimated | Not started |
| Rule: one interaction in a local language, named, and how it fares in a less-supported one (06) | Standard Somali, voice and text; Af-Maay named as the first language of Bakool and as the gap: recorded prompts by a Maay speaker could replace TTS, recognition cannot be offered today | Title card 2; Section 4 of this plan | Not started |
| Guardrails: human in the loop, flags uncertainty, no hallucination (06, pass/fail) | The four fail-safe sentences of Section 5; the tool never refers, books or sends anything; every answer carries the register date | Finder; `docs/responsible-ai.md` | Not started |
| Data: cite every source; data that shows the problem and data you build with; what the data does not cover (07) | Tables A and B of Section 4 and the "not found" paragraph, as a Sources slide and a Data gaps slide | README section Data; title card 4 | In progress |
| Patient data: where it sits, who can read it, what happens when the phone is lost or shared (Annex A) | No patient data is captured or stored; only public files are on the phone; a lost phone exposes nothing | `docs/responsible-ai.md`; one sentence in the video | Not started |
| Judging: scalability and what happens next (09 at 10%) | The pipeline takes any ADM1 region name; the same stack ran for the whole country as geo-philanthropy; the finder is built to load the FMoH Master Facility List and HeRAMS exports when they are public | Title card 5; README section What happens next | Not started |

## 7. Build plan for the weekend

Eight blocks in sequence take the plan from an empty folder to a submitted entry by Sunday 19:30 Beirut time, leaving the rest of Sunday evening as buffer; the PDF says only "by the end of the hackathon weekend", so confirm the exact cut-off time on the Hack-Nation form before Saturday night ends.

&#91;embedded content: build timeline · eight blocks, Saturday evening to Sunday evening\]

The platform and finder blocks are independent, so with two people they run side by side on Sunday morning and the voice block gains two hours. If time runs short, cut in this order: the Esri change layer, the SWALIM cropland layer, voice input (keep typed Somali), the iSEE Analytics adaptation.

1. **Scaffold and download (Sat 19:00 to 20:30).** Copy `geo-somalia` to a sibling folder `geo-health-somalia`; remove `.git`, `.env`, `.env.droplet`, `CF_Origin_Certificate.txt`, `ssh.txt`; `git init -b main`. Add `pipeline/sources.yaml` with the links of Section 4 and `pipeline/fetch_sources.py` that downloads them into `pipeline/raw/` (git-ignored). The WorldCover tile is 103 MB and WorldPop 16.5 MB from public URLs; the WHO register, Maina XLSX, COD-AB and COD-PS come from HDX and figshare; schools come from the SWALIM WFS; OSM from one Overpass call. For MAP travel time, the global 1 km GeoTIFF is large, so export the Bakool window from Google Earth Engine or take the Somalia 100 m surfaces from HDX if the download is slow.
2. **Pipeline, cells and access (Sat 20:30 to Sun 00:00).** Steps 1 to 4 of Section 5. Sanity checks before moving on: Bakool population from WorldPop against PESS 2014 (367,226) and IPC 2024 (543,371); facilities per district against the register; a printed table of the five districts.
3. **Land cover and index (Sun 00:00 to 02:00).** Steps 5 to 7; write `access10_v1.json.gz`, `facilities_v1.json.gz`, `schools_v1.json.gz`, `places_bakool_v1.json.gz`, `adm2_bakool_v1.json.gz`; add their formats to `docs/data-sources.md` in the style already used there.
4. **Rest (Sun 02:00 to 08:00).**
5. **Platform layers and Brief (Sun 08:00 to 11:00).** New entries in `frontend/src/config.ts`; five layer modules beside `map/layers/` (facilities as typed markers, travel time and access index as cell fills, land cover as the dominant class per cell, schools); new tiles in `panels/cellDashboard.ts`; the Brief card's four tiles and sentence; the ranking by index; `insights_figures.py` dimensions. `npm run build` and `pytest -q` green.
6. **Finder, offline (Sun 11:00 to 14:00).** A `/finder` route in the same app; `vite-plugin-pwa` service worker pre-caching the five Bakool files and the Bakool map tiles; fuzzy matching (Fuse.js) over places, facility names and service keywords; the answer templates and the four fail-safe sentences of Section 5; tested with aeroplane mode on.
7. **Voice (Sun 14:00 to 16:30).** Whisper tiny, quantized, through transformers.js with the language fixed to Somali, loaded once and cached by the service worker; the fixed answer sentences and facility names synthesised with MMS TTS Somali at build time and shipped as short audio clips, so the phone needs no speech model for output, only for input. Say in the video that synthesis runs at build time.
8. **Video and submission (Sun 16:30 to 19:30).** Record the planner journey on the laptop and the finder on a phone; five title cards in the order the PDF lists; README with the Data, Tech stack, Responsible AI and What happens next sections; `docs/video-script.md`, `docs/responsible-ai.md`, `docs/offline-package.md` with measured file sizes; push; deploy to the droplet with the playbook (or serve the production build from a temporary host if the droplet is not ready); submit the form with the repository link and the video. Submit at 19:30, then use the buffer only for fixes the judges would notice.

## 8. Risks, assumptions and what I would fix before you ship

Four things would cost points or credibility if left as they are: the platform's poverty points do not all match the OPHI table, the facility register has no status field so the demo must never say "open", the licences of three inputs do not allow a Ministry deployment as they stand, and the fixed Somali sentences must come from a native speaker, not a translation model.

| Item | Why it matters | What to do before shipping |
| --- | --- | --- |
| `mpi_points_v1.json` in geo-philanthropy gives Gedo 54, Bay 54 and Middle Juba 52; the OPHI 2024 report gives Gedo 0.489, Bay 0.511 and no value for Middle Juba (not surveyed) | A judge who opens the report will see the mismatch; the new ranking must not inherit it | Do not touch geo-somalia. In the new project add `mpi_regions_v1.json` with H, A and MPI for the 17 regions from Table 3.3, cite the page, and show Middle Juba as "not surveyed". Check where the old values came from when there is time |
| The WHO register (2021/2023) has name, type and coordinates only; no functional status, services or hours | The one-sentence problem statement rests on "nearest working facility"; the data cannot prove which ones work | Every screen says "listed in the WHO register, 2023"; the functional-status claim is cited as the national one-third figure; the finder's answer names two facilities, not one |
| MAP travel-time surfaces use a 2019 global facility list, not Bakool's register | Travel time and register can disagree in both directions | Compute both, show both, and flag cells where the register has no facility within one hour but the surface says under one hour, or the reverse |
| Licences: OSM and healthsites are ODbL (share-alike), WHO and OCHA files CC BY-IGO, Maina CC0, WorldCover and WorldPop CC BY 4.0; MMS TTS and NLLB are CC BY-NC 4.0; SWALIM layers carry no licence | Mixing ODbL into one redistributed file forces share-alike; NC blocks a Ministry or NGO deployment; no licence means no right to redistribute | One attributed file per source, attribution in the app footer and README; label the TTS as hackathon-only and plan recorded prompts; ask swalim@fao.org before shipping any SWALIM-derived layer |
| Somali speech recognition is weak: a Whisper-large fine-tune reports 50.96% word error on FLEURS; Whisper tiny will do worse, and no Af-Maay model exists | A confident wrong village is a wrong referral | Keep the yes/no confirmation on every heard name, show a failure handled in the video, name Af-Maay as the first language of Bakool and as the gap, in the video and the README |
| The fixed answer sentences and the fail-safe phrase must be in correct Somali | A machine-translated sentence read aloud to a health worker undermines the whole "localized" claim | Have a Somali speaker write and check the sentence templates on Sunday morning before synthesis; keep English as the second display language |
| Population: WorldPop 2020 gives one number; PESS 2014 (367,226) and IPC 2024 (543,371) bracket Bakool widely | The index's "people" term carries that uncertainty | Label every population figure "WorldPop 2020 estimate" and quote the bracket once in the dashboard's data note |
| The shares of people beyond one and two hours from care are the project's own computation; nothing published exists | Presenting them as a finding without saying so is the kind of overclaim the judges watch for | Write "our estimate from WorldPop 2020 and MAP 2020 surfaces" beside the number every time |
| HDX and Overpass refused automated downloads from both environments used today; the counts 520, 879 and 667 come from the HDX datastore mirror | The fetch script may need a browser download for two files | Run `fetch_sources.py` from a normal connection first thing; if HDX still refuses, download the WHO SHP and COD files in the browser into `pipeline/raw/` and record their checksums |
| The PDF gives no exact submission time ("by the end of the hackathon weekend") and the organizers are in several time zones | Submitting at Beirut midnight could be too late | Confirm the cut-off on the Hack-Nation form on Saturday night; the plan submits at 19:30 Sunday on purpose |
| Eligibility is 18 to 35 for entrants | A team member outside the range would void the entry | Confirm for every named team member before the form is sent |
| Entries without a video are not shortlisted | A finished tool with no video scores zero | Record the planner journey as soon as block 5 is done, the finder as soon as block 6 is done, and assemble at the end; do not leave recording to the last hour |
| The sentiment jobs and auto-refresh in the copied code call paid providers | Credit spent on readings nobody will see | `GEOSOM_AUTO_REFRESH=false` in the new `.env` and the Sentiment entry point behind a flag, done in block 1 |
| The Pro view's password is checked in the browser | It keeps visitors out of screens, not data | Put nothing sensitive behind it; the new project ships only public data, so this is a note, not a blocker |

**Assumptions this plan makes.** One builder working the blocks in sequence, with the voice block cut first if time runs short; Standard Somali as the demonstrated local language; the 10x10 km grid of the platform as the unit of analysis, with district totals for the Brief; a straight copy of the repository rather than a fork, so geo-philanthropy's history and secrets stay where they are. Figures marked second-hand in Section 4 (the ITU coverage shares via Ecofin, the Master Facility List via a press report) are used only with that label.
