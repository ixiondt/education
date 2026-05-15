/* ============================================================
   Where Is It? — Spatial reasoning (v5.28)

   Rammeplan area 5: Antall, rom og form (spatial sub-domain).
   Trains positional vocabulary: over / under / inside / beside /
   on / in front of.

   Mechanics: a scene with two emojis positioned via CSS to express
   a relation. The kid picks the right preposition from 4 buttons.

   Public entry points (window-attached):
     startWhereIsIt(opts) ; stopWhereIsIt()
   ============================================================ */
(function (global) {
  'use strict';

  /* Each scenario: subject (the moving thing), object (the
     reference), and the relation. CSS class on the scene
     positions the subject correctly. */
  const SCENARIOS = [
    { subj: '🐱', obj: '🪑', relation: 'under',  prompt: 'Where is the cat?' },
    { subj: '🐦', obj: '🌳', relation: 'in',     prompt: 'Where is the bird?' },
    { subj: '🌙', obj: '☁️', relation: 'above',  prompt: 'Where is the moon?' },
    { subj: '🐠', obj: '🪣', relation: 'inside', prompt: 'Where is the fish?' },
    { subj: '🐕', obj: '🏠', relation: 'beside', prompt: 'Where is the dog?' },
    { subj: '🐝', obj: '🌼', relation: 'on',     prompt: 'Where is the bee?' },
    { subj: '🐰', obj: '🥕', relation: 'beside', prompt: 'Where is the rabbit?' },
    { subj: '☀️', obj: '🌳', relation: 'above',  prompt: 'Where is the sun?' },
    { subj: '🐢', obj: '🪨', relation: 'under',  prompt: 'Where is the turtle?' },
    { subj: '🍎', obj: '🥣', relation: 'inside', prompt: 'Where is the apple?' }
  ];

  /* Always show 4 options including the correct one. */
  const ALL_RELATIONS = ['above', 'under', 'inside', 'beside', 'on', 'in'];
  const RELATION_LABELS = {
    above: 'Above', under: 'Under', inside: 'Inside',
    beside: 'Beside', on: 'On top', in: 'In'
  };

  const ROUNDS_PER_SESSION = 6;

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

  function pickChoices(correct) {
    // 3 distractors + correct, shuffled
    const others = ALL_RELATIONS.filter((r) => r !== correct);
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
    const out = [correct, ...others.slice(0, 3)];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function render() {
    if (!host) return;
    if (idx >= order.length) {
      host.innerHTML = `
        <div class="where-card where-done">
          <div class="where-done-emoji">🧭</div>
          <h1 class="where-title">Great noticing!</h1>
        </div>
      `;
      if (onAttemptFn) try { onAttemptFn('math-spatial-session', true); } catch {}
      setTimeout(() => { if (onCompleteFn) try { onCompleteFn(); } catch {} }, 1500);
      return;
    }
    const s = order[idx];
    const choices = pickChoices(s.relation);
    host.innerHTML = `
      <div class="where-card">
        <div class="where-progress"><div class="where-progress-bar" style="width:${((idx+1)/order.length)*100}%"></div></div>
        <h1 class="where-title">${s.prompt}</h1>
        <div class="where-scene where-rel-${s.relation}">
          <span class="where-obj">${s.obj}</span>
          <span class="where-subj">${s.subj}</span>
        </div>
        <div class="where-choices">
          ${choices.map((r) => `
            <button class="where-choice" data-rel="${r}">${RELATION_LABELS[r]}</button>
          `).join('')}
        </div>
      </div>
    `;
    if (speakFn) try { speakFn(s.prompt, `where-${s.relation}`); } catch {}
    host.querySelectorAll('.where-choice').forEach((b) => {
      b.addEventListener('click', () => handlePick(b.dataset.rel === s.relation, b, s));
    });
  }

  function handlePick(correct, btn, scenario) {
    if (correct) {
      btn.classList.add('where-correct');
      if (onAttemptFn) try { onAttemptFn(`math-spatial-${scenario.relation}`, true); } catch {}
      setTimeout(() => { idx++; render(); }, 600);
    } else {
      btn.classList.add('where-wrong');
      if (onAttemptFn) try { onAttemptFn(`math-spatial-${scenario.relation}`, false); } catch {}
      setTimeout(() => {
        const right = host.querySelector(`.where-choice[data-rel="${scenario.relation}"]`);
        if (right) right.classList.add('where-hint');
        setTimeout(() => { idx++; render(); }, 900);
      }, 250);
    }
  }

  function startWhereIsIt(opts = {}) {
    host = document.getElementById('screen-where-is-it');
    if (!host) return;
    onAttemptFn  = typeof opts.onAttempt  === 'function' ? opts.onAttempt  : null;
    speakFn      = typeof opts.speak      === 'function' ? opts.speak      : null;
    onCompleteFn = typeof opts.onComplete === 'function' ? opts.onComplete : null;
    idx = 0;
    order = pickSession();
    render();
  }
  function stopWhereIsIt() {
    if (host) host.innerHTML = '';
    host = null;
    order = [];
    idx = 0;
    onAttemptFn = speakFn = onCompleteFn = null;
  }

  global.startWhereIsIt = startWhereIsIt;
  global.stopWhereIsIt  = stopWhereIsIt;
})(window);
