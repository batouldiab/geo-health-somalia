import L from 'leaflet';
import type { Feature, FeatureCollection, Polygon } from 'geojson';
import { store } from '../../data/store';
import type { Facility, Settlement } from '../../data/types';
import { fmt } from '../../format';
import { state } from '../../state';
import { rampColor } from '../colors';

/**
 * Health-access layers for the region built by pipeline/build_bakool_health_v1.py
 * (Bakool). Five layers, all built once from store.HEALTH and toggled by the
 * render pass: travel time to care (cell fill), the underserved index U (cell
 * fill), buildings seen from space (cell fill), facilities (points) and
 * settlements far from care (points). The colour tables here are the ones the
 * Bakool card's buttons show as swatches, so map and card cannot disagree.
 */

// ---- colour tables -----------------------------------------------------------------
// The basemap is dark, so every ramp runs dim -> bright: the squares with the most need,
// the longest walk or the most buildings are the brightest, which is where the eye goes.
// No red-green pair anywhere; level and class are also coded by lightness and size.

/** walking minutes to the nearest facility (MAP 2020): three classes, the ones the card names */
export const TT_BREAKS = [60, 120];
export const TT_RAMP = ['#1f6f6a', '#f59e0b', '#f43f5e'];
export const TT_LABELS = ['under 1 hour', '1 to 2 hours', 'over 2 hours'];

/** people far from care (score U): rank classes (eighths of the squares with a score), dim to bright pink */
export const U_RAMP = ['#3b0a2a', '#5e1140', '#7f1a57', '#a1266f', '#c23688', '#dd4fa3', '#f17ac0', '#fdbfe0'];

/** facility symbols: fill by level (white: health centre or MCH; cyan: health post), dark ring, hollow when doubtful */
export const FAC_FILL = { referral: '#ffffff', post: '#22d3ee' } as const;
export const FAC_RING = '#0f172a';
export const FAC_SOURCE_LABEL: Record<string, string> = {
  maina2019: 'WHO/KEMRI facility database (2019; from lists dated up to 2013), via HDX',
  who2021: 'WHO / MoH Somalia list (HDX, 2021)',
  osm: 'OpenStreetMap (ODbL)',
};

/** AI-detected buildings per 10x10 km cell (Google Open Buildings V3): upper bounds of each class, dim to bright blue */
export const BLD_BREAKS = [50, 200, 500, 1000, 2000, 5000];
export const BLD_RAMP = ['#0c2a4a', '#0f3d66', '#125a8a', '#1e7fb0', '#38a3d6', '#67c3ec', '#a3dcf7'];
export const BLD_LABELS = ['1 to 50', '51 to 200', '201 to 500', '501 to 1,000', '1,001 to 2,000', '2,001 to 5,000', 'over 5,000'];
/** settlements: far from care (the outreach shortlist, rose) against the rest (slate) */
export const STL_FAR = '#fb7185';
export const STL_NEAR = '#94a3b8';

// ---- helpers -----------------------------------------------------------------------

/** octile breaks over cells that have an index; shared with the legend */
export function uBreaks(): number[] {
  const v = Object.values(store.HEALTH.access.cells)
    .map((a) => a.U ?? 0)
    .filter((x) => x > 0)
    .sort((a, b) => a - b);
  const b: number[] = [];
  for (let i = 1; i < 8; i++) b.push(v[Math.floor((v.length * i) / 8)]);
  return b;
}

export function ttColor(min: number | undefined): string | null {
  if (min == null) return null;
  return rampColor(Math.max(min, 0.001), TT_BREAKS, TT_RAMP, TT_RAMP[0]);
}

