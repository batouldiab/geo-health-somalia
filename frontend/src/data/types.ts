import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';

/** Grid cell row: [col, row, region_idx, pop2015, pop2020, pop2025, pop2030, nl_x1000] */
export type CellRow = number[];

export interface GridMeta {
  cell_deg: number;
  nl_year: string;
  total_cells: number;
  populated_cells: number;
  total_pop2025: number;
  [key: string]: unknown;
}

export interface Province {
  name: string;
  cells: number;
  populated: number;
  lit: number;
  mpi: number | null;
  pop2015: number;
  pop2025: number;
  [key: string]: unknown;
}

export interface Adm1Props {
  idx: number;
  name: string;
}

export interface SomGrid {
  meta: GridMeta;
  provinces: Province[];
  adm1: FeatureCollection<Polygon | MultiPolygon, Adm1Props>;
  cells: CellRow[];
}

// ---- health-access layers (pipeline/build_bakool_health_v1.py) ----------------------

export interface AccessCell {
  col: number;
  row: number;
  district: string | null;
  pop2025: number;
  pop2020c?: number;
  tt_walking_mean?: number;
  share_walking_gt60?: number;
  share_walking_gt120?: number;
  tt_motorized_mean?: number;
  share_motorized_gt60?: number;
  share_motorized_gt120?: number;
  /** WorldCover 2021 class shares, e.g. { shrub: 0.78, grass: 0.17 } */
  lc?: Record<string, number>;
  built_share?: number;
  nearest_who2021?: string;
  nearest_who2021_km?: number;
  nearest_maina2019?: string;
  nearest_maina2019_km?: number;
  /** underserved index: people x poverty incidence x min(1, walking minutes / T*) */
  U?: number;
  rank?: number;
}

export interface DistrictTotals {
  cells: number;
  pop2020c: number;
  pop2025: number;
  U: number;
  pop_gt60_walk: number;
  pop_gt120_walk: number;
  facilities_who2021: number;
  facilities_maina2019: number;
  facilities_osm: number;
  pop2021_codps?: number | null;
  urban?: number | null;
  rural?: number | null;
  idp?: number | null;
}

export interface AccessData {
  meta: { region: string; cell_deg: number; tstar_min: number; h_region: number | null; travel_modes: string[]; [key: string]: unknown };
  cells: Record<string, AccessCell>;
  districts: Record<string, DistrictTotals>;
}

export interface Facility {
  id: string;
  name: string;
  type: string;
  owner: string;
  district: string;
  district_adm2: string | null;
  lon: number;
  lat: number;
  source: string;
  source_key: 'who2021' | 'maina2019' | 'osm';
  licence: string;
  cell: string;
  referral: boolean;
  osm?: string;
}

export interface FacilitiesData {
  meta: { region: string; count: number; by_source: Record<string, number>; sources: string[]; note: string; [key: string]: unknown };
  facilities: Facility[];
}

export interface Adm2Data {
  meta: { region: string; [key: string]: unknown };
  adm1: FeatureCollection<Polygon | MultiPolygon, { region: string }>;
  adm2: FeatureCollection<Polygon | MultiPolygon, { district: string; pcode?: string }>;
  cell_district: Record<string, string | null>;
}

export interface OsmPlace {
  name: string;
  name_so?: string;
  place: string;
  osm: string;
  lon: number;
  lat: number;
  source: string;
  licence: string;
  /** the point falls inside one of Bakool's five districts (OCHA COD-AB); false for the box's overspill into Bay, Gedo and Hiiraan */
  in_region?: boolean;
  /** the district it falls in, when in_region */
  district?: string;
}

export interface PlacesData {
  meta: { region: string; [key: string]: unknown };
  places: OsmPlace[];
}

export interface BuildingCell {
  n: number;
  area_m2: number;
  district: string | null;
  pop2020c: number;
  pop2025: number;
  ppb_2020: number | null;
  ppb_2025: number | null;
}

export interface BuildingsData {
  meta: { region: string; min_confidence: number; buildings_used: number; buildings_in_region_cells: number; source: string; source_url: string; [key: string]: unknown };
  cells: Record<string, BuildingCell>;
  districts: Record<string, { n: number; area_m2: number; cells_with_buildings: number }>;
  cells_people_no_buildings?: string[];
  cells_buildings_no_people?: string[];
}

export interface Settlement {
  id: string;
  lon: number;
  lat: number;
  n: number;
  area_m2: number;
  cell: string;
  district: string | null;
  nearest_fac: string | null;
  nearest_km: number | null;
  tt_walking_mean?: number | null;
  builtup_share: number;
  far_from_care: boolean;
}

export interface SettlementsData {
  meta: { region: string; cluster_m: number; min_cluster: number; far_rule: string; [key: string]: unknown };
  settlements: Settlement[];
}

export interface FacilityChecks {
  meta: { radius_m: number; [key: string]: unknown };
  checks: Record<string, { buildings_within_m: number; radius_m: number; flag: string | null }>;
}

export interface HealthData {
  access: AccessData;
  facilities: FacilitiesData;
  adm2: Adm2Data;
  /** Open Buildings layers; absent until pipeline/build_buildings_v1.py has run */
  buildings?: BuildingsData;
  settlements?: SettlementsData;
  checks?: FacilityChecks;
}
