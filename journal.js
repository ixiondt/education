/* ============================================================
   Parent Observation Journal — Finally Focused (v5.19)

   Pedagogical reference: Greenblatt's "Plus-Minus" framework from
   Finally Focused — the parent observes daily patterns (sleep,
   mood, focus, energy, screen time, outdoor time, supplements,
   triggers) and brings those observations to clinical visits.

   This module owns:
     - Per-day entry shape + validation
     - Read/write against profile.journal.entries[date]
     - 7-day and 30-day aggregate views
     - JSON / CSV / printable PDF export
     - Tiny inline-SVG trend charts (no chart library — zero deps)

   The module is a PURE DATA LAYER. UI wiring (modal, form
   handlers, export buttons) lives in app.js per the existing
   architecture — we expose JournalAPI on window for app.js to use.

   IMPORTANT — clinical boundary:
     The app NEVER interprets these entries. We display patterns
     ("focus dropped on Tuesdays") but never recommend supplements,
     diet changes, or medical action. Export is the path to a
     real clinician.
   ============================================================ */
(function (global) {
  'use strict';

  /* ----------- Date helpers ----------- */

  function todayKey() {
    const d = new Date();
    return ymd(d);
  }
  function ymd(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function addDays(dateKey, n) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + n);
    return ymd(dt);
  }
  /* Inclusive list of date keys [start..end] */
  function dateRange(startKey, endKey) {
    const out = [];
    let cur = startKey;
    let safety = 400;
    while (cur <= endKey && safety-- > 0) {
      out.push(cur);
      cur = addDays(cur, 1);
    }
    return out;
  }

  /* ----------- Entry shape + defaults ----------- */

  /* Default empty entry. Numeric fields use null (not 0) so we can
     distinguish "not logged" from "intentionally zero." */
  function emptyEntry() {
    return {
      ts:          null,
      sleep:       null,   // hours, 0-12
      mood:        null,   // 1-5
      focus:       null,   // 1-5
      energy:      null,   // 1-5
      screen:      null,   // minutes (0-480)
      outdoor:     null,   // minutes (0-180)
      supplements: '',
      notes:       ''
    };
  }

  function ensureJournal(profile) {
    if (!profile.journal) profile.journal = { entries: {} };
    if (!profile.journal.entries) profile.journal.entries = {};
    return profile.journal;
  }

  function getEntry(profile, key) {
    if (!profile) return emptyEntry();
    const journal = ensureJournal(profile);
    return { ...emptyEntry(), ...(journal.entries[key] || {}) };
  }

  function setEntry(profile, key, patch) {
    if (!profile) return null;
    const journal = ensureJournal(profile);
    const existing = journal.entries[key] || emptyEntry();
    const updated = { ...existing, ...patch, ts: Date.now() };
    // Strip "all-empty" entries so the calendar shows blank days correctly
    const hasAnyValue = ['sleep','mood','focus','energy','screen','outdoor'].some(
      (k) => updated[k] !== null && updated[k] !== undefined
    ) || (updated.supplements && updated.supplements.trim())
       || (updated.notes && updated.notes.trim());
    if (!hasAnyValue) {
      delete journal.entries[key];
      return null;
    }
    journal.entries[key] = updated;
    return updated;
  }

  function clearEntry(profile, key) {
    if (!profile) return;
    const journal = ensureJournal(profile);
    delete journal.entries[key];
  }

  /* ----------- Aggregates / queries ----------- */

  function entriesForRange(profile, days) {
    const today = todayKey();
    const start = addDays(today, -(days - 1));
    const keys = dateRange(start, today);
    return keys.map((k) => ({ date: k, ...getEntry(profile, k) }));
  }

  /* Average of a single numeric field over the range, skipping nulls. */
  function average(entries, field) {
    const vals = entries.map((e) => e[field]).filter((v) => v != null && !isNaN(v));
    if (!vals.length) return null;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  }

  /* Heat-grid value 0..1 for the calendar view. Maps "great day" toward 1.
     Uses mood + focus + energy as a composite signal; falls back to whichever
     is logged. Returns null if nothing logged. */
  function dayScore(entry) {
    const dims = ['mood', 'focus', 'energy'].map((k) => entry[k]).filter((v) => v != null);
    if (!dims.length) return null;
    const avg = dims.reduce((s, v) => s + v, 0) / dims.length;
    return Math.max(0, Math.min(1, (avg - 1) / 4));   // 1-5 → 0-1
  }

  /* ----------- Tiny inline-SVG sparkline ----------- */

  /* values: array of numbers (nulls allowed for gaps).
     min/max: y-axis bounds.
     w/h: pixel dimensions of the chart.
     Returns an SVG element ready to insert. */
  function sparkline(values, opts = {}) {
    const w = opts.width  || 280;
    const h = opts.height || 40;
    const min = opts.min ?? 1;
    const max = opts.max ?? 5;
    const stroke = opts.stroke || 'var(--accent)';
    const fill   = opts.fill   || 'rgba(0,0,0,0)';
    const pad = 4;
    const n = values.length;
    if (!n) return svgEl(`<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"></svg>`);
    const xStep = (w - pad * 2) / Math.max(1, n - 1);
    const yScale = (v) => h - pad - ((v - min) / (max - min)) * (h - pad * 2);
    // Build polyline path, but break the line when a value is null
    let path = '';
    let inSegment = false;
    for (let i = 0; i < n; i++) {
      const v = values[i];
      const x = pad + i * xStep;
      if (v == null) { inSegment = false; continue; }
      const y = yScale(v);
      path += (inSegment ? ` L${x.toFixed(1)} ${y.toFixed(1)}` : ` M${x.toFixed(1)} ${y.toFixed(1)}`);
      inSegment = true;
    }
    // Dots for each logged point so single days are visible
    const dots = values.map((v, i) => {
      if (v == null) return '';
      const cx = pad + i * xStep;
      const cy = yScale(v);
      return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2.5" fill="${stroke}" />`;
    }).join('');
    return svgEl(`
      <svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <path d="${path}" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        ${dots}
      </svg>
    `);
  }
  function svgEl(html) {
    const div = document.createElement('div');
    div.innerHTML = html.trim();
    return div.firstElementChild;
  }

  /* ----------- Export ----------- */

  function exportJSON(profile) {
    const journal = ensureJournal(profile);
    return JSON.stringify({
      profile: { name: profile.name, ageMonths: profile.ageMonths },
      exportedAt: new Date().toISOString(),
      entries: journal.entries
    }, null, 2);
  }

  function exportCSV(profile) {
    const journal = ensureJournal(profile);
    const headers = ['date', 'sleep_hours', 'mood', 'focus', 'energy', 'screen_min', 'outdoor_min', 'supplements', 'notes'];
    const rows = [headers.join(',')];
    const dates = Object.keys(journal.entries).sort();
    for (const k of dates) {
      const e = journal.entries[k];
      rows.push([
        k,
        e.sleep   ?? '',
        e.mood    ?? '',
        e.focus   ?? '',
        e.energy  ?? '',
        e.screen  ?? '',
        e.outdoor ?? '',
        csvEscape(e.supplements || ''),
        csvEscape(e.notes || '')
      ].join(','));
    }
    return rows.join('\n');
  }
  function csvEscape(s) {
    if (s == null) return '';
    const str = String(s);
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  }

  function downloadBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  }

  /* ----------- Public API ----------- */

  global.JournalAPI = {
    todayKey,
    addDays,
    emptyEntry,
    getEntry,
    setEntry,
    clearEntry,
    entriesForRange,
    average,
    dayScore,
    sparkline,
    exportJSON,
    exportCSV,
    downloadBlob
  };
})(window);
