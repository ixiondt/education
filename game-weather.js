/* ============================================================
   Today's Weather — Nature observation (v5.27)

   Rammeplan area 4: Natur, miljø og teknologi.
   Once-per-day quick weather observation. The kid taps what they
   see outside; we save it into the journal so the parent dashboard
   can correlate weather with mood / outdoor time over weeks.

   Pedagogically: the simplest possible nature-observation habit,
   building the foundation of empirical noticing that Rammeplan §4
   calls for. No quiz, no "correct" answer — they record what is.

   Public entry points (window-attached):
     startWeather(opts)
       opts.onAttempt(skillId, success)
       opts.onComplete()
     stopWeather()
   ============================================================ */
(function (global) {
  'use strict';

  const WEATHER_OPTIONS = [
    { key: 'sunny',  emoji: '☀️', label: 'Sunny' },
    { key: 'cloudy', emoji: '🌥️', label: 'Cloudy' },
    { key: 'rainy',  emoji: '🌧️', label: 'Rainy' },
    { key: 'snowy',  emoji: '❄️', label: 'Snowy' },
    { key: 'windy',  emoji: '🌬️', label: 'Windy' },
    { key: 'foggy',  emoji: '🌫️', label: 'Foggy' },
    { key: 'stormy', emoji: '⛈️', label: 'Stormy' },
    { key: 'rainbow',emoji: '🌈', label: 'Rainbow' }
  ];

  const NOTICE_CHIPS = [
    { key: 'tree',   emoji: '🌳', label: 'A tree' },
    { key: 'bird',   emoji: '🐦', label: 'A bird' },
    { key: 'flower', emoji: '🌼', label: 'A flower' },
    { key: 'dog',    emoji: '🐕', label: 'A dog' },
    { key: 'puddle', emoji: '💦', label: 'A puddle' },
    { key: 'moon',   emoji: '🌙', label: 'The moon' },
    { key: 'stars',  emoji: '✨', label: 'Stars' },
    { key: 'leaf',   emoji: '🍂', label: 'A leaf' }
  ];

  let host = null;
  let pickedWeather = null;
  let pickedNotices = new Set();
  let onAttemptFn = null;
  let onCompleteFn = null;

  function render() {
    if (!host) return;
    host.innerHTML = `
      <div class="weather-card">
        <div class="weather-emoji">${pickedWeather ? WEATHER_OPTIONS.find(w => w.key === pickedWeather).emoji : '🌤️'}</div>
        <h1 class="weather-title">How's the weather today?</h1>
        <div class="weather-grid" id="weather-grid">
          ${WEATHER_OPTIONS.map((w) => `
            <button type="button" class="weather-btn ${pickedWeather === w.key ? 'selected' : ''}" data-weather="${w.key}" aria-pressed="${pickedWeather === w.key}">
              <span class="weather-btn-emoji">${w.emoji}</span>
              <span class="weather-btn-label">${w.label}</span>
            </button>
          `).join('')}
        </div>
        <h2 class="weather-h2">What did you see outside?</h2>
        <p class="weather-sub">Tap any you noticed. Or none — that's okay too.</p>
        <div class="weather-chips">
          ${NOTICE_CHIPS.map((c) => `
            <button type="button" class="weather-chip ${pickedNotices.has(c.key) ? 'selected' : ''}" data-notice="${c.key}" aria-pressed="${pickedNotices.has(c.key)}">
              <span>${c.emoji}</span><span>${c.label}</span>
            </button>
          `).join('')}
        </div>
        <div class="weather-actions">
          <button class="btn btn-secondary" id="weather-skip">Skip</button>
          <button class="btn btn-primary"   id="weather-save" ${pickedWeather ? '' : 'disabled'}>Save</button>
        </div>
      </div>
    `;
    host.querySelectorAll('[data-weather]').forEach((b) => {
      b.addEventListener('click', () => {
        pickedWeather = b.dataset.weather;
        render();
      });
    });
    host.querySelectorAll('[data-notice]').forEach((b) => {
      b.addEventListener('click', () => {
        const k = b.dataset.notice;
        if (pickedNotices.has(k)) pickedNotices.delete(k); else pickedNotices.add(k);
        render();
      });
    });
    host.querySelector('#weather-skip').addEventListener('click', () => {
      if (onCompleteFn) try { onCompleteFn(); } catch {}
    });
    host.querySelector('#weather-save').addEventListener('click', save);
  }

  function save() {
    if (!pickedWeather) return;
    if (window.JournalAPI && typeof activeProfile === 'function') {
      const p = activeProfile();
      if (p) {
        const key = JournalAPI.todayKey();
        const existing = JournalAPI.getEntry(p, key);
        const merged = {
          ...existing,
          weather: pickedWeather,
          noticed: Array.from(pickedNotices)
        };
        JournalAPI.setEntry(p, key, merged);
        if (typeof saveStorage === 'function') saveStorage();
      }
    }
    if (onAttemptFn) {
      try { onAttemptFn(`nature-weather-${pickedWeather}`, true); } catch {}
      for (const k of pickedNotices) {
        try { onAttemptFn(`nature-noticed-${k}`, true); } catch {}
      }
    }
    host.innerHTML = `
      <div class="weather-card weather-done">
        <div class="weather-emoji">${WEATHER_OPTIONS.find(w => w.key === pickedWeather).emoji}</div>
        <h1 class="weather-title">Saved.</h1>
        <p class="weather-sub">Nature noticed — that's science.</p>
      </div>
    `;
    setTimeout(() => { if (onCompleteFn) try { onCompleteFn(); } catch {} }, 1500);
  }

  function startWeather(opts = {}) {
    host = document.getElementById('screen-weather');
    if (!host) { console.warn('Weather screen missing'); return; }
    onAttemptFn  = typeof opts.onAttempt  === 'function' ? opts.onAttempt  : null;
    onCompleteFn = typeof opts.onComplete === 'function' ? opts.onComplete : null;
    pickedWeather = null;
    pickedNotices = new Set();
    // If today's entry has weather already, pre-fill so the kid can edit
    if (window.JournalAPI && typeof activeProfile === 'function') {
      const p = activeProfile();
      if (p) {
        const e = JournalAPI.getEntry(p, JournalAPI.todayKey());
        if (e.weather) pickedWeather = e.weather;
        if (Array.isArray(e.noticed)) pickedNotices = new Set(e.noticed);
      }
    }
    render();
  }

  function stopWeather() {
    if (host) host.innerHTML = '';
    host = null;
    pickedWeather = null;
    pickedNotices = new Set();
    onAttemptFn = null;
    onCompleteFn = null;
  }

  global.startWeather = startWeather;
  global.stopWeather  = stopWeather;
})(window);
