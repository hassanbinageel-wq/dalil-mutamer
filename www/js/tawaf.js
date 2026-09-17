// ══════ Tawaf — automatic GPS counter + zone-based paginated duas ══════
import { LANDMARKS, distanceM, bearingDeg, watchLocation, stopWatching } from './geo.js';
import { loadDuas, pickTawafDuaByZone, pickAfterTawaf, TAWAF_ZONE_LABELS } from './duas.js';
import { haptic, toast, confetti, renderPaginatedDua } from './ui.js';
import { updateTawafViz, initTawafScene } from './viz3d.js';

const RING_LEN = 552.9;
const KAABA_RADIUS_M = 45;
const MIN_ROUND_SECS = 45;

const state = {
  round: 0,
  paused: true,
  startedAt: null,
  totalMs: 0,
  timerId: null,
  currentZone: null,
  lastCrossAt: 0,
  lastPos: null,
  visitedFar: false,
  autoStarted: false,
};

let el = {};

export async function initTawaf() {
  el = {
    number:   document.getElementById('tawaf-number'),
    progress: document.getElementById('tawaf-progress'),
    time:     document.getElementById('tawaf-time'),
    zone:     document.getElementById('tawaf-mode'),
    dist:     document.getElementById('tawaf-dist'),
    dua:      document.getElementById('tawaf-dua'),
    pauseBtn: document.getElementById('tawaf-pause'),
    addBtn:   document.getElementById('tawaf-add'),
    resetBtn: document.getElementById('tawaf-reset'),
    gps:      document.getElementById('tawaf-gps'),
  };
  el.addBtn.addEventListener('click', () => bump('manual'));
  el.resetBtn.addEventListener('click', reset);
  el.pauseBtn.addEventListener('click', togglePause);
  render();
}

export async function enterTawaf() {
  // Build/attach the Three.js Kaaba scene (idempotent)
  const vizEl = document.getElementById('viz-tawaf');
  if (vizEl) initTawafScene(vizEl);

  render();
  await updateDua();
  setGpsStatus('locating');
  await watchLocation((pos, err) => {
    if (err || !pos) { setGpsStatus('off'); return; }
    setGpsStatus('live');
    onLocation(pos);
  });
}

export async function leaveTawaf() { await stopWatching(); }

function getTawafZone(bearing) {
  const b = ((bearing % 360) + 360) % 360;
  if (b >= 90  && b < 135) return 'blackstone';
  if (b >= 45  && b < 90)  return 'door';
  if (b < 45   || b >= 337) return 'misr';
  if (b >= 292 && b < 337) return 'mizab_hijr';
  if (b >= 225 && b < 292) return 'between_corners';
  if (b >= 180 && b < 225) return 'yemeni';
  return 'approaching_end';
}

function onLocation(pos) {
  state.lastPos = pos;
  const dK = distanceM(pos, LANDMARKS.KAABA);
  el.dist.textContent = Math.round(dK);

  if (dK > KAABA_RADIUS_M) {
    updateTawafViz(null, dK);
    if (state.currentZone !== null) {
      state.currentZone = null;
      updateDua();
      el.zone.textContent = 'خارج المطاف';
    } else {
      el.zone.textContent = 'خارج المطاف';
    }
    return;
  }

  const bearing = bearingDeg(LANDMARKS.KAABA, pos);
  updateTawafViz(bearing, dK);
  const zone = getTawafZone(bearing);

  if (zone !== state.currentZone) {
    state.currentZone = zone;
    el.zone.textContent = TAWAF_ZONE_LABELS[zone] || '—';
    updateDua();
  }

  if (!state.autoStarted && state.paused) {
    state.autoStarted = true;
    start();
    toast('بدأ التتبع التلقائي');
  }

  const isFar = zone === 'between_corners' || zone === 'yemeni' || zone === 'approaching_end';
  if (isFar) state.visitedFar = true;

  const secsSinceLast = (Date.now() - state.lastCrossAt) / 1000;
  if (zone === 'blackstone' && state.visitedFar && secsSinceLast > MIN_ROUND_SECS && !state.paused) {
    state.lastCrossAt = Date.now();
    state.visitedFar = false;
    bump('auto');
  }
}

async function bump(source) {
  if (state.round >= 7) return;
  if (state.paused) start();
  state.round += 1;
  render();
  el.number.classList.add('bump');
  setTimeout(() => el.number.classList.remove('bump'), 500);
  haptic('medium');

  if (state.round === 7) complete();
  else                    toast(`اكتمل الشوط ${arabicNum(state.round)}${source === 'auto' ? ' · تلقائي' : ''}`);
}

async function updateDua() {
  const data = await loadDuas();
  if (!state.currentZone) {
    if (state.round === 0) {
      renderPaginatedDua(el.dua, {
        label: 'استقبل الكعبة',
        text: 'اقترب من الحجر الأسود لبدء الطواف.\n\nالأدعية والأشواط تُحسب تلقائياً حسب موقعك حول الكعبة.',
      });
    }
    return;
  }
  const d = pickTawafDuaByZone(data, state.currentZone, state.round);
  if (d) renderPaginatedDua(el.dua, d);
}

async function complete() {
  stop();
  confetti();
  haptic('heavy');
  const data = await loadDuas();
  const after = pickAfterTawaf(data);
  if (after) renderPaginatedDua(el.dua, after);
  toast('تقبل الله طوافك 🕋');
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
  if (state.round >= 7) return;
  state.paused ? start() : stop();
}
async function reset() {
  stop();
  state.round = 0;
  state.totalMs = 0;
  state.lastCrossAt = 0;
  state.visitedFar = false;
  state.autoStarted = false;
  state.currentZone = null;
  el.pauseBtn.textContent = 'إيقاف مؤقت';
  el.pauseBtn.classList.remove('is-active');
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
