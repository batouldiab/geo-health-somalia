// The place-matcher test: every named OpenStreetMap place inside Bakool's five districts,
// every listed facility and the five districts are run through the finder's matcher in
// their own spelling and in the spelling variants a Somali speaker or a speech model
// produces (x<->h, dropped c, dh->d, kh->k, q->k, long vowels shortened, a typo), inside a
// typical question. The table reports how often the right place comes first without a
// confirmation (score >= SURE), first with a "did you mean" (>= UNSURE), in the top five,
// or falls to "not sure, ask a person". No model is involved: this measures the closed-list
// matching that every heard or typed name passes through.
//
//   node scripts/test-matcher.mjs            (Node 22.18+ strips the TypeScript types itself)
//
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { coversWholeQuestion, matchPlaces, normalize, somKey, SURE, tiedAtTop, UNSURE } from '../src/finder/match.ts';

const read = (p) => JSON.parse(gunzipSync(readFileSync(new URL('../../data/' + p, import.meta.url))).toString('utf8'));
const places = read('places_bakool_v1.json.gz');
const facilities = read('facilities_v1.json.gz');
const adm2 = read('adm2_bakool_v1.json.gz');

// the same gazetteer the finder builds (src/finder/main.ts buildGazetteer), without the map-only details
const gaz = { places: [], services: [] };
for (const f of adm2.adm2.features) {
  const name = f.properties.district;
  const town = places.places.find((p) => ['city', 'town', 'village'].includes(p.place) && somKey(p.name) === somKey(name) && p.district === name);
  gaz.places.push({ key: 'd:' + name, name, kind: 'district', lon: town ? town.lon : 0, lat: town ? town.lat : 0, inRegion: true, source: '' });
}
const seen = new Set();
for (const p of places.places) {
  const name = (p.name || '').replace(/[^\x20-\x7EÀ-ɏ’]/g, '').replace(/\s+/g, ' ').trim();
  if (!name) continue;
  const k = p.place + ':' + name.toLowerCase() + ':' + p.lon.toFixed(2) + ':' + p.lat.toFixed(2);
  if (seen.has(k)) continue;
  seen.add(k);
  gaz.places.push({ key: 'p:' + p.osm, name, kind: p.place, lon: p.lon, lat: p.lat, district: p.district, inRegion: p.in_region !== false, source: '' });
}
for (const f of facilities.facilities) if (f.name && f.source_key !== 'osm') gaz.places.push({ key: 'f:' + f.id, name: f.name, kind: 'facility', lon: f.lon, lat: f.lat, inRegion: true, facilityId: f.id, source: '' });

const targets = gaz.places.filter((p) => p.inRegion);
console.log(`gazetteer: ${gaz.places.length} entries (${targets.length} inside Bakool, ${gaz.places.length - targets.length} outside, refused by name)`);

// spelling variants of a name: the ways Somali place names are written and mis-heard
function variants(name) {
  const n = name;
  const out = new Set([n]);
  out.add(n.replace(/x/gi, 'h'));                 // Xudur -> Hudur
  out.add(n.replace(/h/gi, 'x'));                 // Hudur -> Xudur
  out.add(n.replace(/\bC/g, '').replace(/\bc/g, '')); // Ceel Barde -> Eel Barde
  out.add(n.replace(/([aeiou])\1/gi, '$1'));      // Waajid -> Wajid
  out.add(n.replace(/dh/gi, 'd'));                // Rab Dhuure -> Rab Duure
  out.add(n.replace(/q/gi, 'k'));                 // Qansax -> Kansax
  out.add(n.replace(/kh/gi, 'k'));
  if (n.length > 5) out.add(n.slice(0, -1));      // a dropped final letter
  if (n.length > 6) out.add(n.slice(0, 3) + n.slice(4)); // a dropped letter inside
  return [...out].filter((v) => v && normalize(v) !== '');
}

