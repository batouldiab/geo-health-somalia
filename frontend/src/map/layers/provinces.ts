import type { Feature, Geometry } from 'geojson';
import L from 'leaflet';
import { regionIdx, store } from '../../data/store';
import type { Adm1Props } from '../../data/types';
import { state } from '../../state';
import { map } from '../map';

/**
 * The 18 province outlines of the national grid, for context around the built
 * region, which is drawn heavier and white. Not interactive: a click anywhere on
 * the map that no square or marker took lets go of the selected square (cells.ts).
 */
export function provStyle(f?: Feature<Geometry, Adm1Props>): L.PathOptions {
  if (f && f.properties.idx === regionIdx()) {
    return { fill: true, fillColor: '#334155', fillOpacity: 0.04, color: '#ffffff', weight: 3.5, opacity: 1 };
  }
  return { fill: true, fillColor: '#334155', fillOpacity: 0.04, color: '#0ea5e9', weight: 1, opacity: 0.6 };
}

export function buildProvinces(onClickElsewhere: () => void): void {
  map.on('click', () => onClickElsewhere());
  state.provLayer = L.geoJSON(store.G.adm1, { interactive: false, style: provStyle }).addTo(map);
}
