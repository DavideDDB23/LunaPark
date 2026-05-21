// Shared river curve. Used by Paths (bed) and Vegetation (skip zone).

export const RIVER_X_MIN = -100;
export const RIVER_X_MAX = 100;

// Center-line Z as function of X — a slow sinuous bend. center(0) = 0 so the bridge sits on it.
export function riverCenter(x) {
  return 14 * Math.sin(x * 0.04) + 3 * Math.sin(x * 0.11);
}

// Half-width as function of X — river widens and narrows along its length.
// Min ~4m, max ~8m → total river width varies 8-16m.
export function riverHalfWidth(x) {
  return 6 + 2 * Math.sin(x * 0.07 + 0.3);
}

export function distanceFromRiver(x, z) {
  return Math.abs(z - riverCenter(x)) - riverHalfWidth(x);
}
