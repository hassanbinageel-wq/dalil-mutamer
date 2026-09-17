// ══════ Storage — Capacitor Preferences with browser fallback ══════
const nativePrefs = () => window.Capacitor?.Plugins?.Preferences;

export async function getPref(key, fallback = null) {
  const P = nativePrefs();
  if (P) {
    try {
      const { value } = await P.get({ key });
      return value ?? fallback;
    } catch { return fallback; }
  }
  return localStorage.getItem(key) ?? fallback;
}

export async function setPref(key, value) {
  const P = nativePrefs();
  if (P) {
    try { await P.set({ key, value: String(value) }); return; } catch {}
  }
  localStorage.setItem(key, String(value));
}

export async function getPrefJSON(key, fallback) {
  const raw = await getPref(key, null);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

export async function setPrefJSON(key, obj) {
  return setPref(key, JSON.stringify(obj));
}
