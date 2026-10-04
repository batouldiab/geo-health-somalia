/**
 * The learning loop: every voice question the worker confirms is a labelled sample
 * of Somali (or Af-Maay) speech of a kind no public corpus has (place names, health
 * vocabulary, field conditions). With one tap she keeps the recording, what the phone
 * heard, the place she confirmed and the language she says she spoke, on the phone,
 * in IndexedDB. Only questions about places are offered, never a spoken referral slip
 * (which describes a patient). Nothing leaves the phone until she exports the set as a
 * zip (clips + metadata.csv in the "audiofolder" layout that datasets libraries and
 * Common Voice-style tools read: file_name, sentence, locale, ...) or shares it through
 * the Android share sheet, after confirming. She can delete everything at any time.
 */

export interface Donation {
  id?: number;
  at: string;
  /** 'so' Standard Somali, 'ymm' Af-Maay, 'other' */
  locale: 'so' | 'ymm' | 'other';
  heard: string;
  confirmed: string;
  place: string;
  mime: string;
  blob: Blob;
}

/** one random id per phone, so clips from the same speaker can be grouped; not a person's identity */
export function speakerId(): string {
  try {
    const k = 'finder-speaker-id';
    let v = localStorage.getItem(k);
    if (!v) {
      v = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return 'unknown';
  }
}

const DB = 'finder-voice-donations';
const STORE = 'clips';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export function donationsSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

export function keepDonation(d: Donation): Promise<number> {
  return tx('readwrite', (s) => s.add(d) as IDBRequest<number>);
}

export function listDonations(): Promise<Donation[]> {
  return tx('readonly', (s) => s.getAll() as IDBRequest<Donation[]>);
}

export function clearDonations(): Promise<void> {
  return tx('readwrite', (s) => s.clear() as IDBRequest<undefined>).then(() => undefined);
}

// ---- a minimal zip writer (stored, no compression): clips are already compressed audio --

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosTime(d: Date): [number, number] {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return [time, date];
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

export function buildZip(entries: ZipEntry[]): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const [t, d] = dosTime(new Date());
  for (const e of entries) {
    const name = enc.encode(e.name);
    const crc = crc32(e.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // utf-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, t, true);
    local.setUint16(12, d, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, e.data.length, true);
    local.setUint32(22, e.data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), name, e.data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, t, true);
    cd.setUint16(14, d, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, e.data.length, true);
    cd.setUint32(24, e.data.length, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), name);
    offset += 30 + name.length + e.data.length;
  }
  const cdSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  const chunks: ArrayBuffer[] = [...parts, ...central, new Uint8Array(end.buffer)].map((u) => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer);
  return new Blob(chunks, { type: 'application/zip' });
}

function ext(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mp4') || mime.includes('aac')) return 'm4a';
  if (mime.includes('wav')) return 'wav';
  return 'bin';
}

function csvCell(s: string): string {
  return '"' + String(s).replace(/"/g, '""') + '"';
}

/**
 * All kept clips as one zip: clips/<n>.<ext> plus metadata.csv (file_name, sentence, locale, heard,
 * place, recorded_at, speaker_id, mime, consent_licence) and a README. The layout is the
 * "audiofolder" one (metadata.csv beside the clips, paths relative to it), which
 * `datasets.load_dataset("audiofolder", ...)` reads directly.
 */
export async function exportDonations(): Promise<{ blob: Blob; count: number }> {
  const items = await listDonations();
  const enc = new TextEncoder();
  const entries: ZipEntry[] = [];
  const rows = ['file_name,sentence,locale,heard,place,recorded_at,speaker_id,mime,consent_licence'];
  const speaker = speakerId();
  let i = 0;
  for (const it of items) {
    i++;
    const path = `clips/${String(i).padStart(4, '0')}.${ext(it.mime)}`;
    entries.push({ name: path, data: new Uint8Array(await it.blob.arrayBuffer()) });
    rows.push([path, it.confirmed || it.heard, it.locale, it.heard, it.place, it.at, speaker, it.mime, 'CC0-1.0'].map(csvCell).join(','));
  }
  entries.push({ name: 'metadata.csv', data: enc.encode(rows.join('\n') + '\n') });
  entries.push({
    name: 'README.txt',
    data: enc.encode(
      'Voice samples kept by a health worker with the Geo Health Bakool facility finder.\n' +
        'Each clip is the worker\'s own voice asking the finder where a health facility is; "sentence" is the text she confirmed, "heard" is what the on-device model (OpenAI Whisper tiny, 8-bit ONNX) transcribed, "locale" is the language she said she spoke (so = Standard Somali, ymm = Af-Maay, other), "speaker_id" is a random id for this phone, not a person.\n' +
        'The finder offers to keep a recording only after a confirmed question about a place that named no service and described no case, and never a spoken referral slip; the worker is asked to keep only recordings of her own voice with no one else speaking. She exported this set herself and confirmed the release as public-domain (CC0-1.0) speech data, which is the licence stated per row.\n' +
        'Audio is lossy (Opus in WebM, or AAC), 48 kHz as recorded; transcode to 16 kHz WAV for training. Somali has very little public speech data (FLEURS: read sentences, none from Bakool, no place names or health vocabulary); Af-Maay has none. Clips like these are how that changes, on the speakers\' own terms.\n',
    ),
  });
  return { blob: buildZip(entries), count: items.length };
}

/** Hand the zip to the person: Android share sheet when it can take files, otherwise a download. */
export async function shareOrDownload(blob: Blob, filename: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return 'shared';
    } catch {
      /* cancelled: fall through to the download */
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 2000);
  return 'downloaded';
}
