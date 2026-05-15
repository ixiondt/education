/* ============================================================
   Stop & Go — Response Inhibition trainer (v5.18)

   EF skill: response inhibition — the canonical Go/No-Go paradigm
   used in neuropsychological testing and adapted here for kid play.
   Reference: Dawson & Guare via Grisham's "Scattered to Focused."

   Mechanics:
     - Discs drift downward from the top. Most are GREEN (Go) —
       tap them. Some are RED (Stop) — DON'T tap them.
     - "Go" tapped correctly: chime + sparkle, +1 (internal).
     - "Stop" tapped (mistake): soft thump + brief pause.
     - "Stop" let through (correct restraint): also +1.
     - "Go" missed (let through): no penalty — just a fresh disc.
     - Speed and Stop:Go ratio gently increase with successful
       restraint. Sessions cap at 60 attempts to keep it short.

   Pedagogical guardrails:
     - No "lives", no game over. Misses are data, not punishment.
     - Stop is harder than Go on purpose — that's the EF training.
     - Calm-arcade aesthetic (sine waves, pastel discs).
     - Kid never sees a number; parent dashboard records hit / miss
       counts per attempt for the inhibition skill.

   Public entry points (window-attached):
     startStopGo(opts)
       opts.onAttempt(skillId, success)
       opts.speak(text)
       opts.onComplete()
     stopStopGo()
   ============================================================ */
