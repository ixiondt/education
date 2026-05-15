/* ============================================================
   Number Blaster — full arcade game (v5.17)

   Math Blaster homage. Pedagogical band: skolestart (5-8) and up,
   designed primarily for ages 7-10 (Band C in the K-12 plan).

   Mechanics:
     - A math problem displays at the top: "7 × 6 = ?"
     - Four answer discs descend from the top of the canvas, one
       correct + three plausible distractors (off-by-one, off-by-ten,
       or operator-confused).
     - Tap the correct disc → spaceship at the bottom fires a laser
       at it, the disc bursts, score increments, new problem.
     - Tap a wrong disc → red flash + thump + life lost.
     - Let the correct disc fall off-screen → "missed" tone + life lost.
     - 3 lives. 10 correct answers per level. Speed + range scale up
       each level (problems get harder).
     - Game over → modal with final score + restart / exit.

   Pedagogical guardrails (per ROADMAP § Game modes):
     - No leaderboard. Personal best stored locally per profile only.
     - Score visible (band C+ ready for it), never shown to under-7s
       (we age-gate the mode to ≥7).
     - Failure recoverable in <5 seconds — death just resets the round.
     - Difficulty serves flow: success rate >85% over the last 10
       attempts speeds things up; <40% slows them down.
     - "Calm mode" toggle hides score/lives for stress-sensitive kids.

   Public entry points (window-attached):
     startNumberBlaster(opts)
        opts.operator   : '+' | '-' | '×' | '÷' (default '+')
        opts.calmMode   : bool — hides score/lives, infinite play
        opts.onAttempt(skillId, success) — fired per tap, host records
        opts.onComplete()  — fired on game-over modal exit
     stopNumberBlaster()  — cleanup, called from goHome()

   Like Letter Lander, the module is a pure renderer + game logic.
   Host wires onAttempt for curriculum integration, onComplete for
   navigation.
   ============================================================ */
