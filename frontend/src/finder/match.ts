/**
 * Matching a typed or heard question against three fixed lists: places,
 * facility names and service words. No model here: normalisation that knows
 * how Somali place names are spelt (Xudur / Hudur, Ceel Barde / El Barde,
 * Waajid / Wajid), bigram similarity, and a threshold. Everything the matcher
 * can return is something a person typed into a data file, which is what makes
 * the answers checkable.
 */

export interface Gazetteer {
  places: Place[];
  services: Service[];
}

export interface Place {
  key: string;
  /** what the user sees */
  name: string;
  /** 'village' | 'hamlet' | 'town' | 'city' | 'district' | 'facility' */
  kind: string;
  lon: number;
  lat: number;
  /** district the place sits in, when known */
  district?: string;
  /** facility id when kind === 'facility' */
  facilityId?: string;
  source: string;
  /**
   * false for a named place outside Bakool's five districts (the OpenStreetMap box reaches
   * into Bay, Gedo and Hiiraan): kept so that a question about it is refused by name
   * instead of answered with a Bakool facility
   */
  inRegion?: boolean;
}

export interface Service {
  key: 'delivery' | 'vaccination' | 'nutrition' | 'emergency' | 'general';
  label: { en: string; so: string };
  words: { en: string[]; so: string[] };
}

/**
 * Service words. English is the reference; the Somali list is a draft written
 * without a native speaker and must be checked before the demo (plan, Section 8).
 * Any word here can only route to a facility level; the tool never claims a
 * facility offers the service, because no source lists services.
 */
export const SERVICES: Service[] = [
  { key: 'delivery', label: { en: 'delivery and pregnancy care', so: 'dhalmo iyo daryeel uur' },
    words: { en: ['delivery', 'deliver', 'birth', 'maternity', 'pregnant', 'pregnancy', 'labour', 'labor', 'antenatal', 'midwife'],
             so: ['dhalmo', 'dhalid', 'uur', 'umul', 'umusha', 'umuliso'] } },
  { key: 'vaccination', label: { en: 'vaccination', so: 'tallaal' },
    words: { en: ['vaccine', 'vaccination', 'vaccinate', 'immunization', 'immunisation', 'measles', 'polio'],
             so: ['tallaal', 'tallaalka', 'talaal', 'jadeeco', 'dabeyl'] } },
  { key: 'nutrition', label: { en: 'malnutrition treatment', so: 'daaweynta nafaqo-darrada' },
    words: { en: ['malnutrition', 'malnourished', 'nutrition', 'feeding', 'plumpy', 'otp', 'muac'],
             so: ['nafaqo', 'nafaqo-darro', 'nafaqadarro', 'nafaqo darro'] } },
  { key: 'emergency', label: { en: 'emergency or referral care', so: 'degdeg ama gudbin' },
    words: { en: ['emergency', 'urgent', 'referral', 'refer', 'hospital', 'surgery', 'accident', 'bleeding'],
             so: ['isbitaal', 'isbitaalka', 'degdeg', 'gurmad', 'dhiigbax', 'gudbin'] } },
  { key: 'general', label: { en: 'a health facility', so: 'xarun caafimaad' },
    words: { en: ['clinic', 'clinics', 'health', 'facility', 'facilities', 'doctor', 'nurse', 'post', 'centre', 'center', 'mch'],
             so: ['caafimaad', 'caafimaadka', 'xarun', 'xarunta', 'xarumaha', 'xarumo', 'dhakhtar', 'dhakhtarka', 'kalkaaliye', 'rugta', 'rug', 'rugaha', 'bakhaar'] } },
];

/**
 * Questions the tool must refuse: medicines, doses, treatment. A symptom word on its own
 * ("a child with fever, nearest facility to Waajid") is a referral reason, not a medical
 * question, so it passes through to place matching. Draft Somali, to be checked.
 */
export const OUT_OF_SCOPE_WORDS = {
  en: ['dose', 'dosage', 'tablet', 'tablets', 'pill', 'pills', 'how many', 'how much', 'treat', 'treatment', 'medicine', 'medicines', 'drug', 'drugs', 'paracetamol', 'amoxicillin', 'antibiotic', 'antibiotics', 'ors', 'prescribe', 'diagnose', 'diagnosis'],
  so: ['kaniini', 'kiniin', 'daawo', 'dawo', 'daawooyin', 'dawooyin', 'qiyaas daawo', 'dawo imisa', 'daawo imisa', 'imisa kaniini', 'daaweeyo', 'daaweynta'],
};

