/* ============================================================
   Switch It — Cognitive Flexibility trainer (v5.20)

   EF skill: cognitive flexibility / mental set-shifting.
   Reference: Dimensional Change Card Sort (DCCS) — the standard
   developmental-psych measure for flexibility in preschoolers and
   older kids. Adapted for tap-and-sort gameplay.

   Mechanics:
     - One item at the top has two attributes: COLOR + SHAPE.
       e.g. a red triangle, a yellow circle.
     - Four sort bins along the bottom. A banner says which rule
       is active right now: "Sort by COLOR" or "Sort by SHAPE."
     - Bins update to show the four possible values for the current
       rule (so under "by COLOR" the bins are RED / BLUE / YELLOW /
       GREEN; under "by SHAPE" they're TRIANGLE / CIRCLE / SQUARE /
       STAR).
     - Kid taps the bin matching the active rule. Correct: chime +
       new item. Wrong: chime down + hint pulse on the right bin.
     - Rule switches every 5 correct sorts. Banner flashes when it
       changes — that flash is the whole point of the game (testing
       whether the kid can update their rule).
     - 20 sorts total per session.

   Records skill events under ef-cognitive-flexibility, with extra
   tags distinguishing pre-switch from post-switch correctness.

   Public entry points (window-attached):
     startSwitchIt(opts)
       opts.onAttempt(skillId, success)
       opts.speak(text)
       opts.onComplete()
     stopSwitchIt()
   ============================================================ */
