import L from 'leaflet';
import { BASEMAPS, MAX_ZOOM, MIN_ZOOM } from '../config';

export let map: L.Map;

export function createMap(): L.Map {
  map = L.map('map', {
    preferCanvas: true,
    zoomControl: false,
    attributionControl: true,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    zoomSnap: 0.5,
  });
  // the opening view is set by the Bakool card (it fits the region beside the card)
  map.setView([4.3, 43.9], 8);
  map.attributionControl.setPrefix(false);
  L.control.zoom({ position: 'bottomleft' }).addTo(map);
  L.control.scale({ position: 'bottomleft', imperial: false, maxWidth: 120 }).addTo(map);
  L.tileLayer(BASEMAPS.dark.url, BASEMAPS.dark.options).addTo(map);
  return map;
}
