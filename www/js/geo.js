// ══════ Geo utilities & GPS watch ══════

// Approximate coordinates of Mataf landmarks (WGS84).
// Small errors are OK — we use distance thresholds, not exact matching.
export const LANDMARKS = {
  KAABA:        { lat: 21.422510, lng: 39.826168, name: 'الكعبة' },
  BLACK_STONE:  { lat: 21.422487, lng: 39.826206, name: 'الحجر الأسود' },
  YEMENI:       { lat: 21.422321, lng: 39.826080, name: 'الركن اليماني' },
  SAFA:         { lat: 21.422300, lng: 39.826910, name: 'الصفا' },
  MARWA:        { lat: 21.423450, lng: 39.826760, name: 'المروة' },
};

// Interpolate between two points at fraction t (0..1)
function interp(a, b, t) {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

// الميلين الأخضرين — the two green pillars marking the run-zone for men (هرولة).
// Positioned approximately at 42% and 62% of the Safa→Marwa straight line.
export const GREEN_MILE_START = interp(LANDMARKS.SAFA, LANDMARKS.MARWA, 0.42);
export const GREEN_MILE_END   = interp(LANDMARKS.SAFA, LANDMARKS.MARWA, 0.62);
export const GREEN_ZONE_PCT   = { start: 0.42, end: 0.62 };

// Haversine distance in metres between two lat/lng points
export function distanceM(a, b) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat), la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Bearing in degrees from a → b (0=N, 90=E)
export function bearingDeg(a, b) {
  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;
  const φ1 = toRad(a.lat), φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Compute smallest signed delta between two bearings (-180 .. +180)
export function bearingDelta(prev, next) {
  let d = next - prev;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

// ── Capacitor Geolocation wrapper (with browser fallback) ─────────
const nativeGeo = () => window.Capacitor?.Plugins?.Geolocation;
let currentWatchId = null;
let browserWatchId = null;

export async function requestPermission() {
  const G = nativeGeo();
  if (G && G.requestPermissions) {
    try {
      const r = await G.requestPermissions();
      return r.location === 'granted' || r.location === 'prompt';
    } catch { return false; }
  }
  return true;
}

export async function watchLocation(cb) {
  await stopWatching();

  const G = nativeGeo();
  if (G) {
    try {
      currentWatchId = await G.watchPosition(
        { enableHighAccuracy: true, timeout: 10000 },
        (position, err) => {
          if (err) { cb(null, err); return; }
          if (position && position.coords) {
            cb({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              time: position.timestamp,
            }, null);
          }
        }
      );
      return;
    } catch (e) { /* fall through to browser */ }
  }

  if (!navigator.geolocation) { cb(null, new Error('no-geo')); return; }
  browserWatchId = navigator.geolocation.watchPosition(
    (position) => cb({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      time: position.timestamp,
    }, null),
    (err) => cb(null, err),
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
  );
}

export async function stopWatching() {
  const G = nativeGeo();
  if (currentWatchId && G) {
    try { await G.clearWatch({ id: currentWatchId }); } catch {}
    currentWatchId = null;
  }
  if (browserWatchId != null && navigator.geolocation) {
    navigator.geolocation.clearWatch(browserWatchId);
    browserWatchId = null;
  }
}
