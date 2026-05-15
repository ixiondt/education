/* ============================================================
   Food Sort — Body, Movement, Food & Health (v5.24)

   Rammeplan area 2 (mat og helse): nutritional awareness without
   moralizing. The framing is Norwegian fem-om-dagen / public-health
   style — three categories of "how often" rather than "good vs bad."

     🥕 Everyday foods (fruits, vegetables, water, milk, grains)
     🍕 Sometimes foods (juice, white bread, pizza)
     🍬 Rare foods (candy, soda, chips)

   The kid sorts items into bins. Wrong taps don't punish — the
   correct bin pulses as a hint. Norwegian early-childhood food
   education is explicitly NOT about restriction; it's about
   noticing patterns and developing self-awareness over time.

   Public entry points (window-attached):
     startFoodSort(opts)
       opts.onAttempt(skillId, success)
       opts.speak(text, key)
       opts.onComplete()
     stopFoodSort()
   ============================================================ */
(function (global) {
  'use strict';

  /* Food bank. Emoji + category. Sourced from Unicode emoji + the
     Norwegian Helsedirektoratet kid-food pyramid (which is a circle,
     not a pyramid, and explicitly avoids ranking). */
  const FOODS = {
    everyday: [
      { emoji: '🍎', name: 'Apple' },
      { emoji: '🥕', name: 'Carrot' },
      { emoji: '🥦', name: 'Broccoli' },
      { emoji: '🍌', name: 'Banana' },
      { emoji: '💧', name: 'Water' },
      { emoji: '🥛', name: 'Milk' },
      { emoji: '🍚', name: 'Rice' },
      { emoji: '🥚', name: 'Egg' },
      { emoji: '🍅', name: 'Tomato' },
      { emoji: '🍓', name: 'Strawberry' },
      { emoji: '🥒', name: 'Cucumber' },
      { emoji: '🫐', name: 'Blueberries' },
      { emoji: '🐟', name: 'Fish' },
      { emoji: '🥜', name: 'Nuts' }
    ],
    sometimes: [
      { emoji: '🍕', name: 'Pizza' },
      { emoji: '🧃', name: 'Juice box' },
      { emoji: '🍞', name: 'White bread' },
      { emoji: '🍝', name: 'Pasta' },
      { emoji: '🥞', name: 'Pancakes' },
      { emoji: '🌭', name: 'Hot dog' },
      { emoji: '🍔', name: 'Burger' }
    ],
    rare: [
      { emoji: '🍬', name: 'Candy' },
      { emoji: '🍪', name: 'Cookie' },
      { emoji: '🍩', name: 'Donut' },
      { emoji: '🍰', name: 'Cake' },
      { emoji: '🍨', name: 'Ice cream' },
      { emoji: '🍫', name: 'Chocolate' },
      { emoji: '🍟', name: 'Chips' },
      { emoji: '🥤', name: 'Soda' }
    ]
  };

  const BIN_DEFS = [
    { id: 'everyday',  emoji: '🥕', label: 'Every day',  hint: 'Foods we eat lots of' },
    { id: 'sometimes', emoji: '🍕', label: 'Sometimes',  hint: 'Foods for special days' },
    { id: 'rare',      emoji: '🍬', label: 'Now & then', hint: 'Foods we taste once in a while' }
  ];

  const ROUNDS_PER_SESSION = 12;

  /* Build a working pool — flat list with category attached. Shuffled
     each session so the same items don't always come up. */
  function buildPool() {
    const out = [];
    for (const cat of Object.keys(FOODS)) {
      for (const f of FOODS[cat]) {
        out.push({ ...f, category: cat });
      }
    }
    // Fisher-Yates
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /* Engine entity wrappers. We reuse the SortBin pattern from
     Switch It — defined inline here so this game is self-contained
     and doesn't require Switch It's classes. */
  class FoodItem extends GameEntity {
    constructor(emoji, x, y) {
      super(x, y);
      this.emoji = emoji;
      this.r = 60;
      this.z = 10;
      this._t = 0;
      this._spawnT = 0.3;
      this._burstT = 0;
    }
    update(dt) {
      this._t += dt;
      if (this._spawnT > 0) this._spawnT = Math.max(0, this._spawnT - dt);
      if (this._burstT > 0) {
        this._burstT -= dt;
        if (this._burstT <= 0) this.alive = false;
      }
    }
    draw(ctx) {
      const idle  = 1 + Math.sin(this._t * 2) * 0.04;
      const spawn = this._spawnT > 0 ? (1 - this._spawnT / 0.3) : 1;
      const burst = this._burstT > 0 ? 1 + (0.45 - this._burstT) * 1.2 : 1;
      const scale = idle * spawn * burst;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(scale, scale);
      // Background disc for clarity
      ctx.fillStyle = '#fff5d6';
      ctx.strokeStyle = '#c69a3f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, this.r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // Emoji
      ctx.font = `${this.r * 1.2}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = this._burstT > 0 ? Math.max(0, this._burstT * 2.2) : 1;
      ctx.fillText(this.emoji, 0, 0);
      ctx.restore();
    }
    burst() { this._burstT = 0.45; }
  }

  class FoodBin extends GameEntity {
    constructor(x, y, def) {
      super(x, y);
      this.def = def;
      this.w = 130;
      this.h = 110;
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
      const scale = 1 + this._pulseT * 0.18;
      ctx.scale(scale, scale);
      // Bin body
      ctx.fillStyle   = this._pulseT > 0 ? '#fffac8' : '#fff5d6';
      ctx.strokeStyle = '#7a5212';
      ctx.lineWidth = 3;
      const r = 16;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-this.w/2, -this.h/2, this.w, this.h, r);
      else ctx.rect(-this.w/2, -this.h/2, this.w, this.h);
      ctx.fill(); ctx.stroke();
      // Emoji
      ctx.font = '36px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.def.emoji, 0, -16);
      // Label
      ctx.font = 'bold 14px system-ui, "Segoe UI", sans-serif';
      ctx.fillStyle = '#3a2e1a';
      ctx.fillText(this.def.label, 0, 22);
      ctx.restore();
    }
  }

  /* ----------- State ----------- */
  let engine = null;
  let pool = [];
  let roundIdx = 0;
  let currentItem = null;
  let bins = [];
  let onAttemptFn = null;
  let speakFn = null;
  let onCompleteFn = null;

  function rebuildBins() {
    if (!engine) return;
    for (const e of engine.entities) {
      if (e instanceof FoodBin) e.alive = false;
    }
    bins = [];
    const { width, height } = engine.viewport;
    const binY = height - 80;
    const slots = BIN_DEFS.length;
    const slotW = Math.min(170, width / (slots + 0.4));
    const startX = (width - slotW * slots) / 2 + slotW / 2;
    BIN_DEFS.forEach((def, i) => {
      const bin = new FoodBin(startX + i * slotW, binY, def);
      bin._onTap = (b, eng) => handleBinTap(b, eng);
      bins.push(bin);
      engine.add(bin);
    });
  }

  function placeNextItem() {
    if (!engine) return;
    if (roundIdx >= ROUNDS_PER_SESSION || roundIdx >= pool.length) {
      sessionComplete();
      return;
    }
    if (currentItem) currentItem.alive = false;
    const food = pool[roundIdx];
    const { width, height } = engine.viewport;
    currentItem = new FoodItem(food.emoji, width / 2, height * 0.30);
    currentItem._food = food;
    engine.add(currentItem);
    if (speakFn) try { speakFn(food.name, `food-${food.name.toLowerCase().replace(/\s+/g, '-')}`); } catch {}
  }

  function handleBinTap(bin, eng) {
    if (!currentItem || !currentItem._food) return;
    const food = currentItem._food;
    const correct = (food.category === bin.def.id);
    if (correct) {
      eng.sfx.chimeUp();
      eng.add(new ParticleBurst(bin.x, bin.y - 30, { count: 14, hue: 110 }));
      bin.pulse();
      currentItem.burst();
      if (onAttemptFn) try { onAttemptFn(`health-food-sort-${food.category}`, true); } catch {}
      roundIdx++;
      setTimeout(placeNextItem, 380);
    } else {
      eng.sfx.chimeDown();
      if (onAttemptFn) try { onAttemptFn(`health-food-sort-${food.category}`, false); } catch {}
      const want = bins.find((b) => b.def.id === food.category);
      if (want) setTimeout(() => want.pulse(), 200);
    }
  }

  function sessionComplete() {
    if (engine) {
      engine.sfx.sticker();
      const { width, height } = engine.viewport;
      engine.add(new ParticleBurst(width / 2, height / 2, { count: 50, hue: 50 }));
    }
    if (speakFn) try { speakFn('Nice sorting!', 'sort-praise'); } catch {}
    setTimeout(() => { if (onCompleteFn) try { onCompleteFn(); } catch {} }, 1600);
  }

  function startFoodSort(opts = {}) {
    const canvas = document.getElementById('food-sort-canvas');
    if (!canvas) { console.warn('Food Sort canvas missing'); return; }
    if (engine) { engine.destroy(); engine = null; }

    pool = buildPool();
    roundIdx = 0;
    onAttemptFn  = typeof opts.onAttempt  === 'function' ? opts.onAttempt  : null;
    speakFn      = typeof opts.speak      === 'function' ? opts.speak      : null;
    onCompleteFn = typeof opts.onComplete === 'function' ? opts.onComplete : null;

    engine = new GameEngine(canvas, { background: '#fdf8ec' });
    // v6.4 — sparse surprise floaters during the sort
    engine.enableSurprises({ minMs: 20000, maxMs: 40000, maxActive: 1 });
    const origResize = engine.resize.bind(engine);
    engine.resize = function () { origResize(); rebuildBins(); };

    rebuildBins();
    placeNextItem();
    engine.start();
  }

  function stopFoodSort() {
    if (engine) { engine.destroy(); engine = null; }
    pool = [];
    roundIdx = 0;
    currentItem = null;
    bins = [];
    onAttemptFn = null;
    speakFn = null;
    onCompleteFn = null;
  }

  global.startFoodSort = startFoodSort;
  global.stopFoodSort  = stopFoodSort;
})(window);
