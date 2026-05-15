/* ============================================================
   Sequence Star — Working Memory trainer (v5.18)

   EF skill: working memory (sequence reproduction).
   Pedagogical reference: Dawson & Guare's executive-function
   framework, popularized for parents in Grisham's
   "Scattered to Focused."

   Mechanics:
     - Four pastel stars arranged in a diamond around the canvas.
     - System "plays" a sequence: each star pulses + plays its own
       musical pitch (C-E-G-C', so the sequence is always pleasant).
     - Kid reproduces the sequence by tapping the stars in order.
     - Correct tap of in-progress sequence: subtle pulse + pitch.
       Correct completion: celebration + sequence grows by 1.
     - Wrong tap: gentle wobble + re-show the same sequence (no
       penalty — this is calm-arcade for EF, not a test).
     - Sequence length starts at 2, grows by 1 each correct round,
       caps at 9 (kindergarten WM ceiling for this paradigm).
     - 5 correct rounds → end-of-session celebration + exit.

   Pedagogical guardrails:
     - No score visible to the kid (parent dashboard records the
       max-length-reached and per-attempt events).
     - Wrong taps are recoverable — re-show instantly, no game-over.
     - All ages: scales naturally because sequence length adapts to
       what the kid succeeds at.

   Public entry points (window-attached):
     startSequenceStar(opts)
        opts.onAttempt(skillId, success)  host records event
        opts.speak(text)                  optional spoken prompt
        opts.onComplete()                 called when session done
     stopSequenceStar()                   teardown for goHome()
   ============================================================ */
