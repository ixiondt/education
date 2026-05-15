/* ============================================================
   Letters & Numbers — Game Engine  (v5.16 — Letter Lander)

   A small, self-contained canvas + rAF + entity system shared by
   every arcade-style game mode. Designed to add zero external
   dependencies — pure WebAPIs (Canvas 2D, requestAnimationFrame,
   WebAudio), works offline through the existing service worker.

   Globals exposed (window-attached for the vanilla / no-bundle
   architecture the rest of the PWA uses):
     GameEngine, GameEntity, FloatingLetter, ParticleBurst,
     Character, GameSFX, fitCanvasToContainer

   The first game to use this (Letter Lander, ages 4-6) is a
   calm-arcade pilot — gentle drift, soft chimes, no timer / no
   score / no fail state. The engine itself is general-purpose so
   later modes (Number Blaster ages 7-10 etc.) reuse it.

   v5.16 — initial release, paired with game-letter-lander.js.
   ============================================================ */
(function (global) {
  'use strict';

  /* High-DPI canvas sizing. Call after layout changes or on every
     window resize. Canvas backing store gets scaled by devicePixelRatio
     so paths stay crisp on phones. */
  function fitCanvasToContainer(canvas) {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width  = Math.max(1, Math.round(rect.width  * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    // Reset transform first — resize handlers can fire repeatedly
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    return { dpr, width: rect.width, height: rect.height };
  }

  /* ============================================================
     SFX — procedural WebAudio (no MP3 dependencies)

     Each cue is a tiny envelope on top of one or two oscillators.
     Calm-arcade tone palette: sine and triangle waves only, no
     sawtooth/square — keeps the aesthetic gentle even for the
     "wrong" cue. Frequencies hand-tuned to feel encouraging.
     ============================================================ */
  class GameSFX {
    constructor() { this._ctx = null; }
    ctx() {
      if (!this._ctx) {
        const C = window.AudioContext || window.webkitAudioContext;
        if (C) this._ctx = new C();
      }
      return this._ctx;
    }
    /* Resume context — must run inside a user gesture or browsers
       leave audio suspended. Called by the game on first tap. */
    unlock() {
      const c = this.ctx();
      if (c && c.state === 'suspended') c.resume();
    }
    _envelope(osc, gain, t0, dur, peak = 0.18) {
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(peak, t0 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }
    /* Ascending two-note chime: correct answer / success */
    chimeUp() {
      const c = this.ctx(); if (!c) return;
      const t = c.currentTime;
      [
        { f: 660, d: 0.18, off: 0.00 },
        { f: 990, d: 0.28, off: 0.10 }
      ].forEach(({ f, d, off }) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        o.connect(g); g.connect(c.destination);
        this._envelope(o, g, t + off, d, 0.16);
      });
    }
    /* Soft descending tone: "not quite — try again". Deliberately
       not punishing; keep the calm-arcade aesthetic. */
    chimeDown() {
      const c = this.ctx(); if (!c) return;
      const t = c.currentTime;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(440, t);
      o.frequency.exponentialRampToValueAtTime(280, t + 0.3);
      o.connect(g); g.connect(c.destination);
      this._envelope(o, g, t, 0.32, 0.10);
    }
    /* Bright sparkle burst — sprinkle of high frequencies. Plays
       alongside the correct chime for the "magic" feel. */
    sparkle() {
      const c = this.ctx(); if (!c) return;
      const t = c.currentTime;
      [1320, 1760, 2200].forEach((f, i) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        o.connect(g); g.connect(c.destination);
        this._envelope(o, g, t + i * 0.04, 0.12, 0.06);
      });
    }
    /* Sticker collected — warm three-note arpeggio for the end-of-set
       reward. Slightly more elaborate than chimeUp so it feels like
       a milestone, not just another correct answer. */
    sticker() {
      const c = this.ctx(); if (!c) return;
      const t = c.currentTime;
      [
        { f: 660,  d: 0.20, off: 0.00 },
        { f: 880,  d: 0.20, off: 0.12 },
        { f: 1175, d: 0.36, off: 0.24 }
      ].forEach(({ f, d, off }) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        o.connect(g); g.connect(c.destination);
        this._envelope(o, g, t + off, d, 0.14);
      });
    }
    /* v5.17 — arcade-tier cues for Number Blaster.
       Tone palette stays musical (no harsh sawtooth) but with
       sharper attack + a pitch-sweep on the laser so it reads as
       "arcade" without being grating. */
    laser() {
      const c = this.ctx(); if (!c) return;
      const t = c.currentTime;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'square';        // brighter than sine — feels like a zap
      o.frequency.setValueAtTime(1200, t);
      o.frequency.exponentialRampToValueAtTime(220, t + 0.18);
      o.connect(g); g.connect(c.destination);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.07, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.20);
      o.start(t);
      o.stop(t + 0.22);
    }
    /* Soft thump for a wrong answer or losing a life. */
    explosion() {
      const c = this.ctx(); if (!c) return;
      const t = c.currentTime;
      // Mix: low triangle sweep + brief noise burst (via random oscillator FM)
      const o1 = c.createOscillator();
      const g1 = c.createGain();
      o1.type = 'triangle';
      o1.frequency.setValueAtTime(180, t);
      o1.frequency.exponentialRampToValueAtTime(60, t + 0.35);
      o1.connect(g1); g1.connect(c.destination);
      g1.gain.setValueAtTime(0, t);
      g1.gain.linearRampToValueAtTime(0.20, t + 0.01);
      g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      o1.start(t); o1.stop(t + 0.42);
    }
    /* Four ascending notes — level up. */
    levelUp() {
      const c = this.ctx(); if (!c) return;
      const t = c.currentTime;
      [523, 659, 784, 1047].forEach((f, i) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        o.connect(g); g.connect(c.destination);
        this._envelope(o, g, t + i * 0.08, 0.18, 0.14);
      });
    }
    /* Slow descending three-note "game over" tone. Encouraging, not punishing. */
    gameOver() {
      const c = this.ctx(); if (!c) return;
      const t = c.currentTime;
      [659, 523, 392].forEach((f, i) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        o.connect(g); g.connect(c.destination);
        this._envelope(o, g, t + i * 0.18, 0.45, 0.15);
      });
    }
  }

  /* ============================================================
     Base entity. Subclass for floating letters, sparkles, etc.
     Engine calls update(dt) then draw(ctx) every frame; remove
     entities by setting `.alive = false`.
     ============================================================ */
  class GameEntity {
    constructor(x = 0, y = 0) {
      this.x = x;  this.y = y;
      this.vx = 0; this.vy = 0;
      this.alive = true;
      this.tappable = false;
      this.z = 0;     // higher = drawn later (in front)
    }
    update(/* dt, engine */) {}
    draw(/* ctx */) {}
    contains(/* px, py */) { return false; }
    onTap(/* engine */) {}
  }

  /* ============================================================
     The engine — owns canvas, rAF loop, entity list, tap routing.
     ============================================================ */
  class GameEngine {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.entities = [];
      this._running = false;
      this._raf = 0;
      this._lastT = 0;
      this.viewport = { width: 0, height: 0 };
      this.sfx = new GameSFX();
      this._bg = opts.background || '#fdf8ec';  // calm cream
      this._onResize = () => this.resize();
      this._onTap = (e) => this._handleTap(e);
      window.addEventListener('resize', this._onResize);
      this.canvas.addEventListener('pointerdown', this._onTap);
      this.resize();
    }

    resize() {
      const v = fitCanvasToContainer(this.canvas);
      this.viewport = { width: v.width, height: v.height };
    }

    add(entity) { this.entities.push(entity); return entity; }

    /* Filter out dead entities. Cheaper than splice in a loop and
       keeps draw order stable. */
    _sweep() {
      this.entities = this.entities.filter((e) => e.alive);
    }

    start() {
      if (this._running) return;
      this._running = true;
      this._lastT = performance.now();
      const loop = (t) => {
        if (!this._running) return;
        const dt = Math.min(0.05, (t - this._lastT) / 1000); // clamp 50ms (gc spikes)
        this._lastT = t;
        this._tick(dt);
        this._raf = requestAnimationFrame(loop);
      };
      this._raf = requestAnimationFrame(loop);
    }

    stop() {
      this._running = false;
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
    }

    /* Tear down — call when leaving the game screen. Releases the
       resize / pointer listeners and clears the canvas. */
    destroy() {
      this.stop();
      window.removeEventListener('resize', this._onResize);
      this.canvas.removeEventListener('pointerdown', this._onTap);
      const c = this.ctx;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.entities = [];
    }

    _tick(dt) {
      // Update
      for (const e of this.entities) {
        if (e.alive && typeof e.update === 'function') e.update(dt, this);
      }
      this._sweep();
      // Draw — clear, then z-sort, then paint
      const { ctx, viewport } = this;
      ctx.fillStyle = this._bg;
      ctx.fillRect(0, 0, viewport.width, viewport.height);
      const drawn = this.entities.slice().sort((a, b) => a.z - b.z);
      for (const e of drawn) {
        if (e.alive && typeof e.draw === 'function') e.draw(ctx);
      }
    }

    _handleTap(ev) {
      this.sfx.unlock();
      const rect = this.canvas.getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const py = ev.clientY - rect.top;
      // Front-to-back so the topmost tappable wins
      const list = this.entities.slice().sort((a, b) => b.z - a.z);
      for (const e of list) {
        if (e.alive && e.tappable && e.contains(px, py)) {
          e.onTap(this);
          return;
        }
      }
    }
  }

  /* ============================================================
     FloatingLetter — a drifting letter the kid taps. Calm-arcade
     vocabulary: soft pastel disc + bold black glyph. Wraps around
     screen edges so it never disappears.
     ============================================================ */
  class FloatingLetter extends GameEntity {
    constructor(char, x, y, vx, vy, palette = {}) {
      super(x, y);
      this.char = String(char);
      this.vx = vx; this.vy = vy;
      this.r = palette.r || 44;          // disc radius (CSS px)
      this.fill   = palette.fill   || '#fff5d6';
      this.stroke = palette.stroke || '#c69a3f';
      this.glyph  = palette.glyph  || '#3a2e1a';
      this.tappable = true;
      this.z = 10;
      this._wobble = 0;     // current wobble offset (set on wrong tap)
      this._wobbleT = 0;    // ms remaining
      this._scale = 1;
      this._burstT = 0;     // burst animation timer
    }
    update(dt, engine) {
      // Drift + bounce off viewport edges
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const w = engine.viewport.width, h = engine.viewport.height;
      if (this.x < this.r)      { this.x = this.r;      this.vx = Math.abs(this.vx); }
      if (this.x > w - this.r)  { this.x = w - this.r;  this.vx = -Math.abs(this.vx); }
      if (this.y < this.r + 8)  { this.y = this.r + 8;  this.vy = Math.abs(this.vy); }
      if (this.y > h - this.r)  { this.y = h - this.r;  this.vy = -Math.abs(this.vy); }
      // Wobble decay
      if (this._wobbleT > 0) {
        this._wobbleT -= dt;
        this._wobble = Math.sin(this._wobbleT * 28) * 6 * Math.max(0, this._wobbleT / 0.4);
      } else {
        this._wobble = 0;
      }
      // Burst animation — scale up + fade, then die
      if (this._burstT > 0) {
        this._burstT -= dt;
        this._scale = 1 + (0.5 - this._burstT) * 1.2;
        if (this._burstT <= 0) this.alive = false;
      }
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x + this._wobble, this.y);
      ctx.scale(this._scale, this._scale);
      // Soft drop shadow
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.beginPath(); ctx.ellipse(0, this.r * 0.85, this.r * 0.95, this.r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
      // Disc
      ctx.beginPath(); ctx.arc(0, 0, this.r, 0, Math.PI * 2);
      ctx.fillStyle   = this.fill;
      ctx.strokeStyle = this.stroke;
      ctx.lineWidth   = 3;
      ctx.fill(); ctx.stroke();
      // Glyph
      const alpha = this._burstT > 0 ? Math.max(0, this._burstT * 2) : 1;
      ctx.fillStyle = this.glyph;
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${this.r * 1.15}px system-ui, "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.char, 0, 2);
      ctx.restore();
    }
    contains(px, py) {
      const dx = px - this.x, dy = py - this.y;
      return dx*dx + dy*dy <= (this.r + 6) * (this.r + 6);  // +6 fat-finger pad
    }
    wobble() {
      this._wobbleT = 0.4;
    }
    burst() {
      this.tappable = false;
      this._burstT = 0.5;
    }
  }

  /* ============================================================
     ParticleBurst — a one-shot fountain of sparkles. Spawn one at
     a letter's position on correct tap. Fades and removes itself.
     ============================================================ */
  class ParticleBurst extends GameEntity {
    constructor(x, y, opts = {}) {
      super(x, y);
      const n = opts.count || 18;
      this.particles = Array.from({ length: n }, () => {
        const ang = Math.random() * Math.PI * 2;
        const spd = 120 + Math.random() * 220;
        return {
          x: 0, y: 0,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 60,
          life: 0.55 + Math.random() * 0.35,
          age: 0,
          size: 3 + Math.random() * 4,
          hue: opts.hue ?? (35 + Math.random() * 50)  // warm orange/yellow
        };
      });
      this.z = 20;
    }
    update(dt) {
      let anyAlive = false;
      for (const p of this.particles) {
        p.age += dt;
        if (p.age < p.life) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 360 * dt;          // gravity
          p.vx *= (1 - 0.6 * dt);    // drag
          anyAlive = true;
        }
      }
      if (!anyAlive) this.alive = false;
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      for (const p of this.particles) {
        if (p.age >= p.life) continue;
        const t = 1 - (p.age / p.life);
        ctx.fillStyle = `hsla(${p.hue}, 95%, 65%, ${t})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /* ============================================================
     Character — the friendly little lander. Subtle floating idle
     animation, hops on cheer().
     ============================================================ */
  class Character extends GameEntity {
    constructor(x, y, emoji = '🐰') {
      super(x, y);
      this.emoji = emoji;
      this.z = 5;
      this._t = 0;          // idle phase
      this._hopT = 0;       // hop animation timer
    }
    update(dt) {
      this._t += dt;
      if (this._hopT > 0) this._hopT = Math.max(0, this._hopT - dt);
    }
    draw(ctx) {
      const idleY  = Math.sin(this._t * 1.4) * 4;
      const hopY   = this._hopT > 0 ? -Math.sin((0.6 - this._hopT) * Math.PI / 0.6) * 22 : 0;
      ctx.save();
      ctx.translate(this.x, this.y + idleY + hopY);
      ctx.font = '54px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.emoji, 0, 0);
      ctx.restore();
    }
    hop() { this._hopT = 0.6; }
  }

  /* ============================================================
     v5.17 — Number Blaster entities
     ============================================================ */

  /* Spaceship — the player avatar at the bottom of Number Blaster.
     Glides horizontally to align with the most-recently-tapped answer
     before firing a laser at it (visual flair; the tap is what scores).
     The ship doesn't actually need user steering — tap-anywhere is the
     primary interaction. */
  class Spaceship extends GameEntity {
    constructor(x, y) {
      super(x, y);
      this.targetX = x;
      this.z = 8;
      this._t = 0;
      this._fireFlash = 0;
    }
    update(dt) {
      this._t += dt;
      // Glide toward targetX
      const dx = this.targetX - this.x;
      this.x += dx * Math.min(1, dt * 6);
      if (this._fireFlash > 0) this._fireFlash = Math.max(0, this._fireFlash - dt);
    }
    aimAt(x) { this.targetX = x; }
    flash()  { this._fireFlash = 0.15; }
    draw(ctx) {
      const idleY = Math.sin(this._t * 3) * 2;
      ctx.save();
      ctx.translate(this.x, this.y + idleY);
      // Body — soft triangle/diamond, calm-arcade palette
      ctx.fillStyle = this._fireFlash > 0 ? '#ffeaa3' : '#fff5d6';
      ctx.strokeStyle = '#7a5212';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(20, 14);
      ctx.lineTo(10, 18);
      ctx.lineTo(-10, 18);
      ctx.lineTo(-20, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Cockpit
      ctx.fillStyle = '#3a78c2';
      ctx.beginPath();
      ctx.arc(0, -4, 7, 0, Math.PI * 2);
      ctx.fill();
      // Exhaust flame (animated)
      const flameH = 12 + Math.sin(this._t * 18) * 4;
      ctx.fillStyle = 'rgba(255,160,80,0.85)';
      ctx.beginPath();
      ctx.moveTo(-6, 18);
      ctx.lineTo(0, 18 + flameH);
      ctx.lineTo(6, 18);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  /* IncomingAnswer — a number/text disc that falls from the top with
     gravity-feeling acceleration. Subclass of FloatingLetter for the
     visual treatment; physics differ. Owns its `value` for scoring. */
  class IncomingAnswer extends GameEntity {
    constructor(value, x, y, vy, palette = {}) {
      super(x, y);
      this.value = String(value);
      this.vx = 0;
      this.vy = vy;
      this.r = palette.r || 40;
      this.fill   = palette.fill   || '#fff5d6';
      this.stroke = palette.stroke || '#c69a3f';
      this.glyph  = palette.glyph  || '#3a2e1a';
      this.tappable = true;
      this.z = 10;
      this._burstT = 0;
      this._scale = 1;
      this._wobbleT = 0;
      this._wobble = 0;
    }
    update(dt, engine) {
      // Constant downward drift (no gravity acceleration — predictable for kids)
      this.y += this.vy * dt;
      // Wobble decay
      if (this._wobbleT > 0) {
        this._wobbleT -= dt;
        this._wobble = Math.sin(this._wobbleT * 32) * 5 * Math.max(0, this._wobbleT / 0.3);
      } else this._wobble = 0;
      // Burst animation
      if (this._burstT > 0) {
        this._burstT -= dt;
        this._scale = 1 + (0.45 - this._burstT) * 1.3;
        if (this._burstT <= 0) this.alive = false;
      }
      // Off-screen — let the game logic decide (death-by-miss vs. just removed)
      if (this.y - this.r > engine.viewport.height + 10 && this._burstT <= 0) {
        if (typeof this.onMiss === 'function') this.onMiss(this, engine);
        this.alive = false;
      }
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x + this._wobble, this.y);
      ctx.scale(this._scale, this._scale);
      // Drop shadow
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.beginPath();
      ctx.ellipse(0, this.r * 0.85, this.r * 0.95, this.r * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      // Disc
      ctx.fillStyle   = this.fill;
      ctx.strokeStyle = this.stroke;
      ctx.lineWidth   = 3;
      ctx.beginPath();
      ctx.arc(0, 0, this.r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // Number — auto-fit if 2-3 digits
      const len = this.value.length;
      const fontPx = len > 2 ? this.r * 0.78 : this.r * 1.05;
      ctx.fillStyle = this.glyph;
      ctx.globalAlpha = this._burstT > 0 ? Math.max(0, this._burstT * 2.2) : 1;
      ctx.font = `bold ${fontPx}px system-ui, "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.value, 0, 2);
      ctx.restore();
    }
    contains(px, py) {
      const dx = px - this.x, dy = py - this.y;
      return dx*dx + dy*dy <= (this.r + 6) * (this.r + 6);
    }
    burst() { this.tappable = false; this._burstT = 0.45; }
    wobble() { this._wobbleT = 0.3; }
  }

  /* LaserShot — visual-only projectile from spaceship to target.
     Auto-removes when it reaches the target Y. Doesn't affect scoring;
     scoring already happened on the tap. */
  class LaserShot extends GameEntity {
    constructor(x, y, targetX, targetY) {
      super(x, y);
      this.targetX = targetX;
      this.targetY = targetY;
      const dx = targetX - x, dy = targetY - y;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = 1400;       // px/sec — fast, feels like a zap
      this.vx = (dx / dist) * speed;
      this.vy = (dy / dist) * speed;
      this.life = dist / speed + 0.02;
      this.age = 0;
      this.z = 15;
    }
    update(dt) {
      this.age += dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.age >= this.life) this.alive = false;
    }
    draw(ctx) {
      const trailLen = 40;
      const angle = Math.atan2(this.vy, this.vx);
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(angle);
      const grad = ctx.createLinearGradient(-trailLen, 0, 0, 0);
      grad.addColorStop(0, 'rgba(255,200,90,0)');
      grad.addColorStop(1, 'rgba(255,230,120,0.95)');
      ctx.fillStyle = grad;
      ctx.fillRect(-trailLen, -3, trailLen, 6);
      ctx.fillStyle = '#fffac8';
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  // Expose
  global.GameEngine        = GameEngine;
  global.GameEntity        = GameEntity;
  global.FloatingLetter    = FloatingLetter;
  global.ParticleBurst     = ParticleBurst;
  global.Character         = Character;
  global.GameSFX           = GameSFX;
  global.Spaceship         = Spaceship;
  global.IncomingAnswer    = IncomingAnswer;
  global.LaserShot         = LaserShot;
  global.fitCanvasToContainer = fitCanvasToContainer;
})(window);
