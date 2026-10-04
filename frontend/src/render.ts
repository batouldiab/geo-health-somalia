import type L from 'leaflet';
import { findCell } from './data/store';
import { clearCell, showCell } from './map/layers/squares';
import { map } from './map/map';
import { renderBakool } from './panels/bakool';
import { state, view, type ViewState } from './state';

/**
 * The one render pass: applies the view to the fills and points, the selected
 * square and the card. Idempotent: only what changed since the last pass is
 * touched, so it can run on every setView() and on zoom changes.
 */
let last: ViewState | null = null;

function cellKey(c: [number, number] | null): string {
  return c ? c[0] + '_' + c[1] : '';
}

function toggleLayer(layer: L.Layer | null, on: boolean): void {
  if (!layer) return;
  if (on) {
    if (!map.hasLayer(layer)) layer.addTo(map);
  } else if (map.hasLayer(layer)) map.removeLayer(layer);
}

export function renderView(v: ViewState = view): void {
  const p = last;
  state.selectedCell = v.cell ? findCell(v.cell[0], v.cell[1]) : null;

  // fills first, then the squares and the district lines (already on the map), points on top
  toggleLayer(state.natBld, v.buildings);
  toggleLayer(state.natTravel, v.travel);
  toggleLayer(state.natAccess, v.access);
  state.cellLayer?.bringToFront();
  toggleLayer(state.natFac, v.facilities);
  toggleLayer(state.natStl, v.settlements);
  if (v.settlements) state.natStl?.eachLayer((l) => (l as L.Path).bringToFront());
  if (v.facilities) state.natFac?.eachLayer((l) => (l as L.Path).bringToFront());

  if (!p || cellKey(p.cell) !== cellKey(v.cell)) {
    if (state.selectedCell) showCell(state.selectedCell);
    else clearCell();
  }

  renderBakool(v, p);
  last = { ...v, cell: v.cell ? [v.cell[0], v.cell[1]] : null };
}

/** Re-apply the current view after something outside it changed (zoom level). */
export function rerender(): void {
  renderView(view);
}
