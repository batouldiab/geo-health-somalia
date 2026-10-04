import './finder.css';

import { DATASETS } from '../config';
import { fetchGzJson } from '../data/loader';
import type { AccessData, Adm2Data, FacilitiesData, PlacesData } from '../data/types';
import { compose, typeWord, type Answer } from './answer';
import { coversWholeQuestion, isOutOfScope, matchPlaces, matchService, somKey, SURE, tiedAtTop, UNSURE, type Gazetteer, type Place, type PlaceMatch, type Service } from './match';
import { clearDonations, donationsSupported, exportDonations, keepDonation, listDonations, shareOrDownload } from './donate';
import { composeSms, fillSlots, loadLog, logSlip, mentionsCase, saveLog, slipComplete, smsLink, WHO, WHY, type Slip } from './referral';
import { loadVoiceManifest, prepareVoice, speakKeys, speechSupported, startRecording, stopSpeaking, storageUsed, transcribe, voiceCached, type Recorder } from './speech';
import { STRINGS, t, type Lang } from './strings';

/**
 * The Bakool facility finder: a health worker asks, by voice or text, where the
 * nearest listed facility is from a place, optionally for a service; the tool
 * matches the place against fixed lists, confirms it, and answers from the data
 * files with fixed sentences. From the answer she can make a referral slip (a
 * 160-character code with no name) that her own SMS app sends when there is signal.
 * Everything runs on the phone; after the first visit the service worker serves the
 * page, the data and the speech model offline.
 *
 * What stays on the phone, by the worker's choice: saved slips (place, facility,
 * case type, urgency, time; 30 days) and recordings of her own voice asking about a
 * place, which she can export for Somali / Af-Maay speech data. Questions are not
 * stored; nothing is sent by the tool.
 */

interface Data {
  access: AccessData;
  facilities: FacilitiesData;
  places: PlacesData;
  adm2: Adm2Data;
}

let D: Data;
let GAZ: Gazetteer;
let lang: Lang = 'so';
let pending: { matches: PlaceMatch[]; service: Service | null; question: string } | null = null;
let lastAnswer: Answer | null = null;
let recorder: Recorder | null = null;
/** the slip being composed, or null */
let slip: Slip | null = null;
let slipRecorder: Recorder | null = null;
/** the last recording of a QUESTION and what the model heard, offered for keeping once the worker has confirmed the place */
let lastVoice: { blob: Blob; heard: string } | null = null;

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ---- data and gazetteer -------------------------------------------------------------

function ringCentroid(geom: { type: string; coordinates: unknown }): [number, number] {
  const rings: number[][][] = geom.type === 'Polygon' ? [(geom.coordinates as number[][][])[0]] : (geom.coordinates as number[][][][]).map((p) => p[0]);
  let x = 0;
  let y = 0;
  let n = 0;
  for (const r of rings) for (const [lon, lat] of r) {
    x += lon;
    y += lat;
    n++;
  }
  return [x / n, y / n];
}

/**
 * The closed lists the finder can answer about: the five districts, the named
 * OpenStreetMap places inside them, and the listed facilities. Named places outside
 * the districts (the Overpass box reaches into Bay, Gedo and Hiiraan) are kept with
 * inRegion=false, so a question about Baydhabo is refused by name, not answered.
 */
