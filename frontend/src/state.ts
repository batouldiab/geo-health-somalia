import type L from 'leaflet';
import { accessForCell, findCell, regionIdx } from './data/store';
import type { CellRow } from './data/types';

/**
 * What is on the screen, in one object. Every control writes here through
 * setView(); one render pass (render.ts) applies the result to the map and the
 * card, and the router mirrors it to the URL. Nothing reads a button to learn
 * the state.
 */
export type Lang = 'en' | 'so';

export interface ViewState {
  /** the card's language; rides in the URL so a shared link opens in the language it was read in */
  lang: Lang;
  /** the district in focus (its ADM2 name), or the whole region */
  district: string | null;
  /** one fill at a time: the need score, walking time to care, or buildings seen from space */
  access: boolean;
  travel: boolean;
  buildings: boolean;
  /** points: listed facilities, settlements far from care */
  facilities: boolean;
  settlements: boolean;
  /** [col, row] of the selected 10x10 km square */
  cell: [number, number] | null;
}

/** the last language chosen on this phone, else English; a `lang` in the URL overrides it (router.ts) */
function savedLang(): Lang {
  try {
    const saved = localStorage.getItem('bakool-lang');
    return saved === 'so' ? 'so' : 'en';
  } catch {
    return 'en';
  }
}

export function defaultView(): ViewState {
  return {
    lang: savedLang(),
    district: null,
    access: true,
    travel: false,
    buildings: false,
    facilities: true,
    settlements: false,
    cell: null,
  };
}

export const view: ViewState = defaultView();

export type History = 'push' | 'replace' | 'none';
export interface SetOptions {
  /** push: a new history entry (scope changes); replace (default): update in place; none: came from the URL itself */
  history?: History;
}
type Listener = (v: ViewState, prev: ViewState, opts: SetOptions) => void;
const listeners: Listener[] = [];

export function subscribe(fn: Listener): void {
  listeners.push(fn);
}

/** Merge a change into the view, keep it consistent, and notify the renderer and the router. */
export function setView(patch: Partial<ViewState>, opts: SetOptions = {}): void {
  const prev: ViewState = { ...view };
  Object.assign(view, patch);
  if (view.cell) {
    const c = findCell(view.cell[0], view.cell[1]);
    // a square outside the region, or one the files do not know, is not selectable
    if (!c || c[2] !== regionIdx()) view.cell = null;
    else {
      // a tapped square belongs to its district: the card's figures follow it
      const d = accessForCell(c)?.district;
      if (d) view.district = d;
    }
  }
  // one fill at a time
  if (view.access) view.travel = view.buildings = false;
  else if (view.travel) view.buildings = false;
  listeners.forEach((fn) => fn(view, prev, opts));
}

/** Runtime objects read by the map modules; the view above is the source of truth. */
export const state = {
  /** the region's clickable squares */
  cellLayer: null as L.GeoJSON | null,
  /** province outlines */
  provLayer: null as L.GeoJSON | null,
  /** outline of the selected square */
  hl: null as L.Rectangle | null,
  /** the selected square */
  selectedCell: null as CellRow | null,
  /** health-access overlays (map/layers/health.ts) */
  natFac: null as L.LayerGroup | null,
  natTravel: null as L.GeoJSON | null,
  natAccess: null as L.GeoJSON | null,
  natBld: null as L.GeoJSON | null,
  natStl: null as L.LayerGroup | null,
  /** the region's cells */
  curCells: [] as CellRow[],
};
