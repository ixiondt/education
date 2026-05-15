/* ============================================================
   Stargazer — Sustained Attention trainer (v5.20)

   EF skill: sustained attention. The clinical paradigm is the
   Continuous Performance Test (CPT) — watch for a target signal
   over a long duration, ignore distractors, respond when the
   target appears. Here it's reframed as scanning a calm starry
   sky for shooting stars.

   Mechanics:
     - Dark-blue sky with gently twinkling stars (decorative — kid
       must NOT tap these).
     - A telescope character at the bottom-left.
     - At random intervals (every 2-6 seconds) a "shooting star"
       streaks across the sky for ~1.6 seconds. Tap it before it
       leaves to score a hit.
     - Distractors: occasionally a regular star pulses brightly.
       Tapping it = false positive (logged, no penalty visual).
     - If no taps for 18 seconds → gentle re-engagement chime
       (the "vigilance decrement" rescue cue).
     - Session: 90 seconds. Hits / misses / false-positives go to
       the parent dashboard under ef-sustained-attention.

   Pedagogical guardrails:
     - No score visible to the kid; only a quiet timer bar that
       depletes.
     - Misses don't punish — just data.
     - The 18-second re-engagement chime is the friendly nudge, not
       a buzzer.

   Public entry points (window-attached):
     startStargazer(opts)
       opts.onAttempt(skillId, success)
       opts.speak(text)
       opts.onComplete()
     stopStargazer()
   ============================================================ */