function buildGazetteer(d: Data): Gazetteer {
  const cd = d.access.meta.cell_deg;
  const districtOf = (lon: number, lat: number): string | undefined =>
    d.adm2.cell_district[Math.round(lon / cd) + '_' + Math.round(lat / cd)] || undefined;
  const places: Place[] = [];
  const seen = new Set<string>();
  for (const f of d.adm2.adm2.features) {
    const name = f.properties.district;
    // the district's town when OpenStreetMap has one (Xudur, Waajid, Ceel Barde, ...), else the polygon's centre
    const town = d.places.places.find((p) => ['city', 'town', 'village'].includes(p.place) && somKey(p.name) === somKey(name) && p.district === name)
      || d.places.places.find((p) => ['city', 'town'].includes(p.place) && somKey(p.name) === somKey(name));
    const [lon, lat] = town ? [town.lon, town.lat] : ringCentroid(f.geometry as { type: string; coordinates: unknown });
    places.push({ key: 'd:' + name, name, kind: 'district', lon, lat, district: name, inRegion: true, source: town ? 'OpenStreetMap town point (ODbL); district from OCHA COD-AB' : 'OCHA COD-AB (polygon centre)' });
  }
  for (const p of d.places.places) {
    if (!p.name) continue;
    // display name in Latin script only (some OSM names carry an Arabic form after the Somali one)
    const name = p.name.replace(/[^\x20-\x7EÀ-ɏ’]/g, '').replace(/\s+/g, ' ').trim();
    if (!name) continue;
    const k = p.place + ':' + name.toLowerCase() + ':' + p.lon.toFixed(2) + ':' + p.lat.toFixed(2);
    if (seen.has(k)) continue;
    seen.add(k);
    // in_region comes from the data file (point in the district polygons); the cell lookup is the fallback for older files
    const inRegion = p.in_region != null ? p.in_region : !!districtOf(p.lon, p.lat);
    places.push({ key: 'p:' + p.osm, name, kind: p.place, lon: p.lon, lat: p.lat, district: p.district || districtOf(p.lon, p.lat), inRegion, source: 'OpenStreetMap (ODbL)' });
  }
  for (const f of d.facilities.facilities) {
    if (!f.name || f.source_key === 'osm') continue;
    places.push({ key: 'f:' + f.id, name: f.name, kind: 'facility', lon: f.lon, lat: f.lat, district: f.district_adm2 || districtOf(f.lon, f.lat), facilityId: f.id, inRegion: true, source: f.source });
  }
  return { places, services: [] };
}

// ---- rendering -----------------------------------------------------------------------

function hideAll(): void {
  for (const id of ['fdHeard', 'fdConfirm', 'fdUnsure', 'fdScope', 'fdAnswer']) $(id).hidden = true;
}

function setStatus(msg: string): void {
  const el = $('fdStatus');
  el.textContent = msg;
  el.hidden = !msg;
}

