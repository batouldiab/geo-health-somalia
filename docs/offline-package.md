# Offline package: what the finder puts on the phone, measured

Rules 2 and 3 of the challenge: the core feature works offline, and the model files are small enough to
side-load or send over a weak connection. These are the files the finder needs, with sizes read from the
built output (`npm run build`, 4 October 2026) and from the publishers' file listings, not estimated.

| Part | Files | Size | Where it comes from |
|---|---|---|---|
| Finder page and code | `finder.html`, `assets/finder-*.js`, `assets/finder-*.css`, `assets/flags-*.js` | 6.4 KB + 49.9 KB + 7.3 KB + 4.2 KB (about 68 KB, 24 KB gzipped) | this repository, built by Vite |
| Data | `data/access10_v1.json.gz`, `facilities_v1.json.gz`, `places_bakool_v1.json.gz`, `adm2_bakool_v1.json.gz` | 15.4 + 2.6 + 31.4 + 5.2 KB = 55 KB | `pipeline/build_bakool_health_v1.py`, `postprocess_v1.py` |
| Icons, manifest | `favicon.svg`, `icon-192.png`, `icon-512.png`, `finder.webmanifest` | 7 KB | this repository |
| Speech-recognition library | `assets/transformers.web-*.js` | 593 KB (172 KB gzipped), loaded only when the microphone is first used or "Download voice" is tapped | `@huggingface/transformers` 4.3.0 |
| ONNX runtime (WebAssembly) | `ort/ort-wasm-simd-threaded.asyncify.wasm`, `.mjs` | 26.9 MB + 53 KB | `onnxruntime-web`, copied by `npm run prepare-offline` |
| Whisper tiny, 8-bit | `models/whisper-tiny/onnx/encoder_model_quantized.onnx`, `decoder_model_merged_quantized.onnx` + 8 config and tokenizer files | 10.1 MB + 30.7 MB + about 4 MB | `pipeline/fetch_models.py` from onnx-community/whisper-tiny (MIT) |
| Somali voice clips | `voice/so/*.wav`, `manifest.json` | none shipped (text answers until a Somali speaker clears the sentences) | `pipeline/synth_clips.py` |

**Totals.** Typed finder: about 0.13 MB. Voice pack: about 72 MB on the first online visit ("about 70 MB"
in the UI, in round figures), after which
everything is served by the service worker with the radio off. The 72 MB is dominated by the ONNX runtime
(27 MB) and the Whisper decoder (31 MB, three quarters of which is the multilingual token embedding, the
price of having a Somali token at all); both are ordinary static files, so they can be installed once where
there is Wi-Fi (the tool asks before spending the data and shows one progress bar) or served from a clinic
laptop or a small hotspot on the same network. Daily use is zero bytes. For scale, the next open model that
hears Somali (Meta MMS) is about 4 GB.

**How offline works.** Two caches. `geo-health-finder-vN` holds the page, the hashed bundles it names (read
from the page at install time, so one visit is enough), the four data files, the icons and the manifest;
it is rebuilt when the data changes. `geo-health-models-v1` holds `/models/`, `/ort/` and `/voice/` and is
kept across data versions, so updating the facility list costs 55 KB and never a re-download of the model.
Every same-origin GET is served cache-first and stored when fetched; an HTML fallback for a missing file is
never stored as that file; nothing cross-origin is cached (the finder has no basemap). A navigation that
fails falls back to the cached finder page. transformers.js's own model cache is switched off
(`useBrowserCache = false`) so the model is not stored twice, and its ORT loader is told not to re-import
the runtime from a `blob:` URL (`useWasmCache = false`), which the strict CSP would refuse. After a
download the finder asks the browser to persist the storage (`navigator.storage.persist()`); the voice pill
shows "Voice ready offline" and the bytes held, from `navigator.storage.estimate()`.

**Verified in a headless browser (4 October 2026):** after one online visit the finder cache held the page,
the three bundles, the four data files and the manifest; with the network switched off, `/finder.html?q=Xudur`
loaded from the cache, showed "● Offline · using saved data" and answered. Voice could not be exercised
headlessly (no microphone); test it on the demo phone with aeroplane mode on after one online use of
Speak or "Download voice".

**Deployment notes (`deploy/nginx/`).** The content-security policy allows WebAssembly (`script-src 'self'
'wasm-unsafe-eval'`), workers from this origin (`worker-src 'self' blob:`) and audio from blobs (`media-src
'self' blob:`); `Permissions-Policy` allows the microphone on this origin (`microphone=(self)`), which the
platform's old header blocked; `/finder` serves `finder.html`; `/sw.js` is served with
`Service-Worker-Allowed: /` and no caching; `/models/`, `/ort/` and `/voice/` are immutable with the right
media types; `.wasm` is gzipped in transit. Service workers and microphones need HTTPS or `localhost`: a
plain `http://192.168.x.x` address gives neither. `frontend/public/models/` and `/ort/` are kept in the
repository on purpose (about 68 MB, every file under GitHub's 100 MB limit) so the build has them; if a
clone lacks them, `python pipeline/fetch_models.py` and `npm run prepare-offline` recreate them. Check that
`/models/whisper-tiny/onnx/decoder_model_merged_quantized.onnx` and `/ort/ort-wasm-simd-threaded.asyncify.wasm`
load on the deployed site before filming the voice segment. Vite also emits an unused copy of the runtime
under `dist/assets/` (27 MB; referenced by onnxruntime-web's own loader, never requested); harmless, and the
next build step to remove.

**What is not offline.** The planner's map (`index.html`) needs the network for the Esri basemap tiles;
only the finder is built to run without it.

**Known limits and next steps.** Inference runs on the main thread, so the screen freezes for the length of
the transcription (seconds on a low-end phone; the finder prints the measured time under "I heard"). A Web
Worker is the next step. One thread (`numThreads = 1`): multi-threading needs cross-origin isolation
headers on every file. The plain (non-asyncify) ONNX runtime build is 14.3 MB instead of 26.9 MB and
transformers.js supports it; switching needs a test on a real phone that we did not want to make blind on
the submission day.

**Setup once, from a normal connection:**

```
cd frontend
npm ci --ignore-scripts             # onnxruntime-node's postinstall tries to fetch GPU binaries; not needed
npm run prepare-offline             # copies the ONNX runtime into public/ort/
python ../pipeline/fetch_models.py  # 44 MB into public/models/whisper-tiny/
npm run dev                         # http://localhost:5173/finder.html
```
