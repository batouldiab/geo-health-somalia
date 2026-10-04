# Geo-Health Somalia — 45-second demo video script

Working title: **Now you see Bakool**
Runtime 0:45 · 130 words of voiceover (≈175 wpm, a brisk read) · Narrator: Batoul, on camera for the hook and the pivot, voiceover over screen recording for the rest.

The structure mirrors the winning sample (60 s): human stakes → the mechanism in three lines → one-line promise → demo narration → guardrail → tagline. Every number in the voiceover and on screen is open, published data; the sources are listed under the table.

## The script

| Time | Voiceover | On screen | Lower-third text (keep each on screen ≥ 2 s) |
|---|---|---|---|
| **0:00–0:12 · HOOK** | "Bakool, Somalia. The poorest region of one of the poorest countries on Earth. In Seynilow, the nearest listed clinic is seventeen kilometres away — over three hours on foot — and nobody knows if it is open." | 0:00 Batoul to camera, plain background, first sentence only. 0:04 cut to the map at `/`: Bakool coloured by **People far from care**, Xudur brightest, districts named. 0:07 fly to Waajid and the Seynilow square (`/?d=waajid&layers=tt,fac&cell=486_43`). 0:10 tap the square: the card. (Optional opener instead of 0:04: the night-light view on geo-philanthropy.nexasee.com, Somalia from space at night with the south-west dark; label it "NexaSEE platform" if you use it, since the submission's map has no night-light layer.) | "Bakool · 97.4% of people live in poverty — OPHI/SNBS MPI 2024" → "Seynilow, Waajid district · nearest listed facility 17 km (straight line from the square) · walking ≈ 3 h 40 min for the square (modelled, MAP 2020) · listed 2019, not confirmed open" |
| **0:12–0:19 · PIVOT** | "I can't fix the world in twenty-four hours. So: one region, one question. Who is poorest — and furthest from care?" | Back to camera for the first sentence. On "one question", cut to the map coloured by People far from care; the 10×10 km squares light up in a quick sweep from dark to bright. Three stat tiles drop in under the question. | "0.65 doctors per 10,000 people — WHO 2024" · "21% of births happen in a facility — SHDS 2020" · "No public register says which facilities are open" |
| **0:19–0:34 · DEMO** | "Geo-Health Somalia stacks UN, WorldPop, poverty and satellite data on one ten-kilometre grid and ranks every square by need. Then, offline on an ordinary phone, it answers a health worker in Somali: where is the nearest listed clinic — and the nearest that takes referrals." | Screen recording of the map: press the big buttons one per word — People far from care → Walking time to care → Buildings seen from space → Listed facilities → Villages with no care nearby — and end on the villages layer (99 rose dots). Cut to the phone with the aeroplane-mode icon and the "Offline · using saved data" pill visible: she speaks the Somali question, "Did you mean …? · match 86%" catches the place name, the fixed answer shows distance, walking time, list date. | "WorldPop 2020 · OPHI 2024 · Malaria Atlas travel time 2020 · ESA WorldCover 2021 · Google Open Buildings 2023 · WHO / OCHA (HDX) · OpenStreetMap" → "Offline · Whisper tiny, 41 MB, Somali · fixed answers, no free text" |
| **0:34–0:42 · BRIDGE** | "Next: a clinic texts a question — free. A Doctors Without Borders doctor answers. And every question becomes a dot on the map." | Animated loop in five beats: phone at a health post → SMS → platform inbox → a volunteer doctor's reply screen → SMS back → a new dot lights up on the Bakool map. Use the architecture figure's dashed amber panel (`docs/architecture.png`) as the backdrop. (Optional still at the end: the 2019 register entry "Xudur MSF-Belgium MCH Centre" with "MSF closed it in 2009"; the judge review advised keeping stale operator names out of the finder demo, so if you use it, keep it on the map side and short.) | "Proposed · donor-sponsored SMS line · a doctor answers, never a model · sender and responder logged · no patient names" |
| **0:42–0:45 · CLOSE** | "The AI informs. People decide. Now — you see Bakool." | Logo card: Geo-Health Somalia · NexaSEE. One line under it: "Open data. Open source. Human in the loop." | "geo-health.nexasee.com" |

## Pace and cuts

130 words in 45 seconds is about 175 words a minute, a brisk read. The sample video runs nearer 130 words a minute with pauses; at that pace this script is a full 60 seconds. To hold 45 seconds at the calmer pace, make two cuts: "of one of the poorest countries on Earth" → "Somalia's poorest region" (saves six words, the lower-third still carries the claim), and drop "— and the nearest that takes referrals" (seven words; the phone screen shows it anyway).

If you can go to 60 seconds like the sample, keep every word and add one beat before the close, on the phone: a mis-heard village caught by "No" and the "Not sure. Ask a person." sentence, with the line "The model can mishear. It cannot answer." (8 words, 6 s). Lower-third: "yes/no on every heard name · 'not sure, ask a person' · places outside Bakool refused by name". A handled failure on camera scores higher than a staged success.

## Every number, its source

| Said or shown | Figure | Source |
|---|---|---|
| Bakool, poorest region; 97.4% live in poverty | H = 97.4%, A = 68.7%, MPI 0.669; national H = 67.0% (poorest of the 17 regions surveyed; Middle Juba not surveyed) | OPHI / Somalia National Bureau of Statistics, Somalia MPI report 2024, Table 3.3 |
| Seynilow: nearest listed clinic 17 km, over three hours on foot, ~7,300 people in the square | Kulunjerer Health Post, 17.4 km straight line from the square's centre, the figure the card shows (the OSM village node itself is 20.2 km from it); Maina et al. 2019 database, inputs 2005–2013; nearest health centre or MCH above health-post level about 31 km; population-weighted walking time of the square 219 min (MAP 2020); square population 7,300 (WorldPop 2020). Rank 1 of 272 Bakool squares on the index | This project's `data/access10_v1.json.gz`, `places_bakool_v1.json.gz`, `facilities_v1.json.gz`; our estimate |
| "Nobody knows if it is open" | No public register carries functional status; nationally "only 1/3 of the existing health facilities are functional" | WHO/HDX register (2021/2023) has no status field; EUAA Somalia healthcare report, June 2025, quoting the European Commission |
| 0.65 doctors per 10,000 people | 0.65 (2024); 0.48 (2014) | WHO Global Health Observatory, HWF_0001, Somalia |
| 21% of births in a facility | 21% nationally (urban 28%, rural 15%, nomadic 3%); 32% skilled attendance; 62% of women name distance as a barrier | Somali Health and Demographic Survey 2020 (UNFPA / SNBS) |
| Bakool region, project totals (the map card) | 441,586 people in Bakool squares (WorldPop 2020); 211,000 (48%) more than an hour's walk from any listed facility; 88,800 (20%) more than two hours; Xudur district 149,000 people, 61% more than an hour away; 73 listed facility records (68 from the 2019 database, 4 from the 2021 list, 1 OSM), 11 health centres or MCH centres above health-post level, 7 with no building within 500 m; 279 settlements seen from space, 99 with no listed facility within 5 km and more than an hour on foot | Our estimate from WorldPop 2020 × MAP 2020 surfaces, WHO/HDX + Maina 2019 lists, Google Open Buildings V3 |
| "Xudur MSF-Belgium MCH Centre", MSF closed it in 2009 | MSF opened a medical and nutritional project in Huddur (Xudur), Bakool, in 2000 and closed the health centre in 2009; it closed all Somalia programmes on 14 August 2013 and returned in May 2017 (Baidoa, Galkayo; not Bakool) | Maina et al. 2019 facility list (name as recorded); MSF Somalia timeline; msf.org Somalia page |
| MSF answers field doctors remotely (for the bridge card) | MSF telemedicine since 2010, store-and-forward: 5,646 cases from 221 hospitals in 63 countries (2010–2017), 382 specialists, median reply 5.1 h | Delaigue et al. 2018, Journal of Telemedicine and Telecare (PMC6292825) |
| Why SMS (for Q&A) | 2G covers ~90% of the population, 3G ~80%, 4G ~50% (ITU 2023, as cited by Ecofin — second-hand, say so); 27.9% of people use the internet (2024); 54 mobile subscriptions per 100 people (2023) | ITU via Ecofin Agency; Our World in Data / ITU; World Bank WDI |

## What is built and what is proposed (say it the same way the judges will read it)

- Built and recordable now: the map (`/`, the Bakool card in English/Somali, the five layer buttons), the Open Buildings settlements and facility checks, the offline finder with Somali voice in, the referral slip that opens the phone's SMS app. Not in the submission since the 4 October simplification: night lights, roads, Pro view, iSEE Analytics and Sentiment (they remain on geo-philanthropy.nexasee.com).
- Proposed, not built: the Doctors Without Borders SMS bridge. The script says "Next:" and the lower-third says "Proposed" on purpose. Do not present MSF as a confirmed partner; if asked, the honest framing is "a volunteer-specialist network of the kind MSF has run online since 2010, brought to a 2G phone". If you would rather not name MSF before speaking to them, the line works as: "A volunteer doctor answers."
- AI value in the bridge that an SMS alone cannot give: urgency and intent classification of each question, Somali→English draft translation for the responding doctor, an automatic check that no name or phone number travels in the text, routing to the right specialty, and the question-density layer on the map. A person writes every answer.

## Where the 45 seconds fit the submission

The concept note requires a 2–5 minute video with five parts in order (problem statement in the template sentence; AI capabilities and why SMS/spreadsheet/search would not do; demo end to end; the gap, where the tool sits in the day, tech stack; your take on localizing AI). Entries without it are not shortlisted. Use these 45 seconds as the opening, then continue with the cards in `docs/video-script.md`:

| Required part | Covered by |
|---|---|
| Problem statement (template sentence) | Title card right after 0:45, read aloud: the sentence in the README |
| AI capabilities and guardrails | Card 2 of `docs/video-script.md` (40 s) |
| Demo end to end | The planner journey and the phone, including one failure handled ("not sure, ask a person") |
| Gap, user's day, tech stack | Card 3 (30 s) |
| Your take on localizing AI | Card 5 (20 s): the language people speak (Af-Maay named as the gap), data owned by the Ministry, answers a person can check |

## Recording notes

- First frame: you, on camera, like the sample. One sentence, then cut to the map. Keep the camera framing for the pivot so the "I can't fix the world" line lands as a person speaking, not a slide.
- Record the map journey as deep links so the fly-in is smooth: `/` (the Bakool card is the landing page), then `/?d=waajid&layers=tt,fac&cell=486_43`; `&lang=so` for the Somali card.
- Phone section: show the aeroplane-mode icon in the status bar in the same shot as the spoken question. The Somali question and the fixed answers are in `frontend/src/finder/strings.ts`; they are drafts until a Somali speaker has checked them, so have them checked before recording.
- Captions in English for the judges (burned in); the Somali spoken line gets an English subtitle.
- Music: one low, steady bed, no drop at the close; the last three seconds carry the tagline alone.
- Keep the "Proposed" lower-third on the bridge segment in the final cut. It costs nothing and protects the Responsible AI pass/fail.