const PLACE_STOPWORDS = new Set([
  'where', 'is', 'the', 'nearest', 'near', 'nearby', 'closest', 'close', 'to', 'from', 'in', 'at', 'a', 'an', 'for', 'me', 'i', 'am', 'we', 'are', 'of', 'please', 'can', 'you', 'tell', 'find', 'go', 'send', 'take', 'bring', 'her', 'him', 'them', 'with', 'has', 'have', 'who', 'needs', 'need', 'there', 'here', 'now', 'around',
  'woman', 'man', 'child', 'baby', 'patient', 'mother', 'girl', 'boy',
  // Somali function words and question words (draft list)
  'halkee', 'halkeeh', 'xagee', 'meeday', 'meesha', 'meel', 'ugu', 'dhow', 'dhaw', 'ka', 'ku', 'u', 'oo', 'iyo', 'waa', 'ma', 'maxaa', 'waxaan', 'rabaa', 'doonayaa', 'ii', 'sheeg', 'tuulada', 'tuulo', 'degmada', 'degmo', 'magaalada', 'magaalo', 'ah', 'la', 'soo', 'aan', 'baan', 'ayaan', 'baa', 'ayaa', 'inta', 'wax',
  'agteeda', 'agtiisa', 'agagaarka', 'dhinaceeda', 'leh', 'qaba', 'baahan', 'halkan', 'halkaas', 'geeyo', 'geynayaa', 'geeyaa', 'ilmaha', 'haweeney', 'haweeneyda', 'naag', 'nin', 'ilmo', 'cunug',
]);

/** lowercase, strip diacritics and punctuation, collapse spaces */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/[-\s]+/g, ' ')
    .trim();
}

/**
 * A spelling-tolerant key for Somali names: the letters that vary between
 * Somali and English spellings are folded (x->h, c dropped before a vowel,
 * dh->d, kh->k, q->k, long vowels shortened, y->i), so that Xudur, Hudur and
 * Huddur, or Ceel Barde and El Barde, land on the same key.
 */
export function somKey(s: string): string {
  return normalize(s)
    .replace(/\bc(?=[aeiou])/g, '')
    .replace(/c/g, '')
    .replace(/x/g, 'h')
    .replace(/dh/g, 'd')
    .replace(/kh/g, 'k')
    .replace(/q/g, 'k')
    .replace(/y/g, 'i')
    .replace(/([aeiou])\1+/g, '$1')
    .replace(/([bdfghjklmnprstwz])\1+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  const t = ' ' + s.replace(/\s+/g, ' ') + ' ';
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    m.set(g, (m.get(g) || 0) + 1);
  }
  return m;
}

/** Dice coefficient over character bigrams, 0..1 */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  let na = 0;
  let nb = 0;
  for (const v of A.values()) na += v;
  for (const v of B.values()) nb += v;
  for (const [g, v] of A) inter += Math.min(v, B.get(g) || 0);
  return (2 * inter) / (na + nb);
}

export interface PlaceMatch {
  place: Place;
  score: number;
  /** the words of the question that matched */
  matched: string;
}

const SERVICE_WORDS = new Set(SERVICES.flatMap((s) => [...s.words.en, ...s.words.so]).map(normalize));

/** The words of a question that can be part of a place name: everything that is not a stop word or a service word. */
export function placeWords(q: string): string[] {
  return normalize(q).split(' ').filter((w) => w && !PLACE_STOPWORDS.has(w) && !SERVICE_WORDS.has(w));
}

/** 1-5 word windows over a word list */
function windowsOf(words: string[]): string[] {
  const out = new Set<string>();
  for (let i = 0; i < words.length; i++) {
    for (let n = 1; n <= 5 && i + n <= words.length; n++) out.add(words.slice(i, i + n).join(' '));
  }
  return [...out];
}

