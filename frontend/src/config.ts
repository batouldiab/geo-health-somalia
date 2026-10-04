export const MIN_ZOOM = 5;
export const MAX_ZOOM = 21;

export const BASEMAPS = {
  // Esri World Imagery darkened via CSS (.basemap-dark): no country borders or names baked
  // into the tiles; free with attribution. Needs the network: the map is the planner's
  // side of the tool, the finder (finder.html) is the part that works offline.
  dark: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxZoom: MAX_ZOOM,
      maxNativeZoom: 19,
      className: 'basemap-dark',
      attribution:
        'Imagery &copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
    },
  },
} as const;

export const DATA_BASE = '/data';
export const DATASETS = {
  // the national 10x10 km grid: province outlines and the cell rows the region's squares are drawn from
  grid: `${DATA_BASE}/som_grid_v1.json.gz`,
  // health-access layers of the built region (pipeline/build_bakool_health_v1.py)
  access: `${DATA_BASE}/access10_v1.json.gz`,
  facilities: `${DATA_BASE}/facilities_v1.json.gz`,
  adm2: `${DATA_BASE}/adm2_bakool_v1.json.gz`,
  // the finder's gazetteer: OpenStreetMap places of the region (ODbL)
  places: `${DATA_BASE}/places_bakool_v1.json.gz`,
  // Open Buildings layers (pipeline/build_buildings_v1.py); optional
  buildings: `${DATA_BASE}/buildings10_v1.json.gz`,
  settlements: `${DATA_BASE}/settlements_v1.json.gz`,
  facilityChecks: `${DATA_BASE}/facility_checks_v1.json`,
} as const;