function accessFC(): FeatureCollection<Polygon, { key: string }> {
  const { CELL, H } = store;
  const cells = store.HEALTH.access.cells;
  const features: Feature<Polygon, { key: string }>[] = [];
  for (const key in cells) {
    const a = cells[key];
    const x = a.col * CELL;
    const y = a.row * CELL;
    features.push({
      type: 'Feature',
      properties: { key },
      geometry: {
        type: 'Polygon',
        coordinates: [[[x - H, y - H], [x + H, y - H], [x + H, y + H], [x - H, y + H], [x - H, y - H]]],
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---- layers ------------------------------------------------------------------------

/** travel time on foot to the nearest facility, population-weighted per cell (MAP 2020) */
export function buildTravelLayer(): void {
  const cells = store.HEALTH.access.cells;
  state.natTravel = L.geoJSON(accessFC(), {
    interactive: false,
    filter: (f) => cells[(f.properties as { key: string }).key].tt_walking_mean != null,
    style: (f: any) => ({
      fillColor: ttColor(cells[f.properties.key].tt_walking_mean) || 'transparent',
      fillOpacity: 0.8,
      stroke: false,
    }),
  });
}

/** people far from care: U = people x poverty incidence x how far beyond reach they are (capped at two hours) */
export function buildAccessLayer(): void {
  const cells = store.HEALTH.access.cells;
  const ub = uBreaks();
  state.natAccess = L.geoJSON(accessFC(), {
    interactive: false,
    filter: (f) => (cells[(f.properties as { key: string }).key].U ?? 0) > 0,
    style: (f: any) => ({
      fillColor: rampColor(cells[f.properties.key].U ?? 0, ub, U_RAMP, 'transparent'),
      fillOpacity: 0.85,
      stroke: false,
    }),
  });
}

/** no building detected within the check radius: the point could not be confirmed from space */
export function isDoubtful(f: Facility): boolean {
  const chk = store.HEALTH.checks?.checks[f.id];
  return !!chk && chk.buildings_within_m === 0;
}

function facilityTip(f: Facility): string {
  const lvl = f.referral ? 'Health centre / MCH level' : 'Health post';
  const chk = store.HEALTH.checks?.checks[f.id];
  const check = chk
    ? chk.buildings_within_m === 0
      ? '<br><span style="color:#fbbf24">No building detected within ' + chk.radius_m + ' m (Open Buildings, imagery up to 2023): the coordinates may be imprecise or the structure too small to detect</span>'
      : '<br><span style="color:#94a3b8">' + fmt(chk.buildings_within_m) + ' buildings within ' + chk.radius_m + ' m (Open Buildings, imagery up to 2023)</span>'
    : '';
  return '<strong>' + esc(f.name || 'Unnamed facility') + '</strong><br>' +
    esc(f.type || lvl) + (f.owner ? ' · ' + esc(f.owner) : '') +
    (f.district_adm2 ? '<br>' + esc(f.district_adm2) + ' district' : '') +
    '<br><span style="color:#94a3b8">' + esc(FAC_SOURCE_LABEL[f.source_key] || f.source) + '</span>' +
    '<br><span style="color:#94a3b8">Listed only; not confirmed open or staffed today</span>' + check;
}

/** what a click on a facility marker does besides stopping the map click; the Bakool view sets it */
let facilityClick: ((f: Facility) => void) | null = null;
export function setFacilityClick(fn: ((f: Facility) => void) | null): void {
  facilityClick = fn;
}

/**
 * Facilities as circle markers, sized for a finger over a coloured fill: white for a health
 * centre or MCH, cyan for a health post, both with a dark ring so one of the two always
 * separates the dot from the fill under it; hollow with a dashed ring when no building was
 * detected nearby. An invisible wider circle under each dot makes the tap target 44 px.
 */
export function buildFacilitiesLayer(): void {
  const group = L.layerGroup();
  for (const f of store.HEALTH.facilities.facilities) {
    const doubtful = isDoubtful(f);
    const fill = f.referral ? FAC_FILL.referral : FAC_FILL.post;
    const onClick = (e: L.LeafletMouseEvent): void => {
      // a click on a marker is about the facility, not the square under it
      L.DomEvent.stopPropagation(e);
      facilityClick?.(f);
    };
    const hit = L.circleMarker([f.lat, f.lon], { radius: 22, stroke: false, fillOpacity: 0, interactive: true });
    hit.on('click', onClick);
    group.addLayer(hit);
    const m = L.circleMarker([f.lat, f.lon], {
      radius: f.referral ? 9 : 7,
      fillColor: fill,
      fillOpacity: doubtful ? 0.2 : f.source_key === 'osm' ? 0.4 : 0.95,
      color: doubtful ? fill : FAC_RING,
      dashArray: doubtful ? '3 3' : undefined,
      weight: doubtful ? 2 : 2.5,
      opacity: 0.95,
    });
    m.bindTooltip(facilityTip(f), { direction: 'top', offset: [0, -6], opacity: 0.95 });
    m.on('click', onClick);
    group.addLayer(m);
  }
  state.natFac = group;
}

/** AI-detected buildings per cell (Google Open Buildings V3, confidence >= 0.7) */
export function buildBuildingsLayer(): void {
  const B = store.HEALTH.buildings;
  if (!B) return;
  state.natBld = L.geoJSON(accessFC(), {
    interactive: false,
    filter: (f) => (B.cells[(f.properties as { key: string }).key]?.n ?? 0) > 0,
    style: (f: any) => ({
      fillColor: rampColor(B.cells[f.properties.key]?.n ?? 0, BLD_BREAKS, BLD_RAMP, 'transparent'),
      fillOpacity: 0.7,
      stroke: false,
    }),
  });
}

function settlementTip(s: Settlement): string {
  const near = store.HEALTH.facilities.facilities.find((f) => f.id === s.nearest_fac);
  return '<strong>' + fmt(s.n) + ' buildings</strong>' + (s.district ? ' · ' + esc(s.district) + ' district' : '') +
    '<br>Nearest listed facility: ' + (near ? esc(near.name) + ', ' + s.nearest_km + ' km in a straight line' : 'none') +
    (s.tt_walking_mean != null ? '<br>Modelled walk to care, average for this 10 km square: ' + Math.round(s.tt_walking_mean) + ' min' : '') +
    '<br><span style="color:' + (s.far_from_care ? '#fb7185' : '#94a3b8') + '">' + (s.far_from_care ? 'Far from care: no listed facility within 5 km, in a square averaging over an hour on foot' : 'Within reach of a listed facility') + '</span>' +
    '<br><span style="color:#94a3b8">Settlement = cluster of buildings detected by Google Open Buildings (imagery up to 2023)</span>';
}

/** settlements (clusters of >= 20 detected buildings), the far-from-care ones in rose: the outreach shortlist */
export function buildSettlementsLayer(): void {
  const S = store.HEALTH.settlements;
  if (!S) return;
  const group = L.layerGroup();
  for (const s of S.settlements) {
    const m = L.circleMarker([s.lat, s.lon], {
      radius: Math.max(4, Math.min(14, 2 + Math.sqrt(s.n) / 2)),
      fillColor: s.far_from_care ? STL_FAR : STL_NEAR,
      fillOpacity: s.far_from_care ? 0.9 : 0.5,
      color: '#0f172a',
      weight: 1,
    });
    m.bindTooltip(settlementTip(s), { direction: 'top', offset: [0, -6], opacity: 0.95 });
    m.on('click', (e: L.LeafletMouseEvent) => L.DomEvent.stopPropagation(e));
    group.addLayer(m);
  }
  state.natStl = group;
}

export function buildHealthLayers(): void {
  buildTravelLayer();
  buildAccessLayer();
  buildBuildingsLayer();
  buildFacilitiesLayer();
  buildSettlementsLayer();
}
