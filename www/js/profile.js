// ══════ Profile — pilgrim data (name, hotel, visa, ...) ══════
import { getPrefJSON, setPrefJSON } from './storage.js';
import { toast, haptic } from './ui.js';

const EMPTY = {
  fullName: '',
  country:  '',
  phone:    '',
  gender:   '',
  supervisorName:  '',
  supervisorPhone: '',
  hotelName:     '',
  hotelLocation: null, // { lat, lng, capturedAt }
  visa: null,          // { data (base64 dataURL), name, type, size }
};

let cache = null;

export async function loadProfile() {
  if (cache) return cache;
  const stored = await getPrefJSON('profile', {});
  cache = { ...EMPTY, ...stored };
  return cache;
}

export async function saveProfile(patch) {
  const current = await loadProfile();
  cache = { ...current, ...patch };
  await setPrefJSON('profile', cache);
  return cache;
}

export async function isProfileComplete() {
  const p = await loadProfile();
  return !!(p.fullName && p.country && p.phone && p.gender);
}

export async function bindProfileForm() {
  const p = await loadProfile();

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('pf-name', p.fullName);
  set('pf-country', p.country);
  set('pf-phone', p.phone);
  set('pf-supervisor', p.supervisorName);
  set('pf-supervisor-phone', p.supervisorPhone);
  set('pf-hotel', p.hotelName);

  const g = document.querySelector(`input[name="pf-gender"][value="${p.gender}"]`);
  if (g) g.checked = true;

  updateHotelDisplay(p.hotelLocation);
  updateVisaDisplay(p.visa);

  const bindText = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => saveProfile({ [key]: el.value.trim() }));
  };
  bindText('pf-name', 'fullName');
  bindText('pf-country', 'country');
  bindText('pf-phone', 'phone');
  bindText('pf-supervisor', 'supervisorName');
  bindText('pf-supervisor-phone', 'supervisorPhone');
  bindText('pf-hotel', 'hotelName');

  document.querySelectorAll('input[name="pf-gender"]').forEach(r => {
    r.addEventListener('change', () => {
      if (r.checked) saveProfile({ gender: r.value });
    });
  });

  document.getElementById('pf-hotel-locate')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'جاري التحديد…';
    try {
      const pos = await getOneShotLocation();
      const loc = { lat: pos.lat, lng: pos.lng, capturedAt: Date.now() };
      await saveProfile({ hotelLocation: loc });
      updateHotelDisplay(loc);
      toast('تم حفظ موقع الفندق');
    } catch (err) {
      toast('تعذّر تحديد الموقع');
    } finally {
      btn.disabled = false;
      btn.textContent = 'حدّد موقع الفندق الحالي';
    }
  });

  document.getElementById('pf-hotel-clear')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await saveProfile({ hotelLocation: null });
    updateHotelDisplay(null);
  });

  // NEW: Navigate to hotel — opens maps app with directions from current location
  document.getElementById('pf-hotel-navigate')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const prof = await loadProfile();
    if (!prof.hotelLocation) { toast('حدّد موقع الفندق أولاً'); return; }
    const { lat, lng } = prof.hotelLocation;
    const name = encodeURIComponent(prof.hotelName || 'الفندق');
    // Google Maps universal URL — opens Google Maps app on Android, browser otherwise
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_name=${name}&travelmode=walking`;
    openExternal(url);
    haptic('light');
  });

  // Visa upload
  document.getElementById('pf-visa-input')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { toast('حجم الملف كبير (الحد 4MB)'); e.target.value = ''; return; }
    try {
      const dataURL = await fileToDataURL(file);
      const visa = { data: dataURL, name: file.name, type: file.type, size: file.size };
      await saveProfile({ visa });
      updateVisaDisplay(visa);
      toast('تم حفظ الفيزا');
    } catch { toast('تعذّر رفع الملف'); }
    finally { e.target.value = ''; }
  });

  // FIX: view visa inline in a modal instead of window.open (which broke back-nav)
  document.getElementById('pf-visa-view')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const prof = await loadProfile();
    if (prof.visa?.data) openVisaModal(prof.visa);
  });

  document.getElementById('pf-visa-clear')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await saveProfile({ visa: null });
    updateVisaDisplay(null);
  });

  // Modal close
  document.getElementById('visa-modal-close')?.addEventListener('click', closeVisaModal);
  document.getElementById('visa-modal-backdrop')?.addEventListener('click', closeVisaModal);
}

// ── Visa modal (fixes the back-button bug) ───────────────────────
function openVisaModal(visa) {
  const modal = document.getElementById('visa-modal');
  const body  = document.getElementById('visa-modal-body');
  const title = document.getElementById('visa-modal-title');
  if (!modal || !body) return;

  title.textContent = visa.name || 'الفيزا';
  body.innerHTML = '';

  if (visa.type && visa.type.startsWith('image/')) {
    const img = document.createElement('img');
    img.src = visa.data;
    img.alt = visa.name || '';
    img.className = 'visa-modal__img';
    body.appendChild(img);
  } else if (visa.type === 'application/pdf') {
    const iframe = document.createElement('iframe');
    iframe.src = visa.data;
    iframe.className = 'visa-modal__pdf';
    iframe.title = visa.name || 'PDF';
    body.appendChild(iframe);
  } else {
    body.textContent = 'نوع الملف غير مدعوم للعرض المباشر.';
  }

  modal.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeVisaModal() {
  const modal = document.getElementById('visa-modal');
  const body  = document.getElementById('visa-modal-body');
  if (!modal) return;
  modal.classList.remove('show');
  if (body) body.innerHTML = ''; // free memory
  document.body.style.overflow = '';
}

// Open a URL externally (native maps app / browser). In Capacitor WebView,
// window.open with _blank triggers Android's URL handler.
function openExternal(url) {
  const AppPlugin = window.Capacitor?.Plugins?.App;
  if (AppPlugin?.openUrl) {
    AppPlugin.openUrl({ url }).catch(() => window.open(url, '_blank'));
  } else {
    window.open(url, '_blank');
  }
}

function updateHotelDisplay(loc) {
  const info = document.getElementById('pf-hotel-info');
  const clear = document.getElementById('pf-hotel-clear');
  const navBtn = document.getElementById('pf-hotel-navigate');
  if (!info) return;
  if (loc && loc.lat) {
    info.innerHTML = `📍 <b>${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}</b>`;
    if (clear)  clear.style.display  = '';
    if (navBtn) navBtn.style.display = '';
  } else {
    info.textContent = 'لم يُحدَّد بعد';
    if (clear)  clear.style.display  = 'none';
    if (navBtn) navBtn.style.display = 'none';
  }
}

function updateVisaDisplay(visa) {
  const info  = document.getElementById('pf-visa-info');
  const view  = document.getElementById('pf-visa-view');
  const clear = document.getElementById('pf-visa-clear');
  if (!info) return;
  if (visa && visa.data) {
    const kb = (visa.size / 1024).toFixed(0);
    info.innerHTML = `📎 <b>${escapeHtml(visa.name)}</b> · ${kb}KB`;
    if (view)  view.style.display  = '';
    if (clear) clear.style.display = '';
  } else {
    info.textContent = 'لم تُرفع بعد';
    if (view)  view.style.display  = 'none';
    if (clear) clear.style.display = 'none';
  }
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function getOneShotLocation() {
  const G = window.Capacitor?.Plugins?.Geolocation;
  if (G) {
    const p = await G.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
    return { lat: p.coords.latitude, lng: p.coords.longitude };
  }
  return new Promise((res, rej) => {
    navigator.geolocation.getCurrentPosition(
      p => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
      rej,
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

function escapeHtml(s) {
  return String(s).replace(/[<>&"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c]));
}
