# Geo Health · Bakool — a Small AI facility finder and referral slip for Somalia's poorest region

**Challenge 04, Small AI for Development (Hack-Nation × World Bank Youth Summit), Health sector (Annex A).**
One map, one phone tool, one data pipeline. Everything the user sees runs in the browser; the phone part
runs with the radio off.

- **The map** (`/`): who in Bakool lives far from a listed health facility, and where the nearest one is,
  in plain English or Somali, on a 10 × 10 km grid. For a district health planner on a laptop.
- **The phone finder** (`/finder.html`): a health worker asks, by voice or text in Somali, where the nearest
  listed facility is from a place; the tool confirms what it heard, answers from fixed sentences, and turns
  the referral into a slip that fits one SMS (at most 160 characters) with no name, which she sends from her
  own SMS app when a bar of signal appears. Installable, offline after the first visit.

## Problem statement (the challenge's template)

> Because of this tool, a community health worker in Bakool will know, offline and on the spot, the nearest
> listed health centre for a referral and send a one-SMS slip ahead on the same day, instead of guessing or
> walking first to a health post that cannot help; we know because 62% of Somali women name distance as a
> barrier to care and only 21% of births happen in a facility (SHDS 2020, 21% in Bakool too), Somalia has
> 0.65 doctors per 10,000 people (WHO GHO, 2024 data), Bakool is the poorest of the 17 regions surveyed
> (97.4% multidimensionally poor, OPHI/SNBS 2024), and by our own estimate from WorldPop 2020 and the Malaria
> Atlas Project 2020 surfaces about 210,000 of its 440,000 people live more than an hour's walk from any
> listed facility.

Every number above is in the sources list at the end; "our own estimate" is labelled as such wherever it
appears in the app.

## What the health worker does

1. Opens the finder on her Android phone (a web page, installable, no store, no account). After the first
   visit it works offline.
2. Taps **Speak** and asks in Somali, or types: *"xarunta ugu dhow Kulunjerer"*, *"dhalmo Waajid agteeda"*.
3. Reads **"I heard: …"** and confirms the place with one tap (**Did you mean Kulunjerer? · match 100%**), or
   picks from the list, or gets **"Not sure. Ask a person."**
4. Reads the answer: nearest listed facility with distance and direction, the modelled walk and drive time,
   the nearest health centre or MCH centre above health-post level, the list the facility is on and its
   date, and the district's access note with its source.
5. Taps **Make a referral slip**, says or taps who and why, checks the facility, and taps **Open SMS app**:
   her own messaging app opens with `GH-REF 2026-10-04 11:28 FROM Tayeeglow TO Tiyeglow Maternal & Child
   Health. WHO WOMAN WHY DELIVERY URGENT ID XMRAQZ`; she chooses the recipient and presses send when a bar of
   signal appears. The tool sends nothing itself.

## What is AI here, and what is deliberately not

**The AI on the phone is one model**: OpenAI Whisper tiny, quantized to 8 bits (41 MB), running inside the
browser on the phone's own CPU (transformers.js + ONNX Runtime Web, WebAssembly), language fixed to Somali
or English, no audio ever leaving the phone. It turns the worker's spoken question or referral into text
with no signal.

**Everything after the ears is not generative, on purpose.** The words are matched, spelling-tolerantly
(Xudur / Hudur / Huddur, Ceel Barde / El Barde), against a closed list of 444 named places inside Bakool,
72 listed facilities with a name and 5 districts; every heard name is confirmed with one tap and shows its
match score; a typed name is answered without a confirmation only when it is the whole of what was typed,
inside Bakool, and has no namesake tied with it; the answer is assembled from twelve fixed answer sentences
(plus four fail-safe sentences) filled from cited public files; the referral is slot-filled from a fixed
vocabulary (3 who × 5 why × urgent) into a code that fits one SMS; when the words match two values for a
slot, the slot stays empty and the worker is told. The model can mishear; it cannot answer. Off the phone we
use the output of a second model as data: Google's Open Buildings detector on satellite imagery (remote
sensing of buildings, not medical imaging), which shows 99 villages of 20+ buildings with no listed facility
within 5 km that lie in squares averaging over an hour's walk to care, and 7 listed facilities with no
building within 500 m of their coordinates.

**Why not SMS, a spreadsheet or a search.** An SMS service needs a tower at the moment of asking, a server, a
short code and someone who can type Somali; this tool hears Somali with no network and uses SMS only as the
transport for the slip, when a bar appears (store-and-forward). A spreadsheet cannot be spoken to on a
footpath with a patient in one arm. A search needs a connection and a page that does not exist for Bakool.
Mwana and mTrac, the SMS systems the brief cites, routed coded messages; this tool produces the coded
message from Somali speech, offline, with no name and no number in it.

