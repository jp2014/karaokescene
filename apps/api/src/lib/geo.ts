export type LatLng = { lat: number; lng: number };

/** Default scene center: downtown Omaha. */
export const DEFAULT_CENTER: LatLng = { lat: 41.2565, lng: -95.9345 };
export const DISCOVERY_RADIUS_MI = 20;
/** You count as "at" a venue inside this distance; leaving the second radius triggers Auto Leave. */
export const ARRIVE_RADIUS_MI = 0.08;
export const LEAVE_RADIUS_MI = 0.25;

/** Fixed area cells, never a rounded distance from raw GPS: changing query centers must
 * not expose a more precise position. All nearby filtering and sorting uses this point. */
export function nearbyArea(loc: LatLng): LatLng {
  const cell = 0.05;
  return { lat: (Math.floor(loc.lat / cell) + 0.5) * cell, lng: (Math.floor(loc.lng / cell) + 0.5) * cell };
}

export function distanceMi(a: LatLng, b: LatLng) {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
