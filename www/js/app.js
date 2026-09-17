// ══════ App entry — router · splash · theme · settings · profile ══════
import { getPrefJSON, setPrefJSON } from './storage.js';
import { initTawaf, enterTawaf, leaveTawaf } from './tawaf.js';
import { initSai, enterSai, leaveSai } from './sai.js';
import { requestPermission } from './geo.js';
import { setHapticEnabled, toast } from './ui.js';
import { bindProfileForm, isProfileComplete, loadProfile } from './profile.js';

// ── Router ─────────────────────────────────────────────────────
let currentScreen = 'splash';
const screens = {
  splash:   document.getElementById('screen-splash'),
  home:     document.getElementById('screen-home'),
  tawaf:    document.getElementById('screen-tawaf'),
  sai:      document.getElementById('screen-sai'),
  profile:  document.getElementById('screen-profile'),
  settings: document.getElementById('screen-settings'),
};

async function navigate(name) {
  if (name === currentScreen) return;
  if (currentScreen === 'tawaf') await leaveTawaf();
  if (currentScreen === 'sai')   await leaveSai();

  screens[currentScreen]?.classList.remove('screen--active');
  screens[name]?.classList.add('screen--active');
  currentScreen = name;

  if (name === 'tawaf') await enterTawaf();
  if (name === 'sai')   await enterSai();
  if (name === 'home')  await refreshHomeBanner();
}

document.querySelectorAll('[data-nav]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    navigate(el.dataset.nav);
  });
});

// Android back button
document.addEventListener('DOMContentLoaded', () => {
  const App = window.Capacitor?.Plugins?.App;
  if (App && App.addListener) {
    App.addListener('backButton', () => {
      if (currentScreen === 'home' || currentScreen === 'splash') App.exitApp?.();
      else navigate('home');
    });
  }
});

// ── Theme system (light / dark / system) ──────────────────────
const mql = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme(mode) {
  const resolved = mode === 'system' ? (mql.matches ? 'dark' : 'light') : mode;
  document.documentElement.setAttribute('data-theme', resolved);
  document.body.setAttribute('data-theme-mode', mode);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#000000' : '#FFFFFF');

  const iconLight = document.getElementById('theme-icon-light');
  const iconDark  = document.getElementById('theme-icon-dark');
  if (iconLight && iconDark) {
    iconLight.style.display = resolved === 'dark' ? 'none' : 'block';
    iconDark.style.display  = resolved === 'dark' ? 'block' : 'none';
  }

  document.querySelectorAll('.themepick__opt').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });

  const SB = window.Capacitor?.Plugins?.StatusBar;
  if (SB) {
    try {
      SB.setStyle({ style: resolved === 'dark' ? 'DARK' : 'LIGHT' });
      SB.setBackgroundColor({ color: resolved === 'dark' ? '#000000' : '#FFFFFF' });
    } catch {}
  }
}

async function loadTheme() {
  const settings = await getPrefJSON('settings', {});
  const mode = settings.themeMode || 'system';
  applyTheme(mode);
}

mql.addEventListener('change', async () => {
  const s = await getPrefJSON('settings', {});
  if ((s.themeMode || 'system') === 'system') applyTheme('system');
});

document.querySelectorAll('.themepick__opt').forEach(btn => {
  btn.addEventListener('click', async () => {
    const mode = btn.dataset.mode;
    applyTheme(mode);
    await saveSettings({ themeMode: mode });
  });
});

document.getElementById('theme-toggle')?.addEventListener('click', async () => {
  const currentResolved = document.documentElement.getAttribute('data-theme');
  const next = currentResolved === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  await saveSettings({ themeMode: next });
});

// ── Settings ───────────────────────────────────────────────────
async function loadSettings() {
  const s = await getPrefJSON('settings', {
    haptic: true, fontSize: 'm', themeMode: 'system',
  });
  document.getElementById('set-haptic').checked = s.haptic !== false;
  document.getElementById('set-fontsize').value = s.fontSize || 'm';
  applyLocal(s);
  return s;
}

function applyLocal(s) {
  document.body.dataset.fontsize = s.fontSize || 'm';
  setHapticEnabled(s.haptic !== false);
}

async function saveSettings(patch) {
  const s = await getPrefJSON('settings', {});
  const merged = { ...s, ...patch };
  await setPrefJSON('settings', merged);
  applyLocal(merged);
  return merged;
}

document.getElementById('set-haptic').addEventListener('change', e => {
  saveSettings({ haptic: e.target.checked });
});
document.getElementById('set-fontsize').addEventListener('change', e => {
  saveSettings({ fontSize: e.target.value });
});

// ── Greeting by time of day ────────────────────────────────────
function updateGreeting() {
  const h = new Date().getHours();
  const el = document.getElementById('greeting-text');
  if (!el) return;
  let text = 'تقبّل الله منك';
  if (h >= 4 && h < 12)       text = 'صباح الخير · تقبّل الله';
  else if (h >= 12 && h < 17) text = 'ظهر مبارك · تقبّل الله';
  else if (h >= 17 && h < 20) text = 'مساء النور · تقبّل الله';
  else                         text = 'ليلة مباركة · تقبّل الله';
  el.textContent = text;
}

// Home banner: shows pilgrim name + missing-data prompt
async function refreshHomeBanner() {
  const p = await loadProfile();
  const nameEl = document.getElementById('greeting-name');
  const banner = document.getElementById('home-banner');
  if (nameEl) nameEl.textContent = p.fullName ? `أهلاً ${p.fullName.split(' ')[0]}` : 'أهلاً بك';
  if (banner) {
    const complete = await isProfileComplete();
    banner.style.display = complete ? 'none' : 'flex';
  }
}

// ── Boot ───────────────────────────────────────────────────────
async function boot() {
  await loadTheme();
  await loadSettings();
  await bindProfileForm();
  await initTawaf();
  await initSai();
  updateGreeting();
  requestPermission().catch(() => {});

  const startScreen = (await isProfileComplete()) ? 'home' : 'profile';
  setTimeout(async () => {
    await refreshHomeBanner();
    await navigate(startScreen);
    if (startScreen === 'profile') toast('أكمل بياناتك للبدء');
  }, 1600);
}

boot();
