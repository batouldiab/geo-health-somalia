import { store } from './data/store';
import { defaultView, setView, subscribe, type ViewState } from './state';

/**
 * The URL is the view state, readable by a person:
 *   /                                   the region with the need score and the listed facilities
 *   /?d=xudur&layers=tt,fac             one district in focus, coloured by walking time to care
 *   /?cell=486_43&layers=access         one 10x10 km square picked (its district follows)
 *   /?lang=so                           the card in Somali
 * Scope changes (district, square) push a history entry, so the browser's Back
 * button steps out of a square, then a district; fill toggles update the entry in place.
 */

export function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** a district of the region by its slug (xudur, ceel-barde), or null */
function districtFromParam(d: string | null): string | null {
  if (!d) return null;
  const f = store.HEALTH.adm2.adm2.features.find((x) => slug(x.properties.district) === slug(d));
  return f ? f.properties.district : null;
}

type LayerKey = 'access' | 'travel' | 'buildings' | 'facilities' | 'settlements';
/** ?layers=access,tt,bld,fac,stl */
const LAYER_CODES: [LayerKey, string][] = [
  ['access', 'access'], ['travel', 'tt'], ['buildings', 'bld'], ['facilities', 'fac'], ['settlements', 'stl'],
];

export function parse(search: string): Partial<ViewState> {
  const q = new URLSearchParams(search);
  const v: Partial<ViewState> = {};
  const lang = q.get('lang');
  if (lang === 'en' || lang === 'so') v.lang = lang;
  const d = districtFromParam(q.get('d'));
  if (d) v.district = d;
  // with a say on the layers, only those are on; without one the defaults stand
  if (q.has('layers')) {
    const layers = (q.get('layers') || '').split(',').filter(Boolean);
    for (const [key, code] of LAYER_CODES) v[key] = layers.includes(code);
  }
  const cell = q.get('cell');
  if (cell) {
    const m = /^(-?\d+)_(-?\d+)$/.exec(cell);
    if (m) v.cell = [Number(m[1]), Number(m[2])];
  }
  return v;
}

export function serialize(v: ViewState): string {
  const q = new URLSearchParams();
  q.set('lang', v.lang);
  if (v.district) q.set('d', slug(v.district));
  if (v.cell) q.set('cell', v.cell[0] + '_' + v.cell[1]);
  const layers = LAYER_CODES.filter(([k]) => v[k]).map(([, c]) => c);
  q.set('layers', layers.length ? layers.join(',') : 'none');
  return '?' + q.toString().replace(/%2C/g, ',');
}

/** Read the URL into the view, then keep the two in step both ways. Call after the renderer has subscribed. */
export function initRouter(): void {
  window.addEventListener('popstate', () => {
    setView({ ...defaultView(), ...parse(window.location.search) }, { history: 'none' });
  });
  subscribe((v, _prev, opts) => {
    if (opts.history === 'none') return;
    const url = window.location.pathname + serialize(v) + window.location.hash;
    const cur = window.location.pathname + window.location.search + window.location.hash;
    if (url === cur) return;
    if (opts.history === 'push') window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
  });
  setView({ ...defaultView(), ...parse(window.location.search) }, { history: 'replace' });
}