function applyLang(): void {
  document.documentElement.lang = lang;
  $('fdTitle').textContent = t('title', lang);
  $('fdTag').textContent = t('tagline', lang);
  $<HTMLInputElement>('fdInput').placeholder = t('placeholder', lang);
  $('fdAsk').textContent = t('ask', lang);
  $('fdMicLabel').textContent = recorder ? t('stop', lang) : t('speak', lang);
  $('fdExamples').innerHTML = STRINGS.examples[lang].map((q) => '<button type="button" class="fd-chip" data-q="' + esc(q) + '">' + esc(q) + '</button>').join('');
  $('fdVoiceNeeds').textContent = t('voiceNeeds', lang);
  $('fdVoiceDownload').textContent = t('prepareVoice', lang);
  $('fdHeardL').textContent = t('heard', lang);
  $('fdYes').textContent = t('yes', lang);
  $('fdNo').textContent = t('no', lang);
  $('fdUnsureT').textContent = t('notSure', lang);
  $('fdUnsureH').textContent = t('notSureHelp', lang);
  $('fdScopeT').textContent = t('outOfScope', lang);
  $('fdPlay').textContent = lang === 'so' ? 'Dhegayso' : 'Play';
  $('fdMapLink').textContent = t('openOnMap', lang);
  $('fdMapHome').textContent = t('mapLink', lang);
  $<HTMLAnchorElement>('fdMapHome').href = '/?lang=' + lang;
  $('fdPrivacy').textContent = t('privacy', lang);
  $('fdAi').textContent = t('aiLine', lang);
  $('fdFoot').textContent = t('footer', lang);
  const draft = $('fdDraft');
  draft.innerHTML = lang === 'so'
    ? esc(STRINGS.draftNote.so) + ' <span lang="en">' + esc(STRINGS.draftNote.en) + '</span>'
    : esc(STRINGS.draftNote.en) + ' <span lang="so">' + esc(STRINGS.draftNote.so) + '</span>';
  $('fdSlipOpen').textContent = t('slipOpen', lang);
  $('fdSlipTitle').textContent = t('slipTitle', lang);
  $('fdSlipHelp').textContent = t('slipHelp', lang);
  $('fdSlipConsent').textContent = t('slipConsent', lang);
  $('fdSlipMic').textContent = slipRecorder ? t('stop', lang) : t('slipSpeak', lang);
  $('fdSlipWhoL').textContent = t('slipWho', lang);
  $('fdSlipWhyL').textContent = t('slipWhy', lang);
  $('fdSlipToL').textContent = t('slipTo', lang);
  $('fdSlipUrgL').textContent = t('slipUrgent', lang);
  $('fdSlipHuman').textContent = t('slipHuman', lang);
  $('fdSlipSend').textContent = t('slipSms', lang);
  $('fdSlipSave').textContent = t('slipSave', lang);
  $('fdSlipCopy').textContent = t('slipCopy', lang);
  $('fdLogTitle').textContent = t('slipLogTitle', lang);
  $('fdLogExpiry').textContent = t('slipExpiry', lang);
  $('fdLogClear').textContent = t('slipClear', lang);
  $('fdDonateAsk').textContent = t('donateAsk', lang);
  $('fdDonateHelp').textContent = t('donateHelp', lang);
  $('fdDonateLangL').textContent = t('donateLang', lang);
  $('fdDonateTextL').textContent = t('donateText', lang);
  $('fdDonateKeep').textContent = t('donateKeep', lang);
  $('fdDonateSkip').textContent = t('donateSkip', lang);
  $('fdDonateEdit').textContent = t('donateEdit', lang);
  $('fdDonateExport').textContent = t('donateExport', lang);
  $('fdDonateClear').textContent = t('donateClear', lang);
  if (slip && !$('fdSlip').hidden) renderSlip();
  renderLog();
  renderDonateLang();
  document.querySelectorAll<HTMLButtonElement>('.fd-lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  if (pending) renderPending();
  if (lastAnswer && !$('fdAnswer').hidden) renderAnswer(compose(lastAnswer.place, lastAnswer.service, D.facilities, D.access, lang), false);
  renderNet();
  void renderVoiceState();
}

function renderNet(): void {
  const el = $('fdNet');
  const off = !navigator.onLine;
  el.textContent = off ? t('netOffline', lang) : t('netOnline', lang) + ' · ' + (cachedState === 'done' ? t('savedPage', lang) : t('savingPage', lang));
  el.classList.toggle('off', off);
}

function placeLabel(p: Place): string {
  const kind = p.kind === 'facility' ? typeWordByKind(p) : STRINGS.kinds[p.kind]?.[lang] || p.kind;
  return esc(p.name) + ' <small>' + esc(kind) + (p.district && p.kind !== 'district' ? ' · ' + esc(p.district) : '') + '</small>';
}

function typeWordByKind(p: Place): string {
  const f = D.facilities.facilities.find((x) => x.id === p.facilityId);
  return f ? typeWord(f, lang) : STRINGS.kinds.facility[lang];
}

/** the confirm card, or the "not sure" card with the in-region candidates as chips */
function renderPending(): void {
  if (!pending) return;
  const top = pending.matches[0];
  hideAll();
  if ($('fdHeardText').textContent) $('fdHeard').hidden = false;
  const inRegion = pending.matches.filter((m) => m.place.inRegion !== false);
  if (!top || top.score < UNSURE || top.place.inRegion === false) {
    $('fdUnsure').hidden = false;
    // a confident match outside Bakool is refused by name; otherwise the standard fail-safe
    const outside = top && top.score >= UNSURE && top.place.inRegion === false ? top.place : null;
    $('fdUnsureT').textContent = outside ? t('outsideRegion', lang, { place: outside.name }) : t('notSure', lang);
    $('fdUnsureH').textContent = t('notSureHelp', lang);
    $('fdChips').innerHTML = inRegion.map((m) => '<button type="button" class="fd-chip" data-k="' + esc(m.place.key) + '">' + placeLabel(m.place) + '</button>').join('') ||
      '<span class="fd-help">' + esc(lang === 'so' ? 'Qor magaca tuulada.' : 'Type the name of the village.') + '</span>';
    return;
  }
  $('fdConfirm').hidden = false;
  $('fdConfirmQ').innerHTML = esc(t('didYouMean', lang, { place: '' })).replace('?', '') + ' <strong>' + placeLabel(top.place) + '</strong>?';
  $('fdConfirmScore').textContent = t('match', lang, { score: Math.round(top.score * 100) });
  $('fdYes').focus({ preventScroll: true });
}

function renderAnswer(a: Answer, bringIntoView = true): void {
  lastAnswer = a;
  hideAll();
  if ($('fdHeardText').textContent) $('fdHeard').hidden = false;
  const card = $('fdAnswer');
  card.hidden = false;
  const meta: string[] = [];
  meta.push('<span>' + esc(t('youAsked', lang)) + ' <strong>' + esc(a.place.name) + '</strong>' + (a.district ? ' · ' + esc(a.district) : '') + '</span>');
  if (a.service) meta.push('<span>' + esc(t('service', lang)) + ': <strong>' + esc(a.service.label[lang]) + '</strong></span>');
  $('fdMeta').innerHTML = meta.join('');
  const cls: Record<string, string> = { nearestIs: 'main', noFacility: 'main', flagged: 'flag', registerDate: 'register', serviceUnknown: 'register', serviceUnknownPost: 'register', hospitalNote: 'register' };
  $('fdLines').innerHTML = a.lines.map((l, i) => '<li class="' + (cls[a.lineKeys[i]] || '') + '">' + esc(l) + '</li>').join('');
  const src = $('fdFlagSrc');
  if (a.flag) {
    src.hidden = false;
    src.innerHTML = (lang === 'so' ? 'Il: ' : 'Source: ') + '<a href="' + esc(a.flag.url) + '" target="_blank" rel="noopener">' + esc(a.flag.source) + '</a>';
  } else src.hidden = true;
  const f = a.nearest?.facility;
  const link = $<HTMLAnchorElement>('fdMapLink');
  if (f) {
    const cd = D.access.meta.cell_deg;
    link.href = '/?cell=' + Math.round(f.lon / cd) + '_' + Math.round(f.lat / cd) + '&layers=access,fac&lang=' + lang;
    link.hidden = false;
  } else link.hidden = true;
  void loadVoiceManifest().then((m) => {
    $('fdPlay').hidden = !m || lang !== 'so';
  });
  if (bringIntoView) {
    // the answer is read from its top, above the keyboard
    $<HTMLInputElement>('fdInput').blur();
    card.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
    card.focus({ preventScroll: true });
  }
}

// ---- the question --------------------------------------------------------------------

function ask(question: string, fromVoice: boolean): void {
  const q = question.trim();
  if (!q) return;
  stopSpeaking();
  lastAnswer = null;
  $('fdDonate').hidden = true;
  if (!fromVoice) {
    lastVoice = null;
    $('fdHeardText').textContent = '';
    $('fdHeardMs').textContent = '';
  }
  if (isOutOfScope(q)) {
    pending = null;
    hideAll();
    $('fdScope').hidden = false;
    return;
  }
  const service = matchService(q);
  const matches = matchPlaces(q, GAZ, 6);
  pending = { matches, service, question: q };
  const top = matches[0];
  // a typed, exact, in-region place that is the whole of what was typed, with no namesake tied with it,
  // needs no confirmation; anything heard, fuzzy, partial, ambiguous, or outside Bakool is confirmed first
  if (top && top.score >= SURE && top.place.inRegion !== false && !fromVoice && coversWholeQuestion(top, q) && !tiedAtTop(matches)) {
    answer(top.place, service);
    return;
  }
  renderPending();
}

function answer(place: Place, service: Service | null): void {
  pending = null;
  const a = compose(place, service, D.facilities, D.access, lang);
  renderAnswer(a);
  if (lang === 'so') void speakKeys(a.lineKeys);
  // a heard question about a place that the worker has now confirmed is a labelled sample of her own voice:
  // offer to keep it, unless the question named a service or described a case
  if (lastVoice && donationsSupported() && !service && !mentionsCase(lastVoice.heard)) offerDonation(place.name);
  else lastVoice = null;
}

// ---- referral slip -------------------------------------------------------------------

function chips<T extends string>(el: HTMLElement, options: { key: T; label: { en: string; so: string } }[], current: T | null, onPick: (k: T) => void): void {
  el.innerHTML = options.map((o) => '<button type="button" class="fd-chip" data-k="' + esc(o.key) + '" aria-pressed="' + (o.key === current) + '">' + esc(o.label[lang]) + '</button>').join('');
  el.querySelectorAll<HTMLButtonElement>('.fd-chip').forEach((b) => b.addEventListener('click', () => onPick(b.dataset.k as T)));
}

function openSlip(): void {
  if (!lastAnswer) return;
  const a = lastAnswer;
  slip = {
    who: null,
    // a service word pre-fills the reason only when it is one reason; "emergency" is the worker's call
    why: a.service ? (a.service.key === 'nutrition' ? 'malnutrition' : a.service.key === 'delivery' ? 'delivery' : null) : null,
    urgent: a.service?.key === 'emergency',
    fromPlace: a.place.name,
    fromDistrict: a.district,
    // a referral goes to the facility above health-post level (the nearest itself when it is one), else the nearest listed one
    to: a.referral?.facility || a.nearest?.facility || null,
    at: new Date().toISOString(),
  };
  $('fdSlip').hidden = false;
  renderSlip();
  $('fdSlip').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

function renderSlip(): void {
  if (!slip || !lastAnswer) return;
  const s = slip;
  chips($('fdSlipWho'), WHO, s.who, (k) => { s.who = k; renderSlip(); });
  chips($('fdSlipWhy'), WHY, s.why, (k) => { s.why = k; renderSlip(); });
  const targets = [lastAnswer.referral, lastAnswer.nearest, lastAnswer.next].filter((n): n is NonNullable<typeof n> => !!n)
    .filter((n, i, arr) => arr.findIndex((m) => m.facility.id === n.facility.id) === i)
    .map((n) => ({ key: n.facility.id, label: { en: n.facility.name + ' · ' + n.km.toFixed(1) + ' km', so: n.facility.name + ' · ' + n.km.toFixed(1) + ' km' }, facility: n.facility }));
  chips($('fdSlipTo'), targets, s.to?.id ?? null, (k) => { s.to = targets.find((x) => x.key === k)?.facility || null; renderSlip(); });
  const yes = lang === 'so' ? 'haa' : 'yes';
  const no = lang === 'so' ? 'maya' : 'no';
  chips($('fdSlipUrg'), [{ key: 'yes', label: { en: yes, so: yes } }, { key: 'no', label: { en: no, so: no } }], s.urgent ? 'yes' : 'no', (k) => { s.urgent = k === 'yes'; renderSlip(); });
  const complete = slipComplete(s);
  const sms = complete ? composeSms(s) : '';
  $('fdSlipSms').textContent = sms ? sms + '\n(' + sms.length + '/160)' : '';
  ($('fdSlipSend') as HTMLButtonElement).disabled = !complete;
  ($('fdSlipSave') as HTMLButtonElement).disabled = !complete;
  ($('fdSlipCopy') as HTMLButtonElement).disabled = !complete;
  if (!complete) slipStatus(t('slipIncomplete', lang));
  else if ($('fdSlipStatus').textContent === t('slipIncomplete', lang)) slipStatus('');
}

function slipStatus(msg: string): void {
  const st = $('fdSlipStatus');
  st.textContent = msg;
  st.hidden = !msg;
}

const SLOT_WORD = { who: { en: 'who', so: 'qofka' }, why: { en: 'why', so: 'sababta' } };

async function toggleSlipMic(): Promise<void> {
  const btn = $<HTMLButtonElement>('fdSlipMic');
  if (!speechSupported()) {
    slipStatus(t('noMic', lang));
    return;
  }
  if (slipRecorder) {
    const rec = slipRecorder;
    slipRecorder = null;
    btn.setAttribute('aria-pressed', 'false');
    btn.textContent = t('slipSpeak', lang);
    slipStatus(t('transcribing', lang));
    try {
      const blob = await rec.stop();
      const { text } = await transcribe(blob, lang, (pct) => slipStatus(t('loadingModel', lang) + ' ' + pct + '%'));
      // a spoken slip describes a patient: it is never kept or offered for keeping
      lastVoice = null;
      slipStatus(t('heard', lang) + ' ' + (text || '…'));
      if (slip && text) {
        const r = fillSlots(text, slip);
        slip = r.slip;
        renderSlip();
        if (r.ambiguous.length) slipStatus(t('heard', lang) + ' ' + text + ' — ' + r.ambiguous.map((k) => t('slipAmbiguous', lang, { slot: SLOT_WORD[k][lang] })).join(' '));
      }
    } catch (err) {
      console.error(err);
      slipStatus(t('speechFailed', lang));
    }
    return;
  }
  try {
    slipRecorder = await startRecording();
    btn.setAttribute('aria-pressed', 'true');
    btn.textContent = t('stop', lang);
    slipStatus(t('listening', lang));
  } catch (err) {
    console.error(err);
    slipStatus(t('noMic', lang));
  }
}

function renderLog(): void {
  const log = loadLog();
  const list = $('fdLogList');
  list.innerHTML = log.length
    ? log.slice().reverse().map((l) => '<li><code>' + esc(l.sms) + '</code><br><span class="' + (l.sent ? 'opened' : '') + '">' + esc(l.sent ? t('slipSent', lang) : t('slipNotSent', lang)) + '</span> · ' + esc(new Date(l.at).toLocaleString()) + '</li>').join('')
    : '<li>' + esc(t('slipLogEmpty', lang)) + '</li>';
  const more = $<HTMLDetailsElement>('fdMore');
  const show = (n: number): void => {
    more.hidden = log.length + n === 0;
    $('fdMoreT').textContent = t('more', lang) + ' (' + (log.length + n) + ')';
  };
  if (donationsSupported()) {
    void listDonations().then((items) => {
      $('fdDonateCount').textContent = t('donateCount', lang, { n: items.length });
      ($('fdDonateExport') as HTMLButtonElement).disabled = !items.length;
      ($('fdDonateClear') as HTMLButtonElement).disabled = !items.length;
      show(items.length);
    }).catch(() => show(0));
  } else {
    $('fdDonateCount').textContent = '';
    show(0);
  }
}

// ---- recordings kept for speech data -------------------------------------------------

let donateLocale: 'so' | 'ymm' | 'other' = 'so';
let donatePlace = '';

function renderDonateLang(): void {
  const opts = [
    { key: 'so' as const, label: { en: t('donateSo', 'en'), so: t('donateSo', 'so') } },
    { key: 'ymm' as const, label: { en: t('donateYmm', 'en'), so: t('donateYmm', 'so') } },
    { key: 'other' as const, label: { en: t('donateOther', 'en'), so: t('donateOther', 'so') } },
  ];
  chips($('fdDonateLang'), opts, donateLocale, (k) => { donateLocale = k; renderDonateLang(); });
}

/** one line under the answer; the explanation, the language and the text are a tap away */
function offerDonation(place: string): void {
  if (!lastVoice) return;
  donatePlace = place;
  // the interface language is the best first guess at what was spoken
  donateLocale = lang === 'so' ? 'so' : 'other';
  renderDonateLang();
  $<HTMLTextAreaElement>('fdDonateText').value = lastVoice.heard;
  $('fdDonateMore').hidden = true;
  $('fdDonate').hidden = false;
}

async function keepLastVoice(): Promise<void> {
  if (!lastVoice) return;
  const text = $<HTMLTextAreaElement>('fdDonateText').value.trim();
  try {
    await keepDonation({ at: new Date().toISOString(), locale: donateLocale, heard: lastVoice.heard, confirmed: text, place: donatePlace, mime: lastVoice.blob.type || 'audio/webm', blob: lastVoice.blob });
    lastVoice = null;
    $('fdDonate').hidden = true;
    const items = await listDonations();
    logStatus(t('donateKept', lang, { n: items.length }));
    renderLog();
  } catch (err) {
    console.error(err);
    logStatus(String(err));
  }
}

function logStatus(msg: string): void {
  const st = $('fdLogStatus');
  st.textContent = msg;
  st.hidden = !msg;
}

// ---- voice ---------------------------------------------------------------------------

let voiceReady = false;

/** the voice pill and the download notice: said before any data is spent */
async function renderVoiceState(): Promise<void> {
  const pill = $('fdVoice');
  const notice = $('fdVoiceNotice');
  if (!speechSupported()) {
    pill.hidden = true;
    notice.hidden = true;
    return;
  }
  voiceReady = voiceReady || (await voiceCached());
  pill.hidden = false;
  if (voiceReady) {
    const used = await storageUsed();
    pill.textContent = t('voiceReady', lang) + (used ? ' · ' + Math.round(used / 1048576) + ' MB' : '');
    pill.classList.add('ok');
    notice.hidden = true;
  } else {
    pill.textContent = t('voiceNot', lang);
    pill.classList.remove('ok');
    notice.hidden = !navigator.onLine;
  }
}

async function downloadVoice(): Promise<void> {
  const bar = $<HTMLProgressElement>('fdVoiceProgress');
  const btn = $<HTMLButtonElement>('fdVoiceDownload');
  btn.disabled = true;
  bar.hidden = false;
  try {
    await prepareVoice((pct) => {
      bar.value = pct;
    });
    voiceReady = true;
    await renderVoiceState();
  } catch (err) {
    console.error(err);
    setStatus(t('speechFailed', lang));
  } finally {
    bar.hidden = true;
    btn.disabled = false;
  }
}

async function toggleMic(): Promise<void> {
  const btn = $<HTMLButtonElement>('fdMic');
  if (!speechSupported()) {
    setStatus(t('noMic', lang));
    return;
  }
  if (recorder) {
    const rec = recorder;
    recorder = null;
    btn.setAttribute('aria-pressed', 'false');
    $('fdMicLabel').textContent = t('speak', lang);
    setStatus(t('transcribing', lang));
    try {
      const blob = await rec.stop();
      const { text, ms } = await transcribe(blob, lang, (pct) => setStatus(t('loadingModel', lang) + ' ' + pct + '%'));
      voiceReady = true;
      void renderVoiceState();
      lastVoice = { blob, heard: text };
      setStatus('');
      $('fdHeard').hidden = false;
      $('fdHeardText').textContent = text || '…';
      $('fdHeardMs').textContent = (ms / 1000).toFixed(1) + ' s';
      $<HTMLInputElement>('fdInput').value = text;
      if (!text) {
        pending = null;
        hideAll();
        $('fdHeard').hidden = false;
        $('fdUnsure').hidden = false;
        $('fdUnsureT').textContent = t('heardNothing', lang);
        $('fdUnsureH').textContent = '';
        $('fdChips').innerHTML = '';
        return;
      }
      ask(text, true);
    } catch (err) {
      console.error(err);
      setStatus(t('speechFailed', lang));
    }
    return;
  }
  try {
    stopSpeaking();
    // the model loads while the person speaks (the first time online; from the cache after that)
    void prepareVoice((pct) => setStatus(t('loadingModel', lang) + ' ' + pct + '%')).catch(() => undefined);
    recorder = await startRecording();
    btn.setAttribute('aria-pressed', 'true');
    $('fdMicLabel').textContent = t('stop', lang);
    setStatus(t('listening', lang));
  } catch (err) {
    console.error(err);
    setStatus(t('noMic', lang));
  }
}

// ---- offline -------------------------------------------------------------------------

let cachedState: 'none' | 'working' | 'done' = 'none';

function registerOffline(): void {
  if (!('serviceWorker' in navigator)) return;
  cachedState = 'working';
  navigator.serviceWorker
    .register('/sw.js')
    .then((reg) => {
      const done = (): void => {
        cachedState = 'done';
        renderNet();
      };
      if (reg.active) done();
      reg.addEventListener('updatefound', () => {
        reg.installing?.addEventListener('statechange', () => {
          if (reg.installing?.state === 'activated' || reg.active) done();
        });
      });
    })
    .catch((err) => {
      console.error(err);
      cachedState = 'none';
      renderNet();
    });
  window.addEventListener('online', () => {
    renderNet();
    void renderVoiceState();
  });
  window.addEventListener('offline', () => {
    renderNet();
    void renderVoiceState();
  });
}

// ---- boot ----------------------------------------------------------------------------

async function boot(): Promise<void> {
  const saved = (() => {
    try {
      return localStorage.getItem('finder-lang');
    } catch {
      return null;
    }
  })();
  if (saved === 'en' || saved === 'so') lang = saved;
  // a link from the map carries the language it was read in
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (fromUrl === 'en' || fromUrl === 'so') lang = fromUrl;
  if (!speechSupported()) $('fdMic').hidden = true;
  applyLang();
  registerOffline();
  try {
    const [access, facilities, places, adm2] = await Promise.all([
      fetchGzJson<AccessData>(DATASETS.access),
      fetchGzJson<FacilitiesData>(DATASETS.facilities),
      fetchGzJson<PlacesData>(DATASETS.places),
      fetchGzJson<Adm2Data>(DATASETS.adm2),
    ]);
    D = { access, facilities, places, adm2 };
  } catch (err) {
    console.error(err);
    setStatus(lang === 'so' ? 'Xogta lama soo rari karin. Mar kale isku day.' : 'The data could not be loaded. Try again.');
    return;
  }
  GAZ = buildGazetteer(D);
  setStatus('');

  $('fdForm').addEventListener('submit', (e) => {
    e.preventDefault();
    ask($<HTMLInputElement>('fdInput').value, false);
  });
  $('fdExamples').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.fd-chip');
    if (!b) return;
    $<HTMLInputElement>('fdInput').value = b.dataset.q || '';
    ask(b.dataset.q || '', false);
  });
  $('fdMic').addEventListener('click', () => void toggleMic());
  $('fdVoiceDownload').addEventListener('click', () => void downloadVoice());
  $('fdYes').addEventListener('click', () => {
    if (pending?.matches[0]) answer(pending.matches[0].place, pending.service);
  });
  $('fdNo').addEventListener('click', () => {
    if (!pending) return;
    // drop the top candidate and offer the rest as a list
    pending.matches = pending.matches.slice(1);
    if (pending.matches[0]) pending.matches[0] = { ...pending.matches[0], score: Math.min(pending.matches[0].score, UNSURE - 0.01) };
    renderPending();
  });
  $('fdChips').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.fd-chip');
    if (!b || !pending) return;
    const m = pending.matches.find((x) => x.place.key === b.dataset.k);
    if (m) answer(m.place, pending.service);
  });
  $('fdSlipOpen').addEventListener('click', openSlip);
  $('fdSlipMic').addEventListener('click', () => void toggleSlipMic());
  $('fdSlipSend').addEventListener('click', () => {
    if (!slip || !slipComplete(slip)) return;
    const sms = composeSms(slip);
    logSlip(sms, true);
    renderLog();
    // the phone's own SMS app opens with the code; the worker chooses the recipient and presses send
    location.href = smsLink(sms);
  });
  $('fdSlipSave').addEventListener('click', () => {
    if (!slip || !slipComplete(slip)) return;
    logSlip(composeSms(slip), false);
    slipStatus(t('slipSaved', lang));
    renderLog();
  });
  $('fdSlipCopy').addEventListener('click', () => {
    if (!slip || !slipComplete(slip)) return;
    void navigator.clipboard?.writeText(composeSms(slip)).then(() => slipStatus(t('slipCopy', lang) + ' ✓')).catch(() => undefined);
  });
  $('fdLogClear').addEventListener('click', () => {
    if (!window.confirm(t('confirmDelete', lang))) return;
    saveLog([]);
    renderLog();
  });
  $('fdDonateKeep').addEventListener('click', () => void keepLastVoice());
  $('fdDonateSkip').addEventListener('click', () => {
    lastVoice = null;
    $('fdDonate').hidden = true;
  });
  $('fdDonateEdit').addEventListener('click', () => {
    const more = $('fdDonateMore');
    more.hidden = !more.hidden;
  });
  $('fdDonateExport').addEventListener('click', () => {
    void listDonations().then((items) => {
      if (!items.length || !window.confirm(t('donateExportConfirm', lang, { n: items.length }))) return;
      return exportDonations().then(({ blob, count }) => shareOrDownload(blob, 'somali-voice-' + new Date().toISOString().slice(0, 10) + '.zip').then(() => logStatus(t('donateExported', lang, { n: count }))));
    }).catch((err) => logStatus(String(err)));
  });
  $('fdDonateClear').addEventListener('click', () => {
    if (!window.confirm(t('confirmDelete', lang))) return;
    void clearDonations().then(() => renderLog());
  });
  renderLog();
  $('fdPlay').addEventListener('click', () => {
    if (lastAnswer) void speakKeys(lastAnswer.lineKeys);
  });
  document.querySelectorAll<HTMLButtonElement>('.fd-lang button').forEach((b) =>
    b.addEventListener('click', () => {
      lang = b.dataset.lang as Lang;
      try {
        localStorage.setItem('finder-lang', lang);
      } catch {
        /* private mode */
      }
      applyLang();
    }),
  );
  void renderVoiceState();
  // a question in the URL (?q=...) runs at once, for deep links from the map and for the demo
  const q = new URLSearchParams(location.search).get('q');
  if (q) {
    $<HTMLInputElement>('fdInput').value = q;
    ask(q, false);
  }
}

void boot();

// keep the strings table reachable for the clip synthesiser's key check
export { STRINGS };

// test hook (?debug=1): lets a headless test stand in for the microphone and run the evaluation set
if (new URLSearchParams(location.search).get('debug') === '1') {
  (window as unknown as { finderDebug: unknown }).finderDebug = {
    setVoice(blob: Blob, heard: string) {
      lastVoice = { blob, heard };
    },
    fillSlip(text: string) {
      if (slip) {
        const r = fillSlots(text, slip);
        slip = r.slip;
        renderSlip();
        return r;
      }
      return null;
    },
    transcribeBlob: (b: Blob) => transcribe(b, lang),
    match: (text: string) => matchPlaces(text, GAZ, 6).map((m) => ({ name: m.place.name, kind: m.place.kind, inRegion: m.place.inRegion !== false, score: +m.score.toFixed(2) })),
    ask: (text: string) => ask(text, false),
    exportDonations,
  };
}