(function (global) {
  'use strict';

  // v5.23 — eased for 4-yo playtest. Shorter session, gentler ratio
  // climb (peak at 1-in-3 rather than 1-in-2), slower fall throughout.
  const ATTEMPTS_PER_SESSION = 20;     // was 30
  const INITIAL_STOP_RATIO   = 0.15;   // was 0.20
  const PEAK_STOP_RATIO      = 0.35;   // was 0.45
  const INITIAL_FALL_SPEED   = 45;     // was 65 px/sec
  const PEAK_FALL_SPEED      = 100;    // was 135

  const PALETTE_GO = {
    fill: '#dff3df', stroke: '#3e8a4a', glyph: '#1a3a1a', label: 'GO'
  };
  const PALETTE_STOP = {
    fill: '#ffd6d6', stroke: '#b54b4b', glyph: '#5a1a1a', label: 'STOP'
  };

  /* Disc — extends IncomingAnswer but uses string labels instead of
     numbers, with a clear color signal so even pre-readers can play
     by color alone. */
  function makeDisc(viewport, isStop, fallSpeed) {
    const r = 50;
    const x = r + 20 + Math.random() * (viewport.width - 2 * r - 40);
    const y = -r;
    const palette = isStop ? PALETTE_STOP : PALETTE_GO;
    const d = new IncomingAnswer(palette.label, x, y, fallSpeed, palette);
    d.r = r;
    d.isStop = isStop;
    return d;
  }

  /* ----------- State ----------- */

  let engine = null;
  let attemptsShown = 0;
  let goHits = 0;
  let stopHits = 0;       // correctly restrained
  let goMisses = 0;       // tapped a STOP
  let stopMisses = 0;     // let a GO through (lenient — not punishing)
  let spawnTimer = 0;
  let nextSpawnIn = 0;
  let stopRatio = INITIAL_STOP_RATIO;
  let fallSpeed = INITIAL_FALL_SPEED;
  let activeCount = 0;
  let sessionComplete = false;
  let onAttemptFn = null;
  let speakFn = null;
  let onCompleteFn = null;
  let hudEls = null;

  /* Quiet HUD — just the round count + visible green/red key.
     Score is intentionally hidden from the kid. */
  function buildHUD(host) {
    host.innerHTML = `
      <div class="sg-hud">
        <div class="sg-progress" id="sg-progress" aria-label="Progress">
          <div class="sg-progress-bar" id="sg-progress-bar"></div>
        </div>
        <div class="sg-legend">
          <span class="sg-chip sg-chip-go">Tap GREEN</span>
          <span class="sg-chip sg-chip-stop">Don't tap RED</span>
        </div>
      </div>
    `;
    hudEls = {
      bar: host.querySelector('#sg-progress-bar')
    };
  }

  function refreshHUD() {
    if (!hudEls) return;
    const pct = Math.min(100, (attemptsShown / ATTEMPTS_PER_SESSION) * 100);
    hudEls.bar.style.width = pct + '%';
  }

  /* Spawn cadence: 800ms to 1400ms gaps, narrowing as session progresses.
     Difficulty (speed + stop ratio) ramps similarly. */
  function recalcDifficulty() {
    const p = Math.min(1, attemptsShown / ATTEMPTS_PER_SESSION);
    stopRatio = INITIAL_STOP_RATIO + (PEAK_STOP_RATIO - INITIAL_STOP_RATIO) * p;
    fallSpeed = INITIAL_FALL_SPEED   + (PEAK_FALL_SPEED   - INITIAL_FALL_SPEED) * p;
  }

  function spawnOne() {
    if (!engine || sessionComplete) return;
    if (attemptsShown >= ATTEMPTS_PER_SESSION) {
      // Drain — let any in-flight discs finish, then complete
      if (activeCount === 0) finishSession();
      return;
    }
    recalcDifficulty();
    const isStop = Math.random() < stopRatio;
    const disc = makeDisc(engine.viewport, isStop, fallSpeed);
    activeCount++;
    attemptsShown++;
    refreshHUD();
    disc.onTap = (eng) => handleTap(disc, eng);
    disc.onMiss = (d, eng) => handleOffScreen(d, eng);
    engine.add(disc);
  }

  function handleTap(disc, eng) {
    if (!disc.alive || !disc.tappable) return;
    if (disc.isStop) {
      // Wrong — tapped a STOP
      goMisses++;
      eng.sfx.chimeDown();
      eng.add(new ParticleBurst(disc.x, disc.y, { count: 14, hue: 0 }));
      disc.burst();
      if (onAttemptFn) try { onAttemptFn('ef-response-inhibition', false); } catch {}
    } else {
      // Correct — tapped a GO
      goHits++;
      eng.sfx.chimeUp();
      eng.add(new ParticleBurst(disc.x, disc.y, { count: 18, hue: 110 }));
      disc.burst();
      if (onAttemptFn) try { onAttemptFn('ef-response-inhibition', true); } catch {}
    }
    activeCount--;
  }

  function handleOffScreen(disc, eng) {
    if (disc.isStop) {
      // Correctly restrained from tapping a STOP — credit the kid
      stopHits++;
      // No SFX — quiet success keeps the focus on the next disc
      if (onAttemptFn) try { onAttemptFn('ef-response-inhibition', true); } catch {}
    } else {
      // Missed a GO — neutral, count it but don't punish
      stopMisses++;
      if (onAttemptFn) try { onAttemptFn('ef-response-inhibition', false); } catch {}
    }
    activeCount--;
  }

  function finishSession() {
    sessionComplete = true;
    if (engine) {
      engine.sfx.sticker();
      const { width, height } = engine.viewport;
      engine.add(new ParticleBurst(width / 2, height / 2, { count: 50, hue: 50 }));
    }
    if (speakFn) {
      const total = goHits + stopHits;
      const took = goMisses + stopMisses;
      let praise = 'Great focus!';
      if (took === 0 && total > 0) praise = 'Amazing — you stopped every red one!';
      try { speakFn(praise); } catch {}
    }
    setTimeout(() => { if (onCompleteFn) try { onCompleteFn(); } catch {} }, 1800);
  }

  function tickSpawner(dt) {
    if (sessionComplete) return;
    nextSpawnIn -= dt;
    if (nextSpawnIn <= 0) {
      spawnOne();
      // Gap shrinks gently as difficulty grows
      const p = Math.min(1, attemptsShown / ATTEMPTS_PER_SESSION);
      nextSpawnIn = 1.4 - 0.6 * p + Math.random() * 0.3;
    }
    // Drain check when we've shown them all
    if (attemptsShown >= ATTEMPTS_PER_SESSION && activeCount === 0 && !sessionComplete) {
      finishSession();
    }
  }

  /* ----------- Entry ----------- */

  function startStopGo(opts = {}) {
    const canvas = document.getElementById('stop-go-canvas');
    const overlay = document.getElementById('stop-go-overlay');
    if (!canvas || !overlay) { console.warn('Stop & Go: canvas/overlay missing'); return; }
    if (engine) { engine.destroy(); engine = null; }

    attemptsShown = 0;
    goHits = stopHits = goMisses = stopMisses = 0;
    nextSpawnIn = 0.7;
    activeCount = 0;
    sessionComplete = false;
    stopRatio = INITIAL_STOP_RATIO;
    fallSpeed = INITIAL_FALL_SPEED;
    onAttemptFn  = typeof opts.onAttempt  === 'function' ? opts.onAttempt  : null;
    speakFn      = typeof opts.speak      === 'function' ? opts.speak      : null;
    onCompleteFn = typeof opts.onComplete === 'function' ? opts.onComplete : null;

    engine = new GameEngine(canvas, { background: '#f3f9f3' });

    // Install a per-frame ticker for the spawner. We piggyback on a
    // hidden entity rather than hooking the engine internals.
    const spawnerEntity = new GameEntity(0, 0);
    spawnerEntity.update = (dt) => tickSpawner(dt);
    spawnerEntity.draw = () => {};
    engine.add(spawnerEntity);

    buildHUD(overlay);
    refreshHUD();
    engine.start();
    if (speakFn) try { speakFn('Tap the green ones. Don\'t tap the red ones.'); } catch {}
  }

  function stopStopGo() {
    if (engine) { engine.destroy(); engine = null; }
    attemptsShown = 0;
    activeCount = 0;
    sessionComplete = false;
    onAttemptFn = null;
    speakFn = null;
    onCompleteFn = null;
    hudEls = null;
  }

  global.startStopGo = startStopGo;
  global.stopStopGo  = stopStopGo;
})(window);