(function (global) {
  'use strict';

  /* ----------- Math problem generation ----------- */

  /* Per-level number range. Multiplication caps lower than addition
     because times-tables-up-to-12 is the canonical Band C goal. */
  function rangeFor(operator, level) {
    if (operator === '+') return Math.min(10 + level * 5, 99);
    if (operator === '-') return Math.min(10 + level * 5, 99);
    if (operator === '×') return Math.min(5 + level * 1, 12);
    if (operator === '÷') return Math.min(5 + level * 1, 12);
    return 10;
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function makeProblem(operator, level) {
    const N = rangeFor(operator, level);
    let a, b, answer;
    switch (operator) {
      case '+':
        a = randInt(1, N); b = randInt(1, N); answer = a + b; break;
      case '-':
        a = randInt(1, N); b = randInt(0, a); answer = a - b; break;
      case '×':
        a = randInt(2, N); b = randInt(2, N); answer = a * b; break;
      case '÷':
        b = randInt(2, N); answer = randInt(2, N); a = b * answer; break;
      default:
        a = randInt(1, 10); b = randInt(1, 10); answer = a + b;
    }
    return { a, b, op: operator, answer, level };
  }

  /* Plausible-wrong distractors: off-by-one, off-by-ten,
     operator-confused (a+b vs a-b), or digit-swapped. Always returns
     3 unique values that are not equal to the correct answer. */
  function distractors(problem) {
    const { a, b, op, answer } = problem;
    const candidates = new Set([
      answer + 1, answer - 1, answer + 2, answer - 2,
      answer + 10, answer - 10
    ]);
    // Operator-confused (e.g. tapped subtract instead of add)
    if (op === '+') candidates.add(Math.abs(a - b));
    if (op === '-') candidates.add(a + b);
    if (op === '×') candidates.add(a + b);
    if (op === '÷' && b !== 0) candidates.add(a + b);
    // Digit-swap if 2-digit answer (e.g. 12 vs 21)
    if (answer >= 10 && answer <= 99) {
      const swapped = parseInt(String(answer).split('').reverse().join(''), 10);
      if (swapped !== answer) candidates.add(swapped);
    }
    // Filter to positives only, ≠ answer, then sample 3 uniques
    const pool = Array.from(candidates).filter((v) => v >= 0 && v !== answer);
    // If we don't have 3 distractors, pad with random nearby values
    while (pool.length < 6) {
      const padding = answer + randInt(-15, 15);
      if (padding >= 0 && padding !== answer && !pool.includes(padding)) pool.push(padding);
    }
    // Shuffle and take 3
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 3);
  }

  /* ----------- Layout helpers ----------- */

  const PALETTES = [
    { fill: '#fff5d6', stroke: '#c69a3f', glyph: '#3a2e1a' },
    { fill: '#e3f0ff', stroke: '#4a7fbf', glyph: '#1a2a3a' },
    { fill: '#ffe1eb', stroke: '#c45f86', glyph: '#3a1a26' },
    { fill: '#dff3df', stroke: '#549b54', glyph: '#1a3a1a' }
  ];

  /* Fall speed in px/sec. Scales with level, never feels rushed.
     v5.23 — playtest showed L1 was too quick. Start at 35 px/s (was 50)
     and ramp gentler so the first 3 levels feel achievable for a kid
     just learning math facts. */
  function fallSpeedFor(level) {
    return 35 + (level - 1) * 10;   // L1: 35, L2: 45, L3: 55, ... L10: 125
  }

  function spawnRowY(viewport) { return -50; }  // just above viewport

  function laneXs(viewport, n = 4) {
    // 4 vertical lanes spaced evenly
    const w = viewport.width;
    const pad = 60;
    const step = (w - pad * 2) / (n - 1);
    return Array.from({ length: n }, (_, i) => pad + i * step);
  }

  /* ----------- State ----------- */

  const ANSWERS_PER_LEVEL = 10;
  const STARTING_LIVES    = 3;

  let engine = null;
  let ship = null;
  let operator = '+';
  let calmMode = false;
  let level = 1;
  let score = 0;
  let lives = STARTING_LIVES;
  let correctThisLevel = 0;
  let currentProblem = null;
  let activeDiscs = [];       // IncomingAnswer references
  let recentResults = [];     // for DDA
  let gameOver = false;
  let onAttemptFn = null;
  let onCompleteFn = null;
  let hudEls = null;          // cached DOM refs

  /* ----------- HUD ----------- */

  function buildHUD(host) {
    host.innerHTML = `
      <div class="nb-hud">
        <div class="nb-lives" id="nb-lives" aria-label="Lives"></div>
        <div class="nb-problem" id="nb-problem">—</div>
        <div class="nb-stats">
          <div class="nb-score"  id="nb-score">0</div>
          <div class="nb-level"  id="nb-level">L1</div>
        </div>
      </div>
      <div class="nb-toolbar">
        <div class="nb-op-group" id="nb-op-group" role="group" aria-label="Operator">
          <button class="nb-op" data-op="+" aria-pressed="false">+</button>
          <button class="nb-op" data-op="−" data-op-val="-" aria-pressed="false">−</button>
          <button class="nb-op" data-op="×" data-op-val="×" aria-pressed="false">×</button>
          <button class="nb-op" data-op="÷" data-op-val="÷" aria-pressed="false">÷</button>
        </div>
        <button class="nb-calm" id="nb-calm" aria-pressed="false" title="Hide score &amp; lives">Calm</button>
      </div>
    `;
    hudEls = {
      lives:    host.querySelector('#nb-lives'),
      problem:  host.querySelector('#nb-problem'),
      score:    host.querySelector('#nb-score'),
      level:    host.querySelector('#nb-level'),
      opGroup:  host.querySelector('#nb-op-group'),
      calmBtn:  host.querySelector('#nb-calm')
    };
    // Operator click handlers
    hudEls.opGroup.querySelectorAll('.nb-op').forEach((b) => {
      b.addEventListener('click', () => switchOperator(b.dataset.opVal || b.dataset.op));
    });
    hudEls.calmBtn.addEventListener('click', toggleCalm);
    refreshHUD();
  }

  function refreshHUD() {
    if (!hudEls) return;
    hudEls.problem.textContent = currentProblem
      ? `${currentProblem.a} ${currentProblem.op} ${currentProblem.b} = ?`
      : '—';
    hudEls.score.textContent = String(score);
    hudEls.level.textContent = `L${level}`;
    // Hearts
    hudEls.lives.innerHTML = '';
    for (let i = 0; i < STARTING_LIVES; i++) {
      const h = document.createElement('span');
      h.className = 'nb-heart' + (i < lives ? '' : ' lost');
      h.textContent = '♥';
      hudEls.lives.appendChild(h);
    }
    // Calm mode visibility
    hudEls.lives.style.visibility = calmMode ? 'hidden' : 'visible';
    document.querySelector('.nb-stats').style.visibility = calmMode ? 'hidden' : 'visible';
    hudEls.calmBtn.setAttribute('aria-pressed', calmMode ? 'true' : 'false');
    // Operator pressed state
    hudEls.opGroup.querySelectorAll('.nb-op').forEach((b) => {
      const v = b.dataset.opVal || b.dataset.op;
      b.setAttribute('aria-pressed', v === operator ? 'true' : 'false');
    });
  }

  function switchOperator(op) {
    if (!['+', '-', '×', '÷'].includes(op)) return;
    operator = op;
    // Soft reset: clear discs, new problem, keep score/level/lives
    activeDiscs.forEach((d) => d.alive = false);
    activeDiscs = [];
    nextProblem();
  }

  function toggleCalm() {
    calmMode = !calmMode;
    refreshHUD();
  }

  /* ----------- Game flow ----------- */

  function nextProblem() {
    currentProblem = makeProblem(operator, level);
    spawnDiscs(currentProblem);
    refreshHUD();
  }

  function spawnDiscs(problem) {
    if (!engine) return;
    const { width } = engine.viewport;
    const wrongs = distractors(problem);
    const values = [problem.answer, ...wrongs];
    // Shuffle
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    const xs = laneXs(engine.viewport, 4);
    const speed = fallSpeedFor(level);
    values.forEach((v, i) => {
      const palette = PALETTES[i % PALETTES.length];
      const disc = new IncomingAnswer(v, xs[i], spawnRowY(engine.viewport), speed, palette);
      disc.isCorrect = (v === problem.answer);
      disc.onTap = (eng) => handleTap(disc, eng);
      disc.onMiss = (d, eng) => handleOffScreen(d, eng);
      activeDiscs.push(disc);
      engine.add(disc);
    });
  }

  function handleTap(disc, eng) {
    if (gameOver || !disc.alive || !disc.tappable) return;
    // Move + flash the ship toward the disc, fire a laser
    if (ship) {
      ship.aimAt(disc.x);
      ship.flash();
      // Slight delay so the ship visually faces it before the laser appears
      setTimeout(() => {
        if (!engine) return;
        engine.add(new LaserShot(ship.x, ship.y - 22, disc.x, disc.y));
      }, 40);
    }
    eng.sfx.laser();

    const skillId = `math-${operator}-${currentProblem.a}-${currentProblem.b}`;
    if (disc.isCorrect) {
      // Schedule the burst to land roughly when the laser arrives
      setTimeout(() => {
        if (!disc.alive) return;
        eng.add(new ParticleBurst(disc.x, disc.y, { count: 22, hue: 40 }));
        eng.sfx.chimeUp();
        disc.burst();
      }, 90);
      score += 100 * level;
      correctThisLevel++;
      recentResults.push(true);
      if (recentResults.length > 10) recentResults.shift();
      if (onAttemptFn) try { onAttemptFn(skillId, true); } catch {}
      // Clear out the other discs after a beat — they're stale
      setTimeout(() => {
        activeDiscs.forEach((d) => { if (d !== disc) d.alive = false; });
        activeDiscs = [];
        if (correctThisLevel >= ANSWERS_PER_LEVEL) {
          levelUp();
        } else {
          nextProblem();
        }
      }, 350);
    } else {
      // Wrong tap — explosion on the disc, life lost
      setTimeout(() => {
        if (!disc.alive) return;
        eng.add(new ParticleBurst(disc.x, disc.y, { count: 16, hue: 0 }));
        eng.sfx.explosion();
        disc.burst();
      }, 90);
      recentResults.push(false);
      if (recentResults.length > 10) recentResults.shift();
      if (onAttemptFn) try { onAttemptFn(skillId, false); } catch {}
      loseLife();
    }
    refreshHUD();
  }

  function handleOffScreen(disc) {
    if (gameOver) return;
    if (!disc.isCorrect) return;   // missing a distractor is fine
    // Correct answer fell off-screen — life lost
    if (engine) engine.sfx.explosion();
    loseLife();
    // Clear remaining stale discs and re-pose the problem
    activeDiscs.forEach((d) => d.alive = false);
    activeDiscs = [];
    setTimeout(() => { if (!gameOver) nextProblem(); }, 600);
  }

  function loseLife() {
    if (calmMode) return;           // calm mode = infinite lives
    lives--;
    refreshHUD();
    if (lives <= 0) showGameOver();
  }

  function levelUp() {
    level++;
    correctThisLevel = 0;
    if (engine) engine.sfx.levelUp();
    // Brief celebration then next problem
    if (engine) {
      const { width, height } = engine.viewport;
      engine.add(new ParticleBurst(width / 2, height / 2, { count: 30, hue: 50 }));
    }
    setTimeout(() => nextProblem(), 700);
    refreshHUD();
  }

  /* ----------- Game over ----------- */

  function showGameOver() {
    gameOver = true;
    if (engine) engine.sfx.gameOver();
    activeDiscs.forEach((d) => d.alive = false);
    activeDiscs = [];
    // Build a small modal over the canvas — uses the same overlay host
    const host = document.getElementById('number-blaster-overlay');
    if (!host) return;
    const card = document.createElement('div');
    card.className = 'nb-gameover';
    card.innerHTML = `
      <h2>Mission complete!</h2>
      <p class="nb-go-score">Score: <strong>${score}</strong></p>
      <p class="nb-go-level">Reached level <strong>${level}</strong></p>
      <div class="nb-go-actions">
        <button class="btn btn-primary" id="nb-restart">Fly again</button>
        <button class="btn btn-secondary" id="nb-exit">Home</button>
      </div>
    `;
    host.appendChild(card);
    card.querySelector('#nb-restart').addEventListener('click', () => {
      card.remove();
      score = 0;
      lives = STARTING_LIVES;
      level = 1;
      correctThisLevel = 0;
      gameOver = false;
      recentResults = [];
      nextProblem();
      refreshHUD();
    });
    card.querySelector('#nb-exit').addEventListener('click', () => {
      card.remove();
      if (onCompleteFn) try { onCompleteFn(); } catch {}
    });
  }

  /* ----------- Entry ----------- */

  function startNumberBlaster(opts = {}) {
    const canvas  = document.getElementById('number-blaster-canvas');
    const overlay = document.getElementById('number-blaster-overlay');
    if (!canvas || !overlay) {
      console.warn('Number Blaster canvas / overlay missing — bailing.');
      return;
    }
    if (engine) { engine.destroy(); engine = null; }

    operator = opts.operator || '+';
    calmMode = !!opts.calmMode;
    score = 0;
    lives = STARTING_LIVES;
    level = 1;
    correctThisLevel = 0;
    currentProblem = null;
    activeDiscs = [];
    recentResults = [];
    gameOver = false;
    onAttemptFn  = typeof opts.onAttempt  === 'function' ? opts.onAttempt  : null;
    onCompleteFn = typeof opts.onComplete === 'function' ? opts.onComplete : null;

    engine = new GameEngine(canvas, { background: '#0d1b2c' });
    // Override the bg for arcade aesthetic — deep navy with stars
    const { width, height } = engine.viewport;
    // Star sprinkles as static entities (decorative — no logic)
    for (let i = 0; i < 60; i++) {
      const star = new GameEntity(Math.random() * width, Math.random() * height);
      star.z = -1;
      star._size = Math.random() * 1.8 + 0.4;
      star._twinkle = Math.random() * Math.PI * 2;
      star.update = (dt) => { star._twinkle += dt * 2; };
      star.draw = (ctx) => {
        const a = 0.4 + Math.sin(star._twinkle) * 0.4;
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath(); ctx.arc(star.x, star.y, star._size, 0, Math.PI * 2); ctx.fill();
      };
      engine.add(star);
    }
    ship = new Spaceship(width / 2, height - 60);
    engine.add(ship);

    buildHUD(overlay);
    engine.start();
    nextProblem();
  }

  function stopNumberBlaster() {
    if (engine) { engine.destroy(); engine = null; }
    ship = null;
    activeDiscs = [];
    currentProblem = null;
    onAttemptFn = null;
    onCompleteFn = null;
    hudEls = null;
    gameOver = false;
    // Clear any lingering overlay
    const host = document.getElementById('number-blaster-overlay');
    if (host) host.innerHTML = '';
  }

  global.startNumberBlaster = startNumberBlaster;
  global.stopNumberBlaster  = stopNumberBlaster;
})(window);
