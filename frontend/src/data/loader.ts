import { DATASETS } from '../config';
import type { AccessData, Adm2Data, BuildingsData, FacilitiesData, FacilityChecks, HealthData, SettlementsData, SomGrid } from './types';

/**
 * Fetch a dataset stored as raw gzip bytes and inflate it in the browser
 * (DecompressionStream, no pako needed). Falls back to plain JSON parsing if
 * the server or a proxy already decompressed the body.
 */
export async function fetchGzJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const isGzip = buf[0] === 0x1f && buf[1] === 0x8b;
  if (!isGzip) return JSON.parse(new TextDecoder().decode(buf)) as T;
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text()) as T;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** The national grid (province outlines, cell rows), about 148 KB gzipped. */
export function loadGrid(): Promise<SomGrid> {
  return fetchGzJson<SomGrid>(DATASETS.grid);
}

/** The health-access files of the built region (about 25 KB gzipped together). */
export function loadHealthData(): Promise<HealthData> {
  return Promise.all([
    fetchGzJson<AccessData>(DATASETS.access),
    fetchGzJson<FacilitiesData>(DATASETS.facilities),
    fetchGzJson<Adm2Data>(DATASETS.adm2),
  ]).then(([access, facilities, adm2]) => ({ access, facilities, adm2 }));
}

/** The optional Open Buildings files; each resolves to undefined when the file is not there. */
export function loadBuildingsData(): Promise<Pick<HealthData, 'buildings' | 'settlements' | 'checks'>> {
  const opt = <T,>(p: Promise<T>): Promise<T | undefined> => p.catch(() => undefined);
  return Promise.all([
    opt(fetchGzJson<BuildingsData>(DATASETS.buildings)),
    opt(fetchGzJson<SettlementsData>(DATASETS.settlements)),
    opt(fetchJson<FacilityChecks>(DATASETS.facilityChecks)),
  ]).then(([buildings, settlements, checks]) => ({ buildings, settlements, checks }));
}
