/* ============================================================
   Move with me — Body & Movement (v5.24)

   Rammeplan area 2: Kropp, bevegelse, mat og helse.
   Simon-says style: character on screen does a movement; kid does
   it too (we trust them — no motion detection). 6 movements per
   session, each held for ~6 seconds with an animated countdown,
   then auto-advances. Kid can tap 'Did it!' to advance early.

   Pedagogical anchors:
     - This is one of the few app modes that explicitly REQUIRES
       getting off the chair. We frame it as the bridge between
       screen and embodied learning (Rammeplan's central tension).
     - No scoring, no fail. The metric is "you moved your body."
     - Movements drawn from preschool gym + yoga primary moves:
       hop, stretch, twist, balance, dance, breathe.
     - Records ef-body-movement per completed movement so the
       parent dashboard sees engagement.

   Public entry points (window-attached):
     startMoveWithMe(opts)
       opts.onAttempt(skillId, success)
       opts.speak(text, key)
       opts.onComplete()
     stopMoveWithMe()
   ============================================================ */
(function (global) {
  'use strict';

  /* Movement bank — emoji + cue text + spoken prompt. Animation comes
     from a CSS class on the emoji ('mwm-bounce', 'mwm-spin', etc.) so
     the character on screen visibly does the move. */
  const MOVEMENTS = [
    { emoji: '🦘', cue: 'Hop like a kangaroo!',     anim: 'mwm-bounce',   spoken: 'Hop like a kangaroo!' },
    { emoji: '🌳', cue: 'Stand tall like a tree.',  anim: 'mwm-sway',     spoken: 'Stand tall like a tree.' },
    { emoji: '🌀', cue: 'Twist side to side.',      anim: 'mwm-twist',    spoken: 'Twist side to side.' },
    { emoji: '👏', cue: 'Clap five times!',         anim: 'mwm-clap',     spoken: 'Clap five times.' },
    { emoji: '🤲', cue: 'Reach for the sky.',       anim: 'mwm-reach',    spoken: 'Reach for the sky.' },
    { emoji: '🐸', cue: 'Squat down like a frog.',  anim: 'mwm-squat',    spoken: 'Squat down like a frog.' },
    { emoji: '🦩', cue: 'Stand on one foot.',       anim: 'mwm-balance',  spoken: 'Stand on one foot.' },
    { emoji: '🐢', cue: 'Curl up small, then big.', anim: 'mwm-curl',     spoken: 'Curl up small, then big.' },
    { emoji: '🐝', cue: 'Buzz around the room!',    anim: 'mwm-buzz',     spoken: 'Buzz around the room.' },
    { emoji: '🌬️', cue: 'Breathe slow and deep.',  anim: 'mwm-breathe',  spoken: 'Breathe slow and deep.' }
  ];

  const MOVES_PER_SESSION = 6;
  const HOLD_MS = 6000;

  let host = null;
  let idx = 0;
  let sequence = [];
  let timer = null;
  let onAttemptFn = null;
  let speakFn = null;
  let onCompleteFn = null;

  function pickSequence() {
    const pool = MOVEMENTS.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, MOVES_PER_SESSION);
  }

  function render() {
    if (!host) return;
    if (idx >= sequence.length) {
      // Session complete
      host.innerHTML = `
        <div class="mwm-card mwm-done">
          <div class="mwm-emoji">🎉</div>
          <h1 class="mwm-title">You moved your body!</h1>
          <p class="mwm-sub">That helps your brain too.</p>
        </div>
      `;
      if (onAttemptFn) try { onAttemptFn('ef-body-movement-session', true); } catch {}
      setTimeout(() => { if (onCompleteFn) try { onCompleteFn(); } catch {} }, 1600);
      return;
    }
    const m = sequence[idx];
    host.innerHTML = `
      <div class="mwm-card">
        <div class="mwm-progress"><div class="mwm-progress-bar" id="mwm-bar"></div></div>
        <div class="mwm-emoji ${m.anim}" aria-hidden="true">${m.emoji}</div>
        <h1 class="mwm-title">${m.cue}</h1>
        <p class="mwm-sub">${idx + 1} of ${sequence.length}</p>
        <button class="btn btn-primary mwm-next" id="mwm-next">Did it!</button>
      </div>
    `;
    // Animate the progress bar
    requestAnimationFrame(() => {
      const bar = host.querySelector('#mwm-bar');
      if (bar) {
        bar.style.transition = `width ${HOLD_MS}ms linear`;
        bar.style.width = '100%';
      }
    });
    host.querySelector('#mwm-next')?.addEventListener('click', advance);
    if (speakFn) try { speakFn(m.spoken, m.anim ? `mwm-${m.anim}` : null); } catch {}
    timer = setTimeout(advance, HOLD_MS);
  }

  function advance() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (onAttemptFn && sequence[idx]) {
      try { onAttemptFn(`ef-body-movement-${sequence[idx].anim}`, true); } catch {}
    }
    idx++;
    render();
  }

  function startMoveWithMe(opts = {}) {
    host = document.getElementById('screen-move-with-me');
    if (!host) { console.warn('Move with me screen missing'); return; }
    onAttemptFn  = typeof opts.onAttempt  === 'function' ? opts.onAttempt  : null;
    speakFn      = typeof opts.speak      === 'function' ? opts.speak      : null;
    onCompleteFn = typeof opts.onComplete === 'function' ? opts.onComplete : null;
    idx = 0;
    sequence = pickSequence();
    render();
  }

  function stopMoveWithMe() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (host) host.innerHTML = '';
    host = null;
    idx = 0;
    sequence = [];
    onAttemptFn = null;
    speakFn = null;
    onCompleteFn = null;
  }

  global.startMoveWithMe = startMoveWithMe;
  global.stopMoveWithMe  = stopMoveWithMe;
})(window);