**Guardrails** (the pass/fail criterion): a fixed list of answers; a yes/no on every heard name; "not sure,
ask a person" when nothing in Bakool matches well enough; a refusal by name for places outside Bakool;
a refusal for questions about medicines and doses; the register's date on every answer and "not confirmed
open or staffed today"; no diagnosis, no imaging; nothing sent by the tool; a slip with no name and no
number; a person makes the final call.

## The four rules of the challenge

| Rule | How this entry meets it | Evidence |
|---|---|---|
| Runs on a device the user already has | An installable web page in Chrome on any Android phone; no store, no account. The output is an SMS, so the facility can receive it on a basic phone. | Video: the phone, the home-screen icon. `docs/offline-package.md` |
| Its core feature works offline | A service worker keeps the page, the four data files and the speech model; the finder answers, confirms, refuses and writes slips with the radio off. The map (basemap tiles) needs the network and is the planner's side. | Video: aeroplane mode switched on on camera, then a spoken and a typed question. Headless test in `docs/evaluation.md` |
| Model files small enough to side-load or send over a weak connection | Typed finder: about 0.1 MB. Voice pack: about 70 MB (41 MB model, 27 MB runtime, 4 MB of config), ordinary static files, downloaded once on Wi-Fi after the tool asks, or served from a clinic laptop; daily use is zero bytes. The next open model that hears Somali (Meta MMS) is about 4 GB. | `docs/offline-package.md` (sizes measured from the build) |
| At least one interaction in a local language, named; how it fares in a less-supported one | Somali (Af-Soomaali), by voice and text; English as the second language. **Af-Maay**, the language of the Rahanweyn clans who form much of Bakool's population, has no speech model, no corpus and no translation model; Maay-only speakers do not fully understand health messages in Standard Somali (MRG/CLEAR Global 2023). A Maay speaker gets the typed path (place names are shared), the yes/no confirmation that catches mishearing, and a one-tap way to keep her corrected recordings so the first Af-Maay speech data is built by the people who speak it. The Somali strings are a draft until a native speaker has checked them; the UI says so. | `frontend/src/finder/strings.ts`, the "draft" tag in the UI, `docs/responsible-ai.md` |

## Evidence it works (team tests, not users)

`node frontend/scripts/test-matcher.mjs` runs every named place inside Bakool, every listed facility and the
five districts through the finder's matcher and the finder's own decision rule, in their own spelling inside
eight question frames (English and Somali) and in the spelling variants a Somali speaker or a speech model
produces. The result table and the rule are in `docs/evaluation.md` (4 October 2026, 521 targets, 5,593
questions): in its own spelling the right place is answered directly 87.5% of the time and is first or in the
top five 99.8%; with spelling variants it is answered directly or confirmed first 84% and is in the top five
97.5%. The test also counts typed questions that the rule would answer without a confirmation with
the wrong place, and fails if that count is not zero; the five out-of-region controls (Baydhabo, Baidoa,
Berdale, Muqdisho, Beledweyne) are refused by name 5/5. Spoken questions are always confirmed.

The speech smoke test (20 Bakool place names spoken by the team, task success after confirmation, time per
question on the demo phone) and its reporting sentence are set out in `docs/evaluation.md`; run it on the
demo phone before the video and paste the numbers there. No Somali word-error rate is claimed that we did
not measure.

## Data: built with, shows the problem, and what it does not cover

**Built with** (every file: link, date, licence, size and gaps in `pipeline/sources.yaml`): WHO Somalia
health facilities on HDX, CC BY-IGO (the 2023 SHP whose fields and records match the WHO/KEMRI database of
Maina et al. 2019, from lists dated up to 2013: 68 Bakool records after removing 4 duplicates; and the 2021
WHO/MoH XLSX: 9 Bakool rows, 4 with coordinates, 3 of them inside the district polygons — Yeed sits on the
border); OpenStreetMap via Overpass, ODbL (444 named places inside the districts, 1 unnamed health site);
WorldPop 2020 constrained 100 m, CC BY 4.0 (Bondarenko et al. 2020); Malaria Atlas Project 2020 travel time
to healthcare, walking and motorized, CC BY (Weiss et al. 2020); ESA WorldCover 2021, CC BY 4.0 (land cover
per square, kept in the files); OCHA COD-AB (edition 2026-01-26) and COD-PS, CC BY-IGO; Google Open
Buildings V3, CC BY 4.0 (55,985 detections at confidence ≥ 0.7 inside Bakool's squares, 192,799 in the
download box; 279 settlement clusters); OPHI/SNBS Somalia MPI report 2024, Table 3.3; UNFPA PESS 2014 and
FSNAU/IPC 2024 for the population bracket; OpenAI Whisper tiny, MIT (8-bit ONNX export by onnx-community);
transformers.js (Apache-2.0) and ONNX Runtime Web (MIT). Nothing synthetic.

