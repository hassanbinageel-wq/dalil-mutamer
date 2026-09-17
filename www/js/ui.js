// ══════ UI helpers — toast, confetti, haptics, paginated dua card ══════
import { getPrefJSON } from './storage.js';
import { splitToPages } from './duas.js';

let hapticEnabled = true;
(async () => {
  const s = await getPrefJSON('settings', {});
  hapticEnabled = s.haptic !== false;
})();

export function setHapticEnabled(v) { hapticEnabled = !!v; }

export async function haptic(style = 'light') {
  if (!hapticEnabled) return;
  const H = window.Capacitor?.Plugins?.Haptics;
  if (H) {
    try {
      const map = { light: 'LIGHT', medium: 'MEDIUM', heavy: 'HEAVY' };
      await H.impact({ style: map[style] || 'MEDIUM' });
      return;
    } catch {}
  }
  if (navigator.vibrate) {
    navigator.vibrate(style === 'heavy' ? [40, 40, 80] : style === 'medium' ? 50 : 20);
  }
}

let toastTimer = null;
export function toast(msg, ms = 2200) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

function confettiColors() {
  const css = getComputedStyle(document.documentElement);
  return [
    css.getPropertyValue('--confetti-a').trim() || '#059669',
    css.getPropertyValue('--confetti-b').trim() || '#34D399',
    css.getPropertyValue('--confetti-c').trim() || '#A7F3D0',
    css.getPropertyValue('--confetti-d').trim() || '#FFFFFF',
  ];
}

export function confetti(count = 44) {
  const host = document.getElementById('confetti');
  if (!host) return;
  const colors = confettiColors();
  host.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'confetti__p';
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = Math.random() * 0.5 + 's';
    p.style.animationDuration = (2.2 + Math.random() * 1.4) + 's';
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    p.style.opacity = (0.7 + Math.random() * 0.3).toString();
    host.appendChild(p);
  }
  setTimeout(() => { host.innerHTML = ''; }, 4000);
}

// ── Paginated dua card ─────────────────────────────────────
// Splits long duas into swipeable pages. The 3D visualization above
// stays visible because the dua card has a fixed height with horizontal
// pagination instead of vertical scroll.
export function renderPaginatedDua(cardEl, dua) {
  if (!cardEl || !dua) return;

  const pages = splitToPages(dua.text || '', 320);
  const state = { idx: 0, count: pages.length };

  cardEl.innerHTML = `
    <div class="dua-card__label">${escapeHtml(dua.label || '')}</div>
    <div class="dua-card__viewport">
      <div class="dua-card__pages" style="transform: translateX(0)">
        ${pages.map(p => `<div class="dua-card__page">${escapeHtml(p)}</div>`).join('')}
      </div>
    </div>
    ${pages.length > 1 ? `
      <div class="dua-card__nav">
        <button class="dua-card__prev" aria-label="السابق">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M15.4 7.4L14 8.8l2.2 2.2H4v2h12.2L14 15.2l1.4 1.4L20 12z"/></svg>
        </button>
        <div class="dua-card__dots">
          ${pages.map((_, i) => `<span class="dua-card__dot${i === 0 ? ' active' : ''}"></span>`).join('')}
        </div>
        <button class="dua-card__next" aria-label="التالي">
          <svg viewBox="0 0 24 24" width="18" height="18" style="transform:scaleX(-1)"><path fill="currentColor" d="M15.4 7.4L14 8.8l2.2 2.2H4v2h12.2L14 15.2l1.4 1.4L20 12z"/></svg>
        </button>
      </div>
    ` : ''}
  `;

  cardEl.classList.remove('changing');
  void cardEl.offsetWidth;
  cardEl.classList.add('changing');

  if (pages.length <= 1) return;

  const pagesEl = cardEl.querySelector('.dua-card__pages');
  const dots    = cardEl.querySelectorAll('.dua-card__dot');
  const prevBtn = cardEl.querySelector('.dua-card__prev');
  const nextBtn = cardEl.querySelector('.dua-card__next');

  const goto = (i) => {
    state.idx = Math.max(0, Math.min(state.count - 1, i));
    // In RTL, translateX positive moves content right (visually toward "previous").
    // We want "next" to move content to the LEFT so translateX becomes negative.
    // But since the container is RTL, we need to invert: use positive translateX
    // to reveal later pages that are laid out to the left.
    pagesEl.style.transform = `translateX(${state.idx * 100}%)`;
    dots.forEach((d, di) => d.classList.toggle('active', di === state.idx));
    prevBtn.disabled = state.idx === 0;
    nextBtn.disabled = state.idx === state.count - 1;
  };

  prevBtn.addEventListener('click', () => { goto(state.idx - 1); haptic('light'); });
  nextBtn.addEventListener('click', () => { goto(state.idx + 1); haptic('light'); });

  // Touch swipe (horizontal). In RTL: swipe RIGHT → previous page, swipe LEFT → next page.
  let sx = 0, sy = 0, tracking = false;
  const viewport = cardEl.querySelector('.dua-card__viewport');
  viewport.addEventListener('touchstart', (e) => {
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });
  viewport.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    // dx > 0 in RTL means swipe right (toward previous)
    // dx < 0 means swipe left (toward next)
    if (dx > 0) goto(state.idx - 1);
    else        goto(state.idx + 1);
    haptic('light');
  }, { passive: true });

  goto(0);
}

// Trigger the "dua-swap" fade+rise animation
export function animateDuaSwap(cardEl) {
  if (!cardEl) return;
  cardEl.classList.remove('changing');
  void cardEl.offsetWidth;
  cardEl.classList.add('changing');
}

function escapeHtml(s) {
  return String(s).replace(/[<>&"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c]));
}
