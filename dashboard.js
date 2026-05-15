/* ============================================================
   Parent Dashboard — v6.1
   ============================================================
   Read-side rendering of /api/dashboard/summary. Auth-gated by
   the session cookie (Sync.signedIn must be true). Inline-SVG
   charts (no library) to stay vanilla.

   What it shows per child:
     - Totals: attempts, correct, mastered skills, success rate
     - 7-day activity sparkline (attempts + correct overlay)
     - By skill category: bar list with mastery counts
     - By mode: bar list with attempts per mode
     - Recent activity timeline (10 most recent events)

   What it shows globally:
     - Parent email + sign-out
     - Devices list with last-sync timestamp

   Public entry points (window-attached):
     openDashboard()
     closeDashboard()
   ============================================================ */
(function (global) {
  'use strict';

  let host = null;     // #screen-dashboard
  let activeChildIdx = 0;
  let summary = null;
  let loading = false;
  let error = null;

  /* Skill-category display names — keys mirror the server's
     skillCategory() function. */
  const CATEGORY_LABELS = {
    'letter-recognize':       'Letter recognition',
    'letter-sound':           'Letter sounds (phonics)',
    'letter-trace':           'Letter tracing',
    'letter-word':            'Letter → word',
    'number-recognize':       'Number recognition',
    'number-trace':           'Number tracing',
    'count':                  'Counting',
    'phoneme-rhyme':          'Rhyming',
    'phoneme-first':          'First-sound isolation',
    'phoneme-blend':          'Blending',
    'sight-word':             'Sight words',
    'math-add':               'Math: addition',
    'math-sub':               'Math: subtraction',
    'math-mul':               'Math: multiplication',
    'math-div':               'Math: division',
    'math-measure':           'Measurement / comparison',
    'math-spatial':           'Spatial reasoning',
    'ef-working-memory':      'EF · Working memory',
    'ef-response-inhibition': 'EF · Response inhibition',
    'ef-cognitive-flexibility': 'EF · Cognitive flexibility',
    'ef-sustained-attention': 'EF · Sustained attention',
    'ef-metacognition':       'EF · Metacognition',
    'ef-emotional-regulation':'EF · Emotional regulation',
    'ef-body-movement':       'EF · Body movement',
    'ef-self-awareness':      'EF · Self-awareness',
    'ef-body-break':          'EF · Body breaks',
    'ef-gratitude':           'Gratitude practice',
    'health-food-sort':       'Health · Food sort',
    'arts-drawing':           'Arts · Drawing',
    'arts-rhythm':            'Arts · Rhythm',
    'ethics-empathy':         'Ethics · Empathy',
    'ethics-gratitude':       'Ethics · Gratitude',
    'nature':                 'Nature · Observation + sort',
    'society':                'Society · Family + routines',
  };

  function labelForCategory(cat) {
    return CATEGORY_LABELS[cat] || cat.replace(/-/g, ' ');
  }

  async function fetchSummary() {
    loading = true;
    error = null;
    render();
    try {
      const r = await fetch('/api/dashboard/summary', { credentials: 'same-origin' });
      if (r.status === 401) {
        error = 'You need to sign in to see the dashboard.';
        summary = null;
      } else if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        error = j?.error?.message || 'Could not load the dashboard.';
        summary = null;
      } else {
        summary = await r.json();
        activeChildIdx = 0;
      }
    } catch {
      error = 'Network unreachable. Try again when online.';
      summary = null;
    } finally {
      loading = false;
      render();
    }
  }

  /* Inline SVG line chart — 2 series overlay (attempts + correct).
     Reused pattern from JournalAPI.sparkline but with two paths. */
  function chart7Days(last7Days) {
    const W = 320, H = 80, pad = 6;
    const n = last7Days.length;
    if (!n) return '<svg width="320" height="80"></svg>';
    const max = Math.max(1, ...last7Days.map((d) => d.attempts));
    const xStep = (W - pad * 2) / Math.max(1, n - 1);
    const yScale = (v) => H - pad - (v / max) * (H - pad * 2);
    const buildPath = (pick) => {
      let path = '';
      last7Days.forEach((d, i) => {
        const x = pad + i * xStep;
        const y = yScale(pick(d));
        path += (i === 0 ? `M${x.toFixed(1)} ${y.toFixed(1)}` : ` L${x.toFixed(1)} ${y.toFixed(1)}`);
      });
      return path;
    };
    const pathAttempts  = buildPath((d) => d.attempts);
    const pathSuccesses = buildPath((d) => d.successes);
    const ticks = last7Days.map((d, i) => {
      const x = pad + i * xStep;
      const label = d.day.slice(5); // MM-DD
      return `<text x="${x.toFixed(1)}" y="${H - 1}" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.5">${label}</text>`;
    }).join('');
    return `
      <svg viewBox="0 0 ${W} ${H + 12}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style="width:100%;height:96px;">
        <path d="${pathAttempts}"  fill="none" stroke="var(--text-soft)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.6" />
        <path d="${pathSuccesses}" fill="none" stroke="var(--accent)"   stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        ${last7Days.map((d, i) => {
          const x = pad + i * xStep;
          const y = yScale(d.successes);
          return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="var(--accent)"/>`;
        }).join('')}
        ${ticks}
      </svg>
    `;
  }

  /* Bar list — sorted by attempts descending, top N. */
  function barList(map, maxRows = 8) {
    const entries = Object.entries(map).map(([k, v]) => ({ k, ...v }));
    entries.sort((a, b) => (b.attempts || 0) - (a.attempts || 0));
    const top = entries.slice(0, maxRows);
    const max = Math.max(1, ...top.map((e) => e.attempts || 0));
    return top.map((e) => {
      const widthPct = ((e.attempts || 0) / max) * 100;
      const rate = (e.attempts > 0) ? Math.round(((e.successes || 0) / e.attempts) * 100) : 0;
      return `
        <div class="dash-bar-row">
          <div class="dash-bar-label">${escapeHtml(labelForCategory(e.k))}</div>
          <div class="dash-bar-wrap">
            <div class="dash-bar-fill" style="width:${widthPct}%"></div>
          </div>
          <div class="dash-bar-meta">${e.successes || 0}/${e.attempts || 0} · ${rate}%${e.mastered != null ? ` · ${e.mastered} mastered` : ''}</div>
        </div>
      `;
    }).join('') || '<div class="dash-empty">No activity yet.</div>';
  }

  function fmtAge(months) {
    if (months == null) return '—';
    const y = Math.floor(months / 12);
    const m = months % 12;
    if (y === 0) return `${m} mo`;
    if (m === 0) return `${y} yr`;
    return `${y} yr ${m} mo`;
  }

  function fmtRelative(ts) {
    if (!ts) return '—';
    const ms = Date.now() - new Date(ts).getTime();
    const s = Math.round(ms / 1000);
    if (s < 60)  return `${s}s ago`;
    const m = Math.round(s / 60);
    if (m < 60)  return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24)  return `${h}h ago`;
    const d = Math.round(h / 24);
    return `${d}d ago`;
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function render() {
    if (!host) return;
    if (loading) {
      host.innerHTML = `
        <div class="dash-card">
          <h1 class="dash-title">Parent dashboard</h1>
          <p class="dash-sub">Loading…</p>
          <button class="btn btn-secondary" id="dash-close">Done</button>
        </div>
      `;
      host.querySelector('#dash-close')?.addEventListener('click', closeDashboard);
      return;
    }
    if (error) {
      host.innerHTML = `
        <div class="dash-card">
          <h1 class="dash-title">Parent dashboard</h1>
          <p class="dash-sub" style="color: oklch(0.55 0.18 25);">${escapeHtml(error)}</p>
          <div class="dash-actions">
            <button class="btn btn-secondary" id="dash-retry">Retry</button>
            <button class="btn btn-primary" id="dash-close">Done</button>
          </div>
        </div>
      `;
      host.querySelector('#dash-retry')?.addEventListener('click', fetchSummary);
      host.querySelector('#dash-close')?.addEventListener('click', closeDashboard);
      return;
    }
    if (!summary || !summary.children?.length) {
      host.innerHTML = `
        <div class="dash-card">
          <h1 class="dash-title">Parent dashboard</h1>
          <p class="dash-sub">No synced data yet. Once a kid plays for a bit with sync turned on, their progress shows up here.</p>
          <div class="dash-meta">Signed in as <strong>${escapeHtml(summary?.parent?.email || '—')}</strong></div>
          <button class="btn btn-primary" id="dash-close">Done</button>
        </div>
      `;
      host.querySelector('#dash-close')?.addEventListener('click', closeDashboard);
      return;
    }
    activeChildIdx = Math.min(activeChildIdx, summary.children.length - 1);
    const c = summary.children[activeChildIdx];
    const rate = c.totals.attempts > 0 ? Math.round((c.totals.successes / c.totals.attempts) * 100) : 0;

    host.innerHTML = `
      <div class="dash-card">
        <div class="dash-head">
          <h1 class="dash-title">Parent dashboard</h1>
          <div class="dash-meta">Signed in as <strong>${escapeHtml(summary.parent.email)}</strong></div>
        </div>

        ${summary.children.length > 1 ? `
          <div class="dash-kid-tabs">
            ${summary.children.map((k, i) => `
              <button class="dash-kid-tab" data-idx="${i}" aria-pressed="${i === activeChildIdx}">${escapeHtml(k.name)}</button>
            `).join('')}
          </div>
        ` : ''}

        <section class="dash-section">
          <h2 class="dash-h2">${escapeHtml(c.name)} <span class="dash-age">${fmtAge(c.ageMonths)}</span></h2>
          <div class="dash-stats">
            <div class="dash-stat"><div class="dash-stat-n">${c.totals.attempts}</div><div class="dash-stat-l">attempts</div></div>
            <div class="dash-stat"><div class="dash-stat-n">${c.totals.successes}</div><div class="dash-stat-l">correct</div></div>
            <div class="dash-stat"><div class="dash-stat-n">${rate}%</div><div class="dash-stat-l">success</div></div>
            <div class="dash-stat"><div class="dash-stat-n">${c.totals.mastered}</div><div class="dash-stat-l">mastered skills</div></div>
          </div>
        </section>

        <section class="dash-section">
          <h2 class="dash-h2">Last 7 days</h2>
          <p class="dash-help">Attempts (grey) and correct (accent). Empty means no activity that day.</p>
          <div class="dash-chart">${chart7Days(c.last7Days)}</div>
        </section>

        <section class="dash-section">
          <h2 class="dash-h2">By skill area</h2>
          <div class="dash-bars">${barList(c.bySkillCategory)}</div>
        </section>

        <section class="dash-section">
          <h2 class="dash-h2">By mode (last 7 days)</h2>
          <div class="dash-bars">${barList(c.byMode)}</div>
        </section>

        <section class="dash-section">
          <h2 class="dash-h2">Recent activity</h2>
          <ul class="dash-events">
            ${c.recentEvents.length === 0 ? '<li class="dash-empty">No events yet.</li>' :
              c.recentEvents.map((e) => `
                <li class="dash-event ${e.success ? 'ok' : 'miss'}">
                  <span class="dash-event-dot" aria-hidden="true"></span>
                  <span class="dash-event-skill">${escapeHtml(e.skillId)}</span>
                  ${e.mode ? `<span class="dash-event-mode">${escapeHtml(e.mode)}</span>` : ''}
                  <span class="dash-event-time">${fmtRelative(e.clientTs)}</span>
                </li>
              `).join('')}
          </ul>
        </section>

        <section class="dash-section">
          <h2 class="dash-h2">Devices</h2>
          ${summary.devices?.length ? `
            <ul class="dash-devices">
              ${summary.devices.map((d) => `
                <li>
                  <code>${escapeHtml(d.id.slice(0, 8))}…</code>
                  <span class="dash-event-time">last sync ${fmtRelative(d.lastSyncAt)}</span>
                </li>
              `).join('')}
            </ul>
          ` : '<div class="dash-empty">No devices have synced yet.</div>'}
        </section>

        <div class="dash-actions">
          <button class="btn btn-secondary" id="dash-refresh">Refresh</button>
          <button class="btn btn-primary"   id="dash-close">Done</button>
        </div>
      </div>
    `;

    host.querySelectorAll('.dash-kid-tab').forEach((b) => {
      b.addEventListener('click', () => {
        activeChildIdx = Number(b.dataset.idx) || 0;
        render();
      });
    });
    host.querySelector('#dash-refresh')?.addEventListener('click', fetchSummary);
    host.querySelector('#dash-close')?.addEventListener('click', closeDashboard);
  }

  function openDashboard() {
    host = document.getElementById('screen-dashboard');
    if (!host) { console.warn('Dashboard screen missing'); return; }
    if (typeof showScreen === 'function') showScreen('dashboard');
    fetchSummary();
  }

  function closeDashboard() {
    if (host) host.innerHTML = '';
    host = null;
    summary = null;
    activeChildIdx = 0;
    loading = false;
    error = null;
    if (typeof goHome === 'function') goHome();
  }

  global.openDashboard  = openDashboard;
  global.closeDashboard = closeDashboard;
})(window);
