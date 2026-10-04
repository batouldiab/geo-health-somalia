import 'leaflet/dist/leaflet.css';
import './styles/main.css';

import { loadBuildingsData, loadGrid, loadHealthData } from './data/loader';
import { initStore } from './data/store';
import { buildHealthLayers } from './map/layers/health';
import { buildProvinces } from './map/layers/provinces';
import { buildSquares, unselectCell } from './map/layers/squares';
import { createMap } from './map/map';
import { initBakool } from './panels/bakool';
import { renderView } from './render';
import { initRouter } from './router';
import { subscribe } from './state';

/**
 * Boot: the files, the map, the layers, the card, then the URL into the view.
 * Without the files there is nothing to show, so a failed load is said plainly
 * in both languages and nothing else runs.
 */
async function boot(): Promise<void> {
  const card = document.getElementById('bkCard')!;
  try {
    const [grid, health, ob] = await Promise.all([loadGrid(), loadHealthData(), loadBuildingsData()]);
    // the Open Buildings files are optional: their buttons appear only when they exist
    initStore(grid, Object.assign(health, ob));
  } catch (err) {
    console.error(err);
    card.innerHTML =
      '<p class="bk-lead">The map data did not load. Check the connection and refresh the page.</p>' +
      '<p class="bk-lead" lang="so">Xogta khariidadda lama soo rarin. Hubi xiriirka oo dib u cusboonaysii bogga.</p>';
    return;
  }

  createMap();
  buildProvinces(unselectCell);
  buildSquares();
  buildHealthLayers();
  initBakool();

  // one state, one render: every change of the view redraws; the router then
  // reads the URL into the view (which triggers the first render) and keeps
  // the two in step from here on
  subscribe(() => renderView());
  initRouter();
}

void boot();
