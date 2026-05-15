/* ============================================================
   Gratitude — Today I'm grateful for… (v5.26)

   Rammeplan area 6: Etikk, religion og filosofi.
   Daily gratitude entry with one-tap chip selection. Saves into
   today's journal entry under `gratitude: ['family', 'pet', ...]`
   so the parent dashboard can see what the kid has noticed
   alongside the parent's own observations.

   Pedagogically: gratitude practice is the canonical positive-
   psychology habit that pairs well with Greenblatt's Plus-Minus
   tracking. Norwegian Rammeplan §danning frames this as
   cultivation of attention and appreciation.

   Public entry points (window-attached):
     startGratitude(opts)
       opts.onAttempt(skillId, success)
       opts.onComplete()
     stopGratitude()
   ============================================================ */
(function (global) {
  'use strict';

  const CHIPS = [
    { key: 'family',  emoji: '👪', label: 'My family' },
    { key: 'pet',     emoji: '🐶', label: 'My pet' },
    { key: 'friend',  emoji: '👫', label: 'A friend' },
    { key: 'sun',     emoji: '☀️', label: 'Sunshine' },
    { key: 'outside', emoji: '🌳', label: 'Being outside' },
    { key: 'food',    emoji: '🍎', label: 'Yummy food' },
    { key: 'art',     emoji: '🎨', label: 'Making things' },
    { key: 'books',   emoji: '📚', label: 'A book' },
    { key: 'home',    emoji: '🏠', label: 'My home' },
    { key: 'love',    emoji: '❤️', label: 'Being loved' },
    { key: 'music',   emoji: '🎵', label: 'Music' },
    { key: 'play',    emoji: '🪁', label: 'Playing' }
  ];

  let host = null;
  let picked = new Set();
  let onAttemptFn = null;
  let onCompleteFn = null;

  function render() {
    if (!host) return;
    host.innerHTML = `
      <div class="gratitude-card">
        <div class="gratitude-emoji">🙏</div>
        <h1 class="gratitude-title">Today I'm grateful for…</h1>
        <p class="gratitude-sub">Tap one or more — whatever feels true today.</p>
        <div class="gratitude-chips" id="gratitude-chips">
          ${CHIPS.map((c) => `
            <button type="button" class="gratitude-chip" data-key="${c.key}" aria-pressed="false">
              <span class="gratitude-chip-emoji">${c.emoji}</span>
              <span class="gratitude-chip-label">${c.label}</span>
            </button>
          `).join('')}
        </div>
        <div class="gratitude-actions">
          <button class="btn btn-secondary" id="gratitude-skip">Skip today</button>
          <button class="btn btn-primary"   id="gratitude-save" disabled>Save</button>
        </div>
      </div>
    `;
    host.querySelectorAll('.gratitude-chip').forEach((b) => {
      b.addEventListener('click', () => {
        const k = b.dataset.key;
        if (picked.has(k)) picked.delete(k);
        else                picked.add(k);
        b.setAttribute('aria-pressed', picked.has(k) ? 'true' : 'false');
        b.classList.toggle('selected', picked.has(k));
        updateSaveBtn();
      });
    });
    host.querySelector('#gratitude-skip').addEventListener('click', () => {
      if (onCompleteFn) try { onCompleteFn(); } catch {}
    });
    host.querySelector('#gratitude-save').addEventListener('click', save);
  }

  function updateSaveBtn() {
    const btn = host?.querySelector('#gratitude-save');
    if (btn) btn.disabled = picked.size === 0;
  }

  function save() {
    if (picked.size === 0) return;
    const items = Array.from(picked);
    // Save into today's journal entry under `gratitude` (we extend
    // the entry shape — journal.js doesn't care about extra fields).
    if (window.JournalAPI && typeof activeProfile === 'function') {
      const p = activeProfile();
      if (p) {
        const key = JournalAPI.todayKey();
        const existing = JournalAPI.getEntry(p, key);
        const merged = { ...existing, gratitude: items };
        JournalAPI.setEntry(p, key, merged);
        if (typeof saveStorage === 'function') saveStorage();
      }
    }
    // Record per-item event so the parent dashboard sees the engagement
    if (onAttemptFn) {
      for (const k of items) {
        try { onAttemptFn(`ethics-gratitude-${k}`, true); } catch {}
      }
    }
    // Acknowledgement screen
    if (host) {
      host.innerHTML = `
        <div class="gratitude-card gratitude-done">
          <div class="gratitude-emoji">💛</div>
          <h1 class="gratitude-title">Saved.</h1>
          <p class="gratitude-sub">Noticing what we love is its own gift.</p>
        </div>
      `;
    }
    setTimeout(() => { if (onCompleteFn) try { onCompleteFn(); } catch {} }, 1500);
  }

  function startGratitude(opts = {}) {
    host = document.getElementById('screen-gratitude');
    if (!host) { console.warn('Gratitude screen missing'); return; }
    onAttemptFn  = typeof opts.onAttempt  === 'function' ? opts.onAttempt  : null;
    onCompleteFn = typeof opts.onComplete === 'function' ? opts.onComplete : null;
    picked = new Set();
    render();
  }

  function stopGratitude() {
    if (host) host.innerHTML = '';
    host = null;
    picked = new Set();
    onAttemptFn = null;
    onCompleteFn = null;
  }

  global.startGratitude = startGratitude;
  global.stopGratitude  = stopGratitude;
})(window);