(function (global) {
  'use strict';

  // v5.23 — playtest showed 90s was way too long for a 4-yo and 1.6s
  // wasn't enough time to find + tap the shooting star. 45s session
  // with 2.8s shooting-star lifetime + tighter gaps between targets so
  // the kid sees more action in the shorter window.
  const SESSION_DURATION_MS = 45 * 1000;   // was 90s
  const REENGAGE_AFTER_MS   = 12 * 1000;   // was 18s
  const SHOOTING_STAR_LIFE  = 2.8;         // was 1.6s — much longer to react
  const MIN_GAP_MS = 1500;                 // was 2000ms
  const MAX_GAP_MS = 3500;                 // was 6000ms

  /* A drifting decorative star — tapping it is logged as a false
     positive but doesn't visually punish. */
  class DecorStar extends GameEntity {
    constructor(x, y) {
      super(x, y);
      this.r = Math.random() * 1.6 + 0.6;
      this.z = -1;
      this._twinkle = Math.random() * Math.PI * 2;
      this.tappable = true;          // taps go through but get ignored visually
    }
    update(dt) { this._twinkle += dt * 1.8; }
    contains(px, py) {
      const dx = px - this.x, dy = py - this.y;
      return dx*dx + dy*dy <= 12 * 12;       // generous false-positive zone
    }
    onTap(eng) {
      if (typeof this._onTap === 'function') this._onTap(this, eng);
    }
    draw(ctx) {
      const a = 0.4 + Math.sin(this._twinkle) * 0.4;
      ctx.fillStyle = `rgba(255,255,240,${a})`;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  /* The actual target — fast diagonal streak across the sky.
     Has a glow + comet tail for affordance. */
  class ShootingStar extends GameEntity {
    constructor(x, y, vx, vy) {
      super(x, y);
      this.vx = vx;
      this.vy = vy;
      this.r = 22;                  // v5.23 — bumped from 14 (easier for small fingers)
      this.tappable = true;
      this.z = 20;
      this.age = 0;
      this.life = SHOOTING_STAR_LIFE;
    }
    update(dt) {
      this.age += dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.age >= this.life) {
        if (typeof this.onMiss === 'function') this.onMiss(this);
        this.alive = false;
      }
    }
    contains(px, py) {
      const dx = px - this.x, dy = py - this.y;
      return dx*dx + dy*dy <= (this.r + 18) * (this.r + 18);  // v5.23 +18 pad (was +12)
    }
    onTap(eng) {
      if (typeof this._onTap === 'function') this._onTap(this, eng);
    }
    draw(ctx) {
      const angle = Math.atan2(this.vy, this.vx);
      const tail = 90;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(angle);
      // Tail gradient
      const grd = ctx.createLinearGradient(-tail, 0, 0, 0);
      grd.addColorStop(0, 'rgba(255,220,140,0)');
      grd.addColorStop(1, 'rgba(255,250,200,0.95)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(-tail, -5);
      ctx.lineTo(0, -8);
      ctx.lineTo(0,  8);
      ctx.lineTo(-tail, 5);
      ctx.closePath();
      ctx.fill();
      // Head
      const headGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
      headGrd.addColorStop(0, '#fffac8');
      headGrd.addColorStop(0.5, '#ffd166');
      headGrd.addColorStop(1, 'rgba(255,209,102,0)');
      ctx.fillStyle = headGrd;
      ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fffac8';
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  class Telescope extends GameEntity {
    constructor(x, y) {
      super(x, y);
      this.z = 2;
      this._t = 0;
    }
    update(dt) { this._t += dt; }
    draw(ctx) {
      const bob = Math.sin(this._t * 1.3) * 2;
      ctx.save();
      ctx.translate(this.x, this.y + bob);
      ctx.font = '54px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔭', 0, 0);
      ctx.restore();
    }
  }

  /* ----------- State ----------- */

  let engine = null;
  let sessionStart = 0;
  let lastTapTime = 0;
  let lastReengageT = 0;
  let nextSpawnIn = 0;
  let hits = 0;
  let misses = 0;
  let falsePos = 0;
  let onAttemptFn = null;
  let speakFn = null;
  let onCompleteFn = null;
  let timerBar = null;
  let sessionDone = false;

  function buildOverlay(host) {
    host.innerHTML = `
      <div class="sg-stars-hud">
        <div class="sg-stars-progress"><div class="sg-stars-bar" id="sg-stars-bar"></div></div>
      </div>
    `;
    timerBar = host.querySelector('#sg-stars-bar');
  }

  function spawnDecorStars() {
    if (!engine) return;
    const { width, height } = engine.viewport;
    for (let i = 0; i < 100; i++) {
      const s = new DecorStar(Math.random() * width, Math.random() * height * 0.85);
      s._onTap = () => {
        falsePos++;
        if (onAttemptFn) try { onAttemptFn('ef-sustained-attention', false); } catch {}
        lastTapTime = performance.now();
        // No visual punishment — just record. Quiet feedback.
      };
      engine.add(s);
    }
  }

  function spawnShootingStar() {
    if (!engine || sessionDone) return;
    const { width, height } = engine.viewport;
    // Random origin on one of the top edges, trajectory toward the opposite half
    const leftStart = Math.random() < 0.5;
    const startX = leftStart ? -40 : width + 40;
    const startY = Math.random() * height * 0.4 + 30;
    const endX   = leftStart ? width + 40 : -40;
    const endY   = startY + Math.random() * height * 0.5;
    const dx = endX - startX, dy = endY - startY;
    const dist = Math.hypot(dx, dy);
    const speed = dist / SHOOTING_STAR_LIFE;
    const ss = new ShootingStar(startX, startY, dx / dist * speed, dy / dist * speed);
    ss._onTap = (s, eng) => {
      if (!s.alive) return;
      hits++;
      eng.sfx.chimeUp();
      eng.add(new ParticleBurst(s.x, s.y, { count: 18, hue: 50 }));
      s.alive = false;
      lastTapTime = performance.now();
      if (onAttemptFn) try { onAttemptFn('ef-sustained-attention', true); } catch {}
    };
    ss.onMiss = () => {
      misses++;
      if (onAttemptFn) try { onAttemptFn('ef-sustained-attention', false); } catch {}
    };
    engine.add(ss);
  }

  function tick(dt) {
    if (sessionDone) return;
    const now = performance.now();
    const elapsed = now - sessionStart;
    const pct = Math.min(100, (elapsed / SESSION_DURATION_MS) * 100);
    if (timerBar) timerBar.style.width = pct + '%';
    if (elapsed >= SESSION_DURATION_MS) {
      finishSession();
      return;
    }
    // Spawn cadence
    nextSpawnIn -= dt * 1000;
    if (nextSpawnIn <= 0) {
      spawnShootingStar();
      nextSpawnIn = MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS);
    }
    // Re-engagement chime if no taps in REENGAGE_AFTER_MS
    if (now - lastTapTime > REENGAGE_AFTER_MS && now - lastReengageT > REENGAGE_AFTER_MS) {
      if (engine) engine.sfx.sparkle();
      lastReengageT = now;
    }
  }

  function finishSession() {
    sessionDone = true;
    if (engine) {
      engine.sfx.sticker();
      const { width, height } = engine.viewport;
      engine.add(new ParticleBurst(width / 2, height / 2, { count: 50, hue: 50 }));
    }
    if (speakFn) try { speakFn(`Nice watching!`); } catch {}
    setTimeout(() => { if (onCompleteFn) try { onCompleteFn(); } catch {} }, 1800);
  }

  function startStargazer(opts = {}) {
    const canvas = document.getElementById('stargazer-canvas');
    const overlay = document.getElementById('stargazer-overlay');
    if (!canvas || !overlay) { console.warn('Stargazer: canvas/overlay missing'); return; }
    if (engine) { engine.destroy(); engine = null; }

    sessionStart = performance.now();
    lastTapTime = sessionStart;
    lastReengageT = sessionStart;
    nextSpawnIn = MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS);
    hits = misses = falsePos = 0;
    sessionDone = false;
    onAttemptFn  = typeof opts.onAttempt  === 'function' ? opts.onAttempt  : null;
    speakFn      = typeof opts.speak      === 'function' ? opts.speak      : null;
    onCompleteFn = typeof opts.onComplete === 'function' ? opts.onComplete : null;

    engine = new GameEngine(canvas, { background: '#0d1b2c' });
    // v6.4 — surprise floaters (sparingly — Stargazer already has the
    // shooting-star target; we don't want false positives)
    engine.enableSurprises({ minMs: 25000, maxMs: 45000, maxActive: 1 });
    spawnDecorStars();
    const { width, height } = engine.viewport;
    engine.add(new Telescope(60, height - 70));

    // Ticker entity for spawn cadence + reengagement
    const ticker = new GameEntity(0, 0);
    ticker.draw = () => {};
    ticker.update = (dt) => tick(dt);
    engine.add(ticker);

    buildOverlay(overlay);
    engine.start();
    if (speakFn) try { speakFn('Watch the sky. Tap the shooting stars when they fly.'); } catch {}
  }

  function stopStargazer() {
    if (engine) { engine.destroy(); engine = null; }
    sessionDone = false;
    timerBar = null;
    onAttemptFn = null;
    speakFn = null;
    onCompleteFn = null;
  }

  global.startStargazer = startStargazer;
  global.stopStargazer  = stopStargazer;
})(window);
