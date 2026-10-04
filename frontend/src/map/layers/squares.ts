import type { FeatureCollection, Polygon } from 'geojson';
import L from 'leaflet';
import { regionIdx, store } from '../../data/store';
import type { CellRow } from '../../data/types';
import { bakoolCellTip } from '../../panels/bakool';
import { setView, state, view } from '../../state';
import { map } from '../map';

/**
 * The region's 10x10 km squares: drawn once, faintly, over the fills; a tap
 * selects one (the card then reads it); the selected square is outlined in
 * white. A tap anywhere else on the map lets go of it.
 * Cell field layout: [col, row, region_idx, pop2015, pop2020, pop2025, pop2030, nl_x1000]
 */

export function cellsFC(cells: CellRow[]): FeatureCollection<Polygon, { i: number }> {
  const { CELL, H } = store;
  return {
    type: 'FeatureCollection',
    features: cells.map((c, i) => {
      const x = c[0] * CELL;
      const y = c[1] * CELL;
      return {
        type: 'Feature',
        properties: { i },
        geometry: {
          type: 'Polygon',
          coordinates: [[[x - H, y - H], [x + H, y - H], [x + H, y + H], [x - H, y + H], [x - H, y - H]]],
        },
      };
    }),
  };
}

/** the grid rows of the built region */
export function regionCells(): CellRow[] {
  const idx = regionIdx();
  return store.G.cells.filter((c) => c[2] === idx);
}

function sameCell(a: number[], c: CellRow): boolean {
  return a[0] === c[0] && a[1] === c[1];
}

/** Select a square: write the view; the render pass outlines it and the card reads it. */
export function selectCell(c: CellRow): void {
  setView({ cell: [c[0], c[1]] }, { history: 'push' });
}

/** Let go of the selected square. */
export function unselectCell(): void {
  if (view.cell) setView({ cell: null }, { history: 'push' });
}

/** Draw the region's squares once (boot). */
export function buildSquares(): void {
  state.curCells = regionCells();
  state.cellLayer = L.geoJSON(cellsFC(state.curCells), {
    style: () => ({ fillColor: '#0ea5e9', fillOpacity: 0.06, color: '#0ea5e9', weight: 0.5, opacity: 0.5 }),
    onEachFeature: (f, l) => {
      const tip = (): string => {
        const c = state.curCells[f.properties.i];
        return bakoolCellTip(c, !!view.cell && sameCell(view.cell, c));
      };
      l.on('mouseover', () => {
        (l as L.Path).setStyle({ fillOpacity: 0.35 });
        l.bindTooltip(tip(), { sticky: true }).openTooltip();
      });
      l.on('mouseout', () => (l as L.Path).setStyle({ fillOpacity: 0.06 }));
      l.on('click', (e: L.LeafletMouseEvent) => {
        // the click is the square's, not the map's
        L.DomEvent.stopPropagation(e);
        selectCell(state.curCells[f.properties.i]);
        if (l.getTooltip()) l.setTooltipContent(tip());
      });
    },
  }).addTo(map);
}

/** Outline the selected square (render pass). */
export function showCell(c: CellRow): void {
  if (state.hl) map.removeLayer(state.hl);
  const { CELL, H } = store;
  const x = c[0] * CELL;
  const y = c[1] * CELL;
  // not interactive: a click on the outline goes to the square under it; white, which no fill uses
  state.hl = L.rectangle(
    [[y - H, x - H], [y + H, x + H]],
    { color: '#ffffff', weight: 3.5, fillColor: '#ffffff', fillOpacity: 0.12, interactive: false },
  ).addTo(map);
  state.selectedCell = c;
}

/** No square selected: drop the outline (render pass). */
export function clearCell(): void {
  if (state.hl) {
    map.removeLayer(state.hl);
    state.hl = null;
  }
  state.selectedCell = null;
}
