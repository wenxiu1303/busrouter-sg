import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

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

// Show the user in the same view as the stop only when they're this close;
// further away, keep the map on the stop instead of jumping across the island.
const NEAR_METERS = 500;

function distanceMeters(a, b) {
  const x = (b.lng - a.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180);
  const y = (b.lat - a.lat) * 110540;
  return Math.hypot(x, y);
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

  // User location (opt-in). `position` = { lng, lat, accuracy } in metres.
  const [locating, setLocating] = useState(false);
  const [position, setPosition] = useState(null);
  const [locError, setLocError] = useState(null);
  const userMarkerRef = useRef();
  const watchIdRef = useRef();
  const positionRef = useRef(); // latest position for non-render code
  positionRef.current = position;

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
      drawUserDot();
    });
    return () => {
      cancelled = true;
      if (watchIdRef.current != null)
        navigator.geolocation.clearWatch(watchIdRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Stops (and the user, if within NEAR_METERS of this stop) to keep in view.
  function frameCamera() {
    const map = mapRef.current;
    if (!map) return;
    const { stop, opposite } = propsRef.current;
    const pts = [[stop.lng, stop.lat]];
    if (opposite) pts.push([opposite.lng, opposite.lat]);
    const me = positionRef.current;
    if (me && distanceMeters(me, stop) <= NEAR_METERS) pts.push([me.lng, me.lat]);
    if (pts.length === 1) {
      map.jumpTo({ center: pts[0], zoom: 17 });
    } else {
      const bounds = pts.reduce(
        (b, p) => b.extend(p),
        new lib.maplibregl.LngLatBounds(),
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 18, duration: 0 });
    }
  }

  function placeMarkers() {
    const map = mapRef.current;
    if (!map) return;
    const { stop, opposite } = propsRef.current;
    const { Marker } = lib.maplibregl;
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
    }
    frameCamera();
  }

  // Move markers/camera when the stop (or its opposite) changes.
  useEffect(placeMarkers, [stop.code, opposite?.code]);

  function startLocating() {
    if (!('geolocation' in navigator)) {
      setLocError('Location not supported on this device');
      return;
    }
    if (watchIdRef.current != null) return;
    setLocating(true);
    setLocError(null);
    let first = true;
    watchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const pos = {
          lng: coords.longitude,
          lat: coords.latitude,
          accuracy: coords.accuracy,
        };
        positionRef.current = pos;
        setPosition(pos);
        if (first) {
          first = false;
          frameCamera(); // only reframe once; don't fight the user's panning
        }
      },
      (err) => {
        setLocError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied'
            : "Couldn't get your location",
        );
        setLocating(false);
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
  }

  // If the user already granted location before, show the dot without asking.
  useEffect(() => {
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((status) => status.state === 'granted' && startLocating())
      .catch(() => {});
  }, []);

  // Draw / move the blue dot (also called once the map finishes loading).
  function drawUserDot() {
    const map = mapRef.current;
    const pos = positionRef.current;
    if (!map || !pos) return;
    if (!userMarkerRef.current) {
      const el = markerEl('me', '');
      el.title = 'You are here';
      userMarkerRef.current = new lib.maplibregl.Marker({ element: el });
    }
    userMarkerRef.current.setLngLat([pos.lng, pos.lat]).addTo(map);
  }
  useEffect(drawUserDot, [position]);

  const near = position && distanceMeters(position, stop) <= NEAR_METERS;

  return (
    <div class="stop-map" ref={containerRef}>
      <div class="stop-map-locate">
        {!locating ? (
          <button type="button" onClick={startLocating}>
            📍 Show me
          </button>
        ) : position ? (
          <span>
            {near
              ? `You: ±${Math.round(position.accuracy)} m`
              : `You're ${(distanceMeters(position, stop) / 1000).toFixed(1)} km away`}
          </span>
        ) : (
          <span>Locating…</span>
        )}
        {locError && <span class="error">{locError}</span>}
      </div>
    </div>
  );
}
