// ══════ Duas — lookup by zone/round + pagination ══════
let cache = null;

export async function loadDuas() {
  if (cache) return cache;
  const res = await fetch('data/duas.json');
  cache = await res.json();
  return cache;
}

export const TAWAF_ZONE_LABELS = {
  blackstone:       'الحجر الأسود',
  door:             'الملتزم',
  misr:             'الركن العراقي',
  mizab_hijr:       'الميزاب وحجر إسماعيل',
  between_corners:  'بين الركنين',
  yemeni:           'الركن اليماني',
  approaching_end:  'بين اليماني والحجر',
};

// Return {label, text} for a tawaf zone + round.
// Combines the universal intro for the zone with the per-round distinctive extra.
export function pickTawafDuaByZone(data, zoneKey, roundIdx) {
  if (!zoneKey || !data?.tawaf) return null;
  const t = data.tawaf;
  const round = String(Math.min(7, Math.max(1, (roundIdx || 0) + (roundIdx === 0 ? 1 : 0))));
  const roundData = t.rounds?.[round] || {};

  let parts = [];
  const zoneLabel = TAWAF_ZONE_LABELS[zoneKey] || 'الطواف';

  switch (zoneKey) {
    case 'blackstone':
      parts = [t.at_blackstone];
      break;
    case 'door':
      parts = [t.at_multazam_intro, roundData.multazam];
      break;
    case 'misr':
    case 'between_corners':
      parts = [t.at_shami_intro, roundData.shami_extra];
      break;
    case 'mizab_hijr':
      parts = [t.at_mizab_intro, roundData.mizab_extra];
      break;
    case 'yemeni':
    case 'approaching_end':
      parts = [t.at_yemeni_to_blackstone];
      break;
  }
  parts = parts.filter(Boolean);
  if (!parts.length) return null;

  return {
    label: `${zoneLabel} · الشوط ${arabicNum(parseInt(round))}`,
    text: parts.join('\n\n'),
  };
}

// Sa'i dua for the current round + context (green zone, at peak, at arrival)
export function pickSaiDua(data, roundIdx, opts = {}) {
  if (!data?.sai) return null;
  const s = data.sai;
  const { inGreenZone = false, atPeak = false, atArrival = false } = opts;

  if (inGreenZone) {
    return { label: '🏃 الميلان الأخضران · الهرولة', text: s.haraula };
  }
  if (atArrival) {
    return { label: 'عند الوصول', text: s.arrival_verse };
  }
  if (atPeak) {
    const peakName = (roundIdx === 0) ? 'الصفا' : (roundIdx % 2 === 0 ? 'الصفا' : 'المروة');
    return { label: `التكبير على ${peakName}`, text: s.peak_takbir };
  }

  // Walking: common dua + round-specific extra
  const round = String(Math.min(7, Math.max(1, roundIdx + 1)));
  const extra = s.extras?.[round];
  const direction = (roundIdx % 2 === 0) ? 'إلى المروة' : 'إلى الصفا';
  const parts = [s.walk_common, extra].filter(Boolean);
  return {
    label: `الشوط ${arabicNum(roundIdx + 1)} · ${direction}`,
    text: parts.join('\n\n'),
  };
}

export function pickAfterTawaf(data) {
  return data?.after_tawaf ? { label: 'دعاء بعد الطواف', text: data.after_tawaf } : null;
}

export function pickAfterSai(data) {
  return data?.after_sai ? { label: 'دعاء بعد السعي', text: data.after_sai } : null;
}

export function pickHalq(data) {
  const h = data?.halq;
  if (!h) return null;
  return {
    intro:  h.intro,
    before: { label: 'قبل الحلاقة أو التقصير', text: h.before },
    after:  { label: 'بعد الحلاقة أو التقصير', text: h.after },
  };
}

// Split long text into pages that fit the dua card without vertical scroll.
// Uses paragraph boundaries (\n\n). Small paragraphs get combined; large ones
// stay whole (they'll scroll internally if truly huge).
export function splitToPages(text, targetLen = 320) {
  if (!text) return [''];
  const paragraphs = text.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
  if (paragraphs.length === 0) return [''];
  const pages = [];
  let current = '';
  for (const p of paragraphs) {
    if (!current) {
      current = p;
    } else if (current.length + p.length + 2 <= targetLen) {
      current += '\n\n' + p;
    } else {
      pages.push(current);
      current = p;
    }
  }
  if (current) pages.push(current);
  return pages;
}

function arabicNum(n) {
  const map = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  return String(n).split('').map(c => map[+c] ?? c).join('');
}
