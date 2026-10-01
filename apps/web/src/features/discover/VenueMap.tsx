import * as maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import type { LatLng } from '~/lib/location';
import type { VenueSummary } from '~/lib/queries';

const STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

/** GeoJSON polygon approximating a circle, for the 20-mile discovery radius. */
function circle(center: LatLng, radiusMi: number, steps = 96) {
  const coords: [number, number][] = [];
  const dLat = radiusMi / 69;
  const dLng = radiusMi / (69 * Math.cos((center.lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    coords.push([center.lng + dLng * Math.cos(t), center.lat + dLat * Math.sin(t)]);
  }
  return { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [coords] } };
}

function markerEl(v: VenueSummary) {
  const el = document.createElement('button');
  el.className = 'ks-marker';
  el.setAttribute('aria-label', v.name);
  const color = v.kjNow ? '#3ee58f' : v.isLive ? '#22d3ee' : v.tonight ? '#8b5cf6' : '#6f6690';
  el.innerHTML = `
    <span class="ks-pin" style="--c:${color}">
      ${v.kjNow ? '<span class="ks-ring"></span>' : ''}
      <span class="ks-dot">${v.isPremiere ? '★' : v.kjNow ? '🎤' : ''}</span>
      ${v.crowd.count ? `<span class="ks-count">${v.crowd.count}</span>` : ''}
    </span>
    <span class="ks-label">${v.name.replace(/^The /, '')}</span>`;
  return el;
}

/**
 * Thin wrapper over MapLibre (free, no API key). Markers are plain DOM elements
 * keyed by venue id and refreshed when the data changes.
 */
export function VenueMap({ venues, center, radiusMi, me, selectedId, onSelect, className }: { venues: VenueSummary[]; center: LatLng; radiusMi: number; me: LatLng; selectedId?: string | null; onSelect: (id: string) => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef(new Map<string, maplibregl.Marker>());
  const meMarker = useRef<maplibregl.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!ref.current) return;
    const m = new maplibregl.Map({ container: ref.current, style: STYLE, center: [center.lng, center.lat], zoom: 10.3, attributionControl: { compact: true } });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.on('load', () => {
      m.addSource('radius', { type: 'geojson', data: circle(center, radiusMi) });
      m.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius', paint: { 'fill-color': '#8b5cf6', 'fill-opacity': 0.05 } });
      m.addLayer({ id: 'radius-line', type: 'line', source: 'radius', paint: { 'line-color': '#8b5cf6', 'line-opacity': 0.5, 'line-width': 1.5, 'line-dasharray': [2, 2] } });
    });
    map.current = m;
    if (import.meta.env.DEV) (window as unknown as { __ksMap: unknown }).__ksMap = m;
    return () => {
      m.remove();
      map.current = null;
      markers.current.clear();
    };
  }, []);

  // Radius ring follows the search center.
  useEffect(() => {
    const src = map.current?.getSource('radius') as maplibregl.GeoJSONSource | undefined;
    src?.setData(circle(center, radiusMi));
  }, [center.lat, center.lng, radiusMi]);

  // "You are here" marker.
  useEffect(() => {
    if (!map.current) return;
    if (!meMarker.current) {
      const el = document.createElement('div');
      el.className = 'ks-me';
      meMarker.current = new maplibregl.Marker({ element: el }).setLngLat([me.lng, me.lat]).addTo(map.current);
    } else meMarker.current.setLngLat([me.lng, me.lat]);
  }, [me.lat, me.lng]);

  // Venue markers.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const seen = new Set<string>();
    for (const v of venues) {
      seen.add(v.id);
      markers.current.get(v.id)?.remove();
      const el = markerEl(v);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectRef.current(v.id);
      });
      if (v.id === selectedId) el.classList.add('is-selected');
      markers.current.set(v.id, new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([v.lng, v.lat]).addTo(m));
    }
    for (const [id, mk] of markers.current) {
      if (!seen.has(id)) {
        mk.remove();
        markers.current.delete(id);
      }
    }
  }, [venues, selectedId]);

  // Fly to the selected venue.
  useEffect(() => {
    const v = venues.find((x) => x.id === selectedId);
    if (v && map.current) map.current.flyTo({ center: [v.lng, v.lat], zoom: Math.max(map.current.getZoom(), 12.5), speed: 1.4, padding: { bottom: 160, top: 0, left: 0, right: 0 } });
  }, [selectedId]);

  // MapLibre forces position:relative on its container, so size it via a wrapper.
  return (
    <div className={className}>
      <div ref={ref} className="h-full w-full" />
    </div>
  );
}
