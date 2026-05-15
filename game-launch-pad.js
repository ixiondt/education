/* ============================================================
   Launch Pad — Task Initiation ritual (v5.18)

   EF skill: task initiation — reducing the friction of "getting
   started." Reference: Grisham's "Scattered to Focused," ch. on
   transitions + starting rituals.

   This isn't a game with a fail/win state — it's a 4-second
   countdown ritual paced to a calm breathing rhythm. Rocket
   launches at zero, transitions the kid into the next activity
   with momentum. Can also run as a stand-alone calming exercise.

   Two modes:
     1. Stand-alone — kid taps "Launch Pad" on home, plays the
        ritual, then returns home. Useful as a transition before
        homework, mealtime, or a tough activity.
     2. Pre-session (future) — surfaced as a Settings option so
        Launch Pad runs before every game mode automatically.
        Hook is in place (opts.onComplete fires next-action) but
        we don't auto-prepend yet — kid agency first.

   Public entry points (window-attached):
     startLaunchPad(opts)
       opts.onComplete()      — called when the launch finishes
       opts.speak(text)       — optional spoken cue
     stopLaunchPad()
   ============================================================ */
(function (global) {
  'use strict';

  let engine = null;
  let onCompleteFn = null;
  let speakFn = null;
  let phase = 'idle';       // idle | counting | launching | done
  let countdownT = 0;       // time in current count
  let countValue = 3;       // 3, 2, 1
  let rocket = null;

  /* The rocket entity: emoji-based for visual warmth, animated
     using simple parameterized motion. */
  class Rocket extends GameEntity {
    constructor(x, y) {
      super(x, y);
      this.baseY = y;
      this.z = 5;
      this._t = 0;
      this._launchT = 0;     // elapsed since launch start
      this.launched = false;
    }
    update(dt) {
      this._t += dt;
      if (this.launched) {
        this._launchT += dt;
        // Accelerate upward
        this.y -= (200 + this._launchT * 400) * dt;
      } else {
        // Idle hover
        this.y = this.baseY + Math.sin(this._t * 3) * 4;
      }
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      // Flame trail when launching
      if (this.launched) {
        const flameH = 60 + Math.sin(this._t * 30) * 12;
        const grd = ctx.createLinearGradient(0, 30, 0, 30 + flameH);
        grd.addColorStop(0, 'rgba(255,200,80,1)');
        grd.addColorStop(0.6, 'rgba(255,90,30,0.6)');
        grd.addColorStop(1, 'rgba(255,90,30,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.moveTo(-18, 30);
        ctx.lineTo(0, 30 + flameH);
        ctx.lineTo(18, 30);
        ctx.closePath();
        ctx.fill();
      }
      // Rocket emoji centered (so it works on every platform without sprites)
      ctx.font = '92px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🚀', 0, 0);
      ctx.restore();
    }
    launch() { this.launched = true; }
  }

  /* Big breathing-paced count overlay. Drawn after rocket so it
     sits on top. */
  class CountdownText extends GameEntity {
    constructor(viewport) {
      super(viewport.width / 2, viewport.height / 2 + 60);
      this.text = '3';
      this.scale = 1;
      this.alpha = 1;
      this.z = 30;
    }
    setValue(v) {
      this.text = String(v);
      this.scale = 1.4;
      this.alpha = 1;
    }
    update(dt) {
      this.scale += (1 - this.scale) * Math.min(1, dt * 4);
      this.alpha -= dt * 0.6;
      if (this.alpha < 0) this.alpha = 0;
    }
    draw(ctx) {
      if (this.alpha <= 0) return;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(this.scale, this.scale);
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = '#3a78c2';
      ctx.font = 'bold 180px system-ui, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.text, 0, 0);
      ctx.restore();
    }
  }

  let countText = null;

  /* Soft countdown tone via WebAudio. Distinct from the in-game
     chimes so the ritual feels different from gameplay. */
  function tickTone(sfx, freq = 440) {
    const ctxA = sfx.ctx(); if (!ctxA) return;
    const t = ctxA.currentTime;
    const o = ctxA.createOscillator();
    const g = ctxA.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    o.connect(g); g.connect(ctxA.destination);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.start(t);
    o.stop(t + 0.45);
  }

  function startLaunchPad(opts = {}) {
    const canvas = document.getElementById('launch-pad-canvas');
    if (!canvas) { console.warn('Launch Pad canvas missing'); return; }
    if (engine) { engine.destroy(); engine = null; }
    onCompleteFn = typeof opts.onComplete === 'function' ? opts.onComplete : null;
    speakFn      = typeof opts.speak      === 'function' ? opts.speak      : null;

    phase = 'counting';
    countValue = 3;

    engine = new GameEngine(canvas, { background: '#fdf8ec' });
    const { width, height } = engine.viewport;

    // Stars background — pure decorative
    for (let i = 0; i < 30; i++) {
      const star = new GameEntity(Math.random() * width, Math.random() * height * 0.5);
      star.z = -1;
      star._size = Math.random() * 1.6 + 0.3;
      star._twinkle = Math.random() * Math.PI * 2;
      star.update = (dt) => { star._twinkle += dt * 2; };
      star.draw = (ctx) => {
        const a = 0.3 + Math.sin(star._twinkle) * 0.3;
        ctx.fillStyle = `rgba(100,100,140,${a})`;
        ctx.beginPath(); ctx.arc(star.x, star.y, star._size, 0, Math.PI * 2); ctx.fill();
      };
      engine.add(star);
    }
    // Rocket on the bottom-center launch pad
    rocket = new Rocket(width / 2, height - 140);
    engine.add(rocket);

    // Static "pad" — a soft rounded rectangle under the rocket
    const pad = new GameEntity(width / 2, height - 80);
    pad.z = 4;
    pad.draw = (ctx) => {
      ctx.save();
      ctx.translate(pad.x, pad.y);
      ctx.fillStyle = '#3a2e1a';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-80, -10, 160, 20, 8) : ctx.rect(-80, -10, 160, 20);
      ctx.fill();
      ctx.restore();
    };
    engine.add(pad);

    countText = new CountdownText(engine.viewport);
    countText.setValue('3');
    engine.add(countText);
    engine.start();

    if (speakFn) try { speakFn('Get ready. Three.'); } catch {}
    tickTone(engine.sfx, 440);

    // v5.23 — paced to a calming inhale rhythm. Was 1.1s/beat — felt
    // rushed for a "settle in" ritual. Now 1.5s/beat. The full ritual
    // is ~6 seconds total which matches a slow-breath count.
    // 3 → 2 → 1 → liftoff
    setTimeout(() => {
      countValue = 2;
      countText.setValue('2');
      if (speakFn) try { speakFn('Two.'); } catch {}
      tickTone(engine.sfx, 494);
    }, 1500);
    setTimeout(() => {
      countValue = 1;
      countText.setValue('1');
      if (speakFn) try { speakFn('One.'); } catch {}
      tickTone(engine.sfx, 554);
    }, 3000);
    setTimeout(() => {
      countText.setValue('GO!');
      if (speakFn) try { speakFn('Lift off!'); } catch {}
      // Engine SFX uses a chimeUp + sparkle blast for celebration
      engine.sfx.levelUp();
      engine.sfx.sparkle();
      rocket.launch();
      phase = 'launching';
      const { width, height } = engine.viewport;
      engine.add(new ParticleBurst(width / 2, height - 100, { count: 40, hue: 30 }));
    }, 4500);

    // After the rocket flies off-screen, signal completion
    setTimeout(() => {
      phase = 'done';
      if (onCompleteFn) try { onCompleteFn(); } catch {}
    }, 6600);
  }

  function stopLaunchPad() {
    if (engine) { engine.destroy(); engine = null; }
    rocket = null;
    countText = null;
    phase = 'idle';
    onCompleteFn = null;
    speakFn = null;
  }

  global.startLaunchPad = startLaunchPad;
  global.stopLaunchPad  = stopLaunchPad;
})(window);
