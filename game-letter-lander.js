/* ============================================================
   Letter Lander — calm-arcade game (v5.16)

   Pedagogical band: Småbarn → Eldre (toddler through older
   preschool, 18-60 mo). Same letter-recognize / number-recognize
   skills as the existing find-letters / find-numbers modes —
   different DELIVERY, identical curriculum integration.

   Design anchors:
     - No timer, no fail state. Wrong tap = soft wobble + gentle
       descending chime + target letter pulses; correct happens
       at the kid's own pace.
     - Score is tracked through the existing skill-progress
       system (parent dashboard) — never shown to the child.
     - Calm aesthetic: pastel discs, sine-wave SFX, slow drift.
       Visually distinct from the Math-Blaster-style arcade modes
       we'll add later for ages 7+.
     - 4 correct = 1 "set" → sticker reward + brief celebration,
       then either advance to the next set or end and return home.

   Public entry points (window-attached):
     startLetterLander(opts)
        opts.target       : 'letter' | 'number' (default 'letter')
        opts.pickTarget() : returns the next target symbol (e.g. 'A')
        opts.onAttempt(skillId, success) : called on every tap
        opts.speak(text)  : speaks the prompt (uses host voice chain)
        opts.onComplete() : called when the kid finishes the full set
     stopLetterLander()   — teardown, called from goHome()

   The game module is a pure renderer; app.js owns the curriculum
   picker and event recording. Keeps the boundary clean for when we
   add Number Blaster and other games later — they reuse the engine
   without forking into the curriculum internals.
   ============================================================ */
