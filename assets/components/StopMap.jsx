import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

// Small map for the arrival page, replacing upstream's Mapbox static image.
// Reuses the main map's self-hosted style (PMTiles via assets.busrouter.sg),
// so no Mapbox token is needed. MapLibre is loaded lazily so arrival times
// don't wait for the ~800 KB map library.

let mapLibPromise;
let lib; // { maplibregl, createMapStyle } once loaded
function loadMapLib() {
  if (!mapLibPromise) {
    mapLibPromise = Promise.all([
      import('maplibre-gl'),
      import('pmtiles'),
      import('../map-style'),
    ]).then(([maplibreModule, { Protocol }, { createMapStyle }]) => {
      // maplibre-gl is a UMD bundle; depending on interop it may arrive as
      // the namespace itself or under .default.
      const maplibregl = maplibreModule.default || maplibreModule;
      maplibregl.addProtocol('pmtiles', new Protocol().tile);
      lib = { maplibregl, createMapStyle };
      return lib;
    });
  }
  return mapLibPromise;
}

const markerEl = (className, label) => {
  const el = document.createElement('div');
  el.className = `stop-map-marker ${className}`;
  el.textContent = label;
  return el;
};

export default function StopMap({ stop, opposite }) {
  const containerRef = useRef();
  const mapRef = useRef();
  const markersRef = useRef([]);
  // Latest props, so a map that finishes loading late still shows the current stop.
  const propsRef = useRef();
  propsRef.current = { stop, opposite };

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    loadMapLib().then(({ maplibregl, createMapStyle }) => {
      if (cancelled || !containerRef.current) return;
      mapRef.current = new maplibregl.Map({
        container: containerRef.current,
        style: createMapStyle(),
        center: [stop.lng, stop.lat],
        zoom: 17,
        attributionControl: { compact: true },
        cooperativeGestures: true, // don't hijack page scroll on phones
        pitchWithRotate: false,
        dragRotate: false,
      });
      placeMarkers();
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  function placeMarkers() {
    const map = mapRef.current;
    if (!map) return;
    const { stop, opposite } = propsRef.current;
    const { Marker, LngLatBounds } = lib.maplibregl;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [
      new Marker({ element: markerEl('here', stop.code) })
        .setLngLat([stop.lng, stop.lat])
        .addTo(map),
    ];
    if (opposite) {
      markersRef.current.push(
        new Marker({ element: markerEl('opposite', opposite.code) })
          .setLngLat([opposite.lng, opposite.lat])
          .addTo(map),
      );
      const bounds = new LngLatBounds()
        .extend([stop.lng, stop.lat])
        .extend([opposite.lng, opposite.lat]);
      map.fitBounds(bounds, { padding: 60, maxZoom: 18, duration: 0 });
    } else {
      map.jumpTo({ center: [stop.lng, stop.lat], zoom: 17 });
    }
  }

  // Move markers/camera when the stop (or its opposite) changes.
  useEffect(placeMarkers, [stop.code, opposite?.code]);

  return <div class="stop-map" ref={containerRef} />;
}
