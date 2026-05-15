/* ============================================================
   Rhythm — Music-making (v5.25)

   Rammeplan area 3: Kunst, kultur og kreativitet.
   Four-pad instrument with two modes:

     🎵 Jam — free play. Tap pads, hear sounds. No pattern, no
              scoring, no end. Just play. Calm-arcade default for
              ages 2+.

     🎯 Listen & repeat — system plays a pattern (2-5 beats), kid
              taps the same pattern back. Builds rhythmic memory
              + auditory sequencing. Pattern grows with success.

   Each pad has its own WebAudio synthesis (no MP3 samples needed):
     🥁 Drum   — low triangle + quick noise burst
     🔔 Bell   — high sine with metallic harmonic
     🪘 Shaker — short noise envelope, no pitch
     👏 Clap   — short white-noise pop with band-pass

   Records arts-rhythm-jam-tap / arts-rhythm-pattern-correct /
   arts-rhythm-pattern-miss to the parent dashboard.

   Public entry points (window-attached):
     startRhythm(opts)
       opts.onAttempt(skillId, success)
       opts.onComplete()
     stopRhythm()
   ============================================================ */
(function (global) {
  'use strict';

  const PADS = [
    { id: 'drum',   emoji: '🥁', label: 'Drum',   color: '#ef476f' },
    { id: 'bell',   emoji: '🔔', label: 'Bell',   color: '#ffd166' },
    { id: 'shaker', emoji: '🪘', label: 'Shaker', color: '#06d6a0' },
    { id: 'clap',   emoji: '👏', label: 'Clap',   color: '#118ab2' }
  ];

  let audioCtx = null;
  function ctx() {
    if (!audioCtx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (C) audioCtx = new C();
    }
    return audioCtx;
  }
  function unlock() { const c = ctx(); if (c && c.state === 'suspended') c.resume(); }

  /* Per-pad WebAudio synthesis. Each is a tiny envelope on top of an
     oscillator or filtered noise. Tuned to be musical and child-friendly
     (no harsh transients). */
  function playSound(padId) {
    const c = ctx(); if (!c) return;
    const t = c.currentTime;
    if (padId === 'drum') {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(180, t);
      o.frequency.exponentialRampToValueAtTime(50, t + 0.18);
      o.connect(g); g.connect(c.destination);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.25, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.start(t); o.stop(t + 0.25);
    } else if (padId === 'bell') {
      // Bell = fundamental + 2× harmonic for that "ting"
      [880, 1760].forEach((f, i) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        o.connect(g); g.connect(c.destination);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.16 * (i === 0 ? 1 : 0.5), t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
        o.start(t); o.stop(t + 0.6);
      });
    } else if (padId === 'shaker') {
      // White noise burst, brief envelope
      const buf = c.createBuffer(1, c.sampleRate * 0.18, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
      const src = c.createBufferSource();
      src.buffer = buf;
      const filt = c.createBiquadFilter();
      filt.type = 'highpass'; filt.frequency.value = 2500;
      const g = c.createGain();
      src.connect(filt); filt.connect(g); g.connect(c.destination);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      src.start(t); src.stop(t + 0.18);
    } else if (padId === 'clap') {
      // 3 quick noise pops band-passed for a "clap" feel
      for (let i = 0; i < 3; i++) {
        const buf = c.createBuffer(1, c.sampleRate * 0.05, c.sampleRate);
        const data = buf.getChannelData(0);
        for (let j = 0; j < data.length; j++) data[j] = (Math.random() * 2 - 1) * 0.4;
        const src = c.createBufferSource();
        src.buffer = buf;
        const filt = c.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.value = 1500;
        filt.Q.value = 1.2;
        const g = c.createGain();
        src.connect(filt); filt.connect(g); g.connect(c.destination);
        const tt = t + i * 0.015;
        g.gain.setValueAtTime(0.2, tt);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.06);
        src.start(tt); src.stop(tt + 0.07);
      }
    }
  }

  /* ----------- State ----------- */

  let host = null;
  let activeMode = 'jam';        // 'jam' | 'pattern'
  let pattern = [];              // current target pattern (pad ids)
  let playerIdx = 0;
  let patternLen = 2;
  let acceptingTaps = false;
  let onAttemptFn = null;
  let onCompleteFn = null;

  function buildUI() {
    host.innerHTML = `
      <div class="rhythm-tabs">
        <button class="rhythm-tab" data-rhythm-tab="jam"     aria-pressed="true">Jam</button>
        <button class="rhythm-tab" data-rhythm-tab="pattern" aria-pressed="false">Listen &amp; repeat</button>
      </div>
      <div class="rhythm-banner" id="rhythm-banner">Tap a pad to play!</div>
      <div class="rhythm-pads" id="rhythm-pads">
        ${PADS.map((p) => `
          <button type="button" class="rhythm-pad" data-pad="${p.id}"
            style="background:${p.color};"
            aria-label="${p.label}">
            <span class="rhythm-pad-emoji">${p.emoji}</span>
            <span class="rhythm-pad-label">${p.label}</span>
          </button>
        `).join('')}
      </div>
      <div class="rhythm-actions">
        <button class="btn btn-secondary" id="rhythm-replay" hidden>Play it again</button>
        <button class="btn btn-secondary" id="rhythm-done">Done</button>
      </div>
    `;
  }

  function setBanner(text, opts = {}) {
    const b = host?.querySelector('#rhythm-banner');
    if (!b) return;
    b.textContent = text;
    b.classList.toggle('rhythm-banner-active', !!opts.active);
  }

  function pulsePad(padId, dur = 320) {
    const el = host?.querySelector(`.rhythm-pad[data-pad="${padId}"]`);
    if (!el) return;
    el.classList.remove('rhythm-pad-pulse');
    void el.offsetWidth;
    el.classList.add('rhythm-pad-pulse');
    setTimeout(() => el.classList.remove('rhythm-pad-pulse'), dur);
  }

  function onPadTap(padId) {
    unlock();
    pulsePad(padId);
    playSound(padId);
    if (activeMode === 'jam') {
      if (onAttemptFn) try { onAttemptFn('arts-rhythm-jam-tap', true); } catch {}
      return;
    }
    // Pattern mode
    if (!acceptingTaps) return;
    if (pattern[playerIdx] === padId) {
      playerIdx++;
      if (playerIdx >= pattern.length) {
        acceptingTaps = false;
        if (onAttemptFn) try { onAttemptFn(`arts-rhythm-pattern-len-${pattern.length}`, true); } catch {}
        setTimeout(roundComplete, 500);
      }
    } else {
      acceptingTaps = false;
      if (onAttemptFn) try { onAttemptFn(`arts-rhythm-pattern-len-${pattern.length}`, false); } catch {}
      setBanner('Listen again…');
      setTimeout(() => playPattern(pattern), 700);
    }
  }

  async function playPattern(seq) {
    acceptingTaps = false;
    setBanner('Listen…', { active: true });
    await sleep(450);
    for (let i = 0; i < seq.length; i++) {
      const pid = seq[i];
      pulsePad(pid, 280);
      playSound(pid);
      await sleep(520);
    }
    playerIdx = 0;
    acceptingTaps = true;
    setBanner('Your turn — tap the same pattern!', { active: true });
    const replay = host?.querySelector('#rhythm-replay');
    if (replay) replay.hidden = false;
  }

  function roundComplete() {
    setBanner('Great rhythm!');
    patternLen = Math.min(5, patternLen + 1);
    setTimeout(() => startPatternRound(), 1100);
  }

  function startPatternRound() {
    pattern = [];
    for (let i = 0; i < patternLen; i++) {
      const last = pattern[pattern.length - 1];
      let pick;
      do { pick = PADS[Math.floor(Math.random() * PADS.length)].id; }
      while (last && pick === last);
      pattern.push(pick);
    }
    playPattern(pattern);
  }

  function switchMode(mode) {
    activeMode = mode;
    host.querySelectorAll('.rhythm-tab').forEach((b) =>
      b.setAttribute('aria-pressed', b.dataset.rhythmTab === mode ? 'true' : 'false'));
    const replay = host?.querySelector('#rhythm-replay');
    if (replay) replay.hidden = (mode !== 'pattern');
    if (mode === 'jam') {
      acceptingTaps = false;
      pattern = [];
      setBanner('Tap a pad to play!');
    } else {
      patternLen = 2;
      setTimeout(startPatternRound, 350);
    }
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  function startRhythm(opts = {}) {
    host = document.getElementById('screen-rhythm');
    if (!host) { console.warn('Rhythm screen missing'); return; }
    onAttemptFn  = typeof opts.onAttempt  === 'function' ? opts.onAttempt  : null;
    onCompleteFn = typeof opts.onComplete === 'function' ? opts.onComplete : null;
    activeMode = 'jam';
    pattern = [];
    patternLen = 2;
    acceptingTaps = false;

    buildUI();

    host.querySelectorAll('.rhythm-tab').forEach((b) =>
      b.addEventListener('click', () => switchMode(b.dataset.rhythmTab)));
    host.querySelectorAll('.rhythm-pad').forEach((b) =>
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        onPadTap(b.dataset.pad);
      }));
    host.querySelector('#rhythm-replay')?.addEventListener('click', () => {
      if (pattern.length) playPattern(pattern);
    });
    host.querySelector('#rhythm-done')?.addEventListener('click', () => {
      if (onCompleteFn) try { onCompleteFn(); } catch {}
    });
  }

  function stopRhythm() {
    if (host) host.innerHTML = '';
    host = null;
    pattern = [];
    acceptingTaps = false;
    onAttemptFn = null;
    onCompleteFn = null;
  }

  global.startRhythm = startRhythm;
  global.stopRhythm  = stopRhythm;
})(window);
