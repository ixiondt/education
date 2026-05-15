/* ============================================================
   Sort It Out — Recycling / Kildesortering (v5.27)

   Rammeplan area 4: Natur, miljø og teknologi.
   Norwegian *kildesortering* — three-bin source separation:
     ♻️ Resirkulering  — paper, plastic bottle, glass, can, cardboard
     🥬 Kompost (food/garden waste) — apple core, banana peel, leaves
     🗑️ Restavfall (residual)       — chip bag, broken toy, gum

   Pedagogical framing: environmental citizenship as a daily habit,
   not as moral judgement. Norway has near-universal kildesortering
   in homes — this is the everyday-pattern foundation that produces
   it. No "good kid" / "bad kid" — just "what goes where."

   Public entry points (window-attached):
     startSortItOut(opts)
       opts.onAttempt(skillId, success)
       opts.speak(text, key)
       opts.onComplete()
     stopSortItOut()
   ============================================================ */
(function (global) {
  'use strict';

  const ITEMS = {
    recycle: [
      { emoji: '📰', name: 'Newspaper' },
      { emoji: '📦', name: 'Cardboard box' },
      { emoji: '🥫', name: 'Tin can' },
      { emoji: '🍾', name: 'Glass bottle' },
      { emoji: '📄', name: 'Paper' },
      { emoji: '🧴', name: 'Plastic bottle' },
      { emoji: '🍶', name: 'Glass jar' }
    ],
    compost: [
      { emoji: '🍎', name: 'Apple core' },
      { emoji: '🍌', name: 'Banana peel' },
      { emoji: '🥚', name: 'Eggshell' },
      { emoji: '🍂', name: 'Leaves' },
      { emoji: '🥕', name: 'Carrot tops' },
      { emoji: '🥬', name: 'Lettuce' }
    ],
    trash: [
      { emoji: '🍫', name: 'Chip bag' },
      { emoji: '🦷', name: 'Old toothbrush' },
      { emoji: '🧻', name: 'Used tissue' },
      { emoji: '🩹', name: 'Bandage' }
    ]
  };

  const BIN_DEFS = [
    { id: 'recycle', emoji: '♻️', label: 'Recycle',  color: '#118ab2' },
    { id: 'compost', emoji: '🥬', label: 'Compost',  color: '#06d6a0' },
    { id: 'trash',   emoji: '🗑️', label: 'Trash',    color: '#5a5a5a' }
  ];

  const ROUNDS_PER_SESSION = 10;

  function buildPool() {
    const out = [];
    for (const cat of Object.keys(ITEMS)) {
      for (const f of ITEMS[cat]) out.push({ ...f, category: cat });
    }
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /* Inline entities — same pattern as Food Sort but with category-
     colored bins for kildesortering's visual convention. */
  class SortItem extends GameEntity {
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
      const idle = 1 + Math.sin(this._t * 2) * 0.04;
      const spawn = this._spawnT > 0 ? (1 - this._spawnT / 0.3) : 1;
      const burst = this._burstT > 0 ? 1 + (0.45 - this._burstT) * 1.2 : 1;
      const scale = idle * spawn * burst;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(scale, scale);
      ctx.fillStyle = '#fff5d6';
      ctx.strokeStyle = '#c69a3f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, this.r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.font = `${this.r * 1.2}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = this._burstT > 0 ? Math.max(0, this._burstT * 2.2) : 1;
      ctx.fillText(this.emoji, 0, 0);
      ctx.restore();
    }
    burst() { this._burstT = 0.45; }
  }

  class SortBin extends GameEntity {
    constructor(x, y, def) {
      super(x, y);
      this.def = def;
      this.w = 130; this.h = 120;
      this.tappable = true;
      this.z = 5;
      this._pulseT = 0;
    }
    contains(px, py) {
      return Math.abs(px - this.x) <= this.w / 2 && Math.abs(py - this.y) <= this.h / 2;
    }
    onTap(eng) { if (typeof this._onTap === 'function') this._onTap(this, eng); }
    pulse() { this._pulseT = 0.5; }
    update(dt) { if (this._pulseT > 0) this._pulseT = Math.max(0, this._pulseT - dt); }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      const scale = 1 + this._pulseT * 0.18;
      ctx.scale(scale, scale);
      // Color-tinted bin body
      ctx.fillStyle   = this._pulseT > 0 ? this.def.color : '#fff5d6';
      ctx.strokeStyle = this.def.color;
      ctx.lineWidth = 4;
      const r = 16;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-this.w/2, -this.h/2, this.w, this.h, r);
      else ctx.rect(-this.w/2, -this.h/2, this.w, this.h);
      ctx.fill(); ctx.stroke();
      ctx.font = '40px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.def.emoji, 0, -16);
      ctx.font = 'bold 14px system-ui, "Segoe UI", sans-serif';
      ctx.fillStyle = this._pulseT > 0 ? '#fff' : '#3a2e1a';
      ctx.fillText(this.def.label, 0, 30);
      ctx.restore();
    }
  }

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
    for (const e of engine.entities) if (e instanceof SortBin) e.alive = false;
    bins = [];
    const { width, height } = engine.viewport;
    const binY = height - 80;
    const slots = BIN_DEFS.length;
    const slotW = Math.min(170, width / (slots + 0.4));
    const startX = (width - slotW * slots) / 2 + slotW / 2;
    BIN_DEFS.forEach((def, i) => {
      const bin = new SortBin(startX + i * slotW, binY, def);
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
    const item = pool[roundIdx];
    const { width, height } = engine.viewport;
    currentItem = new SortItem(item.emoji, width / 2, height * 0.30);
    currentItem._item = item;
    engine.add(currentItem);
    if (speakFn) try { speakFn(item.name, `nature-${item.name.toLowerCase().replace(/\s+/g, '-')}`); } catch {}
  }

  function handleBinTap(bin, eng) {
    if (!currentItem || !currentItem._item) return;
    const item = currentItem._item;
    const correct = (item.category === bin.def.id);
    if (correct) {
      eng.sfx.chimeUp();
      eng.add(new ParticleBurst(bin.x, bin.y - 30, { count: 14, hue: 130 }));
      bin.pulse();
      currentItem.burst();
      if (onAttemptFn) try { onAttemptFn(`nature-sort-${item.category}`, true); } catch {}
      roundIdx++;
      setTimeout(placeNextItem, 380);
    } else {
      eng.sfx.chimeDown();
      if (onAttemptFn) try { onAttemptFn(`nature-sort-${item.category}`, false); } catch {}
      const want = bins.find((b) => b.def.id === item.category);
      if (want) setTimeout(() => want.pulse(), 200);
    }
  }

  function sessionComplete() {
    if (engine) {
      engine.sfx.sticker();
      const { width, height } = engine.viewport;
      engine.add(new ParticleBurst(width / 2, height / 2, { count: 50, hue: 130 }));
    }
    if (speakFn) try { speakFn('Nice sorting!', 'sort-praise'); } catch {}
    setTimeout(() => { if (onCompleteFn) try { onCompleteFn(); } catch {} }, 1600);
  }

  function startSortItOut(opts = {}) {
    const canvas = document.getElementById('sort-it-out-canvas');
    if (!canvas) { console.warn('Sort It Out canvas missing'); return; }
    if (engine) { engine.destroy(); engine = null; }

    pool = buildPool();
    roundIdx = 0;
    onAttemptFn  = typeof opts.onAttempt  === 'function' ? opts.onAttempt  : null;
    speakFn      = typeof opts.speak      === 'function' ? opts.speak      : null;
    onCompleteFn = typeof opts.onComplete === 'function' ? opts.onComplete : null;

    engine = new GameEngine(canvas, { background: '#f0f8f0' });
    const origResize = engine.resize.bind(engine);
    engine.resize = function () { origResize(); rebuildBins(); };

    rebuildBins();
    placeNextItem();
    engine.start();
  }

  function stopSortItOut() {
    if (engine) { engine.destroy(); engine = null; }
    pool = [];
    roundIdx = 0;
    currentItem = null;
    bins = [];
    onAttemptFn = null;
    speakFn = null;
    onCompleteFn = null;
  }

  global.startSortItOut = startSortItOut;
  global.stopSortItOut  = stopSortItOut;
})(window);
