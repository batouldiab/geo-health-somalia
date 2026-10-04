import type { AccessCell, CellRow, HealthData, SomGrid } from './types';

/**
 * Loaded datasets, populated once at boot before any layer is built.
 */
export const store = {} as {
  /** the national 10x10 km grid: province outlines and the cell rows the squares are drawn from */
  G: SomGrid;
  /** cell size in degrees */
  CELL: number;
  /** half cell size */
  H: number;
  /** health-access files of the built region */
  HEALTH: HealthData;
};

export function initStore(grid: SomGrid, health: HealthData): void {
  store.G = grid;
  store.CELL = grid.meta.cell_deg;
  store.H = store.CELL / 2;
  store.HEALTH = health;
}

/** the cell row for a [col, row] key, or null */
export function findCell(col: number, row: number): CellRow | null {
  for (const c of store.G.cells) if (c[0] === col && c[1] === row) return c;
  return null;
}

/** the province index of the region the health files were built for (Bakool) */
export function regionIdx(): number {
  const name = store.HEALTH.access.meta.region.toLowerCase();
  return store.G.provinces.findIndex((p) => p.name.toLowerCase() === name);
}

/** the health-access record of a cell, or null outside the built region */
export function accessForCell(c: CellRow): AccessCell | null {
  return store.HEALTH.access.cells[c[0] + '_' + c[1]] || null;
}