/**
 * A typed match that needs no confirmation: the best window is the whole of what was typed
 * (after stop and service words). "Buulo Fu" then asks "did you mean Buulo?" instead of
 * answering as Buulo, and a five-word name is matched as five words. Spoken questions are
 * always confirmed, whatever the score.
 */
export function coversWholeQuestion(m: PlaceMatch, q: string): boolean {
  return normalize(m.matched).split(' ').filter(Boolean).length >= placeWords(q).length;
}

function kmBetween(a: Place, b: Place): number {
  const r = 6371;
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const dl = ((b.lon - a.lon) * Math.PI) / 180;
  const x = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
}

/**
 * Two candidates inside Bakool with the same top score that are different places (two
 * villages called Buulo Jadiid, in Xudur and in Tayeeglow, 60 km apart): the tool asks
 * which, with the district shown, rather than picking one. A village and the health post
 * named after it, or a district and its town, sit on the same spot and are not a tie.
 */
export function tiedAtTop(m: PlaceMatch[]): boolean {
  if (m.length < 2 || m[1].score < SURE || m[1].score < m[0].score - 1e-9 || m[1].place.inRegion === false) return false;
  return kmBetween(m[0].place, m[1].place) > 2;
}

/** Rank places against the question; a place's score is its best window's score. */
export function matchPlaces(q: string, gaz: Gazetteer, limit = 5): PlaceMatch[] {
  const windows = windowsOf(placeWords(q));
  if (!windows.length) return [];
  // a facility asked for by its full name ("Ato Health Post"): its windows keep the service words
  const facilityWindows = windowsOf(normalize(q).split(' ').filter((w) => w && !PLACE_STOPWORDS.has(w)));
  const best = new Map<string, PlaceMatch>();
  for (const p of gaz.places) {
    const pk = somKey(p.name);
    const pn = normalize(p.name);
    let top: PlaceMatch | null = null;
    for (const w of p.kind === 'facility' ? facilityWindows : windows) {
      const wk = somKey(w);
      if (!wk) continue;
      let s = Math.max(similarity(wk, pk), similarity(normalize(w), pn));
      // a window that is the whole name, or the name's first word, counts for more
      if (wk === pk) s = 1;
      else if (pk.startsWith(wk + ' ') || pk.startsWith(wk) && wk.length >= 4) s = Math.max(s, 0.86);
      if (!top || s > top.score) top = { place: p, score: s, matched: w };
    }
    if (top && top.score >= 0.45) {
      const prev = best.get(p.key);
      if (!prev || top.score > prev.score) best.set(p.key, top);
    }
  }
  // ties: a place inside Bakool before its namesake outside, the longer matched window first
  // ("Buulo Jadiid" over "Buulo"), then towns before villages before hamlets
  return [...best.values()]
    .sort((a, b) => b.score - a.score || Number(b.place.inRegion !== false) - Number(a.place.inRegion !== false) || b.matched.length - a.matched.length || kindRank(a.place.kind) - kindRank(b.place.kind) || a.place.name.localeCompare(b.place.name))
    .slice(0, limit);
}

/** towns before villages before hamlets when scores tie */
function kindRank(kind: string): number {
  return ['district', 'city', 'town', 'facility', 'village', 'hamlet'].indexOf(kind);
}

export function matchService(q: string): Service | null {
  const n = ' ' + normalize(q) + ' ';
  let hit: Service | null = null;
  for (const s of SERVICES) {
    for (const w of [...s.words.en, ...s.words.so]) {
      if (n.includes(' ' + normalize(w) + ' ')) {
        // a specific service beats 'general'
        if (!hit || (hit.key === 'general' && s.key !== 'general')) hit = s;
      }
    }
  }
  // 'general' words (clinic, health, facility) only keep place matching clean; they are not a service to answer about
  return hit && hit.key !== 'general' ? hit : null;
}

export function isOutOfScope(q: string): boolean {
  const n = ' ' + normalize(q) + ' ';
  return [...OUT_OF_SCOPE_WORDS.en, ...OUT_OF_SCOPE_WORDS.so].some((w) => n.includes(' ' + normalize(w) + ' '));
}

/** Score at or above which a typed match needs no confirmation; below it the tool asks "did you mean". */
export const SURE = 0.92;
/** Score below which the tool says it is not sure and shows the list instead. */
export const UNSURE = 0.6;
