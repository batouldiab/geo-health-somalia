import type { AccessData, Facility, FacilitiesData } from '../data/types';
import { flagFor } from './flags';
import type { Place, Service } from './match';
import { minutesWords, STRINGS, t, type Lang } from './strings';

/**
 * Composing the answer. Inputs: a confirmed place, an optional service, and
 * the data files. Output: the facilities to name, the figures, the flags, and
 * the sentences, one per template. No sentence is written here that is not in
 * strings.ts; no fact is used that is not in the files.
 */

export interface Named {
  facility: Facility;
  km: number;
  dir: string;
}

export interface Answer {
  place: Place;
  service: Service | null;
  nearest: Named | null;
  /** the nearest facility above health-post level (health centre or MCH); the nearest itself when it is one */
  referral: Named | null;
  next: Named | null;
  walkMin?: number;
  driveMin?: number;
  district: string | null;
  flag: { text: string; source: string; url: string } | null;
  /** the sentences in order, for display and for speech */
  lines: string[];
  /** keys of the templates used, for the audio clips */
  lineKeys: string[];
}

export function haversineKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const r = 6371;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = p2 - p1;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

function bearing(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function dirWord(deg: number, lang: Lang): string {
  return STRINGS.dirs[lang][Math.round(deg / 45) % 8];
}

export function typeWord(f: Facility, lang: Lang): string {
  const known = STRINGS.types[f.type];
  if (known) return known[lang];
  if (f.referral) return lang === 'so' ? 'heer xarun caafimaad' : 'health centre level';
  return f.type ? f.type.toLowerCase() : lang === 'so' ? 'xarun caafimaad' : 'health facility';
}

function km1(x: number): string {
  return x < 0.05 ? '< 0.1' : (Math.round(x * 10) / 10).toFixed(1);
}

/** the two registers list some facilities twice under other names a few metres apart: one compound is named once */
function sameCompound(a: Named, b: Named): boolean {
  return a.facility.id === b.facility.id || haversineKm(a.facility.lon, a.facility.lat, b.facility.lon, b.facility.lat) < 0.2;
}

export function compose(place: Place, service: Service | null, F: FacilitiesData, A: AccessData, lang: Lang): Answer {
  // listed facilities only (OSM points are shown on the map, not spoken as a destination)
  const listed = F.facilities.filter((f) => f.source_key !== 'osm');
  const named = (f: Facility): Named => ({
    facility: f,
    km: haversineKm(place.lon, place.lat, f.lon, f.lat),
    dir: dirWord(bearing(place.lon, place.lat, f.lon, f.lat), lang),
  });
  const ranked = listed.map(named).sort((a, b) => a.km - b.km);
  // a question about a facility by name answers with that facility first
  const nearest = place.facilityId ? ranked.find((n) => n.facility.id === place.facilityId) || ranked[0] || null : ranked[0] || null;
  // the higher level: the nearest itself when it is a health centre or MCH, else the nearest one that is
  const referral = nearest ? (nearest.facility.referral ? nearest : ranked.find((n) => n.facility.referral && !sameCompound(n, nearest)) || null) : null;
  const next = nearest ? ranked.find((n) => !sameCompound(n, nearest) && (!referral || !sameCompound(n, referral))) || null : null;

  const cd = A.meta.cell_deg;
  const cell = A.cells[Math.round(place.lon / cd) + '_' + Math.round(place.lat / cd)];
  const district = place.district || cell?.district || null;
  const fl = flagFor(district) || (nearest ? flagFor(nearest.facility.district_adm2) : null);

  const lines: string[] = [];
  const keys: string[] = [];
  const push = (key: keyof typeof STRINGS, vars: Record<string, string | number>): void => {
    lines.push(t(key, lang, vars));
    keys.push(key);
  };

  if (!nearest) {
    push('noFacility', { place: place.name });
  } else {
    push('nearestIs', { place: place.name, facility: nearest.facility.name, type: typeWord(nearest.facility, lang), km: km1(nearest.km), dir: nearest.dir });
    if (cell?.tt_walking_mean != null) {
      if (cell.tt_motorized_mean != null) push('walkTime', { walk: minutesWords(cell.tt_walking_mean, lang), drive: minutesWords(cell.tt_motorized_mean, lang) });
      else push('walkTimeOnly', { walk: minutesWords(cell.tt_walking_mean, lang) });
    }
    // no register lists services: say so, and name the higher level when the nearest is a health post
    // (vaccination is a health-post service in Somalia's essential package, so no "may not handle" for it)
    if (service) push(nearest.facility.referral || service.key === 'vaccination' ? 'serviceUnknown' : 'serviceUnknownPost', { service: service.label[lang] });
    if (referral && referral !== nearest) {
      push('referralIs', { facility: referral.facility.name, km: km1(referral.km), dir: referral.dir });
      // the higher-level facility may come from the other list: say which, with its date
      if (referral.facility.source_key !== nearest.facility.source_key) {
        const rs = STRINGS.sources[referral.facility.source_key];
        push('referralListed', { facility: referral.facility.name, source: rs ? rs[lang] : referral.facility.source });
      }
    } else if (next) {
      push('nextIs', { facility: next.facility.name, type: typeWord(next.facility, lang), km: km1(next.km), dir: next.dir });
    }
    // a delivery or emergency case may need a hospital, and no hospital in Bakool is on any list we can read
    if (service && (service.key === 'delivery' || service.key === 'emergency')) push('hospitalNote', {});
    const src = STRINGS.sources[nearest.facility.source_key];
    push('registerDate', { source: src ? src[lang] : nearest.facility.source });
    if (fl) push('flagged', { district: fl.district, asOf: fl.asOf, flag: fl[lang] });
  }

  return {
    place,
    service,
    nearest,
    referral,
    next,
    walkMin: cell?.tt_walking_mean,
    driveMin: cell?.tt_motorized_mean,
    district,
    flag: fl ? { text: fl[lang], source: fl.source, url: fl.url } : null,
    lines,
    lineKeys: keys,
  };
}