(function (global) {
  'use strict';

  /* Pastel palette for drifting letters. Pick at spawn time so the
     same letter looks different across spawns — gives the canvas
     visual variety without us having to hand-author it. */
  const PALETTES = [
    { fill: '#fff5d6', stroke: '#c69a3f', glyph: '#3a2e1a' }, // honey
    { fill: '#e3f0ff', stroke: '#4a7fbf', glyph: '#1a2a3a' }, // sky
    { fill: '#ffe1eb', stroke: '#c45f86', glyph: '#3a1a26' }, // rose
    { fill: '#dff3df', stroke: '#549b54', glyph: '#1a3a1a' }, // moss
    { fill: '#eee0ff', stroke: '#8a64c2', glyph: '#2a1a3a' }  // lilac
  ];
  const CHARACTERS = ['🐰', '🦊', '🐻', '🐢', '🐨', '🐼', '🦉', '🐧'];

  /* The set is short on purpose — kids in this band have ~10-min
     attention windows and we want them to feel completion. */
  const TARGETS_PER_SET = 4;

  const SETS_TO_OFFER = 2;          // chains 8 targets before sticker break

  /* Returns 3 random distractor symbols (uppercase letters or numbers)
     that aren't the target. The Lander spawns 4 floaters total. */
  function pickDistractors(target, mode, count = 3) {
    const pool = (mode === 'number')
      ? (typeof NUMBERS !== 'undefined' ? NUMBERS : ['0','1','2','3','4','5','6','7','8','9','10'])
      : (typeof LETTERS !== 'undefined' ? LETTERS : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
    const filtered = pool.filter((c) => String(c) !== String(target));
    // Fisher-Yates to count
    const shuffled = filtered.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count);
  }

  function randomVelocity(baseSpeed = 28) {
    const ang = Math.random() * Math.PI * 2;
    return { vx: Math.cos(ang) * baseSpeed, vy: Math.sin(ang) * baseSpeed };
  }

  function randomSpawn(vw, vh, r = 50) {
    return {
      x: r + Math.random() * (vw - 2 * r),
      y: r + 60 + Math.random() * (vh - 2 * r - 120)
    };
  }

  /* Default fallback picker — only used if the host doesn't supply
     opts.pickTarget. Random from the pool. */
  function defaultPickTarget(mode) {
    const pool = mode === 'number'
      ? (typeof NUMBERS !== 'undefined' ? NUMBERS : ['0','1','2','3','4','5','6','7','8','9','10'])
      : (typeof LETTERS !== 'undefined' ? LETTERS : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /* Default speech fallback — calls VoiceEngine directly so the game is
     still audible even if the host forgets to wire opts.speak. */
  function defaultSpeak(text) {
    if (typeof VoiceEngine !== 'undefined') VoiceEngine.speak([text]);
  }

  /* ============================================================
     State machine for one Letter Lander session.
     ============================================================ */
  let engine = null;
  let activeTarget = null;       // current target symbol
  let activeSkillId = null;      // 'letter-recognize-A' etc. for event log
  let setProgress = 0;           // 0..TARGETS_PER_SET
  let setIndex = 0;              // 0..SETS_TO_OFFER-1
  let mode = 'letter';
  let character = null;
  let stickerEl = null;          // overlay tracking sticker fills
  /* Host-supplied callbacks. Defaults run the game in pure preview
     mode if the host wires nothing. */
  let pickTargetFn  = null;
  let onAttemptFn   = null;
  let speakFn       = null;
  let onCompleteFn  = null;

  function clearFloaters() {
    if (!engine) return;
    for (const e of engine.entities) {
      if (e instanceof FloatingLetter) e.alive = false;
    }
  }

  function spawnRound() {
    if (!engine) return;
    activeTarget = String(pickTargetFn ? pickTargetFn() : defaultPickTarget(mode));
    activeSkillId = (mode === 'number' ? 'number-recognize-' : 'letter-recognize-') + activeTarget;
    const distractors = pickDistractors(activeTarget, mode, 3);
    const all = [activeTarget, ...distractors];
    // Shuffle so target isn't always first
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    const { width, height } = engine.viewport;
    all.forEach((char) => {
      const p = randomSpawn(width, height);
      const v = randomVelocity();
      const palette = PALETTES[Math.floor(Math.random() * PALETTES.length)];
      const f = new FloatingLetter(String(char), p.x, p.y, v.vx, v.vy, palette);
      f.target = (String(char) === String(activeTarget));
      f.onTap = (eng) => handleTap(f, eng);
      engine.add(f);
    });
    // Speak the prompt after a short delay so the spawn animation reads
    const promptText = mode === 'number'
      ? `Find the ${activeTarget}.`
      : `Find the letter ${activeTarget}.`;
    setTimeout(() => (speakFn || defaultSpeak)(promptText), 250);
  }

  function handleTap(letter, eng) {
    if (!letter.alive || !letter.tappable) return;
    if (letter.target) {
      // Correct — sparkle, hop, advance after a beat
      eng.sfx.chimeUp();
      eng.sfx.sparkle();
      eng.add(new ParticleBurst(letter.x, letter.y));
      letter.burst();
      if (character) character.hop();
      if (onAttemptFn) try { onAttemptFn(activeSkillId, true); } catch {}

      setProgress++;
      updateStickerCard();

      if (setProgress >= TARGETS_PER_SET) {
        setProgress = 0;
        setIndex++;
        if (setIndex >= SETS_TO_OFFER) {
          // Whole session complete — celebrate then return home
          setTimeout(() => sessionComplete(eng), 700);
          clearFloaters();
          return;
        }
        // Set complete — sticker break, then next set
        setTimeout(() => {
          stickerCelebration(eng);
          clearFloaters();
          setTimeout(() => spawnRound(), 1400);
        }, 500);
      } else {
        // Next target within the same set
        setTimeout(() => {
          clearFloaters();
          spawnRound();
        }, 350);
      }
    } else {
      // Wrong tap — soft wobble, descending chime, no penalty
      eng.sfx.chimeDown();
      letter.wobble();
      if (onAttemptFn) try { onAttemptFn(activeSkillId, false); } catch {}
      // Pulse the target so the kid can see what they're looking for
      const target = eng.entities.find((e) => e instanceof FloatingLetter && e.target);
      if (target) target._scale = 1.2, setTimeout(() => { if (target.alive) target._scale = 1; }, 220);
    }
  }

  function stickerCelebration(eng) {
    if (!eng) return;
    eng.sfx.sticker();
    const { width, height } = eng.viewport;
    eng.add(new ParticleBurst(width / 2, height / 2, { count: 36, hue: 50 }));
    if (character) character.hop();
  }

  function sessionComplete(eng) {
    stickerCelebration(eng);
    setTimeout(() => {
      if (onCompleteFn) try { onCompleteFn(); } catch {}
    }, 1600);
  }

  /* ============================================================
     The sticker card — a small HTML overlay above the canvas
     showing TARGETS_PER_SET * SETS_TO_OFFER cells; fills one per
     correct tap so the kid sees "almost there" progress. Kid sees
     visual progress only, never a score number.
     ============================================================ */
  function buildStickerCard(host) {
    host.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'll-sticker-card';
    const total = TARGETS_PER_SET * SETS_TO_OFFER;
    for (let i = 0; i < total; i++) {
      const s = document.createElement('div');
      s.className = 'll-sticker';
      card.appendChild(s);
    }
    host.appendChild(card);
    stickerEl = card;
  }
  function updateStickerCard() {
    if (!stickerEl) return;
    const filled = setIndex * TARGETS_PER_SET + setProgress;
    const cells = stickerEl.querySelectorAll('.ll-sticker');
    cells.forEach((c, i) => c.classList.toggle('filled', i < filled));
  }

  /* ============================================================
     PUBLIC ENTRY
     ============================================================ */
  function startLetterLander(opts = {}) {
    mode = opts.target === 'number' ? 'number' : 'letter';
    setProgress = 0;
    setIndex = 0;
    // Wire host callbacks (all optional — defaults run a pure preview game)
    pickTargetFn = typeof opts.pickTarget === 'function' ? opts.pickTarget : null;
    onAttemptFn  = typeof opts.onAttempt  === 'function' ? opts.onAttempt  : null;
    speakFn      = typeof opts.speak      === 'function' ? opts.speak      : null;
    onCompleteFn = typeof opts.onComplete === 'function' ? opts.onComplete : null;

    const canvas = document.getElementById('letter-lander-canvas');
    const overlay = document.getElementById('letter-lander-overlay');
    if (!canvas || !overlay) {
      console.warn('Letter Lander canvas / overlay missing — bailing.');
      return;
    }

    // Tear down any previous instance (e.g. quick mode-switch)
    if (engine) { engine.destroy(); engine = null; }

    engine = new GameEngine(canvas, { background: '#fdf8ec' });
    const { width, height } = engine.viewport;
    const charEmoji = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
    character = new Character(width / 2, height - 50, charEmoji);
    engine.add(character);

    buildStickerCard(overlay);
    updateStickerCard();
    engine.start();
    spawnRound();
  }

  function stopLetterLander() {
    if (engine) { engine.destroy(); engine = null; }
    activeTarget = null;
    activeSkillId = null;
    character = null;
    setProgress = 0;
    setIndex = 0;
    if (stickerEl && stickerEl.parentNode) stickerEl.parentNode.innerHTML = '';
    stickerEl = null;
  }

  global.startLetterLander = startLetterLander;
  global.stopLetterLander  = stopLetterLander;
})(window);
