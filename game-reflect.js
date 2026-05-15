/* ============================================================
   Reflect — Metacognition trainer (v5.20)

   EF skill: metacognition — the ability to notice and describe
   one's own thinking / feelings during a task. Reference: Dawson
   & Guare's framework via Grisham's "Scattered to Focused" ch. on
   self-awareness; also aligns with Norwegian Rammeplan's
   "danning" (cultivation / self-knowledge) pillar.

   Unlike the other EF games, Reflect is a DOM form, not a canvas
   game. Three quick questions after any session (or on demand):

     1. How did that feel?         (emoji ladder 1-5)
     2. Was it...?                  (Too easy / Just right / Too hard)
     3. What helped you focus?      (chip multi-select)

   Records under ef-metacognition-* skill IDs so the parent
   dashboard sees self-awareness practice as a tracked skill in
   its own right.

   Public entry points (window-attached):
     startReflect(opts)
       opts.onAttempt(skillId, success)
       opts.onComplete()
     stopReflect()

   The opts.context (optional) lets future post-session hooks
   pass which mode just finished — for now nobody uses it; future
   work auto-triggers Reflect after long sessions.
   ============================================================ */
(function (global) {
  'use strict';

  const HELP_CHIPS = [
    { key: 'quiet',     emoji: '🤫', label: 'Quiet space' },
    { key: 'breathing', emoji: '🌬️', label: 'Slow breathing' },
    { key: 'break',     emoji: '🚶', label: 'A break' },
    { key: 'character', emoji: '🐰', label: 'My character' },
    { key: 'nothing',   emoji: '🤷', label: 'Not sure' }
  ];

  let onAttemptFn = null;
  let onCompleteFn = null;
  let pickedFeeling = null;       // 1-5
  let pickedDifficulty = null;    // 'easy' | 'just-right' | 'hard'
  let pickedHelps = new Set();
  let host = null;

  function render() {
    if (!host) return;
    host.innerHTML = `
      <div class="reflect-card">
        <h1 class="reflect-title">How did that go?</h1>
        <p class="reflect-sub">Noticing how you feel helps your brain learn.</p>

        <section class="reflect-section">
          <h2 class="reflect-q">How did that feel?</h2>
          <div class="reflect-ladder" id="reflect-feeling" role="radiogroup" aria-label="Feeling">
            ${['😞','🙁','😐','🙂','😄'].map((e, i) => `
              <button type="button" class="reflect-step" data-value="${i + 1}" role="radio" aria-checked="false" aria-label="Level ${i + 1} of 5">${e}</button>
            `).join('')}
          </div>
        </section>

        <section class="reflect-section">
          <h2 class="reflect-q">Was it…?</h2>
          <div class="reflect-difficulty" id="reflect-difficulty" role="radiogroup">
            <button type="button" class="reflect-d-btn" data-value="easy"       role="radio" aria-checked="false">Too easy 😴</button>
            <button type="button" class="reflect-d-btn" data-value="just-right" role="radio" aria-checked="false">Just right 👌</button>
            <button type="button" class="reflect-d-btn" data-value="hard"       role="radio" aria-checked="false">Too tricky 🥵</button>
          </div>
        </section>

        <section class="reflect-section">
          <h2 class="reflect-q">What helped you focus?</h2>
          <div class="reflect-chips" id="reflect-chips">
            ${HELP_CHIPS.map((c) => `
              <button type="button" class="reflect-chip" data-key="${c.key}" aria-pressed="false">
                <span class="reflect-chip-emoji">${c.emoji}</span>
                <span class="reflect-chip-label">${c.label}</span>
              </button>
            `).join('')}
          </div>
        </section>

        <div class="reflect-actions">
          <button class="btn btn-secondary" id="reflect-skip">Skip</button>
          <button class="btn btn-primary"   id="reflect-save"  disabled>Save reflection</button>
        </div>
      </div>
    `;

    // Feeling ladder
    host.querySelectorAll('#reflect-feeling .reflect-step').forEach((b) => {
      b.addEventListener('click', () => {
        pickedFeeling = Number(b.dataset.value);
        host.querySelectorAll('#reflect-feeling .reflect-step').forEach((x) => {
          const on = x === b;
          x.setAttribute('aria-checked', on ? 'true' : 'false');
          x.classList.toggle('selected', on);
        });
        updateSaveBtn();
      });
    });

    // Difficulty
    host.querySelectorAll('#reflect-difficulty .reflect-d-btn').forEach((b) => {
      b.addEventListener('click', () => {
        pickedDifficulty = b.dataset.value;
        host.querySelectorAll('#reflect-difficulty .reflect-d-btn').forEach((x) => {
          const on = x === b;
          x.setAttribute('aria-checked', on ? 'true' : 'false');
          x.classList.toggle('selected', on);
        });
        updateSaveBtn();
      });
    });

    // Chips
    host.querySelectorAll('#reflect-chips .reflect-chip').forEach((b) => {
      b.addEventListener('click', () => {
        const key = b.dataset.key;
        if (pickedHelps.has(key)) pickedHelps.delete(key); else pickedHelps.add(key);
        b.setAttribute('aria-pressed', pickedHelps.has(key) ? 'true' : 'false');
        b.classList.toggle('selected', pickedHelps.has(key));
      });
    });

    host.querySelector('#reflect-skip').addEventListener('click', () => {
      if (onCompleteFn) try { onCompleteFn(); } catch {}
    });
    host.querySelector('#reflect-save').addEventListener('click', save);
  }

  function updateSaveBtn() {
    const ready = pickedFeeling != null && pickedDifficulty != null;
    const btn = host?.querySelector('#reflect-save');
    if (btn) btn.disabled = !ready;
  }

  function save() {
    if (pickedFeeling == null || pickedDifficulty == null) return;
    if (onAttemptFn) {
      try {
        onAttemptFn(`ef-metacognition-feeling-${pickedFeeling}`, true);
        onAttemptFn(`ef-metacognition-difficulty-${pickedDifficulty}`, true);
        for (const k of pickedHelps) onAttemptFn(`ef-metacognition-help-${k}`, true);
      } catch {}
    }
    // Brief acknowledgement
    if (host) {
      host.innerHTML = `
        <div class="reflect-card">
          <h1 class="reflect-title">Thanks for noticing.</h1>
          <p class="reflect-sub">Knowing how you feel is its own skill.</p>
        </div>
      `;
    }
    setTimeout(() => { if (onCompleteFn) try { onCompleteFn(); } catch {} }, 1400);
  }

  function startReflect(opts = {}) {
    host = document.getElementById('screen-reflect');
    if (!host) { console.warn('Reflect screen missing'); return; }
    onAttemptFn  = typeof opts.onAttempt  === 'function' ? opts.onAttempt  : null;
    onCompleteFn = typeof opts.onComplete === 'function' ? opts.onComplete : null;
    pickedFeeling = null;
    pickedDifficulty = null;
    pickedHelps = new Set();
    render();
  }

  function stopReflect() {
    if (host) host.innerHTML = '';
    host = null;
    onAttemptFn = null;
    onCompleteFn = null;
    pickedFeeling = null;
    pickedDifficulty = null;
    pickedHelps = new Set();
  }

  global.startReflect = startReflect;
  global.stopReflect  = stopReflect;
})(window);
