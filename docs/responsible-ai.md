# Responsible AI, data and safety (the pass/fail criterion)

Everything here is true of the shipped prototype on 4 October 2026.

## Human in the loop

- The finder informs; the community health worker decides. It never books, refers, sends a message or
  diagnoses. The slip is composed by the tool and sent by the worker from her own SMS app, to a recipient she
  chooses, when she presses send.
- Every heard place name is confirmed with one tap and shows its match score. A referral slot (who, why)
  filled from speech is one of a fixed list of values; when the words match two values, the slot stays empty
  and the worker is told to tap the right one.
- Every answer names the list the facility is on and its date, and says that no source records whether it is
  open or staffed today; the higher-level facility is named as well as the nearest one.

## Fail-safes (a fixed list of answers)

| Situation | What the tool says |
|---|---|
| No place in Bakool matches the words well enough (match score under 0.6) | "Not sure. Ask a person." with the in-region candidates as chips and a typed path |
| The best match is a named place outside Bakool's five districts (Baydhabo, Berdale, …) | "{place} is outside Bakool. This finder covers Bakool only; ask a person who knows that area." |
| The question is about medicines, doses or treatment | "This finder only finds facilities and writes referral slips. It does not answer questions about medicines or doses. Ask it for a place; speak to a health worker about the treatment." |
| A service is asked for (delivery, vaccination, malnutrition, emergency) | "No list says which services a facility offers; ask there or at the district health office." When the nearest is a health post and the service is not vaccination (a health-post service in Somalia's essential package): "A health post may not handle {service}, so the nearest health centre is named too." |
| The case is a delivery or an emergency | "No hospital in Bakool is on either list. WHO reported services restored at Bakool Regional Hospital in Xudur town in January 2026; ask the district health office." |
| The place or the nearest facility is in a district with an access note | The answer is given, with the note, its year and its source, and the next facility as well |
| The microphone heard nothing | "I did not catch that. Speak closer to the phone, or type the name." |

The trigger for "not sure" is the match score of the heard or typed words against the closed list, not a
speech-confidence value: Whisper tiny produces none that we would trust.

## Hallucination

The speech recogniser (Whisper tiny) is a generative model and can produce fluent text from noise or
silence. Its output is never shown as an answer: it is matched against a closed list of 444 places, 72
facilities with a name and 5 districts, confirmed by a tap, and only then used to pick sentences from twelve
fixed answer templates (and four fail-safe sentences) filled with values read from the data files. A typed
name is answered without a confirmation only when it is the whole of what was typed, inside Bakool, and has
no namesake tied with it; `frontend/scripts/test-matcher.mjs` checks that this rule never answers a typed
question with the wrong place. There is no free-text generation anywhere in the
tool, on the phone or on a server (there is no server).

## No diagnosis, no imaging

Nothing reads an image or a symptom. The five "why" categories of the slip (pregnancy or delivery
complication, malnutrition, fever or illness, injury, other) are a referral reason chosen by the worker, not
a triage score. Google Open Buildings is remote sensing of buildings on satellite images, used as data for
the planner's map; it is not medical imaging.

## Patient data: where it sits, who can read it, what happens when the phone is lost or shared

The referral slip is the one place a patient is described. It carries no name, no number and no free text:
who (woman / child under five / man), why (five fixed categories), from (a place), to (a listed facility),
urgent (yes/no) and the time, composed into a code of at most 160 characters. In a hamlet of 20 buildings
"WOMAN DELIVERY URGENT 11:28 FROM X" can still identify a person, so we treat the slip as minimal patient
data and say so to the worker.

| | |
|---|---|
| **Where it sits** | On the worker's phone: the public data files (service-worker cache); the saved slips in `localStorage` (`finder-slips-v1`, at most 200, removed after 30 days); the recordings she chose to keep of her own voice asking about a place (IndexedDB `finder-voice-donations`). In her own SMS app once she sends a slip. With her mobile operator in transit, in clear, like every SMS. On the receiving phone. Questions are not stored; nothing is sent by the tool; there is no server and no account. |
| **Who can read it** | Whoever holds the unlocked phone; the number she chose, which should be a facility or district-office phone, not a personal one; the operator (SMS text and metadata). |
| **Consent** | The slip screen tells the worker: "The slip describes a person. Tell the person, or whoever is with them, what will be sent and to whom; they can say no." Kept recordings are offered only after a confirmed question about a place that named no service and described no case (never after a spoken slip), the offer says to keep it only if nothing about a patient was said and no one else was speaking, and the export asks for a confirmation that names the public-domain (CC0) release. |
| **Lost or shared phone** | Exposes the slip log and the kept recordings, nothing about anyone else. "Delete all" removes each in one tap; slips expire after 30 days; a screen lock is advised. The SMS app's own sent messages are outside the tool. |

## Kept recordings (the learning loop)

A worker who confirmed a spoken question about a place (one that named no service and described no case)
can keep the recording of her own voice, what the model heard, the text she confirms and the language she
says she spoke (Standard Somali, Af-Maay, other). It stays on the phone until she exports it herself as a
zip (clips plus `metadata.csv` in the audiofolder layout, with a per-phone random speaker id, not a person's
identity, and a licence column, CC0-1.0, named in the export confirmation) or deletes it. A spoken referral
slip is never offered for keeping. Somali has very little public speech data (FLEURS: read
sentences, none from Bakool, no place names, no health vocabulary) and Af-Maay has none; recordings like
these, corrected by the speakers, are how that changes on their own terms.

## Bias and language

Speech recognition is offered in Standard Somali and English; the first language of much of Bakool is
Af-Maay, for which no model, corpus or translation system exists. A Maay speaker will be understood worse or
not at all; the typed path, the shared place names and the yes/no confirmation are the mitigation, and the
gap is stated in the video, the README and the UI. The Somali interface text is a draft written without a
native speaker; every screen carries a "draft" tag until a Somali speaker has checked it, because the Somali
keyword lists also drive the slot filling, so a wrong word there routes a slip wrongly: the native check
matters for safety, not only for polish.

## Access notes

The district access notes (`frontend/src/finder/flags.ts`) are statements about 2024–2025 reporting (EUAA
2025 and 2026, UNOCHA via EUAA, Radio Ergo), shown with their year and source, phrased as practical
guidance (restricted access, roads reopened, check locally) and never as a political statement, since a
health worker's phone can be inspected on the road. They never block an answer.

## Data provenance

See `pipeline/sources.yaml` for every input with link, date, licence, size and gaps, and the README for what
the data does not cover.
