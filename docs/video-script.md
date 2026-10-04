# Video script, 2 to 5 minutes (entries without a video are not shortlisted)

Five title cards in the order the PDF lists them (section 08), the phone before the map inside the
demo, about 4 minutes 30 seconds in all. Record the phone segment first, today, in aeroplane mode, with a
real Somali utterance; if Whisper tiny mangles it, show exactly that and the confirmation catching it.
That footage scores higher than a staged success. Demo places that read cleanly: Kulunjerer, Garas Wiine,
Tayeeglow, Ceel Barde. Keep Falan Faay and Xudur town out of the finder demo: their answers name "Hudur IMC
MCH" and "Xudur MSF-Belgium MCH", 2005–2013 operator names; a health judge knows MSF left Somalia in 2013.
The register-date sentence covers it on screen, but the SMS code carries the name; do not make it the
headline shot. Show Xudur on the map instead.

## Card 1 — Problem statement (15 s)

Read the one sentence from the README over the map coloured by "People far from care", Xudur brightest:

> Because of this tool, a community health worker in Bakool will know, offline and on the spot, the nearest
> listed health centre for a referral and send a one-SMS slip ahead on the same day, instead of guessing or
> walking first to a health post that cannot help; we know because 62% of Somali women name distance as a
> barrier to care and only 21% of births happen in a facility (SHDS 2020, 21% in Bakool too), Somalia has
> 0.65 doctors per 10,000 people (WHO GHO, 2024 data), Bakool is the poorest of the 17 regions surveyed
> (97.4% multidimensionally poor, OPHI/SNBS 2024), and by our own estimate from WorldPop 2020 and the Malaria
> Atlas Project 2020 surfaces about 210,000 of its 440,000 people live more than an hour's walk from any
> listed facility.

## Card 2 — AI capabilities, why not SMS / spreadsheet / search, guardrails (35 s)

Spoken over the phone screen, roughly:

> The AI on this phone is one model: Whisper tiny, 41 megabytes, running in the browser, listening in Somali
> with the radio off. Everything after the ears is deliberately not AI. The place matcher is
> spelling-tolerant arithmetic over 444 names inside Bakool, the referral slip is slot filling over a fixed
> vocabulary, and every sentence you will see is one of sixteen fixed sentences filled from cited files. So nothing on the phone
> can invent a facility or a fact. Off the phone we use the output of a second model, Google's building
> detector on satellite images: it shows 99 villages more than an hour from any listed facility and 7 listed
> facilities with no building near their coordinates. SMS alone cannot hear Somali or match Hudur to Xudur;
> the slip ends as an SMS because that is what reaches a facility with a basic phone and 2G. A spreadsheet
> cannot be spoken to on a footpath. A search needs a connection and a page that does not exist.

End with the guardrails in one breath: fixed list of answers; yes/no on every heard name with its match
score; "not sure, ask a person"; places outside Bakool refused by name; the register date on every answer;
no diagnosis; no name on the slip; the worker presses send.

## Demo (150 s)

Phone, aeroplane mode switched on **on camera**; the amber pill "Offline · using saved data" and the green
"Voice ready offline" pill are the proof shots for rules 2 and 3.

1. **Typed (25 s).** "Garas Wiine" (Xudur district) → the answer: Garas Weyne Health Post 1.6 km, the
   modelled walk for its square, the nearest health centre or MCH above health-post level (Buur Dhuxunle
   MCH, 34.8 km), "listed in the 2019 database, not confirmed open", the Xudur road note with its source. Say: "every sentence is one of thirteen
   templates; the facility, the distance and the date come from the files."
2. **Spoken (30 s).** Tap Speak, ask in Somali, "I heard: …" with the seconds it took, "Did you mean … ?
   · match 86%" → Yes → the answer. Name the phone model on screen.
3. **Referral slip (40 s).** "Make a referral slip" → speak "haweeney uur leh dhiigbax degdeg" → woman /
   pregnancy or delivery complication / urgent fill; check the facility chip; the 115-character code
   appears; read the line "Nothing is sent by this tool. You choose who receives it and you press send";
   tap "Open SMS app": the phone's own messaging app opens with the code. Say out loud: no name, no number;
   she presses send when there is signal; the receiving facility sees who is coming, from where, and why.
4. **Failures handled (25 s).** A mis-heard name caught by "No" → the list; a place outside Bakool
   ("Baydhabo") refused by name; "how many tablets" refused; "Not sure. Ask a person." Say: "the model may
   mishear; it cannot answer."
5. **Laptop, the map (30 s).** "About 440,000 people live in Bakool's five districts… about 210,000 (48%)
   more than an hour's walk from a listed facility"; tap Xudur: "150,000 people, 61% over an hour, 15
   facilities on the 2019 database, 2 health centres or MCH, 62 villages with no care nearby, the access
   note"; switch to "Villages with no care nearby" (99 rose dots: no listed facility within 5 km, in a square
   averaging over an hour on foot); tap one hollow dashed dot: "no building detected within 500 m". Tap a square → "Find the nearest facility from Seynilow" opens the finder with
   the question filled in: the bridge from the planner to the phone.

No password, no other tabs, no AI readings: the whole product is on screen.

## Card 3 — The gap, where it sits in the day, the stack (25 s)

A morning round in a Bakool village; the worker meets a referral case and asks the phone in her pocket
where to send her, with no signal; the slip waits in her SMS app until the road gives a bar. Stack: Vite +
TypeScript PWA with a service worker; transformers.js + ONNX Runtime Web running Whisper tiny (8-bit ONNX)
in WebAssembly; a Python pipeline (geopandas, rasterio) over WorldPop, Malaria Atlas Project, WHO/HDX
facility lists, OpenStreetMap, OCHA boundaries and Google Open Buildings; static hosting, no server code.

## Card 4 — Data (25 s)

Three slides: built with / shows the problem / what the data does not cover (the README paragraph: no
status or services in any public register, no hospital in Bakool on any list although WHO reports one
restored in Xudur, HeRAMS and the 2026 Master Facility List not public, MAP's inputs a 2019 compilation,
WorldPop a model bracketed by 367,000–543,000, Open Buildings misses tents, 20 named places in Ceel Barde,
SDI has no Somalia survey, no Af-Maay model, the Somali text a draft). Then the matcher test line from
`docs/evaluation.md` and, if run, the speech smoke-test line.

## Card 5 — Your take on localizing AI (20 s)

Localizing means the language people actually speak: Af-Maay has no model, so we name it as the gap and
built the loop that starts closing it, recordings kept by the workers themselves, exported on their own
terms. It means data the Ministry owns: the finder loads the Master Facility List the day it is public, and
the slip's six fields are a DHIS2 event. And it means answers a person can check: a closed list, a
confirmation, a date on every sentence, and a worker who presses send.