(function (global) {
  'use strict';

  const COLORS = [
    { id: 'red',    label: 'Red',    fill: '#ef476f', stroke: '#a4324f', glyph: '#fff' },
    { id: 'blue',   label: 'Blue',   fill: '#118ab2', stroke: '#0a5a78', glyph: '#fff' },
    { id: 'yellow', label: 'Yellow', fill: '#ffd166', stroke: '#a48438', glyph: '#3a2e1a' },
    { id: 'green',  label: 'Green',  fill: '#06d6a0', stroke: '#067453', glyph: '#fff' }
  ];
  const SHAPES = ['triangle', 'circle', 'square', 'star'];

  const SORTS_PER_SESSION = 20;
  const SWITCH_INTERVAL   = 5;

  /* Renders a shape (triangle/circle/square/star) at (0,0) with a
     given radius. Used by both the "current item" sprite and the
     sort-bin labels in shape-rule mode. */
  function drawShape(ctx, shape, r, fill, stroke) {
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (shape === 'circle') {
      ctx.arc(0, 0, r, 0, Math.PI * 2);
    } else if (shape === 'square') {
      ctx.rect(-r, -r, r * 2, r * 2);
    } else if (shape === 'triangle') {
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.9, r * 0.7);
      ctx.lineTo(-r * 0.9, r * 0.7);
      ctx.closePath();
    } else if (shape === 'star') {
      for (let i = 0; i < 5; i++) {
        const a1 = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const a2 = a1 + Math.PI / 5;
        if (i === 0) ctx.moveTo(Math.cos(a1) * r, Math.sin(a1) * r);
        else         ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
        ctx.lineTo(Math.cos(a2) * r * 0.45, Math.sin(a2) * r * 0.45);
      }
      ctx.closePath();
    }
    ctx.fill(); ctx.stroke();
  }

  class CurrentItem extends GameEntity {
    constructor(x, y, color, shape) {
      super(x, y);
      this.color = color;
      this.shape = shape;
      this.r = 60;
      this.z = 10;
      this._t = 0;
      this._spawnT = 0.3;       // scale-in animation
    }
    setItem(color, shape) {
      this.color = color;
      this.shape = shape;
      this._spawnT = 0.3;
    }
    update(dt) {
      this._t += dt;
      if (this._spawnT > 0) this._spawnT = Math.max(0, this._spawnT - dt);
    }
    draw(ctx) {
      const idle = 1 + Math.sin(this._t * 2) * 0.03;
      const spawn = this._spawnT > 0 ? (1 - this._spawnT / 0.3) : 1;
      const scale = idle * spawn;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(scale, scale);
      drawShape(ctx, this.shape, this.r, this.color.fill, this.color.stroke);
      ctx.restore();
    }
  }

  /* A sort bin — taps route through onTap with the bin's `value`. */
  class SortBin extends GameEntity {
    constructor(x, y, rule, value, color) {
      super(x, y);
      this.rule = rule;       // 'color' | 'shape'
      this.value = value;     // color id or shape name
      this.color = color;     // optional palette ref
      this.w = 110;
      this.h = 90;
      this.tappable = true;
      this.z = 5;
      this._pulseT = 0;
    }
    contains(px, py) {
      return Math.abs(px - this.x) <= this.w / 2 && Math.abs(py - this.y) <= this.h / 2;
    }
    onTap(eng) {
      if (typeof this._onTap === 'function') this._onTap(this, eng);
    }
    pulse() { this._pulseT = 0.5; }
    update(dt) {
      if (this._pulseT > 0) this._pulseT = Math.max(0, this._pulseT - dt);
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      // Bin body
      const pulseScale = 1 + this._pulseT * 0.18;
      ctx.scale(pulseScale, pulseScale);
      ctx.fillStyle   = this._pulseT > 0 ? '#fffac8' : '#fff5d6';
      ctx.strokeStyle = '#7a5212';
      ctx.lineWidth = 3;
      const r = 16;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-this.w/2, -this.h/2, this.w, this.h, r);
      else ctx.rect(-this.w/2, -this.h/2, this.w, this.h);
      ctx.fill(); ctx.stroke();
      // Bin label
      if (this.rule === 'color') {
        // Draw a swatch + label of the color
        drawShape(ctx, 'circle', 24, this.color.fill, this.color.stroke);
        ctx.fillStyle = this.color.glyph;
      } else {
        // Draw the shape in a neutral grey so color isn't the cue
        drawShape(ctx, this.value, 24, '#999', '#333');
      }
      ctx.restore();
    }
  }

  /* ----------- State ----------- */

  let engine = null;
  let activeRule = 'color';      // 'color' or 'shape'
  let currentItem = null;
  let currentColor = null;
  let currentShape = null;
  let bins = [];
  let sortsDone = 0;
  let sortsSinceSwitch = 0;
  let ruleSwitches = 0;
  let onAttemptFn = null;
  let speakFn = null;
  let onCompleteFn = null;
  let banner = null;             // DOM overlay

  function rebuildBins() {
    if (!engine) return;
    // Remove old bins
    for (const e of engine.entities) {
      if (e instanceof SortBin) e.alive = false;
    }
    bins = [];
    const { width, height } = engine.viewport;
    const binY = height - 70;
    const slots = 4;
    const slotW = Math.min(140, width / (slots + 0.5));
    const startX = (width - slotW * slots) / 2 + slotW / 2;
    for (let i = 0; i < slots; i++) {
      const x = startX + i * slotW;
      let bin;
      if (activeRule === 'color') {
        const c = COLORS[i];
        bin = new SortBin(x, binY, 'color', c.id, c);
      } else {
        bin = new SortBin(x, binY, 'shape', SHAPES[i]);
      }
      bin._onTap = (b, eng) => handleBinTap(b, eng);
      bins.push(bin);
      engine.add(bin);
    }
  }

  function rebuildLayout() {
    if (!engine) return;
    const { width, height } = engine.viewport;
    if (currentItem) {
      currentItem.x = width / 2;
      currentItem.y = height * 0.30;
    }
    rebuildBins();
  }

  function pickItem() {
    currentColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    currentShape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    if (currentItem) currentItem.setItem(currentColor, currentShape);
  }

  function setRule(rule, sayIt = true) {
    activeRule = rule;
    sortsSinceSwitch = 0;
    rebuildBins();
    updateBanner();
    if (sayIt && speakFn) {
      try { speakFn(rule === 'color' ? 'Now sort by color.' : 'Now sort by shape.'); } catch {}
    }
  }

  function updateBanner() {
    if (!banner) return;
    banner.textContent = activeRule === 'color' ? 'Sort by COLOR' : 'Sort by SHAPE';
    banner.classList.remove('rule-flash');
    // Force reflow then add the class to retrigger the animation
    void banner.offsetWidth;
    banner.classList.add('rule-flash');
    // v5.23 — also play the levelUp arpeggio so the rule-switch is
    // audibly distinct, not just a brief scale animation
    if (engine) engine.sfx.levelUp();
  }

  function handleBinTap(bin, eng) {
    if (!currentItem || !currentColor || !currentShape) return;
    const expected = activeRule === 'color' ? currentColor.id : currentShape;
    const ok = bin.value === expected;
    if (ok) {
      eng.sfx.chimeUp();
      eng.add(new ParticleBurst(bin.x, bin.y - 30, { count: 14, hue: 110 }));
      bin.pulse();
      sortsDone++;
      sortsSinceSwitch++;
      if (onAttemptFn) try { onAttemptFn(`ef-cognitive-flexibility-${activeRule}`, true); } catch {}
      if (sortsDone >= SORTS_PER_SESSION) {
        sessionComplete();
        return;
      }
      // Rule-switch trigger
      if (sortsSinceSwitch >= SWITCH_INTERVAL) {
        const nextRule = activeRule === 'color' ? 'shape' : 'color';
        ruleSwitches++;
        setTimeout(() => {
          setRule(nextRule);
          pickItem();
        }, 600);
      } else {
        setTimeout(pickItem, 350);
      }
    } else {
      eng.sfx.chimeDown();
      if (onAttemptFn) try { onAttemptFn(`ef-cognitive-flexibility-${activeRule}`, false); } catch {}
      // Pulse the correct bin as a hint
      const want = bins.find((b) => b.value === expected);
      if (want) setTimeout(() => want.pulse(), 200);
    }
  }

  function sessionComplete() {
    if (engine) {
      engine.sfx.sticker();
      const { width, height } = engine.viewport;
      engine.add(new ParticleBurst(width / 2, height / 2, { count: 50, hue: 50 }));
    }
    if (speakFn) try { speakFn('Great switching!'); } catch {}
    setTimeout(() => { if (onCompleteFn) try { onCompleteFn(); } catch {} }, 1600);
  }

  function startSwitchIt(opts = {}) {
    const canvas = document.getElementById('switch-it-canvas');
    const overlay = document.getElementById('switch-it-overlay');
    if (!canvas || !overlay) { console.warn('Switch It: canvas/overlay missing'); return; }
    if (engine) { engine.destroy(); engine = null; }

    sortsDone = 0;
    sortsSinceSwitch = 0;
    ruleSwitches = 0;
    activeRule = 'color';
    onAttemptFn  = typeof opts.onAttempt  === 'function' ? opts.onAttempt  : null;
    speakFn      = typeof opts.speak      === 'function' ? opts.speak      : null;
    onCompleteFn = typeof opts.onComplete === 'function' ? opts.onComplete : null;

    engine = new GameEngine(canvas, { background: '#fdf8ec' });
    const origResize = engine.resize.bind(engine);
    engine.resize = function () { origResize(); rebuildLayout(); };

    const { width, height } = engine.viewport;
    currentItem = new CurrentItem(width / 2, height * 0.30, COLORS[0], 'circle');
    engine.add(currentItem);

    overlay.innerHTML = `<div class="switch-banner" id="switch-banner">Sort by COLOR</div>`;
    banner = overlay.querySelector('#switch-banner');

    rebuildBins();
    pickItem();
    updateBanner();
    engine.start();

    if (speakFn) try { speakFn('Sort by color first.'); } catch {}
  }

  function stopSwitchIt() {
    if (engine) { engine.destroy(); engine = null; }
    currentItem = null;
    bins = [];
    banner = null;
    onAttemptFn = null;
    speakFn = null;
    onCompleteFn = null;
  }

  global.startSwitchIt = startSwitchIt;
  global.stopSwitchIt  = stopSwitchIt;
})(window);
