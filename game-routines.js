/* ============================================================
   Daily Routines — sequence the day (v5.29)

   Rammeplan area 7: Nærmiljø og samfunn.
   Norwegian *rutiner* — sequencing the predictable shape of a
   day. Build temporal/causal reasoning + reinforce the calming
   structure of routine.

   Mechanics:
     - 5-6 routine moments shown shuffled (wake up, breakfast,
       outdoor play, lunch, nap, dinner, bedtime).
     - Kid taps them in temporal order. Each correct tap moves it
       to the timeline. Wrong tap → gentle nudge, no penalty.

   Public entry points: startRoutines(opts) ; stopRoutines()
   ============================================================ */
(function (global) {
  'use strict';

  /* Canonical day order — could be customized per family later
     (some kids nap, others don't; some have dinner at 4, etc.) */
  const FULL_DAY = [
    { key: 'wake',    emoji: '🌅', label: 'Wake up' },
    { key: 'breakfast', emoji: '🥣', label: 'Breakfast' },
    { key: 'play',    emoji: '🧸', label: 'Morning play' },
    { key: 'outside', emoji: '🌳', label: 'Outside time' },
    { key: 'lunch',   emoji: '🥪', label: 'Lunch' },
    { key: 'nap',     emoji: '😴', label: 'Quiet time' },
    { key: 'dinner',  emoji: '🍝', label: 'Dinner' },
    { key: 'bath',    emoji: '🛁', label: 'Bath' },
    { key: 'story',   emoji: '📖', label: 'Story time' },
    { key: 'sleep',   emoji: '🌙', label: 'Sleep' }
  ];

  const ROUTINES_PER_SESSION = 6;

  let host = null;
  let order = [];        // expected canonical order this session
  let pool = [];         // shuffled options the kid taps from
  let timeline = [];     // taps so far
  let onAttemptFn = null;
  let speakFn = null;
  let onCompleteFn = null;

  function pickSession() {
    // Take a contiguous slice from FULL_DAY so the kid sequences a
    // realistic block of their day, not a random 6 from across it.
    const max = FULL_DAY.length - ROUTINES_PER_SESSION;
    const start = Math.floor(Math.random() * (max + 1));
    return FULL_DAY.slice(start, start + ROUTINES_PER_SESSION);
  }

  function shuffle(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function render() {
    if (!host) return;
    if (timeline.length >= order.length) {
      host.innerHTML = `
        <div class="rout-card rout-done">
          <div class="rout-done-emoji">🌙</div>
          <h1 class="rout-title">That's a day!</h1>
          <div class="rout-timeline">
            ${order.map((r, i) => `
              <div class="rout-timeline-cell">
                <span class="rout-emoji">${r.emoji}</span>
                <span class="rout-label">${r.label}</span>
              </div>
            `).join('<span class="rout-arrow">→</span>')}
          </div>
        </div>
      `;
      if (onAttemptFn) try { onAttemptFn('society-routines-session', true); } catch {}
      setTimeout(() => { if (onCompleteFn) try { onCompleteFn(); } catch {} }, 2400);
      return;
    }
    const expected = order[timeline.length];
    host.innerHTML = `
      <div class="rout-card">
        <h1 class="rout-title">What comes next in the day?</h1>
        <div class="rout-timeline">
          ${timeline.map((r) => `
            <div class="rout-timeline-cell">
              <span class="rout-emoji">${r.emoji}</span>
              <span class="rout-label">${r.label}</span>
            </div>
          `).join('<span class="rout-arrow">→</span>')}
          ${timeline.length > 0 ? '<span class="rout-arrow">→</span>' : ''}
          <div class="rout-timeline-cell rout-next">?</div>
        </div>
        <div class="rout-pool">
          ${pool.map((r) => `
            <button class="rout-pick" data-key="${r.key}">
              <span class="rout-emoji">${r.emoji}</span>
              <span class="rout-label">${r.label}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
    host.querySelectorAll('.rout-pick').forEach((b) => {
      b.addEventListener('click', () => handlePick(b.dataset.key, b, expected));
    });
  }

  function handlePick(pickedKey, btn, expected) {
    if (pickedKey === expected.key) {
      btn.classList.add('rout-correct');
      if (speakFn) try { speakFn(expected.label, `routine-${expected.key}`); } catch {}
      if (onAttemptFn) try { onAttemptFn(`society-routine-${expected.key}`, true); } catch {}
      // Move into timeline, drop from pool, re-render
      setTimeout(() => {
        timeline.push(expected);
        pool = pool.filter((r) => r.key !== pickedKey);
        render();
      }, 520);
    } else {
      btn.classList.add('rout-wrong');
      if (onAttemptFn) try { onAttemptFn(`society-routine-${expected.key}`, false); } catch {}
      // Pulse the correct one
      setTimeout(() => {
        const right = host.querySelector(`.rout-pick[data-key="${expected.key}"]`);
        if (right) right.classList.add('rout-hint');
      }, 220);
    }
  }

  function startRoutines(opts = {}) {
    host = document.getElementById('screen-routines');
    if (!host) return;
    onAttemptFn  = typeof opts.onAttempt  === 'function' ? opts.onAttempt  : null;
    speakFn      = typeof opts.speak      === 'function' ? opts.speak      : null;
    onCompleteFn = typeof opts.onComplete === 'function' ? opts.onComplete : null;
    order = pickSession();
    pool = shuffle(order);
    timeline = [];
    render();
  }
  function stopRoutines() {
    if (host) host.innerHTML = '';
    host = null;
    order = pool = [];
    timeline = [];
    onAttemptFn = speakFn = onCompleteFn = null;
  }

  global.startRoutines = startRoutines;
  global.stopRoutines  = stopRoutines;
})(window);
