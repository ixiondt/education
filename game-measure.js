/* ============================================================
   Measure Me — comparison reasoning (v5.28)

   Rammeplan area 5: Antall, rom og form.
   Comparative-measurement: longer/shorter, heavier/lighter,
   more/less. Pre-numeric quantitative reasoning — the foundation
   for measurement when actual rulers and scales come later.

   Public entry points:
     startMeasure(opts)
       opts.onAttempt(skillId, success)
       opts.speak(text, key)
       opts.onComplete()
     stopMeasure()
   ============================================================ */
(function (global) {
  'use strict';

  /* Each scenario: a dimension question + two items where one
     clearly wins on that dimension. Sizes are CSS scale factors
     so the visual reflects the answer (longer = wider emoji). */
  const SCENARIOS = [
    { dim: 'length',  q: 'Which is longer?',  a: { emoji: '🐍', label: 'snake',  scale: 1.6 }, b: { emoji: '🐛', label: 'worm',  scale: 0.7 }, winner: 'a', tag: 'longer' },
    { dim: 'length',  q: 'Which is shorter?', a: { emoji: '✏️', label: 'pencil', scale: 1.3 }, b: { emoji: '📏', label: 'ruler', scale: 1.8 }, winner: 'a', tag: 'shorter' },
    { dim: 'height',  q: 'Which is taller?',  a: { emoji: '🦒', label: 'giraffe', scale: 1.8 }, b: { emoji: '🐈', label: 'cat',   scale: 0.9 }, winner: 'a', tag: 'taller' },
    { dim: 'height',  q: 'Which is shorter?', a: { emoji: '🌳', label: 'tree',   scale: 1.7 }, b: { emoji: '🌱', label: 'sprout', scale: 0.6 }, winner: 'b', tag: 'shorter' },
    { dim: 'weight',  q: 'Which is heavier?', a: { emoji: '🐘', label: 'elephant', scale: 1.5 }, b: { emoji: '🐭', label: 'mouse',  scale: 0.6 }, winner: 'a', tag: 'heavier' },
    { dim: 'weight',  q: 'Which is lighter?', a: { emoji: '🪨', label: 'rock',   scale: 1.2 }, b: { emoji: '🪶', label: 'feather', scale: 1.0 }, winner: 'b', tag: 'lighter' },
    { dim: 'amount',  q: 'Which has more?',   a: { emoji: '🍎🍎🍎🍎🍎', label: 'five apples', scale: 1.0 }, b: { emoji: '🍎🍎', label: 'two apples', scale: 1.0 }, winner: 'a', tag: 'more' },
    { dim: 'amount',  q: 'Which has less?',   a: { emoji: '⭐⭐⭐⭐⭐⭐', label: 'six stars',  scale: 1.0 }, b: { emoji: '⭐', label: 'one star',  scale: 1.0 }, winner: 'b', tag: 'less' },
    { dim: 'capacity',q: 'Which holds more?', a: { emoji: '🪣', label: 'bucket', scale: 1.6 }, b: { emoji: '🥃', label: 'cup',    scale: 0.9 }, winner: 'a', tag: 'more' },
    { dim: 'size',    q: 'Which is bigger?',  a: { emoji: '🐳', label: 'whale',  scale: 1.8 }, b: { emoji: '🐟', label: 'fish',   scale: 0.8 }, winner: 'a', tag: 'bigger' },
    { dim: 'size',    q: 'Which is smaller?', a: { emoji: '🌕', label: 'moon',   scale: 1.6 }, b: { emoji: '⭐', label: 'star',   scale: 0.6 }, winner: 'b', tag: 'smaller' }
  ];

  const ROUNDS_PER_SESSION = 8;

  let host = null;
  let order = [];
  let idx = 0;
  let onAttemptFn = null;
  let speakFn = null;
  let onCompleteFn = null;

  function pickSession() {
    const pool = SCENARIOS.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, ROUNDS_PER_SESSION);
  }

  function render() {
    if (!host) return;
    if (idx >= order.length) {
      host.innerHTML = `
        <div class="measure-card measure-done">
          <div class="measure-done-emoji">🎉</div>
          <h1 class="measure-title">Great comparing!</h1>
        </div>
      `;
      if (onAttemptFn) try { onAttemptFn('math-measure-session', true); } catch {}
      setTimeout(() => { if (onCompleteFn) try { onCompleteFn(); } catch {} }, 1500);
      return;
    }
    const s = order[idx];
    // Randomize which side is "a" so the answer position varies
    const flip = Math.random() < 0.5;
    const left  = flip ? s.b : s.a;
    const right = flip ? s.a : s.b;
    const winnerKey = flip ? (s.winner === 'a' ? 'b' : 'a') : s.winner;

    host.innerHTML = `
      <div class="measure-card">
        <div class="measure-progress"><div class="measure-progress-bar" style="width:${((idx+1)/order.length)*100}%"></div></div>
        <h1 class="measure-title">${s.q}</h1>
        <div class="measure-pair">
          <button class="measure-pick" data-side="${flip ? 'b' : 'a'}">
            <span class="measure-emoji" style="transform: scale(${left.scale});">${left.emoji}</span>
            <span class="measure-label">${left.label}</span>
          </button>
          <button class="measure-pick" data-side="${flip ? 'a' : 'b'}">
            <span class="measure-emoji" style="transform: scale(${right.scale});">${right.emoji}</span>
            <span class="measure-label">${right.label}</span>
          </button>
        </div>
      </div>
    `;
    if (speakFn) try { speakFn(s.q, `measure-${s.tag}`); } catch {}
    host.querySelectorAll('.measure-pick').forEach((b) => {
      b.addEventListener('click', () => handlePick(b.dataset.side === winnerKey, b, s));
    });
  }

  function handlePick(correct, btn, scenario) {
    if (correct) {
      btn.classList.add('measure-correct');
      if (onAttemptFn) try { onAttemptFn(`math-measure-${scenario.tag}`, true); } catch {}
      setTimeout(() => { idx++; render(); }, 600);
    } else {
      btn.classList.add('measure-wrong');
      if (onAttemptFn) try { onAttemptFn(`math-measure-${scenario.tag}`, false); } catch {}
      // Pulse the correct one
      setTimeout(() => {
        const right = host.querySelectorAll('.measure-pick');
        right.forEach((b) => {
          if (!b.classList.contains('measure-wrong')) b.classList.add('measure-hint');
        });
        setTimeout(() => { idx++; render(); }, 900);
      }, 250);
    }
  }

  function startMeasure(opts = {}) {
    host = document.getElementById('screen-measure');
    if (!host) return;
    onAttemptFn  = typeof opts.onAttempt  === 'function' ? opts.onAttempt  : null;
    speakFn      = typeof opts.speak      === 'function' ? opts.speak      : null;
    onCompleteFn = typeof opts.onComplete === 'function' ? opts.onComplete : null;
    idx = 0;
    order = pickSession();
    render();
  }
  function stopMeasure() {
    if (host) host.innerHTML = '';
    host = null;
    order = [];
    idx = 0;
    onAttemptFn = speakFn = onCompleteFn = null;
  }

  global.startMeasure = startMeasure;
  global.stopMeasure  = stopMeasure;
})(window);
