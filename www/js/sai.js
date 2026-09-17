// ══════ Sa'i — per-round dua, green-zone haraula, halq/taqseer after ══════
import {
  LANDMARKS, GREEN_ZONE_PCT,
  distanceM, watchLocation, stopWatching,
} from './geo.js';
import { loadDuas, pickSaiDua, pickAfterSai, pickHalq } from './duas.js';
import { haptic, toast, confetti, renderPaginatedDua } from './ui.js';
import { updateSaiViz } from './viz3d.js';
import { loadProfile } from './profile.js';

const RING_LEN = 552.9;
const ARRIVAL_M = 25;
const MIN_LEG_SECS = 60;

const state = {
  round: 0,
  target: 'MARWA',       // first leg: Safa → Marwa
  paused: true,
  startedAt: null,
  totalMs: 0,
  timerId: null,
  lastArrival: 0,
  lastPos: null,
  autoStarted: false,
  wasInGreen: false,
  isMale: false,
  onCompletion: false,   // true after round 7 — we're in the halq flow
  compStep: 0,           // 0=after_sai · 1=halq intro/before · 2=halq after
};

let el = {};

export async function initSai() {
  el = {
    number:   document.getElementById('sai-number'),
    progress: document.getElementById('sai-progress'),
    time:     document.getElementById('sai-time'),
    target:   document.getElementById('sai-target'),
    dist:     document.getElementById('sai-dist'),
    dua:      document.getElementById('sai-dua'),
    pauseBtn: document.getElementById('sai-pause'),
    addBtn:   document.getElementById('sai-add'),
    resetBtn: document.getElementById('sai-reset'),
    gps:      document.getElementById('sai-gps'),
    nextBtn:  document.getElementById('sai-next'),
  };
  el.addBtn.addEventListener('click', () => bump('manual'));
  el.resetBtn.addEventListener('click', reset);
  el.pauseBtn.addEventListener('click', togglePause);
  el.nextBtn?.addEventListener('click', advanceCompletion);
  render();
}

export async function enterSai() {
  const profile = await loadProfile();
  state.isMale = profile.gender === 'male';
  render();
  await updateDua();
  setGpsStatus('locating');
  await watchLocation((pos, err) => {
    if (err || !pos) { setGpsStatus('off'); return; }
    setGpsStatus('live');
    onLocation(pos);
  });
}

export async function leaveSai() { await stopWatching(); }

function onLocation(pos) {
  state.lastPos = pos;
  const targetPt = LANDMARKS[state.target];
  const dSafa   = distanceM(pos, LANDMARKS.SAFA);
  const dTarget = distanceM(pos, targetPt);
  el.dist.textContent = Math.round(dTarget);

  const totalPath = distanceM(LANDMARKS.SAFA, LANDMARKS.MARWA);
  const pctFromSafa = Math.max(0, Math.min(1, dSafa / totalPath));

  const inGreenZone = pctFromSafa >= GREEN_ZONE_PCT.start &&
                      pctFromSafa <= GREEN_ZONE_PCT.end;

  updateSaiViz({
    pctFromSafa,
    target: state.target,
    inGreenZone,
    isMale: state.isMale,
  });

  // Haraula notification + dua override (males only, once per leg)
  if (inGreenZone && !state.wasInGreen && state.isMale && !state.paused) {
    state.wasInGreen = true;
    haptic('heavy');
    toast('🏃 الميلان الأخضران — اسرع الخطى (الهرولة)');
    updateDua();
  } else if (!inGreenZone && state.wasInGreen) {
    state.wasInGreen = false;
    updateDua();
  }

  if (!state.autoStarted && state.paused && dSafa < ARRIVAL_M) {
    state.autoStarted = true;
    start();
    toast('بدأ التتبع التلقائي');
  }

  if (state.paused || state.onCompletion) return;

  const secsSinceLast = (Date.now() - state.lastArrival) / 1000;
  if (dTarget < ARRIVAL_M && secsSinceLast > MIN_LEG_SECS) {
    state.lastArrival = Date.now();
    bump('auto');
  }
}

