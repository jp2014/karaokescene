import * as maplibregl from 'maplibre-gl';
import { LocateFixed } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { LatLng } from '~/lib/location';
import { Button } from './ui';

const STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

/**
 * Place a venue on the map: tap or drag the pin. Starts at `value`, zoomed in when `precise`
 * (a real GPS fix) and out to the city otherwise. Load it lazily: MapLibre is large.
 */
export default function PinPicker({ value, precise, onChange }: { value: LatLng; precise: boolean; onChange: (at: LatLng) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const pin = useRef<maplibregl.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!ref.current) return;
    const m = new maplibregl.Map({ container: ref.current, style: STYLE, center: [value.lng, value.lat], zoom: precise ? 16 : 11, attributionControl: { compact: true } });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    const el = document.createElement('div');
    el.className = 'ks-marker';
    el.innerHTML = '<span class="ks-pin" style="--c:#ff3d9a"><span class="ks-dot">🎤</span></span>';
    const marker = new maplibregl.Marker({ element: el, draggable: true, anchor: 'bottom' }).setLngLat([value.lng, value.lat]).addTo(m);
    const emit = () => {
      const { lat, lng } = marker.getLngLat();
      onChangeRef.current({ lat, lng });
    };
    marker.on('dragend', emit);
    m.on('click', (e) => {
      marker.setLngLat(e.lngLat);
      emit();
    });
    map.current = m;
    pin.current = marker;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  function locate() {
    if (!navigator.geolocation) return toast.error('Location isn’t available on this device');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const at = { lat: p.coords.latitude, lng: p.coords.longitude };
        pin.current?.setLngLat([at.lng, at.lat]);
        map.current?.flyTo({ center: [at.lng, at.lat], zoom: 17 });
        onChangeRef.current(at);
      },
      () => toast.error('Couldn’t get your location. Tap the map to place the pin instead.'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div className="space-y-2">
      <div ref={ref} className="h-56 overflow-hidden rounded-2xl border border-line" />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">Tap the map or drag the pin to the venue’s front door.</p>
        <Button size="sm" variant="ghost" type="button" onClick={locate}>
          <LocateFixed className="size-4" /> I’m here
        </Button>
      </div>
    </div>
  );
}