const frames = {
  en: ['nearest facility to {p}', 'where is the nearest clinic from {p}', 'delivery near {p}', '{p}'],
  so: ['xarunta ugu dhow {p}', 'xarun caafimaad meesha ugu dhow {p}', 'dhalmo {p} agteeda', '{p}'],
};

let wrongDirect = 0;
const wrongSamples = []; // a typed question answered without confirmation with the WRONG place: the live rule must make this 0
const rows = { exact: { sure: 0, confirm: 0, top5: 0, none: 0, n: 0 }, variant: { sure: 0, confirm: 0, top5: 0, none: 0, n: 0 } };
const failures = [];
function record(bucket, target, q) {
  const m = matchPlaces(q, gaz, 5);
  const i = m.findIndex((x) => x.place.key === target.key || (x.place.inRegion && somKey(x.place.name) === somKey(target.name)));
  const r = rows[bucket];
  r.n++;
  // a direct answer with a place other than the target is wrong unless the typed words ARE that other place's name
  // (a dropped letter that spells a real neighbour, "Gomrey" for Gomorey, is a different question, answered correctly)
  if (m[0] && i !== 0 && m[0].score >= SURE && m[0].place.inRegion !== false && coversWholeQuestion(m[0], q) && !tiedAtTop(m) && somKey(m[0].place.name) !== somKey(m[0].matched)) {
    wrongDirect++;
    if (wrongSamples.length < 8) wrongSamples.push({ q, target: target.name, top: m[0].place.name + ' (' + m[0].place.kind + ')' });
  }
  if (i === 0 && m[0].score >= SURE && coversWholeQuestion(m[0], q) && !tiedAtTop(m)) r.sure++;
  else if (i === 0 && m[0].score >= UNSURE) r.confirm++;
  else if (i > 0) r.top5++;
  else {
    r.none++;
    if (failures.length < 12) failures.push({ q, target: target.name, top: m[0] ? m[0].place.name + ' ' + m[0].score.toFixed(2) : '-' });
  }
}

for (const target of targets) {
  const langFrames = [...frames.en, ...frames.so];
  for (const fr of langFrames) record('exact', target, fr.replace('{p}', target.name));
  for (const v of variants(target.name)) if (v !== target.name) record('variant', target, langFrames[0].replace('{p}', v));
}

// out-of-region controls: confident matches must be flagged inRegion=false, never answered
const controls = ['Baydhabo', 'Baidoa', 'Berdale', 'Muqdisho', 'Beledweyne'];
const refused = controls.filter((c) => {
  const m = matchPlaces('nearest facility to ' + c, gaz, 5)[0];
  return !m || m.score < UNSURE || m.place.inRegion === false;
});

const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0);
function line(name, r) {
  return `${name.padEnd(28)} n=${String(r.n).padStart(5)}  first & sure ${String(pct(r.sure, r.n)).padStart(5)}%  first, confirm ${String(pct(r.confirm, r.n)).padStart(5)}%  in top 5 ${String(pct(r.top5, r.n)).padStart(5)}%  not sure ${String(pct(r.none, r.n)).padStart(5)}%`;
}
console.log(line('own spelling, in a question', rows.exact));
console.log(line('spelling variants', rows.variant));
console.log(`out-of-region controls refused by name or unmatched: ${refused.length}/${controls.length} (${refused.join(', ')})`);
console.log(`typed questions answered without confirmation with the wrong place (must be 0): ${wrongDirect}`);
for (const w of wrongSamples) console.log(`  ${w.q.padEnd(44)} wanted ${w.target.padEnd(24)} got ${w.top}`);
if (failures.length) {
  console.log('\nsample of questions that fell to "not sure":');
  for (const f of failures) console.log(`  ${f.q.padEnd(44)} wanted ${f.target.padEnd(24)} got ${f.top}`);
}
process.exitCode = wrongDirect === 0 && refused.length === controls.length && pct(rows.exact.sure + rows.exact.confirm + rows.exact.top5, rows.exact.n) >= 95 ? 0 : 1;