**Shows the problem**: SHDS 2020 (UNFPA/SNBS; national and South West State reports), WHO Global Health
Observatory (HWF_0001, HWF_0006, UHC_INDEX_REPORTED), OPHI/SNBS 2024, EUAA Somalia security situation 2025
and 2026 (Bakool), Radio Ergo (May 2025), WHO EMRO (January 2026), EC April 2025 via EUAA ("only 1/3 of
existing health facilities are functional", national).

**What our data does not cover.** The two public facility lists give name, type and location only: no
functional status, services, staffing, opening hours or phone numbers. The lists overlap, so we count them
apart and never say "open". Neither lists a hospital in Bakool; Bakool Regional Hospital in Xudur (WHO,
January 2026) is missing, and the app says so. WHO HeRAMS and the Ministry's 2026 Master Health Facility
List, which record status, are not public. Travel times are a 2020 global model to a mid-2019 facility
compilation that includes our own main register, with no road closures from insecurity or rain. Population
is WorldPop's 2020 model (about 441,000 for Bakool; UNFPA PESS 2014 gave 367,226 and the FSNAU/IPC
projection for Oct–Dec 2024 543,371). Open Buildings misses tents and small shelters, so counts are a lower
bound in pastoral areas. OpenStreetMap place names are sparse (20 named places in Ceel Barde) and
unverified. The Malaria Atlas Project surface gives one modelled walk per square, to its own facility set;
it is shown as an average for the square, not as the walk to the named facility. SHDS 2020 reports Bakool only for its surveyed
domains, not by district; the World Bank Service Delivery Indicators have no Somalia survey. The index score
uses one poverty rate for the whole region (97.4%), so within Bakool it ranks squares by people × walking
time; poverty would separate regions, not squares. Speech recognition covers Standard Somali and English
only, with an unmeasured and certainly high word-error rate for Somali place names; no Af-Maay model or
corpus exists. The Somali interface text is a draft.

**Annex A's datasets.** We use Maina et al. 2019 (the WHO/KEMRI database) as the main register, WHO's 2021
list and OpenStreetMap as cross-checks (healthsites.io: 92 Somalia records, checked, not used), Malaria
Atlas Project surfaces for travel time, WorldPop for people, HDX for boundaries and district population,
and WHO GHO for workforce and coverage figures. The Service Delivery Indicators have no Somalia survey;
Somalia has no DHS or SPA, so SHDS 2020 stands in. AccessMod was not run; recomputing travel time to our own
register and, when it is public, to the Master Facility List is the first next step. DHIS2 is the system
the brief says a record most plausibly lands in: the slip's fixed tokens (receiving facility, case type,
urgency, origin, time, check code) were chosen so they map onto a DHIS2 event, and DHIS2 accepts
SMS-submitted events; this is a design fit, not an integration we built.

## Responsible AI, data and safety

**Where the data sits.** On the phone: the public data files (service-worker cache), the saved slips
(`localStorage`, place, facility, case type, urgency, time and a 6-character check code; no name, no number;
removed after 30 days; "Delete all" in one tap), and any recordings the worker chose to keep of her own
voice asking about a place (IndexedDB). Questions are not stored. Nothing is sent by the tool.

**Patient data, honestly.** The slip is the one place a patient is described, and in a hamlet of 20
buildings "woman, delivery complication, urgent, 11:28, from X" can identify a person. We treat it as
minimal patient data: the slip screen tells the worker to tell the patient, or whoever is with her, what
will be sent and to whom, and that she can refuse; the slip travels as an ordinary SMS over the operator's
network, in clear, to a number the worker already knows, which should be a facility phone; whoever holds
that phone can read it. A spoken referral slip is never kept or offered for keeping. **A lost or shared
phone** exposes the slip log and the kept recordings, nothing about anyone else; a screen lock is advised,
and the SMS app's own history is outside the tool.