(function (global) {
  'use strict';

  /* Star positions are anchor-relative — center of canvas, ±radius.
     Recomputed on resize so the layout follows the viewport. */
  function starAnchors(viewport) {
    const cx = viewport.width  / 2;
    const cy = viewport.height / 2;
    const r  = Math.min(viewport.width, viewport.height) * 0.30;
    return [
      { x: cx,     y: cy - r,  color: '#ffd166', glow: '#ffea9e', tone: 523.25, name: 'C5' }, // top  — yellow
      { x: cx + r, y: cy,      color: '#06d6a0', glow: '#a3f0d6', tone: 659.25, name: 'E5' }, // right — green
      { x: cx,     y: cy + r,  color: '#ef476f', glow: '#fbb5c6', tone: 783.99, name: 'G5' }, // bottom — pink
      { x: cx - r, y: cy,      color: '#118ab2', glow: '#a9d8e4', tone: 1046.5, name: 'C6' }  // left — blue
    ];
  }

  /* A single star entity. Tap routes back to the game logic.
     "pulse(ms)" makes it glow for a beat (used during playback). */
  class StarButton {
    constructor(idx, x, y, color, glow, tone) {
      this.idx = idx;
      this.x = x; this.y = y;
      this.color = color;
      this.glow  = glow;
      this.tone  = tone;
      this.r = 56;
      this.alive = true;
      this.tappable = true;
      this.z = 10;
      this._pulseT = 0;     // pulse animation timer
      this._t = 0;
    }
    update(dt) {
      this._t += dt;
      if (this._pulseT > 0) this._pulseT = Math.max(0, this._pulseT - dt);
    }
    contains(px, py) {
      const dx = px - this.x, dy = py - this.y;
      return dx*dx + dy*dy <= (this.r + 8) * (this.r + 8);
    }
    onTap(eng) {
      if (typeof this._onTap === 'function') this._onTap(this, eng);
    }
    pulse() { this._pulseT = 0.45; }
    draw(ctx) {
      const idle = 1 + Math.sin(this._t * 2 + this.idx) * 0.02;
      const pulse = this._pulseT > 0 ? 1 + this._pulseT * 0.5 : 1;
      const scale = idle * pulse;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(scale, scale);
      // Outer glow when pulsed
      if (this._pulseT > 0) {
        const grd = ctx.createRadialGradient(0, 0, this.r * 0.5, 0, 0, this.r * 2);
        grd.addColorStop(0, this.glow);
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(0, 0, this.r * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // Drop shadow
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.ellipse(0, this.r * 0.85, this.r * 0.95, this.r * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      // Star shape (5-pointed)
      ctx.fillStyle = this._pulseT > 0 ? this.glow : this.color;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a1 = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const a2 = a1 + Math.PI / 5;
        const r1 = this.r;
        const r2 = this.r * 0.45;
        if (i === 0) ctx.moveTo(Math.cos(a1) * r1, Math.sin(a1) * r1);
        else         ctx.lineTo(Math.cos(a1) * r1, Math.sin(a1) * r1);
        ctx.lineTo(Math.cos(a2) * r2, Math.sin(a2) * r2);
      }
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  /* Pure musical pitch via WebAudio — each star has its own note so
     the sequence is melodic. Uses the engine's GameSFX context so we
     don't open a second AudioContext. */
  function playTone(sfx, freq, dur = 0.34) {
    const ctxA = sfx.ctx();
    if (!ctxA) return;
    const t = ctxA.currentTime;
    const o = ctxA.createOscillator();
    const g = ctxA.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    o.connect(g); g.connect(ctxA.destination);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /* ----------- State ----------- */

  const MAX_LENGTH = 9;
  const ROUNDS_PER_SESSION = 5;

  let engine = null;
  let stars = [];           // StarButton[]
  let sequence = [];        // indices into stars[]
  let playerIndex = 0;      // how many of the sequence the kid has reproduced
  let length = 2;           // current target sequence length
  let roundsDone = 0;
  let maxReached = 2;       // record for the parent dashboard
  let acceptingTaps = false;
  let onAttemptFn = null;
  let speakFn = null;
  let onCompleteFn = null;

  function rebuildStars() {
    if (!engine) return;
    const anchors = starAnchors(engine.viewport);
    // Remove old star entities
    for (const e of engine.entities) {
      if (e instanceof StarButton) e.alive = false;
    }
    stars = anchors.map((a, i) => {
      const s = new StarButton(i, a.x, a.y, a.color, a.glow, a.tone);
      s._onTap = (star, eng) => handleStarTap(star.idx, eng);
      engine.add(s);
      return s;
    });
  }

  function generateSequence(len) {
    const out = [];
    for (let i = 0; i < len; i++) {
      // Avoid immediate repeats of the same star to make sequences feel varied
      let next;
      do { next = Math.floor(Math.random() * 4); }
      while (out.length > 0 && next === out[out.length - 1]);
      out.push(next);
    }
    return out;
  }

  async function playSequence(seq) {
    acceptingTaps = false;
    if (!engine) return;
    // Pre-roll beat so the kid knows playback starts
    await sleep(450);
    for (let i = 0; i < seq.length; i++) {
      const s = stars[seq[i]];
      if (!s) continue;
      s.pulse();
      playTone(engine.sfx, s.tone, 0.34);
      await sleep(450);
    }
    playerIndex = 0;
    acceptingTaps = true;
  }

  function handleStarTap(idx, eng) {
    if (!acceptingTaps) return;
    const star = stars[idx];
    star.pulse();
    playTone(eng.sfx, star.tone, 0.22);
    const expected = sequence[playerIndex];
    if (idx === expected) {
      playerIndex++;
      if (playerIndex >= sequence.length) {
        // Round complete
        acceptingTaps = false;
        const skillId = `ef-working-memory-len-${sequence.length}`;
        if (onAttemptFn) try { onAttemptFn(skillId, true); } catch {}
        maxReached = Math.max(maxReached, sequence.length);
        roundsDone++;
        setTimeout(() => celebrateRound(eng), 220);
      }
    } else {
      // Wrong tap — gentle wobble of the expected star, then replay
      acceptingTaps = false;
      eng.sfx.chimeDown();
      if (onAttemptFn) {
        const skillId = `ef-working-memory-len-${sequence.length}`;
        try { onAttemptFn(skillId, false); } catch {}
      }
      // Slight pulse hint on the expected star
      const want = stars[expected];
      if (want) {
        setTimeout(() => want.pulse(), 280);
      }
      setTimeout(() => playSequence(sequence), 900);
    }
  }

  function celebrateRound(eng) {
    eng.sfx.chimeUp();
    eng.sfx.sparkle();
    const { width, height } = eng.viewport;
    eng.add(new ParticleBurst(width / 2, height / 2, { count: 26, hue: 45 }));
    if (roundsDone >= ROUNDS_PER_SESSION) {
      sessionComplete(eng);
      return;
    }
    // Next round — grow sequence length
    length = Math.min(MAX_LENGTH, length + 1);
    setTimeout(() => startRound(), 1200);
  }

  function sessionComplete(eng) {
    eng.sfx.sticker();
    const { width, height } = eng.viewport;
    eng.add(new ParticleBurst(width / 2, height / 2, { count: 50, hue: 50 }));
    if (speakFn) try { speakFn('Nice memory!'); } catch {}
    setTimeout(() => { if (onCompleteFn) try { onCompleteFn(); } catch {} }, 1800);
  }

  function startRound() {
    sequence = generateSequence(length);
    playerIndex = 0;
    playSequence(sequence);
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  /* ----------- Entry ----------- */

  function startSequenceStar(opts = {}) {
    const canvas = document.getElementById('sequence-star-canvas');
    if (!canvas) { console.warn('Sequence Star canvas missing'); return; }
    if (engine) { engine.destroy(); engine = null; }
    onAttemptFn  = typeof opts.onAttempt  === 'function' ? opts.onAttempt  : null;
    speakFn      = typeof opts.speak      === 'function' ? opts.speak      : null;
    onCompleteFn = typeof opts.onComplete === 'function' ? opts.onComplete : null;
    length = 2;
    roundsDone = 0;
    maxReached = 2;

    engine = new GameEngine(canvas, { background: '#fdf8ec' });
    rebuildStars();
    // Rebuild on resize so stars stay correctly anchored
    const origResize = engine.resize.bind(engine);
    engine.resize = function () { origResize(); rebuildStars(); };
    engine.start();

    // Spoken prompt then first round
    if (speakFn) try { speakFn('Watch the stars, then tap them in order.'); } catch {}
    setTimeout(() => startRound(), 1100);
  }

  function stopSequenceStar() {
    if (engine) { engine.destroy(); engine = null; }
    stars = [];
    sequence = [];
    playerIndex = 0;
    acceptingTaps = false;
    onAttemptFn = null;
    speakFn = null;
    onCompleteFn = null;
  }

  global.startSequenceStar = startSequenceStar;
  global.stopSequenceStar  = stopSequenceStar;
})(window);
