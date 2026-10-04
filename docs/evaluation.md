# Evidence it works: what was measured, how, and what is still to be measured on the demo phone

Nothing here involves users; these are team tests, and they are reported as such. No Somali word-error
rate is quoted that we did not measure ourselves.

## 1. The place matcher and the finder's decision rule (measured, 4 October 2026)

Every spoken or typed question passes through the same closed-list matcher (`frontend/src/finder/match.ts`):
a spelling-tolerant key for Somali names (x↔h, dropped c, dh→d, kh→k, q→k, long vowels shortened, y→i),
Dice similarity over character bigrams, and two thresholds (0.92 and 0.6). The finder's decision rule
(`src/finder/main.ts`, `ask()`): a **spoken** question is always confirmed ("Did you mean … ? · match
86%"); a **typed** question is answered without a confirmation only when the best match scores ≥ 0.92, is
inside Bakool, is the whole of what was typed (so "Buulo Fu" asks "did you mean Buulo?" instead of
answering as Buulo) and has no namesake tied with it more than 2 km away (two villages called Buulo
Jadiid, in Xudur and in Tayeeglow, are asked about, with the district shown); otherwise the confirm card;
below 0.6, "not sure, ask a person"; a confident match outside Bakool is refused by name.

The test (`frontend/scripts/test-matcher.mjs`, `node scripts/test-matcher.mjs`, about 4 minutes) runs the
521 in-region entries of the finder's gazetteer (444 named OpenStreetMap places inside Bakool's five
districts, 72 listed facilities with a name, 5 districts) through eight question frames in English and
Somali in their own spelling, and through the spelling variants a Somali speaker or a speech model produces
(x↔h, c dropped, dh→d, q→k, kh→k, a long vowel shortened, a dropped last letter, a dropped inner letter) in
one frame, and applies the rule above. The gazetteer also holds 577 named places outside the districts,
kept only so that they are refused by name.

| Questions | n | answered directly, right place | right place first, "did you mean" | right place in the top five | "not sure, ask a person" |
|---|---|---|---|---|---|
| Own spelling, in a question | 4,168 | 87.5% | 11.3% | 1.0% | 0.2% |
| Spelling variants | 1,425 | 40.5% | 43.6% | 13.4% | 2.5% |

Typed questions the rule answered directly with the wrong place: **0 of 5,593** (the test fails if this is
not zero; a dropped letter that spells a real neighbour, "Gomrey" for Gomorey, is a different question and is
counted as answered correctly). Out-of-region controls (Baydhabo, Baidoa, Berdale, Muqdisho, Beledweyne):
refused by name 5 of 5. The "did you mean" share in the first row is mostly names shared by two places in
different districts, names that contain a Somali function word (la, ka, oo …) and multi-word names; one tap
resolves each. The "not sure" cases are mostly a dropped last letter on a short name where a shorter
neighbour matches exactly; the candidate list still shows the right one in most of them.

Reading: spoken Somali place names will reach the matcher with errors worse than these variants, so the
right place will usually appear as a "did you mean" or in the list rather than first; that is why the
confirmation step exists and why the demo shows it.

## 2. The offline path (verified headlessly, 4 October 2026)

In a headless Chromium: one online visit to `/finder.html`; the service worker's cache then held the page,
its three hashed bundles, the four data files, the icons and the manifest. With the network switched off,
`/finder.html?q=Xudur` loaded from the cache, showed "● Offline · using saved data" and answered with the
nearest listed facility, the modelled walk, the higher-level facility, the register sentence and the access
note. The map page needs the network for its basemap tiles and is not claimed to be offline.

## 3. The speech smoke test (to run on the demo phone before the video)

Measure task success, not word-error rate: what matters is whether the right place is confirmed, not whether
every word is right.

**Items (20 utterances).** Towns: Xudur, Waajid, Ceel Barde, Tayeeglow, Rab Dhuure, Yeed, Buur Dhuxunle,
Goobato, Garas Wiine; villages: Kulunjerer, Garas Weyne, Huddur Gaddud, Shiimi, Qurac-Joome, Abaq Beeday;
facility names: "ACF Wajid HC", "Hudur IMC MCH"; controls (expected: refused): Baydhabo, Muqdisho; plus one
service question ("dhalmo Waajid agteeda"). Say each as a natural question ("Xarunta ugu dhow Xudur
halkee?"), quiet room, phone at arm's length, one or two speakers. Say in the report whether the speakers
are native.

**Procedure.** Open `/finder.html?debug=1` on the phone (or on a laptop with the recordings): for each item
tap Speak, say it, tap Stop; note what "I heard" shows and the seconds under it, whether the confirm card
names the right place (top-1), whether the right place is in the list after "No" (top-5), and whether the
controls were refused. For the five slip sentences of the video script, open a slip and use
`finderDebug.fillSlip('<sentence>')` in the console, or speak them, and count the slots filled correctly
(of 15). The debug hook also exposes `finderDebug.transcribeBlob(blob)` and `finderDebug.match(text)` so a
set of recorded clips can be run in one loop from the console.

**Report sentence (fill in the numbers; do not round up):** "Smoke test, n = 20 utterances (9 towns, 6
villages, 2 facility names, 2 out-of-area controls, 1 service question), N speakers, native/non-native,
quiet room, <phone model, RAM>, Chrome <version>, aeroplane mode: the right place was the first suggestion
a/18 times and in the top five b/18; the two out-of-area names were refused c/2; slots filled correctly
d/15; median time from Stop to 'I heard' e s. Wrong answers given: 0/20, because every heard name is
confirmed."

**Optional calibration (one hour, gives an honest word-error rate):** the first 50 clips of FLEURS Somali
dev (`google/fleurs`, `so_so`, CC BY 4.0, 291 MB) through the same model via the debug hook, with simple
normalisation; report it as "our run, Whisper tiny 8-bit, zero-shot, greedy, 50 clips", next to the
published figures for larger fine-tuned models (BuzzASR/somali, a large-v3 fine-tune: 50.96% on FLEURS +
Common Voice test; steja/whisper-small-somali: 66.59% on FLEURS test), with the note that splits and
normalisation differ. This is why the finder trusts the confirmed match, never the transcript.
