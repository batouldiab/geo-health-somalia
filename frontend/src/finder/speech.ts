/**
 * Speech in (and optional speech out) for the finder, both offline once the files are on the phone.
 *
 * In: OpenAI Whisper tiny (MIT), the ONNX export from onnx-community/whisper-tiny,
 * quantized to 8 bits (encoder 10.1 MB + decoder 30.7 MB), run in the browser by
 * transformers.js on onnxruntime-web (WebAssembly). The model files are served
 * by this site from /models/whisper-tiny/ (pipeline/fetch_models.py puts them
 * there) and the ONNX runtime from /ort/ (frontend/scripts/copy-ort.mjs), so
 * nothing is fetched from a third party and the strict CSP (script-src 'self')
 * holds; the service worker keeps both for offline use after the first load.
 * The language follows the interface language (Somali by default). Somali
 * recognition is weak (a Whisper-large fine-tune reports about 51% word error
 * on FLEURS + Common Voice; nothing is published for tiny), which is why the
 * finder confirms every heard place name before answering and never shows the
 * transcript as an answer. Decoding is capped at 32 new tokens: a short question
 * needs fewer, and a looping decoder cannot stall the phone.
 *
 * Out: short audio clips, one per sentence template, listed in /voice/so/manifest.json
 * when they exist (pipeline/synth_clips.py; none are shipped until a Somali speaker
 * has cleared the sentences). With no manifest the finder shows text only.
 */

type Transcriber = (audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text: string }>;

let transcriberPromise: Promise<Transcriber> | null = null;

/**
 * Where the model and the runtime come from. Default: this site (/models/ and /ort/, no third
 * party, strict CSP). A host that refuses files of 27 and 31 MB (some app builders do) can set
 * VITE_VOICE_REMOTE=1 at build time: the same files then come from the model's public home on
 * Hugging Face (onnx-community/whisper-tiny, MIT) and onnxruntime-web's CDN copy on first use,
 * and the service worker keeps them for offline use exactly as before. Same model, same sizes.
 */
export const VOICE_REMOTE = import.meta.env.VITE_VOICE_REMOTE === '1';
const MODEL_ID = VOICE_REMOTE ? 'onnx-community/whisper-tiny' : 'whisper-tiny';
/** the model's largest file: when it is in the service worker's cache, voice works offline */
const DECODER_URL = VOICE_REMOTE
  ? 'https://huggingface.co/onnx-community/whisper-tiny/resolve/main/onnx/decoder_model_merged_quantized.onnx'
  : '/models/whisper-tiny/onnx/decoder_model_merged_quantized.onnx';
const WASM_URL = '/ort/ort-wasm-simd-threaded.asyncify.wasm';

export function speechSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined' && typeof WebAssembly !== 'undefined';
}

/** Are the model and the runtime already saved on this phone (service worker cache)? */
export async function voiceCached(): Promise<boolean> {
  try {
    if (!('caches' in window)) return false;
    const a = await caches.match(DECODER_URL);
    // the runtime is served by this site unless the remote mode is on (then it is cached under its CDN URL)
    const b = VOICE_REMOTE ? true : !!(await caches.match(WASM_URL));
    return !!a && b;
  } catch {
    return false;
  }
}

/** Bytes this site holds on the phone, when the browser says (an estimate). */
export async function storageUsed(): Promise<number | null> {
  try {
    const est = await navigator.storage?.estimate?.();
    return est?.usage ?? null;
  } catch {
    return null;
  }
}

/** Load the model once; later calls reuse it. Rejects when the files are missing (then the finder stays typed-only). */
export function loadTranscriber(onProgress?: (pct: number) => void): Promise<Transcriber> {
  if (transcriberPromise) return transcriberPromise;
  transcriberPromise = (async () => {
    const tf = await import('@huggingface/transformers');
    tf.env.allowRemoteModels = VOICE_REMOTE;
    tf.env.allowLocalModels = !VOICE_REMOTE;
    tf.env.localModelPath = '/models/';
    // the service worker is the one offline store: no second copy of the model in transformers.js's own cache
    tf.env.useBrowserCache = false;
    // the ORT runtime is imported from /ort/ as is: a blob: copy would be refused by the strict CSP
    (tf.env as unknown as { useWasmCache?: boolean }).useWasmCache = false;
    const onnx = (tf.env.backends as { onnx?: { wasm?: Record<string, unknown> } }).onnx;
    if (onnx?.wasm) {
      // local mode: the runtime from this site; remote mode: transformers.js's own CDN path for it
      if (!VOICE_REMOTE) onnx.wasm.wasmPaths = { mjs: '/ort/ort-wasm-simd-threaded.asyncify.mjs', wasm: WASM_URL };
      onnx.wasm.numThreads = 1;
    }
    // progress as one number: bytes of the files seen so far, weighted by their known sizes
    const seen = new Map<string, number>();
    const pipe = await tf.pipeline('automatic-speech-recognition', MODEL_ID, {
      dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' },
      device: 'wasm',
      progress_callback: (p: { status?: string; file?: string; progress?: number }) => {
        if (!onProgress || p.status !== 'progress' || !p.file) return;
        seen.set(p.file, p.progress || 0);
        // the decoder is three quarters of the download; the encoder the rest
        const dec = seen.get('onnx/decoder_model_merged_quantized.onnx') ?? 0;
        const enc = seen.get('onnx/encoder_model_quantized.onnx') ?? 0;
        onProgress(Math.round(dec * 0.75 + enc * 0.25));
      },
    });
    return (audio: Float32Array, opts: Record<string, unknown>) => (pipe as unknown as Transcriber)(audio, opts);
  })();
  transcriberPromise.catch(() => {
    transcriberPromise = null;
  });
  return transcriberPromise;
}

