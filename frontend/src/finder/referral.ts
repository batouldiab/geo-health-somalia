import type { Facility } from '../data/types';
import { normalize } from './match';
import { STRINGS, type Lang } from './strings';

/**
 * The referral slip: documentation and continuity of care in one gesture (Annex A
 * names "documentation, referral, follow-up or continuity of care" as valid targets).
 * The worker says or taps who is being referred, why, from where and to which
 * facility; the AI part is speech recognition, followed by rule-based slot filling
 * over a FIXED vocabulary, so a slot can only hold one of the listed values. When
 * the words match more than one value for a slot, the slot stays empty and the
 * worker is told, rather than the tool guessing. The slip is a 160-character code
 * with no name, no phone number and no free text, so it fits one SMS; the phone's
 * own messaging app opens with it and the worker chooses the recipient and presses
 * send when there is a signal (store-and-forward). A copy stays on the phone in a
 * log she can clear; slips older than 30 days are dropped. Nothing is sent by the
 * tool itself.
 *
 * A word ending in * is a stem ("pregnan*" matches pregnant and pregnancy); every
 * other word must match whole. Somali vocabulary below is a draft to be checked by
 * a Somali speaker.
 */

export type Who = 'woman' | 'child' | 'man';
export type Why = 'delivery' | 'malnutrition' | 'fever' | 'injury' | 'other';

export interface SlotOption<T extends string> {
  key: T;
  label: { en: string; so: string };
  words: { en: string[]; so: string[] };
  /** the short token written into the SMS code */
  code: string;
}

export const WHO: SlotOption<Who>[] = [
  { key: 'woman', code: 'WOMAN', label: { en: 'woman', so: 'haweeney' },
    words: { en: ['woman', 'mother', 'pregnant', 'lady', 'wife', 'girl'], so: ['haweeney', 'naag', 'hooyo', 'uur', 'uurleh', 'gabar', 'marwo'] } },
  { key: 'child', code: 'CHILD', label: { en: 'child under five', so: 'ilmo ka yar shan sano' },
    words: { en: ['child', 'baby', 'infant', 'boy', 'kid', 'toddler', 'newborn'], so: ['ilmo', 'ilmaha', 'carruur', 'cunug', 'dhallaan', 'wiil', 'canug'] } },
  { key: 'man', code: 'MAN', label: { en: 'man', so: 'nin' },
    words: { en: ['man', 'husband', 'elder', 'father', 'male'], so: ['nin', 'oday', 'aabe', 'ninka'] } },
];

export const WHY: SlotOption<Why>[] = [
  { key: 'delivery', code: 'DELIVERY', label: { en: 'pregnancy or delivery complication', so: 'dhibaato uur ama dhalmo' },
    words: { en: ['delivery', 'labour', 'labor', 'birth', 'pregnan*', 'bleed*', 'antenatal', 'postnatal'], so: ['dhalmo', 'dhalid', 'uur', 'umul', 'dhiigbax', 'foolan'] } },
  { key: 'malnutrition', code: 'MALNUT', label: { en: 'malnutrition', so: 'nafaqo-darro' },
    words: { en: ['malnutrition', 'malnourished', 'muac', 'feeding', 'wasting'], so: ['nafaqo*', 'caato', 'gaajo'] } },
  { key: 'fever', code: 'FEVER', label: { en: 'fever or illness', so: 'qandho ama xanuun' },
    words: { en: ['fever', 'sick', 'illness', 'ill', 'cough', 'diarrhoea', 'diarrhea', 'vomit*', 'measles', 'malaria', 'breathing'], so: ['qandho', 'xanuun', 'jiran', 'qufac', 'shuban', 'matag', 'jadeeco', 'duumo', 'neef'] } },
  { key: 'injury', code: 'INJURY', label: { en: 'injury', so: 'dhaawac' },
    words: { en: ['injur*', 'wound', 'accident', 'burn', 'fracture', 'broken', 'bite', 'fell'], so: ['dhaawac', 'nabar', 'shil', 'gubasho', 'jab', 'qaniinyo'] } },
  { key: 'other', code: 'OTHER', label: { en: 'other', so: 'kale' },
    words: { en: ['other'], so: [] } },
];

export const URGENT_WORDS = { en: ['urgent', 'emergency', 'immediately', 'serious', 'severe'], so: ['degdeg', 'daran', 'halis', 'gurmad'] };
/** said as a phrase, these switch urgency off again ("not urgent", "degdeg ma aha") */
export const NOT_URGENT = { en: ['not urgent', 'no rush', 'routine', 'not an emergency', 'not serious'], so: ['degdeg ma aha', 'ma aha degdeg', 'caadi', 'degdeg maaha', 'maaha degdeg'] };

export interface Slip {
  who: Who | null;
  why: Why | null;
  urgent: boolean;
  fromPlace: string;
  fromDistrict: string | null;
  to: Facility | null;
  /** ISO time the slip was composed, from the phone's clock */
  at: string;
}

function hasWord(text: string, words: string[]): boolean {
  const n = ' ' + normalize(text) + ' ';
  return words.some((w) => {
    const stem = w.endsWith('*');
    const k = normalize(stem ? w.slice(0, -1) : w);
    if (!k) return false;
    return stem ? n.includes(' ' + k) : n.includes(' ' + k + ' ');
  });
}

/** every option whose words occur in the text */
function pickAll<T extends string>(text: string, options: SlotOption<T>[]): T[] {
  return options.filter((o) => hasWord(text, [...o.words.en, ...o.words.so])).map((o) => o.key);
}

export interface FillResult {
  slip: Slip;
  /** slots left empty because the words matched more than one value */
  ambiguous: ('who' | 'why')[];
}