async function bump(source) {
  if (state.round >= 7 || state.onCompletion) return;
  if (state.paused) start();
  state.round += 1;
  state.target = state.target === 'MARWA' ? 'SAFA' : 'MARWA';
  state.wasInGreen = false;
  render();
  el.number.classList.add('bump');
  setTimeout(() => el.number.classList.remove('bump'), 500);
  haptic('medium');

  if (state.round === 7) {
    complete();
  } else {
    await updateDua();
    toast(`اكتمل الشوط ${arabicNum(state.round)}${source === 'auto' ? ' · تلقائي' : ''}`);
  }
}

async function updateDua() {
  if (state.onCompletion) return;
  const data = await loadDuas();
  const d = pickSaiDua(data, state.round, {
    inGreenZone: state.wasInGreen && state.isMale,
  });
  if (d) renderPaginatedDua(el.dua, d);
}

async function complete() {
  stop();
  confetti();
  haptic('heavy');
  state.onCompletion = true;
  state.compStep = 0;
  const data = await loadDuas();
  const after = pickAfterSai(data);
  if (after) renderPaginatedDua(el.dua, after);
  toast('تقبل الله سعيك 🕌');
  if (el.nextBtn) {
    el.nextBtn.style.display = '';
    el.nextBtn.textContent = 'التالي: الحلاقة أو التقصير ✂️';
  }
}

// Advance through the post-sa'i sequence:  after_sai → halq before → halq after
async function advanceCompletion() {
  if (!state.onCompletion) return;
  const data = await loadDuas();
  const halq = pickHalq(data);
  state.compStep += 1;
  haptic('light');

  if (state.compStep === 1 && halq) {
    // Combine intro + before-cutting dua in one paginated card
    renderPaginatedDua(el.dua, {
      label: halq.before.label,
      text:  (halq.intro ? halq.intro + '\n\n' : '') + halq.before.text,
    });
    if (el.nextBtn) el.nextBtn.textContent = 'التالي: بعد الحلاقة ✓';
  } else if (state.compStep === 2 && halq) {
    renderPaginatedDua(el.dua, halq.after);
    if (el.nextBtn) el.nextBtn.textContent = 'تم — عمرة مقبولة';
  } else {
    if (el.nextBtn) el.nextBtn.style.display = 'none';
    toast('تمّت عمرتك — تقبّل الله 🌙');
    confetti(30);
  }
}

function start() {
  if (!state.paused) return;
  state.paused = false;
  state.startedAt = Date.now();
  el.pauseBtn.textContent = 'إيقاف مؤقت';
  el.pauseBtn.classList.remove('is-active');
  tick();
  state.timerId = setInterval(tick, 1000);
}
function stop() {
  state.paused = true;
  if (state.startedAt) state.totalMs += Date.now() - state.startedAt;
  state.startedAt = null;
  clearInterval(state.timerId);
  el.pauseBtn.textContent = 'متابعة';
  el.pauseBtn.classList.add('is-active');
}
function togglePause() {
  if (state.round >= 7 || state.onCompletion) return;
  state.paused ? start() : stop();
}
async function reset() {
  stop();
  state.round = 0;
  state.target = 'MARWA';
  state.totalMs = 0;
  state.lastArrival = 0;
  state.autoStarted = false;
  state.wasInGreen = false;
  state.onCompletion = false;
  state.compStep = 0;
  el.pauseBtn.textContent = 'إيقاف مؤقت';
  el.pauseBtn.classList.remove('is-active');
  if (el.nextBtn) el.nextBtn.style.display = 'none';
  render();
  await updateDua();
}
function tick() {
  const ms = state.totalMs + (state.startedAt ? Date.now() - state.startedAt : 0);
  el.time.textContent = fmtTime(ms);
}

function render() {
  el.number.textContent = arabicNum(state.round);
  el.progress.style.strokeDashoffset = RING_LEN * (1 - state.round / 7);
  el.target.textContent = state.target === 'MARWA' ? 'المروة' : 'الصفا';
}

function setGpsStatus(s) {
  el.gps.classList.remove('gps--live', 'gps--off');
  const label = el.gps.querySelector('.gps-label');
  if (s === 'live') {
    el.gps.classList.add('gps--live');
    label.textContent = 'GPS نشط · العدّ والأدعية تلقائية';
  } else if (s === 'off') {
    el.gps.classList.add('gps--off');
    label.textContent = 'تعذّر GPS · استخدم زر «شوط +»';
  } else {
    label.textContent = 'جاري تحديد الموقع…';
  }
}

function arabicNum(n) {
  const map = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  return String(n).split('').map(c => map[+c] ?? c).join('');
}
function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
}