/** Fetch the model and the runtime once, online, so voice works with the radio off; ask the browser to keep the storage. */
export async function prepareVoice(onProgress?: (pct: number) => void): Promise<void> {
  await loadTranscriber(onProgress);
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* not offered: the cache still works, it is just evictable */
  }
}

/** Decode a recording to 16 kHz mono float samples, what Whisper expects. */
export async function decodeTo16k(blob: Blob): Promise<Float32Array> {
  const buf = await blob.arrayBuffer();
  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({ sampleRate: 16000 });
  try {
    const decoded = await ctx.decodeAudioData(buf);
    if (decoded.sampleRate === 16000) return decoded.getChannelData(0);
    // resample with an offline context when the browser ignored the requested rate
    const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    return (await off.startRendering()).getChannelData(0);
  } finally {
    void ctx.close();
  }
}

export interface Recorder {
  stop: () => Promise<Blob>;
}

/** Start recording from the microphone; the returned stop() resolves with the audio blob. */
export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  rec.start();
  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        rec.onstop = () => {
          stream.getTracks().forEach((tr) => tr.stop());
          resolve(new Blob(chunks, { type: rec.mimeType }));
        };
        rec.stop();
      }),
  };
}

export interface Transcript {
  text: string;
  /** milliseconds from the end of the recording to the text, on this phone */
  ms: number;
}

/** Transcribe a recording in the given language ('so' Somali, 'en' English). */
export async function transcribe(blob: Blob, lang: 'so' | 'en', onProgress?: (pct: number) => void): Promise<Transcript> {
  const [asr, audio] = await Promise.all([loadTranscriber(onProgress), decodeTo16k(blob)]);
  const t0 = performance.now();
  const out = await asr(audio, { language: lang === 'so' ? 'somali' : 'english', task: 'transcribe', return_timestamps: false, max_new_tokens: 32, chunk_length_s: 30 });
  return { text: (out.text || '').trim(), ms: Math.round(performance.now() - t0) };
}

// ---- spoken answers from pre-recorded clips (optional) --------------------------------

interface VoiceManifest {
  lang: string;
  model: string;
  /** template key -> clip path; facility id -> clip path */
  clips: Record<string, string>;
}

let manifest: VoiceManifest | null | undefined;

export async function loadVoiceManifest(): Promise<VoiceManifest | null> {
  if (manifest !== undefined) return manifest;
  try {
    const res = await fetch('/voice/so/manifest.json');
    manifest = res.ok && (res.headers.get('content-type') || '').includes('json') ? ((await res.json()) as VoiceManifest) : null;
  } catch {
    manifest = null;
  }
  return manifest;
}

let playing: HTMLAudioElement | null = null;
let playRun = 0;

/** Play the clips for the answer's template keys in order; resolves when done, stopped, or when no clips exist. */
export async function speakKeys(keys: string[]): Promise<boolean> {
  const m = await loadVoiceManifest();
  if (!m) return false;
  const paths = keys.map((k) => m.clips[k]).filter(Boolean);
  if (!paths.length) return false;
  stopSpeaking();
  const run = ++playRun;
  for (const p of paths) {
    if (run !== playRun) break;
    await new Promise<void>((resolve) => {
      const a = new Audio(p);
      playing = a;
      a.onended = () => resolve();
      a.onerror = () => resolve();
      a.onpause = () => resolve();
      void a.play().catch(() => resolve());
    });
  }
  if (run === playRun) playing = null;
  return true;
}

/** Stop any clip that is playing (a new question, or the Stop button). */
export function stopSpeaking(): void {
  playRun++;
  if (playing) {
    playing.pause();
    playing = null;
  }
}