/**
 * Fill the who / why / urgent slots from what was heard or typed. A slot whose words
 * match exactly one value is filled; one that matches several stays as it was and is
 * reported, so the worker taps the right one; unmatched slots stay for the worker to tap.
 */
export function fillSlots(text: string, slip: Slip): FillResult {
  const negated = hasWord(text, [...NOT_URGENT.en, ...NOT_URGENT.so]);
  const who = pickAll(text, WHO);
  const why = pickAll(text, WHY);
  const ambiguous: ('who' | 'why')[] = [];
  if (who.length > 1) ambiguous.push('who');
  if (why.length > 1) ambiguous.push('why');
  return {
    slip: {
      ...slip,
      who: who.length === 1 ? who[0] : slip.who,
      why: why.length === 1 ? why[0] : slip.why,
      urgent: negated ? false : slip.urgent || hasWord(text, [...URGENT_WORDS.en, ...URGENT_WORDS.so]),
    },
    ambiguous,
  };
}

/** does the text describe a case (who, why, urgency)? Such a recording is never offered for keeping. */
export function mentionsCase(text: string): boolean {
  return pickAll(text, WHO).length > 0 || pickAll(text, WHY).length > 0 || hasWord(text, [...URGENT_WORDS.en, ...URGENT_WORDS.so]);
}

export function slipComplete(s: Slip): boolean {
  return !!(s.who && s.why && s.fromPlace && s.to);
}

/** A short check code so the receiving end can tell two slips apart without any personal data in them. */
function slipId(s: Slip): string {
  const base = s.at + '|' + s.fromPlace + '|' + (s.to?.id || '') + '|' + s.who + '|' + s.why;
  let h = 2166136261;
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36).toUpperCase().padStart(6, '0').slice(-6);
}

/** plain ASCII: any other character would turn the SMS into 70-character UCS-2 segments and split it */
function ascii(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function shorten(s: string, max: number): string {
  const t = ascii(s);
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + '.';
}

/** The SMS text: fixed tokens, at most 160 characters, no name, no number, no free text. */
export function composeSms(s: Slip): string {
  const d = new Date(s.at);
  // the phone's local time, which is what the receiving facility lives by
  const p2 = (n: number): string => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  const who = WHO.find((o) => o.key === s.who)?.code || '?';
  const why = WHY.find((o) => o.key === s.why)?.code || '?';
  const to = s.to ? shorten(s.to.name, 34) : '?';
  const from = shorten(s.fromPlace + (s.fromDistrict && s.fromDistrict.toLowerCase() !== s.fromPlace.toLowerCase() ? '/' + s.fromDistrict : ''), 30);
  const body = `GH-REF ${stamp} FROM ${from} TO ${to} WHO ${who} WHY ${why}${s.urgent ? ' URGENT' : ''} ID ${slipId(s)}`;
  return body.length <= 160 ? body : body.slice(0, 160);
}

/** The slip written out for the screen, in the interface language. */
export function describeSlip(s: Slip, lang: Lang): { k: string; v: string }[] {
  const who = WHO.find((o) => o.key === s.who);
  const why = WHY.find((o) => o.key === s.why);
  const L = lang === 'so'
    ? { who: 'Qofka', why: 'Sababta', from: 'Laga', to: 'Loo diro', urgent: 'Degdeg', at: 'Waqtiga', yes: 'haa', no: 'maya', unset: 'weli lama dooran' }
    : { who: 'Who', why: 'Why', from: 'From', to: 'To', urgent: 'Urgent', at: 'Time', yes: 'yes', no: 'no', unset: 'not chosen yet' };
  return [
    { k: L.who, v: who ? who.label[lang] : L.unset },
    { k: L.why, v: why ? why.label[lang] : L.unset },
    { k: L.from, v: s.fromPlace + (s.fromDistrict ? ' · ' + s.fromDistrict : '') },
    { k: L.to, v: s.to ? s.to.name + (s.to.type ? ' (' + (STRINGS.types[s.to.type]?.[lang] || s.to.type) + ')' : '') : L.unset },
    { k: L.urgent, v: s.urgent ? L.yes : L.no },
    { k: L.at, v: new Date(s.at).toLocaleString() },
  ];
}

// ---- the local log: slips stay on the phone for 30 days or until the worker clears them ----

const LOG_KEY = 'finder-slips-v1';
export const LOG_DAYS = 30;

export interface LoggedSlip {
  at: string;
  sms: string;
  sent: boolean;
}

function fresh(log: LoggedSlip[]): LoggedSlip[] {
  const cutoff = Date.now() - LOG_DAYS * 86400000;
  return log.filter((l) => {
    const ts = Date.parse(l.at);
    return Number.isNaN(ts) || ts >= cutoff;
  });
}

export function loadLog(): LoggedSlip[] {
  try {
    const log = fresh(JSON.parse(localStorage.getItem(LOG_KEY) || '[]') as LoggedSlip[]);
    return log;
  } catch {
    return [];
  }
}

export function saveLog(log: LoggedSlip[]): void {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(fresh(log).slice(-200)));
  } catch {
    /* private mode or full: the slip is still on screen */
  }
}

export function logSlip(sms: string, sent: boolean): LoggedSlip[] {
  const log = loadLog();
  const i = log.findIndex((l) => l.sms === sms);
  if (i >= 0) log[i].sent = log[i].sent || sent;
  else log.push({ at: new Date().toISOString(), sms, sent });
  saveLog(log);
  return log;
}

/** The link that opens the phone's own SMS app with the slip; the worker picks the recipient and sends. */
export function smsLink(body: string): string {
  // Android reads `sms:?body=`; iOS reads `sms:&body=`; both ignore the other form harmlessly enough for a prototype
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  return (ios ? 'sms:&body=' : 'sms:?body=') + encodeURIComponent(body);
}