**Human in the loop.** The worker confirms every heard name, chooses the facility, chooses the recipient and
presses send. The tool never books, refers, sends or diagnoses. Whisper is itself a generative model and can
produce fluent text from noise; its output reaches an answer only after a match against a list a person
wrote and a tap. Recordings are offered for keeping only after a confirmed question about a place that named
no service and described no case; exporting them is a confirmed public-domain (CC0) release of the worker's
own voice.

**Bias and language.** Standard Somali only for speech; Af-Maay named as the gap (above); the typed path and
the confirmation are the mitigation; the "draft" tag stays on every Somali string until a native speaker
has checked it. Full account in `docs/responsible-ai.md`.

## Scalability and what happens next

The pipeline takes any region name (`python pipeline/build_bakool_health_v1.py --region <ADM1>`); the
finder is static files plus a 55 KB data pack, so a district can update its facility list by replacing one
file; the model never re-downloads. The day the Ministry's Master Health Facility List or a HeRAMS export is
public, the pipeline reads it in place of the 2019 database and the finder can say "listed in the 2026
register" and, where the register has it, "open". Travel time to the Ministry's own list via AccessMod is
the second step; Somali speech data from workers' kept recordings, and the first Af-Maay prompts recorded by
a Maay speaker, are the third. Voice output waits for a Somali speaker's sign-off of 13 sentences: we would
rather show text than have a machine read unchecked Somali to a health worker. The speech smoke test on the
demo phone (`docs/evaluation.md`, section 3) is the one measurement still to be made before the video.

## Run it

```
cd frontend
npm ci --ignore-scripts        # onnxruntime-node's postinstall fetches GPU binaries the browser never uses
npm run prepare-offline        # copies the ONNX runtime into public/ort/ (once)
python ../pipeline/fetch_models.py   # Whisper tiny, 8-bit ONNX, 44 MB with its config files, into public/models/ (once)
npm run dev                    # http://localhost:5173/  and  /finder.html
npm run build                  # dist/ is a complete static site, data included
node scripts/test-matcher.mjs  # the matcher test (about 4 minutes)
```

Microphones and service workers need HTTPS or `localhost`. To use the finder from a phone on the same
network during development: `npm run build && npx vite preview --host`, then on the phone `adb reverse
tcp:4173 tcp:4173` and open `http://localhost:4173/finder.html`; or deploy `dist/` to any HTTPS static host
(`deploy/` has an Nginx configuration with the headers the speech runtime needs: `microphone=(self)`,
`script-src 'self' 'wasm-unsafe-eval'`).

## Layout

| Path | What it is |
|---|---|
| `frontend/index.html`, `src/panels/bakool.ts`, `src/map/layers/*` | The map: the Bakool card, the squares, the fills and points |
| `frontend/finder.html`, `src/finder/*`, `public/sw.js`, `public/finder.webmanifest` | The phone finder: matching, answers, speech, referral slip, kept recordings, offline |
| `frontend/scripts/test-matcher.mjs` | The matcher test behind the evidence section |
| `data/*.json.gz` | The versioned data files the app reads (about 250 KB) |
| `pipeline/sources.yaml` | Every source with link, date, licence, size, gaps, and whether the shipped files use it |
| `pipeline/fetch_sources.py`, `fetch_open_buildings.py`, `fetch_models.py` | Downloads into `pipeline/raw/` and `frontend/public/models/` |
| `pipeline/build_bakool_health_v1.py`, `build_buildings_v1.py`, `postprocess_v1.py` | The data files: people, travel time, facilities, index, buildings, settlements, checks |
| `pipeline/synth_clips.py` | Voice clips for the answers, to be run only after a Somali speaker clears the sentences |
| `docs/video-script.md`, `docs/responsible-ai.md`, `docs/offline-package.md`, `docs/evaluation.md` | The submission documents |
| `docs/plan.md` | The 3 October plan the project came from, with a note on what the 4 October simplification changed; where it differs from the README, the README is current |
| `deploy/`, `docker-compose.yml`, `.github/workflows/` | One Nginx container for the static site; CI builds and runs the matcher test |

Built by NexaSEE on its open-source `geo-somalia` map platform (Vite, TypeScript, Leaflet); the Bakool
health layers, the finder, the pipeline and the data files are new for this challenge. Licences: OSM-derived
records carry their ODbL licence on each record and are never merged into a derived value with other
sources; WHO and OCHA files CC BY-IGO; Maina et al. 2019 CC BY (article) with the figshare record's own
licence; WorldPop, WorldCover and Open Buildings CC BY 4.0 (attributions in the app's sources list);
Whisper MIT; MMS TTS CC BY-NC 4.0, not shipped.
