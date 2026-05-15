/* ============================================================
   Letters & Numbers — main application (v2)
   Depends on globals from letters.js and curriculum.js.
   ============================================================ */

(() => {
  'use strict';

  // ============================================================
  //  STORAGE  —  profiles + active profile
  // ============================================================
  const STORAGE_KEY = 'ln.v2';

  const DEFAULT_SETTINGS = {
    speech:        'both',    // name | sound | both
    speechSpeed:   'normal',  // v5.15 — slow | normal | fast
    theme:         'calm',    // calm | bright
    case:          'upper',   // upper | lower | both
    choices:       '3',
    voiceURI:      '',        // empty = auto-pick
    voiceFingerprint: null,   // v5.13 — { name, lang } — survives URI mismatch across devices
    locale:        'en-US',   // v5.13 — preferred speech locale; filters voice pool
    customAudio:   'auto',    // auto | off — neural Aria MP3 pack (305 files in production)
    sensoryMode:   'normal',  // normal | low (low = fewer sparkles + shorter break cap)
    prereqsMode:   'strict',  // strict | relaxed
    agencyMode:    'auto',    // auto | child — when 'child', kid picks their target at mode start (Rammeplan §5)
    showAllModes:  'off',     // v5.1 — 'on' = ignore age band, show every mode card regardless
    /* v5.13 — One-time banner that nudges the parent to record their own voice
       when the device only has robotic TTS available. Dismissed: never re-shown. */
    roboticVoiceBannerDismissed: false,
    /* v5.22 — pre-session check-in (Scattered to Focused). When 'on', the
       app shows a quick 3-emoji "how are you feeling?" before launching any
       mode (at most once per day per profile). Records to the journal. */
    sessionCheckIn: 'on',
    /* v5.22 — body-break suggestions. When 'on', a 30-second guided micro-
       break modal pops every ~8 min of continuous play. Off-switch is
       available because some kids find break interruptions disruptive. */
    bodyBreaks:    'on'
  };

  function newProfileObject(name, ageMonths) {
    return {
      id: cryptoRandomId(),
      name: (name || 'Friend').slice(0, 30).trim() || 'Friend',
      ageMonths: clampAgeMonths(ageMonths),
      createdAt: new Date().toISOString(),
      settings: { ...DEFAULT_SETTINGS },
      progress: { skills: {}, events: [], sessions: [] },
      streaks:   { current: 0, longest: 0, lastPlayedDate: null },
      /* v3.3 — interest map drives the curriculum picker per Rammeplan §5
         "children's right to participation". Symbol uppercase → tap count. */
      interests: {}
    };
  }

  /* Add v3-shape fields to any older profile without breaking v2 storage. */
  function healProfileV3(p) {
    p.settings    = { ...DEFAULT_SETTINGS, ...(p.settings || {}) };
    p.progress    = p.progress || {};
    p.progress.skills   ||= {};
    p.progress.events   ||= [];
    p.progress.sessions ||= [];
    p.streaks   ||= { current: 0, longest: 0, lastPlayedDate: null };
    p.interests ||= {};        // v3.3 — interest-aware picker
    p.ageMonths = clampAgeMonths(p.ageMonths);

    /* v5.13 — neural Aria MP3 pack (305 files) is now deployed to production,
       so customAudio defaults to 'auto'. Profiles that were force-flipped to
       'off' by the v5.1 migration get flipped back to 'auto' so they hear
       the nice voice again, unless they've explicitly opted into 'off' since
       (signaled by a separate timestamp flag we now set when they touch it). */
    if (p.settings.__customAudioMigrated && p.settings.customAudio === 'off'
        && !p.settings.__customAudioUserChosenOff) {
      p.settings.customAudio = 'auto';
    }
    p.settings.__customAudioMigrated = true;

    return p;
  }

  function cryptoRandomId() {
    try {
      if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    } catch {}
    const a = new Uint8Array(16);
    (crypto?.getRandomValues || ((x) => x.forEach((_, i, arr) => (arr[i] = Math.floor(Math.random() * 256)))))(a);
    return [...a].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  }

  function clampAgeMonths(m) {
    const n = typeof m === 'number' ? m : parseInt(m, 10);
    if (!Number.isFinite(n)) return 48;
    return Math.max(18, Math.min(120, n));
  }

  function loadStorage() {
    // Try v2
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.profiles)) {
          /* Heal, and detect whether anything changed. If so, persist
             immediately so the migration is durable even if the user
             never makes another action this session. */
          const before = JSON.stringify(data);
          data.profiles.forEach(healProfileV3);
          if (!data.activeProfileId && data.profiles.length) data.activeProfileId = data.profiles[0].id;
          if (JSON.stringify(data) !== before) {
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
          }
          return data;
        }
      }
    } catch {}
    // Migrate v1 if present
    const migrated = migrateFromV1();
    if (migrated) return migrated;
    return { profiles: [], activeProfileId: null };
  }

  function saveStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        profiles: state.profiles,
        activeProfileId: state.activeProfileId
      }));
    } catch {}
  }

  function migrateFromV1() {
    let v1settings = null, v1progress = null;
    try { const s = localStorage.getItem('ln.settings'); if (s) v1settings = JSON.parse(s); } catch {}
    try { const p = localStorage.getItem('ln.progress'); if (p) v1progress = JSON.parse(p); } catch {}
    if (!v1settings && !v1progress) return null;

    const profile = newProfileObject('My child', 48);
    if (v1settings) profile.settings = { ...DEFAULT_SETTINGS, ...v1settings };

    if (v1progress) {
      const now = Date.now();
      for (const [letter, t] of Object.entries(v1progress.letters || {})) {
        if (t.correct) profile.progress.skills[`letter-recognize-${letter}`] = {
          successes: t.correct, attempts: t.correct + (t.wrong || 0), lastSeen: now
        };
        if (t.traced) profile.progress.skills[`letter-trace-${letter}`] = {
          successes: t.traced, attempts: t.traced, lastSeen: now
        };
      }
      for (const [num, t] of Object.entries(v1progress.numbers || {})) {
        if (t.correct) profile.progress.skills[`number-recognize-${num}`] = {
          successes: t.correct, attempts: t.correct + (t.wrong || 0), lastSeen: now
        };
        if (t.traced) profile.progress.skills[`number-trace-${num}`] = {
          successes: t.traced, attempts: t.traced, lastSeen: now
        };
      }
    }

    return { profiles: [profile], activeProfileId: profile.id };
  }

  // ============================================================
  //  v3 — date / streak / event helpers
  // ============================================================
  function todayString(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function daysBetween(aStr, bStr) {
    const a = new Date(aStr + 'T00:00:00');
    const b = new Date(bStr + 'T00:00:00');
    return Math.round((b - a) / 86400000);
  }

  function bumpStreaks(profile) {
    const today = todayString();
    profile.streaks ||= { current: 0, longest: 0, lastPlayedDate: null };
    if (profile.streaks.lastPlayedDate === today) return;
    if (!profile.streaks.lastPlayedDate) {
      profile.streaks.current = 1;
    } else {
      const diff = daysBetween(profile.streaks.lastPlayedDate, today);
      profile.streaks.current = diff === 1 ? profile.streaks.current + 1 : 1;
    }
    profile.streaks.longest = Math.max(profile.streaks.longest, profile.streaks.current);
    profile.streaks.lastPlayedDate = today;
  }

  function rollupSession(profile, success, durationMs, mode) {
    const today = todayString();
    profile.progress.sessions ||= [];
    let entry = profile.progress.sessions.find((s) => s.date === today);
    if (!entry) {
      entry = { date: today, attempts: 0, successes: 0, durationMs: 0, modes: [] };
      profile.progress.sessions.push(entry);
    }
    entry.attempts++;
    if (success) entry.successes++;
    entry.durationMs += durationMs || 0;
    if (mode && !entry.modes.includes(mode)) entry.modes.push(mode);
  }

  /* Cap stored events to prevent localStorage bloat. We keep the last 1000;
     anything older is already rolled up into sessions[]. */
  const EVENT_CAP = 1000;
  function trimEvents(profile) {
    if (profile.progress.events.length > EVENT_CAP + 100) {
      profile.progress.events = profile.progress.events.slice(-EVENT_CAP);
    }
  }

  /**
   * Single entry-point for every "kid answered" event.
   * Records to skill progress + appends to event log + rolls up to today's
   * session + bumps streak + saves storage. Called from every mode handler.
   */
  function recordAttempt(skillId, success, durationMs = 0) {
    const profile = activeProfile();
    if (!profile) return;

    // Track first-time mastery transition for the skill detail view
    const skill = SKILLS_BY_ID[skillId];
    const wasMastered = skill ? isSkillMastered(skill, profile) : false;

    recordSkillAttempt(profile, skillId, success);

    // v3.3 — every interaction expresses interest. Bump the interest map
    // for the target symbol so the picker biases toward what the child
    // already gravitates toward (Rammeplan §5).
    if (skill?.target) {
      profile.interests = profile.interests || {};
      const key = String(skill.target).toUpperCase();
      profile.interests[key] = (profile.interests[key] || 0) + 1;
    }

    profile.progress.events ||= [];
    const event = {
      skillId,
      success,
      ts: Date.now(),
      durationMs: Math.max(0, Math.min(durationMs, 60000)),
      mode: state.mode
    };
    profile.progress.events.push(event);
    trimEvents(profile);
    // v6.0 — mirror to the sync outbox (no-op when sync disabled or not signed in)
    if (typeof Sync !== 'undefined' && Sync.enqueue) Sync.enqueue(event);

    rollupSession(profile, success, durationMs, state.mode);
    bumpStreaks(profile);

    // Snapshot mastered-at timestamp on the transition (used for fade indicator)
    if (skill && !wasMastered && isSkillMastered(skill, profile)) {
      const slot = profile.progress.skills[skillId];
      if (slot && !slot.masteredAt) slot.masteredAt = Date.now();
    }

    saveStorage();
    maybeSuggestBreak();
  }

  // ============================================================
  //  STATE
  // ============================================================
  const _store = loadStorage();
  const state = {
    mode: null,                      // find-letters | find-numbers | trace-letters | trace-numbers | count | sounds
    target: null,
    currentSkill: null,
    lastSkillId: null,
    profiles: _store.profiles,
    activeProfileId: _store.activeProfileId,
    advancing: false,
    tracer: null,

    // v3 session tracking (in-memory; reset on goHome)
    sessionStartedAt: 0,
    roundStartedAt: 0,
    breakSuggested: false,

    // v3.1 — wrong-answer UX
    wrongInRound: 0,
    hintTimer: null,

    // v5.1 — daily session state (in-memory pointer to profile.dailySession)
    session: null
  };

  function clearHintTimer() {
    if (state.hintTimer) { clearTimeout(state.hintTimer); state.hintTimer = null; }
  }

  function setPulse(element, on) {
    if (!element) return;
    if (on) element.classList.add('hint-pulse');
    else    element.classList.remove('hint-pulse');
  }

  /* Schedule a gentle delayed hint. If they tap before it fires it's
     cleared. In the MP3-pack era we no longer speak a TTS "Try again"
     phrase — that brought back the robotic local voice in modes that
     otherwise use MP3 Aria. The hint is now a silent 3-second pause
     followed by a target re-cue (which uses the full MP3/IDB/TTS
     priority chain via sayLetter / sayNumber / sayWord). */
  function scheduleHint(_bankKey, _vars, sayTargetFn) {
    clearHintTimer();
    state.hintTimer = setTimeout(() => {
      state.hintTimer = null;
      if (state.advancing) return;
      if (sayTargetFn) sayTargetFn();
    }, 3000);
  }

  function roundDuration() {
    return state.roundStartedAt ? Date.now() - state.roundStartedAt : 0;
  }

  function startNewSession() {
    state.sessionStartedAt = Date.now();
    state.breakSuggested = false;
  }

  function sessionCapMs() {
    // sensoryMode 'low' = shorter cap; 'normal' = longer; never zero (always offer a break)
    return profileSettings().sensoryMode === 'low' ? 8 * 60 * 1000 : 15 * 60 * 1000;
  }

  function maybeSuggestBreak() {
    // v5.22 — body-break check piggybacks on the same per-correct-answer
    // pipeline. It uses its own threshold (8 min) and tracking, so it can
    // fire multiple times per session without conflicting with the session
    // cap break (which fires once at sensoryMode-dependent thresholds).
    if (typeof maybeSuggestBodyBreak === 'function') maybeSuggestBodyBreak();

    if (state.breakSuggested) return;
    if (!state.sessionStartedAt) return;
    if (Date.now() - state.sessionStartedAt < sessionCapMs()) return;
    state.breakSuggested = true;
    // Defer slightly so the success animation finishes first
    setTimeout(showBreakModal, 1400);
  }

  function showBreakModal() {
    if (!el.modalBreak) return;
    const profile = activeProfile();
    const stats = profile ? computeProfileStats(profile) : null;
    if (el.breakMinutes) {
      el.breakMinutes.textContent = String(Math.round((Date.now() - state.sessionStartedAt) / 60000));
    }
    if (el.breakStats && stats) {
      el.breakStats.textContent = `${stats.masteredSkills} of ${stats.availableSkills} mastered`;
    }
    el.modalBreak.classList.add('active');
  }

  function activeProfile() {
    return state.profiles.find((p) => p.id === state.activeProfileId) || state.profiles[0] || null;
  }

  function profileSettings() {
    return activeProfile()?.settings || DEFAULT_SETTINGS;
  }

  // ============================================================
  //  v5.15 — speech speed table.
  //  Three discrete settings keep the choice simple for parents. Each
  //  row provides the playbackRate to apply to MP3s (Aria pack /
  //  recordings), the TTS rate (synthetic fallback), and the rate used
  //  in blend-mode phoneme chains (slower for legibility).
  //  Normal matches the v5.14 defaults exactly so existing users see
  //  no behavior change unless they touch the new setting.
  // ============================================================
  const SPEECH_SPEEDS = {
    slow:   { mp3: 0.95, tts: 0.85, seq: 0.75, pauseMs: 450 },
    normal: { mp3: 1.15, tts: 1.05, seq: 0.90, pauseMs: 350 },
    fast:   { mp3: 1.35, tts: 1.25, seq: 1.05, pauseMs: 250 }
  };
  function speechSpeed() {
    return SPEECH_SPEEDS[profileSettings().speechSpeed] || SPEECH_SPEEDS.normal;
  }

  // ============================================================
  //  VOICE ENGINE
  //
  //  Picks the best TTS voice available, prefers the parent's saved
  //  preference, and serializes utterances so the kid never hears two
  //  voices overlapping. v5.13 expanded the picker with:
  //   - locale filter (en-US default; nb-NO / es-ES / fr-FR ready for K-12)
  //   - voiceFingerprint fallback (URI doesn't match across devices, but
  //     `{ name, lang }` usually does — e.g. picking Aria on Windows still
  //     re-selects Aria on the same family of Edge installs)
  //   - isRoboticBestVoice() so we can show the parent a remedy banner
  //     when the device has nothing better than David/Mark/Zira
  //   - speakSequence(parts, opts) — chains utterances with pauses,
  //     replaces two earlier ad-hoc TTS bypasses in Blend mode.
  // ============================================================
  const VoiceEngine = {
    voices: [],
    chosen: null,

    refresh() {
      if (!('speechSynthesis' in window)) return;
      this.voices = speechSynthesis.getVoices() || [];
      this.pick();
    },

    /* Filter the voice pool to the active locale family. Falls back to the
       full pool if nothing in the locale matches — better a robotic English
       voice than silence. */
    _localePool() {
      const wanted = (profileSettings().locale || 'en-US').toLowerCase();
      const prefix = wanted.split(/[-_]/)[0]; // "en" from "en-US"
      const exact = this.voices.filter((v) => v.lang && v.lang.toLowerCase() === wanted);
      if (exact.length) return exact;
      const family = this.voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith(prefix + '-'));
      if (family.length) return family;
      return this.voices;
    },

    pick() {
      if (!this.voices.length) return;
      const settings = profileSettings();
      const pool = this._localePool();

      // 1) Saved URI exact match (same device, same browser, same install)
      if (settings.voiceURI) {
        const match = pool.find((v) => v.voiceURI === settings.voiceURI)
                   || this.voices.find((v) => v.voiceURI === settings.voiceURI);
        if (match) { this.chosen = match; return; }
      }

      // 2) Fingerprint match — same name + lang on a different device
      const fp = settings.voiceFingerprint;
      if (fp && fp.name) {
        const match = pool.find((v) => v.name === fp.name && (!fp.lang || v.lang === fp.lang))
                   || this.voices.find((v) => v.name === fp.name);
        if (match) { this.chosen = match; return; }
      }

      // 3) Auto-pick the best of the locale pool
      this.chosen = [...pool].sort((a, b) => this.score(b) - this.score(a))[0] || null;
    },

    /* Persist BOTH the URI (for same-device round-trips) AND the
       fingerprint (for cross-device portability) when the parent
       explicitly picks a voice in Settings. */
    rememberChoice(voice) {
      const profile = activeProfile();
      if (!profile) return;
      profile.settings.voiceURI = voice ? voice.voiceURI : '';
      profile.settings.voiceFingerprint = voice ? { name: voice.name, lang: voice.lang } : null;
      saveStorage();
      this.chosen = voice || null;
    },

    score(v) {
      /* Goal: pick the LEAST robotic voice available. Modern neural voices
         (Aria, Jenny, Samantha, Google US) get heavy bonuses. The old
         Microsoft David/Zira/Mark engines get penalized — they're the
         #1 reason this app sounds robotic on Windows. */
      let s = 0;
      if (v.localService) s += 30;
      if (/^en[-_]US/i.test(v.lang)) s += 12;
      else if (/^en[-_]GB/i.test(v.lang)) s += 8;
      else if (/^en[-_]/i.test(v.lang)) s += 5;

      // Strong bonus for known natural-sounding voices
      if (/aria|jenny|guy|eva|davis|jane|nancy|tony|amber|ana|christopher|aaron/i.test(v.name)) s += 40;
      if (/samantha|karen|moira|tessa|fiona|allison|ava|susan/i.test(v.name)) s += 35;
      if (/google.*us.*english/i.test(v.name)) s += 35;
      // "Natural" or "Neural" in the name is a strong signal
      if (/natural|neural/i.test(v.name)) s += 15;

      if (/microsoft/i.test(v.name)) s += 4;
      if (/female|woman/i.test(v.name)) s += 2;

      // Penalize the older robotic Microsoft engines
      if (/^microsoft (david|mark|zira|hazel)\b/i.test(v.name)) s -= 8;

      if (/novelty|whisper|cellos|hysterical|bahh|bells|boing|bubbles|deranged|albert|grandma|grandpa|jester|trinoids|zarvox|organ/i.test(v.name)) s -= 200;
      return s;
    },

    /* True iff every voice in the active locale pool reads as robotic.
       Used by the home-screen banner to nudge the parent toward recording
       their own voice — there's no point picking a "better" TTS when the
       device doesn't offer one. */
    isRoboticBestVoice() {
      if (!this.chosen) return false;
      const n = this.chosen.name || '';
      if (/^microsoft (david|mark|zira|hazel)\b/i.test(n)) return true;
      if (/aria|jenny|samantha|karen|google.*us.*english|natural|neural/i.test(n)) return false;
      // Unknown voice — score it. Negative-ish score means likely robotic.
      return this.score(this.chosen) < 20;
    },

    speak(parts, opts = {}) {
      if (!('speechSynthesis' in window)) return;
      // Stop any in-flight MP3 playback before starting TTS — this
      // is half of the multi-voice fix (the other half is audioPlayer
      // stopping TTS when starting MP3).
      if (typeof audioPlayer !== 'undefined') audioPlayer.stop();
      speechSynthesis.cancel();
      const list = Array.isArray(parts) ? parts : [parts];
      const speed = speechSpeed();
      list.filter((p) => p != null && p !== '').forEach((p) => {
        const u = new SpeechSynthesisUtterance(String(p));
        if (this.chosen) u.voice = this.chosen;
        // v5.15 — TTS rate is driven by the Speech-speed setting.
        u.rate   = opts.rate   ?? speed.tts;
        u.pitch  = opts.pitch  ?? 1.05;
        u.volume = opts.volume ?? 1;
        speechSynthesis.speak(u);
      });
    },

    /* Chain TTS utterances with deliberate pauses between them. Replaces the
       two earlier ad-hoc loops (speakChain + playPhonemeChain's TTS branch)
       that bypassed audioPlayer.stop() and risked overlap with an in-flight
       MP3. Returns a Promise that resolves after the last utterance finishes,
       so callers can chain reliable transitions.
       v5.14 — bumped default rate 0.65 → 0.9 and pauseMs 500 → 350 for the
       blend-mode phoneme chain. Still slower than `speak()` because the
       child needs to hear each phoneme distinctly, but no longer plodding. */
    speakSequence(parts, opts = {}) {
      return new Promise((resolve) => {
        if (!('speechSynthesis' in window) || !parts || !parts.length) {
          resolve();
          return;
        }
        if (typeof audioPlayer !== 'undefined') audioPlayer.stop();
        speechSynthesis.cancel();

        // v5.15 — speed-table driven; per-call opts still win
        const speed = speechSpeed();
        const rate    = opts.rate    ?? speed.seq;
        const pitch   = opts.pitch   ?? 1.05;
        const volume  = opts.volume  ?? 1;
        const pauseMs = opts.pauseMs ?? speed.pauseMs;

        let i = 0;
        const next = () => {
          if (i >= parts.length) { resolve(); return; }
          const text = parts[i];
          if (text == null || text === '') { i++; next(); return; }
          const u = new SpeechSynthesisUtterance(String(text));
          if (this.chosen) u.voice = this.chosen;
          u.rate   = rate;
          u.pitch  = pitch;
          u.volume = volume;
          const advance = () => { i++; setTimeout(next, pauseMs); };
          u.onend   = advance;
          u.onerror = advance;
          speechSynthesis.speak(u);
        };
        next();
      });
    },

    stop() {
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      if (typeof audioPlayer !== 'undefined') audioPlayer.stop();
    }
  };

  if ('speechSynthesis' in window) {
    VoiceEngine.refresh();
    speechSynthesis.onvoiceschanged = () => {
      VoiceEngine.refresh();
      // v5.13 — voice list arrives async; re-evaluate the robotic-voice
      // banner once the real options are known.
      if (typeof refreshVoiceBanner === 'function') refreshVoiceBanner();
    };
  }

  let speechPrimed = false;
  function primeSpeech() {
    if (speechPrimed || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
    speechPrimed = true;
  }
  document.addEventListener('pointerdown', primeSpeech, { once: true });

  // ============================================================
  //  AUDIO PLAYER  (single shared controller — prevents overlap)
  //  Before this existed, a round-start MP3 could still be playing
  //  when the kid tapped a correct answer; the answer's TTS would
  //  speak while the MP3 was mid-letter → two voices overlapping.
  //  Now every audio path (MP3, IDB recording, synth TTS) routes
  //  through stops here, so any new utterance interrupts the prior.
  // ============================================================
  const audioPlayer = {
    current: null,         // active HTMLAudioElement, or null
    pendingResolve: null,  // resolve fn for the in-flight play() promise

    /* Stop any in-flight audio file playback. Marks it as aborted so
       the path isn't falsely flagged as missing. */
    stop() {
      const a = this.current;
      if (!a) return;
      a._aborted = true;
      this.current = null;
      try { a.pause(); a.removeAttribute('src'); a.load(); } catch {}
      if (typeof this.pendingResolve === 'function') {
        const r = this.pendingResolve;
        this.pendingResolve = null;
        r(false);
      }
    },

    /* Play an audio resource (MP3 URL, or blob: URL from IDB recording).
       Stops any previous audio first. Resolves true on natural end,
       false on error / abort / timeout.
       v5.14 — playbackRate defaults to 1.15 (a touch faster than the
       MP3 pack's source rate). The pack was rendered with --rate -10%
       for kid clarity but in practice the kids find the delivery a
       little slow; 1.15 brings it back to a natural-feeling cadence
       without losing intelligibility. Overrideable per-call. */
    play(url, opts = {}) {
      this.stop();
      if (typeof VoiceEngine !== 'undefined') VoiceEngine.stop();

      return new Promise((resolve) => {
        const a = new Audio();
        this.current = a;
        this.pendingResolve = resolve;
        let settled = false;

        const finish = (result, kind = 'normal') => {
          if (settled) return;
          settled = true;
          if (this.current === a) this.current = null;
          if (this.pendingResolve === resolve) this.pendingResolve = null;
          if (kind === 'error' && !a._aborted && typeof opts.onError === 'function') opts.onError();
          if (typeof opts.onCleanup === 'function') opts.onCleanup();
          resolve(result);
        };

        a.addEventListener('canplaythrough', () => {
          if (settled) return;
          a.play().catch(() => finish(false));
        }, { once: true });
        a.addEventListener('ended', () => finish(true), { once: true });
        a.addEventListener('error', () => finish(false, 'error'), { once: true });

        a.preload = 'auto';
        // v5.15 — playback rate is driven by the parent's Speech speed
        // setting (slow / normal / fast). Callers can still override
        // explicitly with opts.playbackRate when needed (e.g. for a
        // pacing-sensitive game tutorial later).
        a.playbackRate = opts.playbackRate ?? speechSpeed().mp3;
        a.src = url;

        /* Safety timeout — if a slow / failing fetch never fires
           canplaythrough, treat as missing after 4 seconds. Longer than
           the previous 1.5s so we don't false-trigger on cold caches. */
        setTimeout(() => {
          if (!settled) {
            try { a.pause(); } catch {}
            finish(false);
          }
        }, 4000);
      });
    }
  };

  /* Speech-busy poll — kept for callers that genuinely need to wait
     (the daily-session greeter and a couple of mode openings). The
     post-correct advance no longer uses it; see advanceAfterSpeech. */
  function speechBusy() {
    if (audioPlayer.current) return true;
    if ('speechSynthesis' in window && speechSynthesis.speaking) return true;
    return false;
  }
  function waitForSpeech(maxWaitMs = 5000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        if (!speechBusy() || Date.now() - start > maxWaitMs) resolve();
        else setTimeout(check, 80);
      };
      check();
    });
  }
  /* Advance to the next round.
     v5.14 — user feedback: the post-correct wait felt too long.
     We now snap to the next round in ~150ms (just enough for the
     sparkles to be visible) instead of waiting for speech to finish
     plus a 700ms beat. The naturally-following startNextRound() calls
     audioPlayer.stop() + VoiceEngine.stop() to cut any tail cleanly.
     Pass an explicit celebrationMs to override per-mode if needed
     (e.g., trace mode wants a longer beat to admire the path). */
  function advanceAfterSpeech(callback, celebrationMs = 150) {
    setTimeout(() => {
      // If in a guided session, the session decides what comes next.
      // Otherwise fall through to the per-mode callback.
      if (state.session && advanceSession()) return;
      callback();
    }, celebrationMs);
  }

  /* ─── v5.1 — Daily session orchestration ─────────────────────
     A session is a fixed sequence of activities (mode + roundsTarget).
     After each correct answer, advanceSession() ticks the counter;
     when an activity hits its roundsTarget, we transition to the
     next mode in the sequence; when the last activity completes,
     we show the session-complete screen.
     The session is stored on the profile so it survives reloads. */

  function buildSession(profile) {
    const age = profile.ageMonths || 48;
    /* Younger profiles get fewer rounds per activity, total ~5 min.
       Older profiles get 3 rounds per activity, total ~10 min. */
    const rounds = age < 48 ? 2 : 3;

    const activities = [];
    for (const [area, modes] of Object.entries(MODE_AREAS)) {
      const eligible = modes.filter((m) => modeMinAge(m) <= age);
      if (!eligible.length) continue;
      const pick = eligible[Math.floor(Math.random() * eligible.length)];
      activities.push({ mode: pick, area, rounds });
    }
    return activities;
  }

  function getOrCreateDailySession(profile) {
    const today = todayString();
    if (!profile.dailySession || profile.dailySession.date !== today) {
      profile.dailySession = {
        date: today,
        activities: buildSession(profile),
        currentIdx: 0,
        roundsCompleted: 0,
        completed: false
      };
      saveStorage();
    }
    return profile.dailySession;
  }

  function startTodaysSession() {
    const profile = activeProfile();
    if (!profile) return;
    const session = getOrCreateDailySession(profile);
    if (!session.activities.length) {
      // No age-eligible mode in any area — fall back to free play
      startMode('play');
      return;
    }
    // Reset progress on a fresh start
    session.currentIdx = 0;
    session.roundsCompleted = 0;
    session.completed = false;
    saveStorage();
    state.session = session;
    startMode(session.activities[0].mode);
  }

  /* Returns true if the session orchestrator handled the transition
     (caller should NOT do its own startXRound call). */
  function advanceSession() {
    if (!state.session) return false;
    const s = state.session;
    s.roundsCompleted++;
    const current = s.activities[s.currentIdx];
    if (s.roundsCompleted < current.rounds) {
      // Still rounds left in this activity — let mode's own callback run
      saveStorage();
      return false;
    }
    // Activity done. Advance.
    s.currentIdx++;
    s.roundsCompleted = 0;
    if (s.currentIdx >= s.activities.length) {
      s.completed = true;
      saveStorage();
      state.session = null;
      showSessionComplete(s);
      return true;
    }
    saveStorage();
    startMode(s.activities[s.currentIdx].mode);
    return true;
  }

  function endSessionEarly() {
    // Called from goHome — keeps the session record but exits flow
    state.session = null;
  }

  function showSessionComplete(session) {
    const profile = activeProfile();
    if (!el.screens.sessionComplete || !profile) {
      showScreen('home');
      return;
    }
    // Render summary
    const summary = el.scSummary;
    if (summary) {
      summary.innerHTML = '';
      session.activities.forEach((a) => {
        const row = document.createElement('div');
        row.className = 'sc-row';
        row.innerHTML = `<span class="sc-row-icon">${iconForMode(a.mode)}</span><span class="sc-row-label">${labelForMode(a.mode)}</span><span class="sc-row-count">${a.rounds} rounds</span>`;
        summary.appendChild(row);
      });
    }
    if (el.scGreeting) {
      const cheers = ['Great session!', 'Wonderful work!', 'Nicely done!', 'Lovely exploration today!'];
      el.scGreeting.textContent = cheers[Math.floor(Math.random() * cheers.length)];
    }
    showScreen('sessionComplete');
  }

  function iconForMode(mode) {
    return ({
      'find-letters': 'Aa', 'find-numbers': '12', 'sounds': '🐝',
      'trace-letters': '✍️', 'trace-numbers': '✏️', 'count': '🍎',
      'first-sound': '👂', 'rhyme': '🎵', 'blend': '🧩',
      feelings: '😀', body: '👃', shapes: '🔷', colors: '🎨',
      patterns: '🔁', animals: '🐻', helpers: '👩‍⚕️', play: '🎨'
    })[mode] || '•';
  }
  function labelForMode(mode) {
    return ({
      'find-letters': 'Find letters', 'find-numbers': 'Find numbers', 'sounds': 'Sounds',
      'trace-letters': 'Trace letters', 'trace-numbers': 'Trace numbers', 'count': 'Count',
      'first-sound': 'First sound', 'rhyme': 'Rhyme', 'blend': 'Blend',
      feelings: 'Feelings', body: 'My body', shapes: 'Shapes', colors: 'Colors',
      patterns: 'Patterns', animals: 'Animals', helpers: 'Helpers', play: 'Free play'
    })[mode] || mode;
  }

  function refreshTodaySessionCard() {
    if (!el.todaySessionCard) return;
    const profile = activeProfile();
    if (!profile) return;
    const session = getOrCreateDailySession(profile);
    if (el.todayDate) el.todayDate.textContent = new Date().toLocaleDateString(undefined, { weekday: 'long' });
    if (!session.activities.length) {
      el.todaySessionCard.classList.add('hidden');
      return;
    }
    el.todaySessionCard.classList.remove('hidden');
    if (el.todayActivities) {
      el.todayActivities.innerHTML = '';
      session.activities.forEach((a, idx) => {
        const isDone = session.completed || idx < session.currentIdx;
        const isActive = !session.completed && idx === session.currentIdx;
        const step = document.createElement('div');
        step.className = 'today-step' + (isDone ? ' done' : '') + (isActive ? ' active' : '');
        step.innerHTML = `
          <div class="today-step-icon">${iconForMode(a.mode)}</div>
          <div class="today-step-label">${labelForMode(a.mode)}</div>
          <div class="today-step-rounds">${a.rounds} rounds</div>
        `;
        el.todayActivities.appendChild(step);
      });
    }
    if (el.todayStartBtn) {
      el.todayStartBtn.textContent = session.completed
        ? 'Play today\'s session again'
        : session.currentIdx > 0
          ? 'Continue today\'s session'
          : "Start today's session";
    }
  }

  // ============================================================
  //  RECORDED AUDIO (IndexedDB — parent records voice in-app)
  // ============================================================
  const IDB_NAME = 'lnum-recordings';
  const IDB_VERSION = 1;
  const IDB_STORE = 'audio';

  let _idbPromise = null;
  function openIDB() {
    if (_idbPromise) return _idbPromise;
    if (!('indexedDB' in window)) return Promise.resolve(null);
    _idbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => resolve(null);
      } catch { resolve(null); }
    });
    return _idbPromise;
  }

  /* In-memory cache of which IDB keys exist, so we don't hit IDB
     every time we want to play a letter. Built on init + on save. */
  const recordedKeys = new Set();

  async function refreshRecordedKeys() {
    recordedKeys.clear();
    const db = await openIDB();
    if (!db) return;
    await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).getAllKeys();
      req.onsuccess = () => { (req.result || []).forEach((k) => recordedKeys.add(k)); resolve(); };
      req.onerror   = () => resolve();
    });
  }

  async function saveRecording(key, blob) {
    const db = await openIDB();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(blob, key);
      tx.oncomplete = () => { recordedKeys.add(key); resolve(true); };
      tx.onerror    = () => resolve(false);
    });
  }

  async function getRecording(key) {
    const db = await openIDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = () => resolve(null);
    });
  }

  async function deleteRecording(key) {
    const db = await openIDB();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => { recordedKeys.delete(key); resolve(true); };
      tx.onerror    = () => resolve(false);
    });
  }

  async function playRecording(key) {
    if (!recordedKeys.has(key)) return false;
    const blob = await getRecording(key);
    if (!blob) return false;
    const url = URL.createObjectURL(blob);
    // Route through the shared audioPlayer so any in-flight TTS or
    // MP3 is interrupted first — prevents the multi-voice bug.
    return audioPlayer.play(url, {
      onCleanup: () => URL.revokeObjectURL(url)
    });
  }

  /* Build the canonical IDB key for a given symbol + variant. */
  function idbKey(category, variant, symbol) {
    return `${category}/${variant || 'name'}/${symbol}`;
  }

  // ============================================================
  //  CUSTOM AUDIO OVERRIDES (MP3 pack — neural Aria voice)
  //  v5.13 — locale-aware lookup. Non-en-US locales try audio/<locale>/...
  //  first, then fall back to the default en-US path. So a Norwegian
  //  profile with a partial Norsk pack still gets English audio for
  //  anything not yet translated, rather than silent gaps.
  // ============================================================
  const audioMissing = new Set();

  function localizedAudioPath(path) {
    const loc = profileSettings().locale || 'en-US';
    if (loc === 'en-US' || !path.startsWith('./audio/')) return path;
    return path.replace('./audio/', `./audio/${loc}/`);
  }

  async function tryAudio(path) {
    if (profileSettings().customAudio === 'off') return false;
    // Try locale-specific path first when the active profile isn't en-US
    const loc = profileSettings().locale || 'en-US';
    if (loc !== 'en-US') {
      const localPath = localizedAudioPath(path);
      if (!audioMissing.has(localPath)) {
        const ok = await audioPlayer.play(localPath, { onError: () => audioMissing.add(localPath) });
        if (ok) return true;
      }
    }
    if (audioMissing.has(path)) return false;
    return audioPlayer.play(path, { onError: () => audioMissing.add(path) });
  }

  /* Speech priority chain for any spoken symbol:
       1. IDB recording (parent's own voice, recorded in-app) — always preferred
       2. MP3 file drop-in (advanced, requires customAudio = 'auto')
       3. Synthetic TTS via Web Speech API
     Fast path: recordedKeys (in-memory Set) means no async cost when nothing
     is recorded — we skip straight to TTS. */
  async function sayLetter(letter, opts = {}) {
    const upper = String(letter).toUpperCase();
    const mode = opts.mode || profileSettings().speech;
    const sound = LETTER_SOUNDS[upper];

    // 1. IDB recordings (instant, offline, parent's voice)
    if (mode === 'name' || mode === 'both') {
      const k = idbKey('letter', 'name', upper);
      if (recordedKeys.has(k) && await playRecording(k)) {
        if (mode === 'both') {
          const sk = idbKey('letter', 'sound', upper);
          if (recordedKeys.has(sk)) await playRecording(sk);
          else VoiceEngine.speak([sound]);
        }
        return;
      }
    } else if (mode === 'sound') {
      const k = idbKey('letter', 'sound', upper);
      if (recordedKeys.has(k) && await playRecording(k)) return;
    }

    // 2. MP3 drop-ins (only if explicitly enabled)
    if (profileSettings().customAudio === 'auto') {
      const folder = mode === 'sound' ? 'sound' : 'name';
      const ok = await tryAudio(`./audio/letters/${folder}/${upper}.mp3`);
      if (ok && mode === 'both') {
        await tryAudio(`./audio/letters/sound/${upper}.mp3`);
        return;
      }
      if (ok) return;
    }

    // 3. TTS fallback
    switch (mode) {
      case 'name':  VoiceEngine.speak([upper]); break;
      case 'sound': VoiceEngine.speak([sound]); break;
      default:      VoiceEngine.speak([upper, sound]); break;
    }
  }

  async function sayNumber(n) {
    const key = String(n);
    const k = idbKey('number', 'name', key);
    if (recordedKeys.has(k) && await playRecording(k)) return;
    if (profileSettings().customAudio === 'auto') {
      const ok = await tryAudio(`./audio/numbers/${key}.mp3`);
      if (ok) return;
    }
    VoiceEngine.speak([key]);
  }

  async function sayWord(letter) {
    const upper = String(letter).toUpperCase();
    const info = LETTER_WORDS[upper];
    if (!info) return sayLetter(upper);
    const k = idbKey('letter', 'word', upper);
    if (recordedKeys.has(k) && await playRecording(k)) return;
    if (profileSettings().customAudio === 'auto') {
      const ok = await tryAudio(`./audio/letters/word/${upper}.mp3`);
      if (ok) return;
    }
    VoiceEngine.speak([info.word]);
  }

  async function sayPhrase(text) {
    VoiceEngine.speak([text]);
  }

  /* v5.0.4 — concept / phrase MP3 chain
     For modes whose targets aren't letters/numbers/words, we still want
     the nice neural voice. The audio pack has `audio/<category>/<key>.mp3`
     for feelings, body, shapes, colors, animals, habitats, helpers, plus
     `audio/phrases/<key>.mp3` for reusable round-start prompts.

     If the MP3 isn't found (or customAudio is off), we fall back to TTS
     speaking the human-readable label / text — robotic on Windows
     without a local neural voice installed, but functionally correct. */
  async function sayConcept(category, key, fallbackText) {
    if (profileSettings().customAudio === 'auto') {
      const ok = await tryAudio(`./audio/${category}/${key}.mp3`);
      if (ok) return;
    }
    VoiceEngine.speak([fallbackText || key]);
  }

  /* Play a prompt phrase by key (e.g. "how-many", "whats-next"). */
  async function sayPromptKey(key, fallbackText) {
    return sayConcept('phrases', key, fallbackText);
  }

  // ============================================================
  //  v5.23 — Speech: SINGLE SOURCE OF TRUTH
  //
  //  All game modules (and any future content) should speak through
  //  window.Speech rather than calling VoiceEngine.speak directly.
  //  Why: VoiceEngine.speak is pure TTS — it bypasses the MP3 pack
  //  and the parent-recorded IDB chain. The result is the user
  //  hearing the device's default voice (often Microsoft David /
  //  Zira on Windows, which sounds robotic) for game prompts even
  //  though the rest of the app uses neural Aria from the MP3 pack.
  //
  //  Speech.phrase(key, fallback) looks for audio/phrases/<key>.mp3
  //  first, falling back to TTS only if missing. To eliminate ALL
  //  robotic-TTS leakage we just need MP3 files for every key the
  //  games use — scripts/generate-voices.py has those phrase keys
  //  queued in v5.23.
  // ============================================================
  /* v5.23 — fallback heuristic for game modules that pass free-text
     into the `speak` callback without naming a phrase key. We look
     up known phrases by exact-match first, then by leading-fragment.
     If nothing matches we return a slugified key derived from the
     text — generate-voices.py picks those up next regeneration. */
  const GAME_PHRASE_KEYS = {
    // Generic game intros
    'Watch the stars, then tap them in order.': 'watch-the-stars',
    'Tap the green ones. Don\'t tap the red ones.': 'tap-green-not-red',
    'Sort by color first.': 'sort-by-color-first',
    'Now sort by color.': 'now-sort-color',
    'Now sort by shape.': 'now-sort-shape',
    'Watch the sky. Tap the shooting stars when they fly.': 'watch-the-sky',
    'Get ready. Three.': 'ready-three',
    'Two.': 'count-two',
    'One.': 'count-one',
    'Lift off!': 'lift-off',
    // Praise lines
    'Nice memory!': 'memory-praise',
    'Great focus!': 'focus-praise',
    'Amazing — you stopped every red one!': 'stop-praise',
    'Great switching!': 'switch-praise',
    'Nice watching!': 'watch-praise'
  };
  function gamePhraseKey(text) {
    if (text == null) return null;
    const key = GAME_PHRASE_KEYS[String(text)];
    if (key) return key;
    // Slugify as a fallback — generate-voices.py will pick this up next
    // regeneration if you add the text to its PHRASES dict.
    return String(text)
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 40);
  }

  window.Speech = {
    /* Spoken letter — full priority chain (recording → MP3 → TTS).
       opts.mode = 'name' | 'sound' | 'both' (defaults to settings). */
    letter:  (L, opts)             => sayLetter(L, opts),
    number:  (n)                   => sayNumber(n),
    word:    (w)                   => sayWord(w),
    /* Phrase by key. First tries audio/phrases/<key>.mp3, then falls
       back to TTS with `fallback` text. Use for game prompts:
         Speech.phrase('watch-the-stars', 'Watch the stars...')   */
    phrase:  (key, fallback)       => sayPromptKey(key, fallback),
    /* Generic concept under a category — used for feelings, colors,
       shapes, helpers, etc. that have their own MP3 folder. */
    concept: (category, key, txt)  => sayConcept(category, key, txt),
    /* Free-form text that has no MP3. Pure TTS. Use sparingly — every
       use of cheer() is a candidate for an MP3 entry later. */
    cheer:   (text)                => VoiceEngine.speak([text]),
    /* Hard stop everything. */
    stop:    ()                    => VoiceEngine.stop()
  };

  // ============================================================
  //  PHRASE BANKS (variation so it stops sounding repetitive)
  // ============================================================
  const PHRASES = {
    correctShort:    ['Yes!', 'Great!', 'You got it!', 'Wonderful!', 'Awesome!', 'Nice!', 'Perfect!'],
    correctEcho:     ['{target}!', 'Yes, {target}!', '{target}! Great work.', 'You found {target}!', '{target}! Nice.'],
    findHint:        ['Try again.', 'Look carefully.', 'Take your time.', 'Almost.', 'Where is it?'],
    soundsCorrect:   ['Yes! {word}!', '{word}! Great!', 'You got it! {word}.', '{word}, {target}!'],
    soundsHint:      ['Listen again.', 'Try once more.', 'Hmm, look again.', 'Where is it?'],
    countPrompt:     ['How many?', 'Count them.', "Let's count.", 'How many do you see?'],
    countCorrect:    ['Yes! {n}!', '{n}! Great counting.', 'You counted {n}!', '{n}! Nice work.'],
    countHint:       ['Count again.', 'Take your time.', 'Try once more.']
  };
  const _lastPhrase = new Map();
  function phrase(bankKey, vars = {}) {
    const bank = PHRASES[bankKey];
    if (!bank || !bank.length) return '';
    const last = _lastPhrase.get(bankKey);
    let i;
    do { i = Math.floor(Math.random() * bank.length); } while (bank.length > 1 && i === last);
    _lastPhrase.set(bankKey, i);
    return bank[i].replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''));
  }

  // ============================================================
  //  ELEMENTS
  // ============================================================
  const $ = (id) => document.getElementById(id);

  const el = {
    screens: {
      welcome:     $('screen-welcome'),
      home:        $('screen-home'),
      find:        $('screen-find'),
      trace:       $('screen-trace'),
      count:       $('screen-count'),
      sounds:      $('screen-sounds'),
      play:        $('screen-play'),
      'first-sound': $('screen-first-sound'),
      rhyme:       $('screen-rhyme'),
      blend:       $('screen-blend'),
      // v5 — world / self / society
      feelings:    $('screen-feelings'),
      body:        $('screen-body'),
      shapes:      $('screen-shapes'),
      colors:      $('screen-colors'),
      patterns:    $('screen-patterns'),
      animals:     $('screen-animals'),
      helpers:     $('screen-helpers'),
      // v5.1
      sessionComplete: $('screen-session-complete'),
      // v5.2
      sightWords:  $('screen-sight-words'),
      calmCorner:  $('screen-calm-corner'),
      // v5.3
      addition:    $('screen-addition'),
      subtraction: $('screen-subtraction'),
      // v5.5
      tap:         $('screen-tap'),
      // v5.7
      readingLibrary: $('screen-reading-library'),
      readingBook:    $('screen-reading-book'),
      // v5.9
      timeOfDay:      $('screen-time-of-day'),
      // v5.16 — calm-arcade game pilot (Letter / Number Lander)
      letterLander:   $('screen-letter-lander'),
      // v5.17 — full arcade Math Blaster homage
      numberBlaster:  $('screen-number-blaster'),
      // v5.18 — executive-function trainers (Sequence Star / Stop & Go / Launch Pad)
      sequenceStar:   $('screen-sequence-star'),
      stopGo:         $('screen-stop-go'),
      launchPad:      $('screen-launch-pad'),
      // v5.20 — round-2 EF (flexibility / sustained attention / metacognition)
      switchIt:       $('screen-switch-it'),
      stargazer:      $('screen-stargazer'),
      reflect:        $('screen-reflect'),
      // v5.21 — Calm Corner expansion
      calmBreath:     $('screen-calm-breath'),
      bodyScan:       $('screen-body-scan'),
      thermometer:    $('screen-thermometer'),
      // v5.24 — Rammeplan area 2 (Body, Movement & Health)
      moveWithMe:     $('screen-move-with-me'),
      foodSort:       $('screen-food-sort'),
      // v5.25 — Rammeplan area 3 (Art, Culture & Creativity)
      draw:           $('screen-draw'),
      rhythm:         $('screen-rhythm'),
      // v5.26 — Rammeplan area 6 (Ethics, Religion & Philosophy)
      empathy:        $('screen-empathy'),
      gratitude:      $('screen-gratitude'),
      // v5.27 — Rammeplan area 4 (Nature, Environment & Technology)
      weather:        $('screen-weather'),
      sortItOut:      $('screen-sort-it-out'),
      // v5.28 — Rammeplan area 5 depth (measurement + spatial)
      measure:        $('screen-measure'),
      whereIsIt:      $('screen-where-is-it'),
      // v5.29 — Rammeplan area 7 (Local Environment & Society)
      family:         $('screen-family'),
      routines:       $('screen-routines'),
      // v6.1 — Parent dashboard (cloud-aggregated)
      dashboard:      $('screen-dashboard'),
      // v6.2 — Adventure narrator (between-chapter framing screen)
      adventureNarrator: $('screen-adventure-narrator')
    },
    homeBtn:       $('homeBtn'),
    settingsBtn:   $('settingsBtn'),

    homeTitle:       $('home-title'),
    profileChip:     $('profile-chip'),
    profileChipName: $('profile-chip-name'),
    profileChipLvl:  $('profile-chip-level'),

    welcomeName:   $('welcome-name'),
    welcomeAge:    $('welcome-age'),
    welcomeSubmit: $('welcome-submit'),

    findPromptLabel: $('find-prompt-label'),
    findTarget:      $('find-target'),
    findChoices:     $('find-choices'),

    traceLabel: $('trace-label'),
    traceSvg:   $('trace-svg'),
    traceDots:  $('trace-dots'),

    countStage:   $('count-stage'),
    countChoices: $('count-choices'),

    soundsPic:     $('sounds-pic'),
    soundsWord:    $('sounds-word'),
    soundsChoices: $('sounds-choices'),

    playGrid:      $('play-grid'),
    playShuffle:   $('play-shuffle'),

    // v4 — phonemic awareness mode elements
    firstSoundWord:    $('first-sound-word'),
    firstSoundEmoji:   $('first-sound-emoji'),
    firstSoundChoices: $('first-sound-choices'),
    firstSoundReplay:  $('first-sound-replay'),

    rhymeTargetEmoji:  $('rhyme-target-emoji'),
    rhymeTargetWord:   $('rhyme-target-word'),
    rhymeChoices:      $('rhyme-choices'),

    blendPhonemes:     $('blend-phonemes'),
    blendChoices:      $('blend-choices'),
    blendReplay:       $('blend-replay'),

    // v5 — whole-child mode elements
    feelingsPrompt:    $('feelings-prompt'),
    feelingsChoices:   $('feelings-choices'),

    bodyPrompt:        $('body-prompt'),
    bodyChoices:       $('body-choices'),

    shapesPrompt:      $('shapes-prompt'),
    shapesChoices:     $('shapes-choices'),

    colorsPrompt:      $('colors-prompt'),
    colorsChoices:     $('colors-choices'),

    patternDisplay:    $('pattern-display'),
    patternChoices:    $('pattern-choices'),

    animalsCue:        $('animals-cue'),
    animalsChoices:    $('animals-choices'),

    helpersScenario:   $('helpers-scenario'),
    helpersQuestion:   $('helpers-question'),
    helpersChoices:    $('helpers-choices'),

    // v5 — parent resource elements
    activitiesBtn:     $('activities-btn'),
    modalActivities:   $('modal-activities'),
    activitiesList:    $('activities-list'),
    activitiesRefresh: $('activities-refresh'),
    activitiesClose:   $('activities-close'),
    activitiesFilters: document.querySelectorAll('[data-activity-filter]'),

    readingBtn:        $('reading-btn'),
    modalReading:      $('modal-reading'),
    readingList:       $('reading-list'),
    readingAddForm:    $('reading-add-form'),
    readingTitle:      $('reading-title'),
    readingDate:       $('reading-date'),
    readingReader:     $('reading-reader'),
    readingAddBtn:     $('reading-add-btn'),
    readingStats:      $('reading-stats'),
    readingClose:      $('reading-close'),

    // v5.2 — sight words + calm corner
    sightWordsPrompt:   $('sight-words-prompt'),
    sightWordsChoices:  $('sight-words-choices'),
    sightWordsReplay:   $('sight-words-replay'),

    // v5.3 — arithmetic
    addA:      $('add-a'),
    addB:      $('add-b'),
    addObjsA:  $('add-objs-a'),
    addObjsB:  $('add-objs-b'),
    addChoices:$('add-choices'),
    addReplay: $('add-replay'),

    subA:      $('sub-a'),
    subB:      $('sub-b'),
    subObjsA:  $('sub-objs-a'),
    subObjsRemoved: $('sub-objs-removed'),
    subChoices:$('sub-choices'),
    subReplay: $('sub-replay'),

    // v5.5 — toddler tap
    tapGrid:   $('tap-grid'),
    tapShuffle:$('tap-shuffle'),

    // v5.7 — reading
    readingLibraryList: $('reading-library-list'),
    readingTitle:       $('reading-book-title'),
    readingEmoji:       $('reading-book-emoji'),
    readingSentence:    $('reading-sentence'),
    readingPageInd:     $('reading-page-indicator'),
    readingReadBtn:     $('reading-read-btn'),
    readingPrevBtn:     $('reading-prev-btn'),
    readingNextBtn:     $('reading-next-btn'),
    readingLibBtn:      $('reading-library-btn'),

    // v5.9 — time of day
    timeScenarioEmoji: $('time-scenario-emoji'),
    timeScenarioWord:  $('time-scenario-word'),
    timeChoices:       $('time-choices'),

    // v5.6 — printable worksheets
    worksheetsBtn:    $('worksheets-btn'),
    modalWorksheets:  $('modal-worksheets'),
    worksheetsClose:  $('worksheets-close'),
    printableView:    $('printable-view'),
    printableContent: $('printable-content'),

    calmCornerBtn:     $('calm-corner-btn'),
    calmStop:          $('calm-stop'),
    calmText:          $('calm-text'),
    calmCircle:        $('calm-circle'),

    // v5.13 — robotic-voice nudge banner on home
    voiceBanner:         $('voice-banner'),
    voiceBannerRecord:   $('voice-banner-record'),
    voiceBannerDismiss:  $('voice-banner-dismiss'),

    // v5.1 — today's session
    todaySessionCard:  $('today-session-card'),
    todayDate:         $('today-date'),
    todayActivities:   $('today-activities'),
    todayStartBtn:     $('today-start'),
    todayRebuildBtn:   $('today-rebuild'),
    scGreeting:        $('sc-greeting'),
    scSummary:         $('sc-summary'),
    scDoneBtn:         $('sc-done'),
    scAgainBtn:        $('sc-again'),

    // v3.3 — agency picker + about/pedagogy modal
    modalAgency:    $('modal-agency'),
    agencyChoices:  $('agency-choices'),
    agencySurprise: $('agency-surprise'),
    aboutBtn:       $('about-btn'),
    modalAbout:     $('modal-about'),
    aboutClose:     $('about-close'),

    sparkles:      $('sparkles'),

    modalGate:     $('modal-gate'),
    modalSettings: $('modal-settings'),
    modalProgress: $('modal-progress'),
    modalProfile:  $('modal-profile'),
    modalProfileEdit: $('modal-profile-edit'),

    gateTarget:    $('gate-target'),
    gateNumbers:   $('gate-numbers'),

    voiceSelect:   $('voice-select'),
    progressBtn:   $('progress-btn'),
    profileSwitchBtn: $('profile-switch-btn'),
    resetProgressBtn: $('reset-progress-btn'),
    settingsClose: $('settingsClose'),
    progressClose: $('progressClose'),
    progressSummary: $('progress-summary'),
    progressLetters: $('progress-letters'),
    progressNumbers: $('progress-numbers'),

    profileList:   $('profile-list'),
    profileAdd:    $('profile-add'),
    profileClose:  $('profile-close'),

    profileEditTitle:    $('profile-edit-title'),
    profileEditName:     $('profile-edit-name'),
    profileEditAge:      $('profile-edit-age'),
    profileEditDelete:   $('profile-edit-delete'),
    profileEditCancel:   $('profile-edit-cancel'),
    profileEditSave:     $('profile-edit-save'),

    installPrompt: $('install-prompt'),
    installBtn:    $('install-btn'),
    installDismiss:$('install-dismiss'),

    // v3 — break, skill detail, standards view, export
    modalBreak:    $('modal-break'),
    breakMinutes:  $('break-minutes'),
    breakStats:    $('break-stats'),
    breakContinue: $('break-continue'),
    breakDone:     $('break-done'),

    modalSkill:    $('modal-skill'),
    skillTitle:    $('skill-title'),
    skillDetails:  $('skill-details'),
    skillClose:    $('skill-close'),

    progressStreak:        $('progress-streak'),
    progressRecs:          $('progress-recommendations'),
    progressStandardsList: $('progress-standards-list'),
    progressTabs:          document.querySelectorAll('[data-progress-tab]'),
    progressViewTarget:    $('progress-view-target'),
    progressViewStandard:  $('progress-view-standard'),
    progressViewArea:      $('progress-view-area'),
    progressAreasList:     $('progress-areas-list'),

    exportProgressBtn: $('export-progress-btn'),
    printProgressBtn:  $('print-progress-btn'),

    // v3.1 — voice recording
    recordBtn:        $('record-btn'),
    modalRecord:      $('modal-record'),
    recordList:       $('record-list'),
    recordClose:      $('record-close'),
    recordSummary:    $('record-summary'),
    recordTabs:       document.querySelectorAll('[data-record-tab]'),
    // v5.19 — Parent observation journal (Finally Focused)
    journalBtn:       $('journal-btn'),
    modalJournal:     $('modal-journal'),
    journalClose:     $('journal-close'),
    journalTabs:      document.querySelectorAll('[data-journal-tab]'),
    jSleep:           $('j-sleep'),
    jSleepReadout:    $('j-sleep-readout'),
    jScreen:          $('j-screen'),
    jScreenReadout:   $('j-screen-readout'),
    jOutdoor:         $('j-outdoor'),
    jOutdoorReadout:  $('j-outdoor-readout'),
    jSupplements:     $('j-supplements'),
    jNotes:           $('j-notes'),
    jTrend:           $('j-trend'),
    jCalendar:        $('j-calendar'),
    jExportJson:      $('j-export-json'),
    jExportCsv:       $('j-export-csv'),
    jExportPdf:       $('j-export-pdf'),
    // v5.13 — bulk recorder
    recordBulkStart:  $('record-bulk-start'),
    recordBulkStop:   $('record-bulk-stop'),
    recordBulkStatus: $('record-bulk-status')
  };

  // ============================================================
  //  THEME + HEADER
  // ============================================================
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', profileSettings().theme);
  }

  function refreshHeader() {
    const p = activeProfile();
    if (!p) {
      el.profileChip?.classList.add('hidden');
      return;
    }
    el.profileChip?.classList.remove('hidden');
    if (el.profileChipName) el.profileChipName.textContent = p.name;
    if (el.profileChipLvl) {
      /* v5.1 — show age band + Rammeplan label so parents see which
         stage their child is in and what content is currently unlocked. */
      const band = bandForMonths(p.ageMonths);
      el.profileChipLvl.textContent = `${band.labelEn} · ${Math.floor(p.ageMonths/12)}y`;
    }
    refreshModeLocks();
  }

  /* v5.1 — Mode-card visibility per profile age band.
     - showAllModes=false (default): hide cards for modes not yet
       age-appropriate. Cleaner home screen.
     - showAllModes=true: show every card; locked ones get a pill
       saying "ready at Xy+". For curious parents who want to see
       the whole curriculum.
     Also marks the active band on each mode card so styling can
     emphasize what's age-aligned. */
  function refreshModeLocks() {
    const p = activeProfile();
    if (!p) return;
    const age = p.ageMonths || 0;
    const showAll = profileSettings().showAllModes === 'on';
    document.querySelectorAll('#screen-home .mode-card, .freeplay-cta').forEach((card) => {
      const mode = card.dataset.mode;
      if (!mode) return;
      const min = modeMinAge(mode);
      const locked = age < min;
      card.classList.toggle('locked', locked);
      // hide if locked AND not in show-all mode (free play is never locked since min=0)
      if (locked && !showAll) {
        card.classList.add('hidden');
      } else {
        card.classList.remove('hidden');
      }
      // Add or update the "ready at" pill
      let pill = card.querySelector('.lock-pill');
      if (locked && showAll) {
        const years = Math.ceil(min / 12);
        if (!pill) {
          pill = document.createElement('span');
          pill.className = 'lock-pill';
          card.appendChild(pill);
        }
        pill.textContent = `ready at ${years}y+`;
      } else if (pill) {
        pill.remove();
      }
    });
    // Hide section headers if all their modes are hidden
    document.querySelectorAll('#screen-home .mode-section-title').forEach((title) => {
      const sub = title.nextElementSibling?.classList.contains('mode-section-sub')
        ? title.nextElementSibling : null;
      const grid = sub?.nextElementSibling || title.nextElementSibling;
      if (!grid || !grid.classList.contains('mode-grid')) return;
      const anyVisible = [...grid.children].some((c) => !c.classList.contains('hidden'));
      title.style.display = anyVisible ? '' : 'none';
      if (sub) sub.style.display = anyVisible ? '' : 'none';
      grid.style.display = anyVisible ? '' : 'none';
    });
  }

  // ============================================================
  //  HELPERS
  // ============================================================
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickDistractors(target, pool, count) {
    const result = [target];
    const seen = new Set([String(target).toUpperCase()]);
    const cap = Math.min(count, pool.length);
    while (result.length < cap) {
      const c = pool[Math.floor(Math.random() * pool.length)];
      const k = String(c).toUpperCase();
      if (!seen.has(k)) { seen.add(k); result.push(c); }
    }
    return shuffle(result);
  }

  function caseFor(letter, override) {
    const c = override || profileSettings().case;
    if (c === 'upper') return letter.toUpperCase();
    if (c === 'lower') return letter.toLowerCase();
    return Math.random() < 0.5 ? letter.toLowerCase() : letter.toUpperCase();
  }

  function showScreen(name) {
    Object.values(el.screens).forEach((s) => s?.classList.remove('active'));
    el.screens[name]?.classList.add('active');
    el.homeBtn.style.display = (name === 'home' || name === 'welcome') ? 'none' : 'flex';
    el.settingsBtn.style.display = (name === 'welcome') ? 'none' : 'flex';
  }

  function spawnSparkles(near) {
    const rect = near.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const emojis = ['⭐','✨','🌟','💫'];
    const N = profileSettings().sensoryMode === 'low' ? 6 : 14;
    for (let i = 0; i < N; i++) {
      const s = document.createElement('div');
      s.className = 'sparkle';
      s.textContent = emojis[i % emojis.length];
      const angle = (i / N) * Math.PI * 2;
      const dist  = 60 + Math.random() * 50;
      s.style.left = (cx + Math.cos(angle) * dist) + 'px';
      s.style.top  = (cy + Math.sin(angle) * dist) + 'px';
      s.style.animationDelay = (i * 30) + 'ms';
      el.sparkles.appendChild(s);
      setTimeout(() => s.remove(), 1500);
    }
  }

  // ============================================================
  //  AGENCY PICKER (v3.3 — Rammeplan §5 "Child's right to participate")
  //  When settings.agencyMode === 'child', the kid picks their target
  //  on mode entry instead of the curriculum picker choosing.
  // ============================================================
  function renderAgencyTile(skill, mode) {
    const symbol = escapeHtml(String(skill.target));
    if (mode === 'sounds' || mode === 'first-sound') {
      const info = LETTER_WORDS[skill.target] || { emoji: '' };
      return `<span class="agency-emoji">${info.emoji}</span><span class="agency-label">${symbol}</span>`;
    }
    if (mode === 'rhyme') {
      const fam = (typeof RHYME_FAMILIES !== 'undefined') && RHYME_FAMILIES.find((f) => f.key === skill.target);
      if (fam) return `<span class="agency-emoji">${fam.words[0].e}</span><span class="agency-label">-${symbol}</span>`;
    }
    if (mode === 'blend') {
      const cvc = (typeof CVC_WORDS !== 'undefined') && CVC_WORDS.find((c) => c.word === skill.target);
      if (cvc) return `<span class="agency-emoji">${cvc.emoji}</span><span class="agency-label">${symbol}</span>`;
    }
    return `<span class="agency-symbol">${symbol}</span>`;
  }

  function showAgencyPicker(mode, onChosen) {
    const profile = activeProfile();
    if (!profile || !el.modalAgency) {
      onChosen(pickNextSkill(profile, mode, state.lastSkillId));
      return;
    }

    // Build 4 deduped candidates from the picker
    const candidates = [];
    const seen = new Set();
    let lastId = state.lastSkillId;
    for (let i = 0; i < 24 && candidates.length < 4; i++) {
      const s = pickNextSkill(profile, mode, lastId);
      if (s && !seen.has(s.id)) {
        candidates.push(s);
        seen.add(s.id);
        lastId = s.id;
      }
    }
    if (candidates.length === 0) {
      onChosen(null);
      return;
    }

    el.agencyChoices.innerHTML = '';
    candidates.forEach((skill) => {
      const btn = document.createElement('button');
      btn.className = `agency-choice mode-${mode}`;
      btn.innerHTML = renderAgencyTile(skill, mode);
      btn.addEventListener('click', () => {
        el.modalAgency.classList.remove('active');
        onChosen(skill);
      });
      el.agencyChoices.appendChild(btn);
    });

    /* Voice prompt via MP3 chain — falls back to TTS only if the
       agency phrase MP3 isn't deployed yet. */
    sayPromptKey('pick-what', 'Pick what you want to play with.');
    el.modalAgency.classList.add('active');
    el.agencySurprise.onclick = () => {
      el.modalAgency.classList.remove('active');
      onChosen(candidates[Math.floor(Math.random() * candidates.length)]);
    };
  }

  function startMode(mode) {
    state.mode = mode;
    state.lastSkillId = null;
    state.chosenForRound = null;
    /* Free play is deliberately session-less: no break timer, no progress
       tracking. The Rammeplan principle is that children are competent
       agentic learners — Play mode steps out of the way and lets them
       explore on their own initiative. */
    if (mode !== 'play') startNewSession();

    const launchActivity = () => {
      // v5.22 — Optional pre-session check-in. Runs at most once per
      // day per profile when sessionCheckIn === 'on'. The kid picks a
      // mood, we save it to today's journal entry, then continue.
      if (shouldRunCheckIn()) {
        runCheckIn().then(() => actuallyLaunchActivity(mode));
        return;
      }
      actuallyLaunchActivity(mode);
    };
    const actuallyLaunchActivity = (mode) => {
      switch (mode) {
        case 'find-letters':
        case 'find-numbers':  showScreen('find');  startFindRound();   break;
        case 'trace-letters':
        case 'trace-numbers': showScreen('trace'); startTraceRound();  break;
        case 'count':         showScreen('count'); startCountRound();  break;
        case 'sounds':        showScreen('sounds'); startSoundsRound(); break;
        case 'play':          showScreen('play');  startPlayMode();    break;
        case 'first-sound':   showScreen('first-sound'); startFirstSoundRound(); break;
        case 'rhyme':         showScreen('rhyme'); startRhymeRound();  break;
        case 'blend':         showScreen('blend'); startBlendRound();  break;
        // v5 — whole-child modes
        case 'feelings':      showScreen('feelings'); startFeelingsRound(); break;
        case 'body':          showScreen('body');     startBodyRound();     break;
        case 'shapes':        showScreen('shapes');   startShapesRound();   break;
        case 'colors':        showScreen('colors');   startColorsRound();   break;
        case 'patterns':      showScreen('patterns'); startPatternsRound(); break;
        case 'animals':       showScreen('animals');  startAnimalsRound();  break;
        case 'helpers':       showScreen('helpers');  startHelpersRound();  break;
        // v5.2
        case 'sight-words':   showScreen('sightWords'); startSightWordsRound(); break;
        // v5.3 — arithmetic
        case 'addition':      showScreen('addition');    startAdditionRound();    break;
        case 'subtraction':   showScreen('subtraction'); startSubtractionRound(); break;
        // v5.5 — toddler tap
        case 'tap':           showScreen('tap');         startTapMode();          break;
        // v5.7 — reading
        case 'reading':       openReadingLibrary(); break;
        // v5.9 — time of day
        case 'time-of-day':   showScreen('timeOfDay'); startTimeOfDayRound(); break;
        // v5.18 — Executive-function trainers (Scattered to Focused +
        //         Dawson & Guare). Records under ef-* skill IDs.
        // v5.23 — all `speak` callbacks now route through window.Speech
        //         single-source-of-truth which tries audio/phrases/<key>.mp3
        //         FIRST and falls back to TTS only if the MP3 is missing.
        //         Keys are queued in scripts/generate-voices.py for the
        //         next MP3 regeneration pass.
        case 'sequence-star': {
          showScreen('sequenceStar');
          requestAnimationFrame(() => {
            if (typeof startSequenceStar !== 'function') return;
            startSequenceStar({
              onAttempt: (skillId, ok) => recordAttempt(skillId, ok, 0),
              speak: (text, key) => Speech.phrase(key || gamePhraseKey(text), text),
              onComplete: () => goHome()
            });
          });
          break;
        }
        case 'stop-go': {
          showScreen('stopGo');
          requestAnimationFrame(() => {
            if (typeof startStopGo !== 'function') return;
            startStopGo({
              onAttempt: (skillId, ok) => recordAttempt(skillId, ok, 0),
              speak: (text, key) => Speech.phrase(key || gamePhraseKey(text), text),
              onComplete: () => goHome()
            });
          });
          break;
        }
        case 'launch-pad': {
          showScreen('launchPad');
          requestAnimationFrame(() => {
            if (typeof startLaunchPad !== 'function') return;
            startLaunchPad({
              speak: (text, key) => Speech.phrase(key || gamePhraseKey(text), text),
              onComplete: () => goHome()
            });
          });
          break;
        }
        // v5.20 — round-2 EF
        case 'switch-it': {
          showScreen('switchIt');
          requestAnimationFrame(() => {
            if (typeof startSwitchIt !== 'function') return;
            startSwitchIt({
              onAttempt: (skillId, ok) => recordAttempt(skillId, ok, 0),
              speak: (text, key) => Speech.phrase(key || gamePhraseKey(text), text),
              onComplete: () => goHome()
            });
          });
          break;
        }
        case 'stargazer': {
          showScreen('stargazer');
          requestAnimationFrame(() => {
            if (typeof startStargazer !== 'function') return;
            startStargazer({
              onAttempt: (skillId, ok) => recordAttempt(skillId, ok, 0),
              speak: (text, key) => Speech.phrase(key || gamePhraseKey(text), text),
              onComplete: () => goHome()
            });
          });
          break;
        }
        case 'reflect': {
          showScreen('reflect');
          requestAnimationFrame(() => {
            if (typeof startReflect !== 'function') return;
            startReflect({
              onAttempt: (skillId, ok) => recordAttempt(skillId, ok, 0),
              onComplete: () => goHome()
            });
          });
          break;
        }
        // v5.24 — Rammeplan Session A: Body, Movement & Health
        case 'move-with-me': {
          showScreen('moveWithMe');
          requestAnimationFrame(() => {
            if (typeof startMoveWithMe !== 'function') return;
            startMoveWithMe({
              onAttempt: (skillId, ok) => recordAttempt(skillId, ok, 0),
              speak: (text, key) => Speech.phrase(key || gamePhraseKey(text), text),
              onComplete: () => goHome()
            });
          });
          break;
        }
        case 'food-sort': {
          showScreen('foodSort');
          requestAnimationFrame(() => {
            if (typeof startFoodSort !== 'function') return;
            startFoodSort({
              onAttempt: (skillId, ok) => recordAttempt(skillId, ok, 0),
              speak: (text, key) => Speech.phrase(key || gamePhraseKey(text), text),
              onComplete: () => goHome()
            });
          });
          break;
        }
        // v5.25 — Rammeplan Session B: Art, Culture & Creativity
        case 'draw': {
          showScreen('draw');
          requestAnimationFrame(() => {
            if (typeof startDraw !== 'function') return;
            startDraw({
              onAttempt: (skillId, ok) => recordAttempt(skillId, ok, 0),
              onComplete: () => goHome()
            });
          });
          break;
        }
        case 'rhythm': {
          showScreen('rhythm');
          requestAnimationFrame(() => {
            if (typeof startRhythm !== 'function') return;
            startRhythm({
              onAttempt: (skillId, ok) => recordAttempt(skillId, ok, 0),
              onComplete: () => goHome()
            });
          });
          break;
        }
        // v5.26 — Rammeplan Session C: Ethics, Religion & Philosophy
        case 'empathy': {
          showScreen('empathy');
          requestAnimationFrame(() => {
            if (typeof startEmpathy !== 'function') return;
            startEmpathy({
              onAttempt: (skillId, ok) => recordAttempt(skillId, ok, 0),
              onComplete: () => goHome()
            });
          });
          break;
        }
        case 'gratitude': {
          showScreen('gratitude');
          requestAnimationFrame(() => {
            if (typeof startGratitude !== 'function') return;
            startGratitude({
              onAttempt: (skillId, ok) => recordAttempt(skillId, ok, 0),
              onComplete: () => goHome()
            });
          });
          break;
        }
        // v5.27 — Rammeplan Session D: Nature, Environment & Technology
        case 'weather': {
          showScreen('weather');
          requestAnimationFrame(() => {
            if (typeof startWeather !== 'function') return;
            startWeather({
              onAttempt: (skillId, ok) => recordAttempt(skillId, ok, 0),
              onComplete: () => goHome()
            });
          });
          break;
        }
        case 'sort-it-out': {
          showScreen('sortItOut');
          requestAnimationFrame(() => {
            if (typeof startSortItOut !== 'function') return;
            startSortItOut({
              onAttempt: (skillId, ok) => recordAttempt(skillId, ok, 0),
              speak: (text, key) => Speech.phrase(key || gamePhraseKey(text), text),
              onComplete: () => goHome()
            });
          });
          break;
        }
        // v5.28 — Rammeplan Session E: measurement + spatial reasoning
        case 'measure': {
          showScreen('measure');
          requestAnimationFrame(() => {
            if (typeof startMeasure !== 'function') return;
            startMeasure({
              onAttempt: (skillId, ok) => recordAttempt(skillId, ok, 0),
              speak: (text, key) => Speech.phrase(key || gamePhraseKey(text), text),
              onComplete: () => goHome()
            });
          });
          break;
        }
        case 'where-is-it': {
          showScreen('whereIsIt');
          requestAnimationFrame(() => {
            if (typeof startWhereIsIt !== 'function') return;
            startWhereIsIt({
              onAttempt: (skillId, ok) => recordAttempt(skillId, ok, 0),
              speak: (text, key) => Speech.phrase(key || gamePhraseKey(text), text),
              onComplete: () => goHome()
            });
          });
          break;
        }
        // v5.29 — Rammeplan Session F: family + daily routines
        case 'family': {
          showScreen('family');
          requestAnimationFrame(() => {
            if (typeof startFamily !== 'function') return;
            startFamily({
              onAttempt: (skillId, ok) => recordAttempt(skillId, ok, 0),
              speak: (text, key) => Speech.phrase(key || gamePhraseKey(text), text),
              onComplete: () => goHome()
            });
          });
          break;
        }
        case 'routines': {
          showScreen('routines');
          requestAnimationFrame(() => {
            if (typeof startRoutines !== 'function') return;
            startRoutines({
              onAttempt: (skillId, ok) => recordAttempt(skillId, ok, 0),
              speak: (text, key) => Speech.phrase(key || gamePhraseKey(text), text),
              onComplete: () => goHome()
            });
          });
          break;
        }
        // v5.17 — full arcade math game (Math Blaster homage). Targets
        //         ages 7-10. Records skill events under math-{op}-{a}-{b}
        //         so the parent dashboard can see arithmetic engagement.
        case 'number-blaster': {
          showScreen('numberBlaster');
          requestAnimationFrame(() => {
            if (typeof startNumberBlaster !== 'function') return;
            startNumberBlaster({
              operator: '+',
              calmMode: false,
              onAttempt: (skillId, ok) => recordAttempt(skillId, ok, 0),
              speak: (text, key) => Speech.phrase(key || gamePhraseKey(text), text),
              onComplete: () => goHome()
            });
          });
          break;
        }
        // v5.16 — calm-arcade game (Letter / Number Lander). Same skills
        //         as find-letters / find-numbers, different delivery.
        case 'letter-lander':
        case 'number-lander': {
          showScreen('letterLander');
          const isNumber = mode === 'number-lander';
          const sourceMode = isNumber ? 'find-numbers' : 'find-letters';
          // Canvas needs the screen visible before fit; one frame is enough
          requestAnimationFrame(() => {
            if (typeof startLetterLander !== 'function') return;
            startLetterLander({
              target: isNumber ? 'number' : 'letter',
              // Use the same curriculum-aware picker the find- modes use
              pickTarget: () => {
                const profile = activeProfile();
                if (!profile) return isNumber ? '1' : 'A';
                try {
                  const skill = pickNextSkill(profile, sourceMode);
                  if (skill && skill.target) return skill.target;
                } catch {}
                const pool = isNumber ? NUMBERS : LETTERS;
                return pool[Math.floor(Math.random() * pool.length)];
              },
              // Record into the same skill-progress store as find- modes
              onAttempt: (skillId, ok) => recordAttempt(skillId, ok, 0),
              // v5.23 — speak through the single-source-of-truth chain
              speak: (text, key) => Speech.phrase(key || gamePhraseKey(text), text),
              onComplete: () => goHome()
            });
          });
          break;
        }
      }
    };

    /* Child agency mode: kid picks their own target before mode starts.
       Free play already IS agency — no picker. After first round, normal
       picker continues to run. The child can re-enter the mode to pick again. */
    const profile = activeProfile();
    if (profile?.settings.agencyMode === 'child' && mode !== 'play') {
      showAgencyPicker(mode, (chosen) => {
        state.chosenForRound = chosen;
        launchActivity();
      });
    } else {
      launchActivity();
    }
  }

  function goHome() {
    /* Common teardown — runs in both real-home AND chapter-advance
       paths so the previous mode's rAF loops + DOM are cleaned up. */
    VoiceEngine.stop();
    if (state.tracer) { state.tracer.destroy(); state.tracer = null; }
    // v5.16 — tear down the game engine if Letter / Number Lander is running
    if (typeof stopLetterLander === 'function') stopLetterLander();
    // v5.17 — tear down Number Blaster if running
    if (typeof stopNumberBlaster === 'function') stopNumberBlaster();
    // v5.18 — tear down EF trainers if running
    if (typeof stopSequenceStar === 'function') stopSequenceStar();
    if (typeof stopStopGo       === 'function') stopStopGo();
    if (typeof stopLaunchPad    === 'function') stopLaunchPad();
    // v5.20 — tear down round-2 EF trainers
    if (typeof stopSwitchIt   === 'function') stopSwitchIt();
    if (typeof stopStargazer  === 'function') stopStargazer();
    if (typeof stopReflect    === 'function') stopReflect();
    // v5.24 — Rammeplan Session A (Body / Movement / Health)
    if (typeof stopMoveWithMe === 'function') stopMoveWithMe();
    if (typeof stopFoodSort   === 'function') stopFoodSort();
    // v5.25 — Rammeplan Session B (Art / Culture / Creativity)
    if (typeof stopDraw       === 'function') stopDraw();
    if (typeof stopRhythm     === 'function') stopRhythm();
    // v5.26 — Rammeplan Session C (Ethics / Philosophy)
    if (typeof stopEmpathy    === 'function') stopEmpathy();
    if (typeof stopGratitude  === 'function') stopGratitude();
    // v5.27 — Rammeplan Session D (Nature / Environment / Technology)
    if (typeof stopWeather    === 'function') stopWeather();
    if (typeof stopSortItOut  === 'function') stopSortItOut();
    // v5.28 — Rammeplan Session E (Measurement / Spatial)
    if (typeof stopMeasure    === 'function') stopMeasure();
    if (typeof stopWhereIsIt  === 'function') stopWhereIsIt();
    // v5.29 — Rammeplan Session F (Society / Family / Routines)
    if (typeof stopFamily     === 'function') stopFamily();
    if (typeof stopRoutines   === 'function') stopRoutines();
    state.sessionStartedAt = 0;
    state.breakSuggested = false;
    state.wrongInRound = 0;
    clearHintTimer();
    setPulse(el.findTarget, false);
    setPulse(el.soundsPic, false);
    endSessionEarly();  // v5.1 — exits the daily-session flow if active
    refreshHeader();

    // v6.2 — if we're mid-adventure, hand control back to the
    // adventure runner instead of going home. Common teardown above
    // already ran; runner takes care of the next narrator screen.
    if (typeof isInAdventure === 'function' && isInAdventure()
        && typeof window.__adventureNextChapter === 'function') {
      const advance = window.__adventureNextChapter;
      window.__adventureNextChapter = null;
      advance();
      return;
    }

    refreshTodaySessionCard();
    refreshVoiceBanner();
    refreshTodaysAdventure();
    showScreen('home');
  }

  /* v5.13 — robotic-voice nudge.
     Shows the home banner only when ALL of these are true:
       1. The active profile hasn't dismissed it before
       2. They don't have any IDB recordings yet (a recording proves the
          parent already chose the better path)
       3. The voice the engine would pick is robotic-tier (Microsoft David /
          Zira / Mark / Hazel or an unscored unknown)
     If `speechSynthesis` is missing entirely we still surface the banner
     so the parent knows audio won't work and what to try next. */
  function refreshVoiceBanner() {
    const banner = el.voiceBanner;
    if (!banner) return;
    const profile = activeProfile();
    if (!profile) { banner.hidden = true; return; }
    if (profile.settings.roboticVoiceBannerDismissed) { banner.hidden = true; return; }
    if (recordedKeys.size > 0) { banner.hidden = true; return; }
    const noTTS = !('speechSynthesis' in window);
    const robotic = noTTS || VoiceEngine.isRoboticBestVoice();
    banner.hidden = !robotic;
  }

  // ============================================================
  //  FIND MODE
  // ============================================================
  function startFindRound() {
    state.advancing = false;
    state.wrongInRound = 0;
    clearHintTimer();
    setPulse(el.findTarget, false);
    const profile = activeProfile();
    if (!profile) return;

    /* v3.3 — use child's pre-picked skill on first round of mode if agency
       mode is on. After that, normal picker takes over for natural rotation. */
    let skill = state.chosenForRound;
    state.chosenForRound = null;
    if (!skill) skill = pickNextSkill(profile, state.mode, state.lastSkillId);
    if (!skill) return;
    state.currentSkill = skill;
    state.lastSkillId  = skill.id;
    state.target = skill.target;

    const isLetters = state.mode === 'find-letters';
    el.findPromptLabel.textContent = isLetters ? 'Find the letter' : 'Find the number';
    el.findTarget.textContent = isLetters ? caseFor(skill.target) : skill.target;

    const distractorPool = skillsForMode(state.mode).map((s) => s.target);
    const count = parseInt(profileSettings().choices, 10) || 3;
    const choices = pickDistractors(skill.target, distractorPool, count);

    el.findChoices.innerHTML = '';
    choices.forEach((sym) => {
      const display = isLetters ? caseFor(sym) : sym;
      const btn = document.createElement('button');
      btn.className = 'choice';
      btn.textContent = display;
      btn.addEventListener('click', () => onFindChoice(btn, sym));
      el.findChoices.appendChild(btn);
    });

    state.roundStartedAt = Date.now();
    setTimeout(() => {
      if (isLetters) sayLetter(skill.target);
      else sayNumber(skill.target);
    }, 250);
  }

  function onFindChoice(btn, sym) {
    if (state.advancing) return;
    clearHintTimer();
    const correct = String(sym).toUpperCase() === String(state.target).toUpperCase();
    recordAttempt(state.currentSkill.id, correct, roundDuration());
    if (correct) {
      state.advancing = true;
      btn.classList.add('correct');
      setPulse(el.findTarget, false);
      /* No TTS cheer — the sparkles are the celebration. Wait for any
         in-flight round-start audio to finish naturally before advancing,
         so we never cut the kid off mid-letter. */
      spawnSparkles(btn);
      advanceAfterSpeech(startFindRound);
    } else {
      state.wrongInRound++;
      btn.classList.add('wrong');
      setTimeout(() => btn.classList.remove('wrong'), 400);
      if (state.wrongInRound >= 2) setPulse(el.findTarget, true);
      /* Hint: silently re-cue the target after 3s of inactivity. No TTS
         "Try again" phrase — it was robotic in the absence of a local
         neural voice, and the target re-cue (via MP3 chain) is what's
         actually useful. */
      scheduleHint(null, null, () => {
        if (state.mode === 'find-letters') sayLetter(state.target);
        else sayNumber(state.target);
      });
    }
  }

  // ============================================================
  //  COUNT MODE
  // ============================================================
  function startCountRound() {
    state.advancing = false;
    state.wrongInRound = 0;
    clearHintTimer();
    const profile = activeProfile();
    if (!profile) return;

    let skill = state.chosenForRound;
    state.chosenForRound = null;
    if (!skill) skill = pickNextSkill(profile, 'count', state.lastSkillId);
    if (!skill) return;
    state.currentSkill = skill;
    state.lastSkillId  = skill.id;
    state.target = skill.target;
    const n = parseInt(skill.target, 10);

    el.countStage.innerHTML = '';
    const emoji = COUNT_EMOJIS[Math.floor(Math.random() * COUNT_EMOJIS.length)];
    for (let i = 0; i < n; i++) {
      const span = document.createElement('span');
      span.className = 'count-item';
      span.textContent = emoji;
      span.style.animationDelay = (i * 80) + 'ms';
      el.countStage.appendChild(span);
    }

    const distractorPool = skillsForMode('count').map((s) => s.target);
    const count = parseInt(profileSettings().choices, 10) || 3;
    const choices = pickDistractors(skill.target, distractorPool, count);

    el.countChoices.innerHTML = '';
    choices.forEach((num) => {
      const btn = document.createElement('button');
      btn.className = 'choice';
      btn.textContent = num;
      btn.addEventListener('click', () => onCountChoice(btn, num));
      el.countChoices.appendChild(btn);
    });

    state.roundStartedAt = Date.now();
    setTimeout(() => {
      /* Rotate through 4 prompt MP3s for variety. Each falls back
         to TTS speaking the human phrase when audio is unavailable. */
      const prompts = ['how-many', 'count-them', 'lets-count', 'how-many-do-you-see'];
      const fallbacks = ['How many?', 'Count them.', "Let's count.", 'How many do you see?'];
      const i = Math.floor(Math.random() * prompts.length);
      sayPromptKey(prompts[i], fallbacks[i]);
    }, 250);
  }

  function onCountChoice(btn, num) {
    if (state.advancing) return;
    clearHintTimer();
    const correct = num === state.target;
    recordAttempt(state.currentSkill.id, correct, roundDuration());
    if (correct) {
      state.advancing = true;
      btn.classList.add('correct');
      spawnSparkles(btn);
      advanceAfterSpeech(startCountRound);
    } else {
      state.wrongInRound++;
      btn.classList.add('wrong');
      setTimeout(() => btn.classList.remove('wrong'), 400);
      scheduleHint(null, null, () => sayNumber(state.target));
    }
  }

  // ============================================================
  //  SOUNDS MODE
  // ============================================================
  function startSoundsRound() {
    state.advancing = false;
    state.wrongInRound = 0;
    clearHintTimer();
    setPulse(el.soundsPic, false);
    const profile = activeProfile();
    if (!profile) return;

    let skill = state.chosenForRound;
    state.chosenForRound = null;
    if (!skill) skill = pickNextSkill(profile, 'sounds', state.lastSkillId);
    if (!skill) return;
    state.currentSkill = skill;
    state.lastSkillId  = skill.id;
    state.target = skill.target;
    const info = LETTER_WORDS[skill.target];

    el.soundsPic.textContent = info.emoji;
    el.soundsWord.textContent = info.word;

    const distractorPool = skillsForMode('sounds').map((s) => s.target);
    const count = parseInt(profileSettings().choices, 10) || 3;
    const choices = pickDistractors(skill.target, distractorPool, count);

    el.soundsChoices.innerHTML = '';
    choices.forEach((letter) => {
      const btn = document.createElement('button');
      btn.className = 'choice';
      btn.textContent = letter;
      btn.addEventListener('click', () => onSoundsChoice(btn, letter));
      el.soundsChoices.appendChild(btn);
    });

    state.roundStartedAt = Date.now();
    /* MP3 chain: word ("Apple") then letter-sound ("ah"). Both already
       in the audio pack from the original generate run. */
    setTimeout(async () => {
      await sayWord(skill.target);
      sayLetter(skill.target, { mode: 'sound' });
    }, 250);
  }

  function onSoundsChoice(btn, letter) {
    if (state.advancing) return;
    clearHintTimer();
    const correct = letter === state.target;
    recordAttempt(state.currentSkill.id, correct, roundDuration());
    const info = LETTER_WORDS[state.target];
    if (correct) {
      state.advancing = true;
      btn.classList.add('correct');
      setPulse(el.soundsPic, false);
      spawnSparkles(btn);
      advanceAfterSpeech(startSoundsRound);
    } else {
      state.wrongInRound++;
      btn.classList.add('wrong');
      setTimeout(() => btn.classList.remove('wrong'), 400);
      if (state.wrongInRound >= 2) setPulse(el.soundsPic, true);
      scheduleHint(null, null, () => sayWord(state.target));
    }
  }

  // ============================================================
  //  v4 — PHONEMIC AWARENESS MODES
  //  Pedagogical bridge from "knows letters" to "can read".
  //  Three modes: First-sound isolation, Rhyme matching, Blending.
  // ============================================================

  /* v5.0.5 — Phoneme-to-letter map.
     CVC blend phonemes ('kuh', 'ah', 'tuh', ...) are identical to the
     phonics sounds we already MP3'd per letter in audio/letters/sound/X.mp3.
     This map lets blend mode reuse those existing MP3s instead of falling
     back to robotic TTS. Built once from LETTER_SOUNDS at module load. */
  const PHONEME_TO_LETTER = (() => {
    const map = {};
    if (typeof LETTER_SOUNDS === 'object' && LETTER_SOUNDS) {
      for (const [letter, sound] of Object.entries(LETTER_SOUNDS)) {
        if (!map[sound]) map[sound] = letter;
      }
    }
    return map;
  })();

  /* Play CVC phonemes as a chain of letter-sound MP3s with deliberate
     gaps between (so the child hears them as separate sounds and can
     mentally blend). Falls back to VoiceEngine.speakSequence per-phoneme
     when the audio pack isn't on or a phoneme isn't mapped. The fallback
     used to call speechSynthesis directly, which bypassed audioPlayer.stop()
     and could overlap an in-flight MP3 — fixed in v5.13. */
  async function playPhonemeChain(phonemes, opts = {}) {
    if (!phonemes || !phonemes.length) return;
    // v5.15 — speed-table driven so blend mode follows the parent's
    // Speech-speed choice. Still slower / more spaced than `speak()`
    // since blending requires discrete phoneme perception.
    const pauseMs = opts.pauseMs ?? speechSpeed().pauseMs;
    const ttsBuffer = [];

    const flushTTS = async () => {
      if (!ttsBuffer.length) return;
      await VoiceEngine.speakSequence(ttsBuffer.slice(), { ...opts, pauseMs });
      ttsBuffer.length = 0;
    };

    for (let i = 0; i < phonemes.length; i++) {
      const ph = phonemes[i];
      const letter = PHONEME_TO_LETTER[ph];
      if (letter && profileSettings().customAudio === 'auto') {
        // Flush any pending TTS phonemes first so MP3 and TTS don't overlap
        await flushTTS();
        const ok = await tryAudio(`./audio/letters/sound/${letter}.mp3`);
        if (ok) {
          if (i < phonemes.length - 1) await new Promise((r) => setTimeout(r, pauseMs));
          continue;
        }
      }
      ttsBuffer.push(ph);
    }
    await flushTTS();
  }

  /* Legacy alias — kept so we don't have to touch every Blend-mode call site
     in this turn. Routes through VoiceEngine.speakSequence which serializes
     correctly against audioPlayer. */
  function speakChain(parts, opts = {}) {
    return VoiceEngine.speakSequence(parts, opts);
  }

  // ─────────────────────────────────────────────────────────────
  //  First-sound isolation
  //  "What does 'cat' start with?" — child hears the word, taps the letter
  // ─────────────────────────────────────────────────────────────
  function startFirstSoundRound() {
    state.advancing = false;
    state.wrongInRound = 0;
    clearHintTimer();
    const profile = activeProfile();
    if (!profile) return;

    let skill = state.chosenForRound;
    state.chosenForRound = null;
    if (!skill) skill = pickNextSkill(profile, 'first-sound', state.lastSkillId);
    if (!skill) return;
    state.currentSkill = skill;
    state.lastSkillId  = skill.id;
    state.target = skill.target;
    const info = LETTER_WORDS[skill.target] || { word: skill.target, emoji: '' };

    el.firstSoundEmoji.textContent = info.emoji;
    el.firstSoundWord.textContent  = info.word;

    const distractorPool = LETTERS;
    const count = parseInt(profileSettings().choices, 10) || 3;
    const choices = pickDistractors(skill.target, distractorPool, count);

    el.firstSoundChoices.innerHTML = '';
    choices.forEach((letter) => {
      const btn = document.createElement('button');
      btn.className = 'choice';
      btn.textContent = letter;
      btn.addEventListener('click', () => onFirstSoundChoice(btn, letter));
      el.firstSoundChoices.appendChild(btn);
    });

    state.roundStartedAt = Date.now();
    /* MP3 chain: word, then letter-sound, then word again. Same cue pattern
       a kindergarten teacher would use: "Apple. ah. Apple." */
    setTimeout(async () => {
      await sayWord(skill.target);
      await sayLetter(skill.target, { mode: 'sound' });
      sayWord(skill.target);
    }, 250);
  }

  function onFirstSoundChoice(btn, letter) {
    if (state.advancing) return;
    clearHintTimer();
    const correct = letter === state.target;
    recordAttempt(state.currentSkill.id, correct, roundDuration());
    const info = LETTER_WORDS[state.target] || { word: state.target };
    if (correct) {
      state.advancing = true;
      btn.classList.add('correct');
      spawnSparkles(btn);
      advanceAfterSpeech(startFirstSoundRound);
    } else {
      state.wrongInRound++;
      btn.classList.add('wrong');
      setTimeout(() => btn.classList.remove('wrong'), 400);
      if (state.wrongInRound >= 2) setPulse(el.firstSoundEmoji, true);
      scheduleHint(null, null, async () => {
        await sayWord(state.target);
        await sayLetter(state.target, { mode: 'sound' });
        sayWord(state.target);
      });
    }
  }

  el.firstSoundReplay?.addEventListener('click', async () => {
    if (state.advancing || !state.target) return;
    clearHintTimer();
    await sayWord(state.target);
    await sayLetter(state.target, { mode: 'sound' });
    sayWord(state.target);
  });

  // ─────────────────────────────────────────────────────────────
  //  Rhyme matching
  //  Show one word; child taps which of 3 picture choices rhymes with it.
  // ─────────────────────────────────────────────────────────────
  function startRhymeRound() {
    state.advancing = false;
    state.wrongInRound = 0;
    clearHintTimer();
    const profile = activeProfile();
    if (!profile) return;

    let skill = state.chosenForRound;
    state.chosenForRound = null;
    if (!skill) skill = pickNextSkill(profile, 'rhyme', state.lastSkillId);
    if (!skill) return;
    state.currentSkill = skill;
    state.lastSkillId  = skill.id;
    state.target = skill.target; // rhyme family key

    const family = RHYME_FAMILIES.find((f) => f.key === skill.target);
    if (!family || family.words.length < 2) return;

    // Pick the cue (the word we show) and the match (a word from same family)
    const shuffled = shuffle(family.words);
    const cue   = shuffled[0];
    const match = shuffled[1];

    // Pick 2 distractors from other families
    const otherFamilies = RHYME_FAMILIES.filter((f) => f.key !== skill.target);
    const distractors = [];
    while (distractors.length < 2 && otherFamilies.length) {
      const f = otherFamilies.splice(Math.floor(Math.random() * otherFamilies.length), 1)[0];
      distractors.push(f.words[Math.floor(Math.random() * f.words.length)]);
    }
    const choices = shuffle([match, ...distractors]);

    el.rhymeTargetEmoji.textContent = cue.e;
    el.rhymeTargetWord.textContent  = cue.w;
    state.rhymeMatch = match.w;

    el.rhymeChoices.innerHTML = '';
    choices.forEach((word) => {
      const btn = document.createElement('button');
      btn.className = 'picture-choice';
      btn.innerHTML = `<span class="pc-emoji">${word.e}</span><span class="pc-word">${escapeHtml(word.w)}</span>`;
      btn.addEventListener('click', () => onRhymeChoice(btn, word.w));
      el.rhymeChoices.appendChild(btn);
    });

    state.roundStartedAt = Date.now();
    setTimeout(async () => {
      // Speak cue word twice using MP3 if available
      await sayConcept('voc', cue.w, cue.w);
      sayConcept('voc', cue.w, cue.w);
    }, 300);
  }

  function onRhymeChoice(btn, word) {
    if (state.advancing) return;
    clearHintTimer();
    const correct = word === state.rhymeMatch;
    recordAttempt(state.currentSkill.id, correct, roundDuration());
    if (correct) {
      state.advancing = true;
      btn.classList.add('correct');
      spawnSparkles(btn);
      advanceAfterSpeech(startRhymeRound);
    } else {
      state.wrongInRound++;
      btn.classList.add('wrong');
      setTimeout(() => btn.classList.remove('wrong'), 400);
      const cueWord = el.rhymeTargetWord.textContent;
      scheduleHint(null, null, () => sayConcept('voc', cueWord, cueWord));
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  Blending
  //  Hear "c... a... t" → tap the matching picture.
  //  Highest cognitive load; recommended 4y+.
  // ─────────────────────────────────────────────────────────────
  function startBlendRound() {
    state.advancing = false;
    state.wrongInRound = 0;
    clearHintTimer();
    const profile = activeProfile();
    if (!profile) return;

    let skill = state.chosenForRound;
    state.chosenForRound = null;
    if (!skill) skill = pickNextSkill(profile, 'blend', state.lastSkillId);
    if (!skill) return;
    state.currentSkill = skill;
    state.lastSkillId  = skill.id;
    state.target = skill.target;

    const cvc = CVC_WORDS.find((c) => c.word === skill.target);
    if (!cvc) return;
    state.blendPhonemes = cvc.phonemes;
    state.blendWord     = cvc.word;

    /* Show phoneme cards (visual scaffold) but de-emphasize until the child
       has tried. Pedagogy: blend should be primarily an auditory task. */
    el.blendPhonemes.innerHTML = '';
    cvc.phonemes.forEach((p, i) => {
      const span = document.createElement('span');
      span.className = 'blend-phoneme';
      span.textContent = p;
      span.style.animationDelay = (i * 200) + 'ms';
      el.blendPhonemes.appendChild(span);
    });

    // Pick 2 distractor words from other CVCs
    const others = CVC_WORDS.filter((c) => c.word !== cvc.word);
    const distractors = shuffle(others).slice(0, 2);
    const choices = shuffle([cvc, ...distractors]);

    el.blendChoices.innerHTML = '';
    choices.forEach((c) => {
      const btn = document.createElement('button');
      btn.className = 'picture-choice';
      btn.innerHTML = `<span class="pc-emoji">${c.emoji}</span>`;
      btn.dataset.word = c.word;
      btn.addEventListener('click', () => onBlendChoice(btn, c.word));
      el.blendChoices.appendChild(btn);
    });

    state.roundStartedAt = Date.now();
    setTimeout(() => playPhonemeChain(cvc.phonemes, { rate: 0.55, pauseMs: 500 }), 300);
  }

  function onBlendChoice(btn, word) {
    if (state.advancing) return;
    clearHintTimer();
    const correct = word === state.blendWord;
    recordAttempt(state.currentSkill.id, correct, roundDuration());
    if (correct) {
      state.advancing = true;
      btn.classList.add('correct');
      /* The big reveal: phonemes blended into the whole word */
      spawnSparkles(btn);
      advanceAfterSpeech(startBlendRound);
    } else {
      state.wrongInRound++;
      btn.classList.add('wrong');
      setTimeout(() => btn.classList.remove('wrong'), 400);
      scheduleHint('soundsHint', {}, () => {
        playPhonemeChain(state.blendPhonemes, { rate: 0.55, pauseMs: 500 });
      });
    }
  }

  el.blendReplay?.addEventListener('click', () => {
    if (state.advancing || !state.blendPhonemes) return;
    clearHintTimer();
    playPhonemeChain(state.blendPhonemes, { rate: 0.55, pauseMs: 500 });
  });

  // ============================================================
  //  v5 — WHOLE-CHILD MODES
  //  Picker-style modes covering Rammeplan areas 2, 3, 4, 5, 6, 7.
  //  All follow the same shape: stimulus + N choices, tap matching.
  //  Wrong taps follow the same forgiving flow as Find / Sounds /
  //  Rhyme — wiggle, no penalty, delayed rotating-phrase re-cue.
  // ============================================================

  /* Shared helper — builds N choice buttons inside a container, each
     calling the supplied onTap when clicked. Returns the chosen items
     (the first one is always the correct target). */
  function buildPickerChoices(container, target, pool, count, onTap, renderItem) {
    const others = pool.filter((p) => p !== target);
    const distractors = shuffle(others).slice(0, Math.max(1, count - 1));
    const ordered = shuffle([target, ...distractors]);
    container.innerHTML = '';
    ordered.forEach((item) => {
      const btn = document.createElement('button');
      btn.className = 'picture-choice';
      btn.innerHTML = renderItem(item);
      btn.addEventListener('click', () => onTap(btn, item));
      container.appendChild(btn);
    });
    return ordered;
  }

  /* ─── Feelings (Rammeplan area 6 — Ethics / emotions) ─── */
  function startFeelingsRound() {
    state.advancing = false; state.wrongInRound = 0;
    clearHintTimer();
    const profile = activeProfile();
    if (!profile) return;

    let skill = state.chosenForRound; state.chosenForRound = null;
    if (!skill) skill = pickNextSkill(profile, 'feelings', state.lastSkillId);
    if (!skill) return;
    state.currentSkill = skill; state.lastSkillId = skill.id; state.target = skill.target;

    const feeling = FEELINGS.find((f) => f.key === skill.target);
    if (!feeling) return;
    el.feelingsPrompt.textContent = `Find the ${feeling.label} face`;

    const count = parseInt(profileSettings().choices, 10) || 3;
    buildPickerChoices(el.feelingsChoices, feeling, FEELINGS, count,
      (btn, item) => onFeelingsChoice(btn, item.key),
      (f) => `<span class="pc-emoji">${f.emoji}</span><span class="pc-word">${escapeHtml(f.label)}</span>`);

    state.roundStartedAt = Date.now();
    setTimeout(() => sayPromptKey(`find-${feeling.key}`, `Find the ${feeling.label} face.`), 280);
  }
  function onFeelingsChoice(btn, key) {
    if (state.advancing) return;
    clearHintTimer();
    const correct = key === state.target;
    recordAttempt(state.currentSkill.id, correct, roundDuration());
    const target = FEELINGS.find((f) => f.key === state.target);
    if (correct) {
      state.advancing = true; btn.classList.add('correct');
      spawnSparkles(btn); advanceAfterSpeech(startFeelingsRound);
    } else {
      state.wrongInRound++; btn.classList.add('wrong');
      setTimeout(() => btn.classList.remove('wrong'), 400);
      scheduleHint(null, null, () => sayPromptKey(`find-${state.target}`, `Find the ${target.label} face.`));
    }
  }

  /* ─── Body parts (Rammeplan area 2 — Body) ─── */
  function startBodyRound() {
    state.advancing = false; state.wrongInRound = 0;
    clearHintTimer();
    const profile = activeProfile();
    if (!profile) return;

    let skill = state.chosenForRound; state.chosenForRound = null;
    if (!skill) skill = pickNextSkill(profile, 'body', state.lastSkillId);
    if (!skill) return;
    state.currentSkill = skill; state.lastSkillId = skill.id; state.target = skill.target;

    const part = BODY_PARTS.find((b) => b.key === skill.target);
    if (!part) return;
    el.bodyPrompt.textContent = part.prompt;

    const count = parseInt(profileSettings().choices, 10) || 3;
    buildPickerChoices(el.bodyChoices, part, BODY_PARTS, count,
      (btn, item) => onBodyChoice(btn, item.key),
      (b) => `<span class="pc-emoji">${b.emoji}</span><span class="pc-word">${escapeHtml(b.label)}</span>`);

    state.roundStartedAt = Date.now();
    setTimeout(() => sayPromptKey(`where-is-the-${part.key}`, part.prompt), 280);
  }
  function onBodyChoice(btn, key) {
    if (state.advancing) return;
    clearHintTimer();
    const correct = key === state.target;
    recordAttempt(state.currentSkill.id, correct, roundDuration());
    const target = BODY_PARTS.find((b) => b.key === state.target);
    if (correct) {
      state.advancing = true; btn.classList.add('correct');
      spawnSparkles(btn); advanceAfterSpeech(startBodyRound);
    } else {
      state.wrongInRound++; btn.classList.add('wrong');
      setTimeout(() => btn.classList.remove('wrong'), 400);
      scheduleHint(null, null, () => sayPromptKey(`where-is-the-${state.target}`, target.prompt));
    }
  }

  /* ─── Shapes (Rammeplan area 5 — Quantity/space/shape) ─── */
  function renderShapeSVG(shape) {
    return `<svg viewBox="0 0 200 240" class="shape-svg" xmlns="http://www.w3.org/2000/svg">${shape.svgInner}</svg>`;
  }
  function startShapesRound() {
    state.advancing = false; state.wrongInRound = 0;
    clearHintTimer();
    const profile = activeProfile();
    if (!profile) return;

    let skill = state.chosenForRound; state.chosenForRound = null;
    if (!skill) skill = pickNextSkill(profile, 'shapes', state.lastSkillId);
    if (!skill) return;
    state.currentSkill = skill; state.lastSkillId = skill.id; state.target = skill.target;

    const shape = SHAPES.find((s) => s.key === skill.target);
    if (!shape) return;
    el.shapesPrompt.innerHTML = `Find the <strong>${escapeHtml(shape.label)}</strong>`;

    const count = parseInt(profileSettings().choices, 10) || 3;
    buildPickerChoices(el.shapesChoices, shape, SHAPES, count,
      (btn, item) => onShapesChoice(btn, item.key),
      (s) => `<span class="pc-shape">${renderShapeSVG(s)}</span>`);

    state.roundStartedAt = Date.now();
    setTimeout(() => sayPromptKey(`find-the-${shape.key}`, `Find the ${shape.label}.`), 280);
  }
  function onShapesChoice(btn, key) {
    if (state.advancing) return;
    clearHintTimer();
    const correct = key === state.target;
    recordAttempt(state.currentSkill.id, correct, roundDuration());
    const target = SHAPES.find((s) => s.key === state.target);
    if (correct) {
      state.advancing = true; btn.classList.add('correct');
      spawnSparkles(btn); advanceAfterSpeech(startShapesRound);
    } else {
      state.wrongInRound++; btn.classList.add('wrong');
      setTimeout(() => btn.classList.remove('wrong'), 400);
      scheduleHint(null, null, () => sayPromptKey(`find-the-${state.target}`, `Find the ${target.label}.`));
    }
  }

  /* ─── Colors (Rammeplan area 3 — Art/creativity) ─── */
  function startColorsRound() {
    state.advancing = false; state.wrongInRound = 0;
    clearHintTimer();
    const profile = activeProfile();
    if (!profile) return;

    let skill = state.chosenForRound; state.chosenForRound = null;
    if (!skill) skill = pickNextSkill(profile, 'colors', state.lastSkillId);
    if (!skill) return;
    state.currentSkill = skill; state.lastSkillId = skill.id; state.target = skill.target;

    const color = COLORS.find((c) => c.key === skill.target);
    if (!color) return;
    el.colorsPrompt.innerHTML = `Find <strong>${escapeHtml(color.label)}</strong>`;

    const count = parseInt(profileSettings().choices, 10) || 3;
    buildPickerChoices(el.colorsChoices, color, COLORS, count,
      (btn, item) => onColorsChoice(btn, item.key),
      (c) => `<span class="pc-swatch" style="background:${c.oklch};background:${c.fallback}"></span><span class="pc-word">${escapeHtml(c.label)}</span>`);

    state.roundStartedAt = Date.now();
    setTimeout(() => sayPromptKey(`find-${color.key}`, `Find ${color.label}.`), 280);
  }
  function onColorsChoice(btn, key) {
    if (state.advancing) return;
    clearHintTimer();
    const correct = key === state.target;
    recordAttempt(state.currentSkill.id, correct, roundDuration());
    const target = COLORS.find((c) => c.key === state.target);
    if (correct) {
      state.advancing = true; btn.classList.add('correct');
      spawnSparkles(btn); advanceAfterSpeech(startColorsRound);
    } else {
      state.wrongInRound++; btn.classList.add('wrong');
      setTimeout(() => btn.classList.remove('wrong'), 400);
      scheduleHint(null, null, () => sayPromptKey(`find-${state.target}`, `Find ${target.label}.`));
    }
  }

  /* ─── Patterns (Rammeplan area 5 — pattern recognition) ─── */
  function startPatternsRound() {
    state.advancing = false; state.wrongInRound = 0;
    clearHintTimer();
    const profile = activeProfile();
    if (!profile) return;

    let skill = state.chosenForRound; state.chosenForRound = null;
    if (!skill) skill = pickNextSkill(profile, 'patterns', state.lastSkillId);
    if (!skill) return;
    state.currentSkill = skill; state.lastSkillId = skill.id; state.target = skill.target;

    const rule = PATTERN_RULES.find((p) => p.key === skill.target);
    if (!rule) return;

    // Assign a random color to each unique letter in the pattern
    const letters = [...new Set(rule.sequence)];
    const palette = shuffle(COLORS.filter((c) => c.key !== 'white')).slice(0, letters.length);
    const itemFor = {};
    letters.forEach((l, i) => { itemFor[l] = palette[i]; });

    el.patternDisplay.innerHTML = '';
    rule.sequence.forEach((l, i) => {
      const span = document.createElement('span');
      if (i === rule.hideIdx) {
        span.className = 'pattern-slot empty';
        span.textContent = '?';
      } else {
        span.className = 'pattern-slot';
        span.style.background = itemFor[l].oklch;
      }
      el.patternDisplay.appendChild(span);
    });

    const correctItem = itemFor[rule.sequence[rule.hideIdx]];
    state.patternCorrectKey = correctItem.key;
    const distractors = shuffle(COLORS.filter((c) => c.key !== correctItem.key && c.key !== 'white')).slice(0, 2);
    const ordered = shuffle([correctItem, ...distractors]);

    el.patternChoices.innerHTML = '';
    ordered.forEach((c) => {
      const btn = document.createElement('button');
      btn.className = 'picture-choice pattern-choice';
      btn.innerHTML = `<span class="pc-swatch" style="background:${c.oklch};background:${c.fallback}"></span>`;
      btn.addEventListener('click', () => onPatternsChoice(btn, c.key));
      el.patternChoices.appendChild(btn);
    });

    state.roundStartedAt = Date.now();
    setTimeout(() => sayPromptKey('whats-next', 'What comes next?'), 280);
  }
  function onPatternsChoice(btn, key) {
    if (state.advancing) return;
    clearHintTimer();
    const correct = key === state.patternCorrectKey;
    recordAttempt(state.currentSkill.id, correct, roundDuration());
    if (correct) {
      state.advancing = true; btn.classList.add('correct');
      spawnSparkles(btn); advanceAfterSpeech(startPatternsRound);
    } else {
      state.wrongInRound++; btn.classList.add('wrong');
      setTimeout(() => btn.classList.remove('wrong'), 400);
      scheduleHint(null, null, () => sayPromptKey('whats-next', 'What comes next?'));
    }
  }

  /* ─── Animals & habitats (Rammeplan area 4 — Nature) ─── */
  function startAnimalsRound() {
    state.advancing = false; state.wrongInRound = 0;
    clearHintTimer();
    const profile = activeProfile();
    if (!profile) return;

    let skill = state.chosenForRound; state.chosenForRound = null;
    if (!skill) skill = pickNextSkill(profile, 'animals', state.lastSkillId);
    if (!skill) return;
    state.currentSkill = skill; state.lastSkillId = skill.id; state.target = skill.target;

    const pair = ANIMAL_HABITATS.find((a) => a.key === skill.target);
    if (!pair) return;
    el.animalsCue.innerHTML = `<span class="pc-emoji">${pair.animal.e}</span><span class="pc-word">${escapeHtml(pair.animal.name)}</span>`;

    const otherHabitats = ANIMAL_HABITATS.filter((a) => a.habitat.name !== pair.habitat.name);
    const distractors = shuffle(otherHabitats).slice(0, 2).map((a) => a.habitat);
    const ordered = shuffle([pair.habitat, ...distractors]);
    state.animalCorrect = pair.habitat.name;

    el.animalsChoices.innerHTML = '';
    ordered.forEach((h) => {
      const btn = document.createElement('button');
      btn.className = 'picture-choice';
      btn.innerHTML = `<span class="pc-emoji">${h.e}</span><span class="pc-word">${escapeHtml(h.name)}</span>`;
      btn.addEventListener('click', () => onAnimalsChoice(btn, h.name));
      el.animalsChoices.appendChild(btn);
    });

    state.roundStartedAt = Date.now();
    setTimeout(async () => {
      await sayConcept('animals', pair.animal.name, pair.animal.name);
      sayPromptKey('where-does-it-live', 'Where does it live?');
    }, 280);
  }
  function onAnimalsChoice(btn, name) {
    if (state.advancing) return;
    clearHintTimer();
    const correct = name === state.animalCorrect;
    recordAttempt(state.currentSkill.id, correct, roundDuration());
    if (correct) {
      state.advancing = true; btn.classList.add('correct');
      spawnSparkles(btn); advanceAfterSpeech(startAnimalsRound);
    } else {
      state.wrongInRound++; btn.classList.add('wrong');
      setTimeout(() => btn.classList.remove('wrong'), 400);
      const pair = ANIMAL_HABITATS.find((a) => a.key === state.target);
      scheduleHint(null, null, async () => {
        await sayConcept('animals', pair.animal.name, pair.animal.name);
        sayPromptKey('where-does-it-live', 'Where does it live?');
      });
    }
  }

  /* ─── Community helpers (Rammeplan area 7 — Society) ─── */
  function startHelpersRound() {
    state.advancing = false; state.wrongInRound = 0;
    clearHintTimer();
    const profile = activeProfile();
    if (!profile) return;

    let skill = state.chosenForRound; state.chosenForRound = null;
    if (!skill) skill = pickNextSkill(profile, 'helpers', state.lastSkillId);
    if (!skill) return;
    state.currentSkill = skill; state.lastSkillId = skill.id; state.target = skill.target;

    const item = COMMUNITY_HELPERS.find((h) => h.key === skill.target);
    if (!item) return;
    el.helpersScenario.textContent = item.scenario.e;
    el.helpersQuestion.textContent = item.scenario.q;

    const otherHelpers = COMMUNITY_HELPERS.filter((h) => h.key !== item.key);
    const distractors = shuffle(otherHelpers).slice(0, 2).map((h) => h.helper);
    const ordered = shuffle([item.helper, ...distractors]);
    state.helperCorrect = item.helper.name;

    el.helpersChoices.innerHTML = '';
    ordered.forEach((h) => {
      const btn = document.createElement('button');
      btn.className = 'picture-choice';
      btn.innerHTML = `<span class="pc-emoji">${h.e}</span><span class="pc-word">${escapeHtml(h.name)}</span>`;
      btn.addEventListener('click', () => onHelpersChoice(btn, h.name));
      el.helpersChoices.appendChild(btn);
    });

    state.roundStartedAt = Date.now();
    setTimeout(() => {
      /* Map helper key to phrase MP3 key */
      const phraseKey = ({
        firefighter: 'fire-question',
        doctor:      'sick-question',
        teacher:     'learn-question',
        police:      'safety-question',
        chef:        'food-question',
        farmer:      'grow-question',
        mechanic:    'car-question',
        mail:        'mail-question'
      })[item.key] || null;
      if (phraseKey) sayPromptKey(phraseKey, item.scenario.q);
      else VoiceEngine.speak([item.scenario.q]);
    }, 280);
  }
  function onHelpersChoice(btn, name) {
    if (state.advancing) return;
    clearHintTimer();
    const correct = name === state.helperCorrect;
    recordAttempt(state.currentSkill.id, correct, roundDuration());
    if (correct) {
      state.advancing = true; btn.classList.add('correct');
      spawnSparkles(btn); advanceAfterSpeech(startHelpersRound);
    } else {
      state.wrongInRound++; btn.classList.add('wrong');
      setTimeout(() => btn.classList.remove('wrong'), 400);
      const item = COMMUNITY_HELPERS.find((h) => h.key === state.target);
      scheduleHint(null, null, () => {
        const phraseKey = ({
          firefighter:'fire-question', doctor:'sick-question',
          teacher:'learn-question',    police:'safety-question',
          chef:'food-question',        farmer:'grow-question',
          mechanic:'car-question',     mail:'mail-question'
        })[item.key];
        if (phraseKey) sayPromptKey(phraseKey, item.scenario.q);
        else VoiceEngine.speak([item.scenario.q]);
      });
    }
  }

  // ============================================================
  //  v5 — PARENT RESOURCES (off-screen activities + reading log)
  //  These deliberately add NO game mechanics for the child.
  //  They make the app a Norwegian-aligned platform rather than
  //  just Norwegian-style game content.
  // ============================================================

  let activityFilter = 'all';

  function renderActivities() {
    if (!el.activitiesList) return;
    const profile = activeProfile();
    if (!profile) return;
    const age = profile.ageMonths;

    const pool = (typeof PARENT_ACTIVITIES !== 'undefined' ? PARENT_ACTIVITIES : []).filter((a) => {
      if (a.minAge > age + 6) return false; // skip clearly too-old activities
      if (activityFilter !== 'all' && a.area !== activityFilter) return false;
      return true;
    });
    const chosen = shuffle(pool).slice(0, 3);

    el.activitiesList.innerHTML = '';
    if (chosen.length === 0) {
      el.activitiesList.innerHTML = '<p style="color:var(--text-soft); padding:16px;">No activities match that filter for this age. Pick a different category or "All".</p>';
      return;
    }
    chosen.forEach((a) => {
      const card = document.createElement('div');
      card.className = `activity-card area-${a.area}`;
      card.innerHTML = `
        <div class="activity-area-tag">${escapeHtml(a.area)}</div>
        <div class="activity-text">${escapeHtml(a.t)}</div>
      `;
      el.activitiesList.appendChild(card);
    });
  }

  function openActivities() {
    closeSettings();
    renderActivities();
    el.modalActivities?.classList.add('active');
  }

  el.activitiesBtn?.addEventListener('click', openActivities);
  el.activitiesRefresh?.addEventListener('click', renderActivities);
  el.activitiesClose?.addEventListener('click', () => el.modalActivities.classList.remove('active'));
  el.modalActivities?.addEventListener('click', (e) => {
    if (e.target === el.modalActivities) el.modalActivities.classList.remove('active');
  });
  el.activitiesFilters?.forEach((b) => {
    b.addEventListener('click', () => {
      el.activitiesFilters.forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      activityFilter = b.dataset.activityFilter;
      renderActivities();
    });
  });

  /* ─── Reading log ───
     Per-profile log of books read aloud together. The Rammeplan
     emphasizes read-aloud as the single strongest predictor of
     later reading; we record this not to gamify but to make it
     easy for the parent to keep up the practice. */

  function ensureReadingLog(profile) {
    profile.readingLog ||= [];
    return profile.readingLog;
  }

  function readingStatsForMonth(log) {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonth = log.filter((e) => (e.date || '').startsWith(monthStart));
    return {
      thisMonth: thisMonth.length,
      total: log.length,
      lastDate: log[0]?.date || null
    };
  }

  function renderReading() {
    const profile = activeProfile();
    if (!profile || !el.readingList) return;
    const log = ensureReadingLog(profile);

    const stats = readingStatsForMonth(log);
    if (el.readingStats) {
      el.readingStats.innerHTML = log.length === 0
        ? '<em>No books logged yet. The first one is the hardest — add a book you read this week.</em>'
        : `<strong>${stats.thisMonth}</strong> book${stats.thisMonth === 1 ? '' : 's'} read together this month · ${stats.total} total`;
    }

    el.readingList.innerHTML = '';
    [...log].reverse().forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'reading-row';
      row.innerHTML = `
        <div class="reading-row-main">
          <div class="reading-row-title">${escapeHtml(entry.title)}</div>
          <div class="reading-row-meta">${escapeHtml(entry.date || '')}${entry.reader ? ` · with ${escapeHtml(entry.reader)}` : ''}</div>
        </div>
        <button class="reading-row-delete" data-id="${entry.id}" aria-label="Remove">✕</button>
      `;
      el.readingList.appendChild(row);
    });
  }

  function openReading() {
    closeSettings();
    if (el.readingDate) el.readingDate.value = todayString();
    renderReading();
    el.modalReading?.classList.add('active');
  }

  el.readingBtn?.addEventListener('click', openReading);
  el.readingClose?.addEventListener('click', () => el.modalReading.classList.remove('active'));
  el.modalReading?.addEventListener('click', (e) => {
    if (e.target === el.modalReading) el.modalReading.classList.remove('active');
  });

  el.readingAddForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const profile = activeProfile();
    if (!profile) return;
    const title = (el.readingTitle.value || '').trim();
    if (!title) return;
    const log = ensureReadingLog(profile);
    log.push({
      id: cryptoRandomId().slice(0, 8),
      title: title.slice(0, 200),
      date: el.readingDate.value || todayString(),
      reader: (el.readingReader.value || '').trim().slice(0, 60) || null
    });
    saveStorage();
    el.readingTitle.value = '';
    el.readingReader.value = '';
    renderReading();
  });

  el.readingList?.addEventListener('click', (e) => {
    const btn = e.target.closest('.reading-row-delete');
    if (!btn) return;
    const profile = activeProfile();
    if (!profile) return;
    const log = ensureReadingLog(profile);
    profile.readingLog = log.filter((x) => x.id !== btn.dataset.id);
    saveStorage();
    renderReading();
  });

  // ============================================================
  //  v5.2 — SIGHT WORDS (Dolch pre-primer; skolestart 5y+ band)
  //  Shows one target word, child taps the matching word among
  //  3 choices. Bridges from letter recognition to actual reading.
  // ============================================================

  async function saySightWord(word) {
    const key = String(word).toLowerCase();
    if (profileSettings().customAudio === 'auto') {
      const ok = await tryAudio(`./audio/sight-words/${key}.mp3`);
      if (ok) return;
    }
    VoiceEngine.speak([word]);
  }

  function startSightWordsRound() {
    state.advancing = false; state.wrongInRound = 0;
    clearHintTimer();
    const profile = activeProfile();
    if (!profile) return;

    let skill = state.chosenForRound; state.chosenForRound = null;
    if (!skill) skill = pickNextSkill(profile, 'sight-words', state.lastSkillId);
    if (!skill) return;
    state.currentSkill = skill; state.lastSkillId = skill.id; state.target = skill.target;

    el.sightWordsPrompt.textContent = skill.target;

    const count = parseInt(profileSettings().choices, 10) || 3;
    const distractorPool = (typeof SIGHT_WORDS !== 'undefined' ? SIGHT_WORDS : []).filter((w) => w !== skill.target);
    const distractors = shuffle(distractorPool).slice(0, Math.max(1, count - 1));
    const ordered = shuffle([skill.target, ...distractors]);

    el.sightWordsChoices.innerHTML = '';
    ordered.forEach((w) => {
      const btn = document.createElement('button');
      btn.className = 'choice sight-word-choice';
      btn.textContent = w;
      btn.addEventListener('click', () => onSightWordsChoice(btn, w));
      el.sightWordsChoices.appendChild(btn);
    });

    state.roundStartedAt = Date.now();
    setTimeout(() => saySightWord(skill.target), 280);
  }

  function onSightWordsChoice(btn, word) {
    if (state.advancing) return;
    clearHintTimer();
    const correct = word === state.target;
    recordAttempt(state.currentSkill.id, correct, roundDuration());
    if (correct) {
      state.advancing = true; btn.classList.add('correct');
      spawnSparkles(btn);
      advanceAfterSpeech(startSightWordsRound);
    } else {
      state.wrongInRound++; btn.classList.add('wrong');
      setTimeout(() => btn.classList.remove('wrong'), 400);
      scheduleHint(null, null, () => saySightWord(state.target));
    }
  }

  el.sightWordsReplay?.addEventListener('click', () => {
    if (state.advancing || !state.target) return;
    clearHintTimer();
    saySightWord(state.target);
  });

  // ============================================================
  //  v5.3 — SIMPLE ARITHMETIC (Addition + Subtraction)
  //  Object-supported equations: shows the operands as visual
  //  counters (apples, etc.) so the child can count to verify.
  //  Skill is per-sum / per-difference (not per-fact) so a kid
  //  who's confident with "things adding to 5" gets credit across
  //  every equation that sums to 5.
  // ============================================================

  const _mathState = { a: 0, b: 0, target: 0, op: '+' };

  function renderCounters(container, count, emoji) {
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span');
      s.className = 'math-counter';
      s.textContent = emoji;
      s.style.animationDelay = (i * 60) + 'ms';
      container.appendChild(s);
    }
  }

  function pickMathDistractors(target, count, maxVal) {
    /* Pick numerically-near distractors. ±1, ±2 if in range. */
    const t = parseInt(target, 10);
    const pool = [];
    for (const d of [-2, -1, 1, 2, 3]) {
      const v = t + d;
      if (v >= 0 && v <= maxVal) pool.push(String(v));
    }
    return shuffle(pool).slice(0, Math.max(1, count - 1));
  }

  async function speakEquation(a, op, b) {
    /* Audio chain: number(a) + op-phrase + number(b). MP3 if pack
       is enabled, TTS fallback otherwise. Visual carries the rest. */
    await sayNumber(String(a));
    await sayPromptKey(op === '+' ? 'plus' : 'minus', op === '+' ? 'plus' : 'minus');
    sayNumber(String(b));
  }

  /* ─── Addition ─── */
  function startAdditionRound() {
    state.advancing = false; state.wrongInRound = 0;
    clearHintTimer();
    const profile = activeProfile();
    if (!profile) return;

    let skill = state.chosenForRound; state.chosenForRound = null;
    if (!skill) skill = pickNextSkill(profile, 'addition', state.lastSkillId);
    if (!skill) return;
    state.currentSkill = skill; state.lastSkillId = skill.id; state.target = skill.target;

    const sum = parseInt(skill.target, 10);
    // Pick a random (a, b) where 1 ≤ a ≤ sum-1
    const a = 1 + Math.floor(Math.random() * (sum - 1));
    const b = sum - a;
    _mathState.a = a; _mathState.b = b; _mathState.target = sum; _mathState.op = '+';

    if (el.addA) el.addA.textContent = a;
    if (el.addB) el.addB.textContent = b;
    const emoji = MATH_COUNTERS[Math.floor(Math.random() * MATH_COUNTERS.length)];
    renderCounters(el.addObjsA, a, emoji);
    renderCounters(el.addObjsB, b, emoji);

    const count = parseInt(profileSettings().choices, 10) || 3;
    const distractors = pickMathDistractors(skill.target, count, 12);
    const ordered = shuffle([String(sum), ...distractors]);

    el.addChoices.innerHTML = '';
    ordered.forEach((n) => {
      const btn = document.createElement('button');
      btn.className = 'choice math-choice';
      btn.textContent = n;
      btn.addEventListener('click', () => onAdditionChoice(btn, n));
      el.addChoices.appendChild(btn);
    });

    state.roundStartedAt = Date.now();
    setTimeout(() => speakEquation(a, '+', b), 280);
  }
  function onAdditionChoice(btn, num) {
    if (state.advancing) return;
    clearHintTimer();
    const correct = parseInt(num, 10) === _mathState.target;
    recordAttempt(state.currentSkill.id, correct, roundDuration());
    if (correct) {
      state.advancing = true; btn.classList.add('correct');
      spawnSparkles(btn);
      advanceAfterSpeech(startAdditionRound);
    } else {
      state.wrongInRound++; btn.classList.add('wrong');
      setTimeout(() => btn.classList.remove('wrong'), 400);
      scheduleHint(null, null, () => speakEquation(_mathState.a, '+', _mathState.b));
    }
  }
  el.addReplay?.addEventListener('click', () => {
    if (state.advancing) return;
    clearHintTimer();
    speakEquation(_mathState.a, '+', _mathState.b);
  });

  /* ─── Subtraction ─── */
  function startSubtractionRound() {
    state.advancing = false; state.wrongInRound = 0;
    clearHintTimer();
    const profile = activeProfile();
    if (!profile) return;

    let skill = state.chosenForRound; state.chosenForRound = null;
    if (!skill) skill = pickNextSkill(profile, 'subtraction', state.lastSkillId);
    if (!skill) return;
    state.currentSkill = skill; state.lastSkillId = skill.id; state.target = skill.target;

    const diff = parseInt(skill.target, 10);
    // a − b = diff where a ≤ 10. Pick b from 1..(10-diff).
    const maxB = 10 - diff;
    const b = 1 + Math.floor(Math.random() * Math.max(1, maxB));
    const a = diff + b;
    _mathState.a = a; _mathState.b = b; _mathState.target = diff; _mathState.op = '−';

    if (el.subA) el.subA.textContent = a;
    if (el.subB) el.subB.textContent = b;
    const emoji = MATH_COUNTERS[Math.floor(Math.random() * MATH_COUNTERS.length)];
    /* Show all `a` objects, with the last `b` of them visually crossed out.
       The "stage" has 'a' items; CSS class on the last b marks them removed. */
    renderCounters(el.subObjsA, a, emoji);
    if (el.subObjsA) {
      const items = el.subObjsA.children;
      for (let i = items.length - b; i < items.length; i++) {
        if (items[i]) items[i].classList.add('subtracted');
      }
    }

    const count = parseInt(profileSettings().choices, 10) || 3;
    const distractors = pickMathDistractors(skill.target, count, 10);
    const ordered = shuffle([String(diff), ...distractors]);

    el.subChoices.innerHTML = '';
    ordered.forEach((n) => {
      const btn = document.createElement('button');
      btn.className = 'choice math-choice';
      btn.textContent = n;
      btn.addEventListener('click', () => onSubtractionChoice(btn, n));
      el.subChoices.appendChild(btn);
    });

    state.roundStartedAt = Date.now();
    setTimeout(() => speakEquation(a, '−', b), 280);
  }
  function onSubtractionChoice(btn, num) {
    if (state.advancing) return;
    clearHintTimer();
    const correct = parseInt(num, 10) === _mathState.target;
    recordAttempt(state.currentSkill.id, correct, roundDuration());
    if (correct) {
      state.advancing = true; btn.classList.add('correct');
      spawnSparkles(btn);
      advanceAfterSpeech(startSubtractionRound);
    } else {
      state.wrongInRound++; btn.classList.add('wrong');
      setTimeout(() => btn.classList.remove('wrong'), 400);
      scheduleHint(null, null, () => speakEquation(_mathState.a, '−', _mathState.b));
    }
  }
  el.subReplay?.addEventListener('click', () => {
    if (state.advancing) return;
    clearHintTimer();
    speakEquation(_mathState.a, '−', _mathState.b);
  });

  // ============================================================
  //  v5.9 — TIME OF DAY (Skolestart, 5y+)
  //  Show an activity-emoji scenario, child picks the matching
  //  time-of-day from 3-4 emoji+label tiles. Concrete cause→time
  //  mapping, like a Norwegian kindergarten "daily rhythm" wall.
  // ============================================================

  function startTimeOfDayRound() {
    state.advancing = false; state.wrongInRound = 0;
    clearHintTimer();
    const profile = activeProfile();
    if (!profile) return;

    let skill = state.chosenForRound; state.chosenForRound = null;
    if (!skill) skill = pickNextSkill(profile, 'time-of-day', state.lastSkillId);
    if (!skill) return;
    state.currentSkill = skill; state.lastSkillId = skill.id; state.target = skill.target;

    /* Pick a random scenario whose .time matches the target */
    const matching = (typeof TIME_SCENARIOS !== 'undefined' ? TIME_SCENARIOS : []).filter((s) => s.time === skill.target);
    if (!matching.length) return;
    const scenario = matching[Math.floor(Math.random() * matching.length)];
    el.timeScenarioEmoji.textContent = scenario.emoji;
    el.timeScenarioWord.textContent  = scenario.word;
    state.timeWord = scenario.word;

    const count = parseInt(profileSettings().choices, 10) || 3;
    const allTimes = (typeof TIMES_OF_DAY !== 'undefined' ? TIMES_OF_DAY : []);
    const target = allTimes.find((t) => t.key === skill.target);
    const distractors = shuffle(allTimes.filter((t) => t.key !== skill.target)).slice(0, count - 1);
    const ordered = shuffle([target, ...distractors]);

    el.timeChoices.innerHTML = '';
    ordered.forEach((t) => {
      const btn = document.createElement('button');
      btn.className = 'picture-choice time-choice';
      btn.innerHTML = `<span class="pc-emoji">${t.emoji}</span><span class="pc-word">${escapeHtml(t.label)}</span>`;
      btn.addEventListener('click', () => onTimeOfDayChoice(btn, t.key));
      el.timeChoices.appendChild(btn);
    });

    state.roundStartedAt = Date.now();
    /* Voice: speak the scenario word so kid hears what they're seeing */
    setTimeout(async () => {
      // Try to play the scenario word via the word audio chain
      await sayWordPath(scenario.word);
    }, 280);
  }
  function onTimeOfDayChoice(btn, key) {
    if (state.advancing) return;
    clearHintTimer();
    const correct = key === state.target;
    recordAttempt(state.currentSkill.id, correct, roundDuration());
    if (correct) {
      state.advancing = true; btn.classList.add('correct');
      spawnSparkles(btn);
      // Speak the time-of-day name (target) as confirmation
      sayConcept('phrases', `time-${state.target}`, state.target);
      advanceAfterSpeech(startTimeOfDayRound);
    } else {
      state.wrongInRound++; btn.classList.add('wrong');
      setTimeout(() => btn.classList.remove('wrong'), 400);
      scheduleHint(null, null, () => sayWordPath(state.timeWord));
    }
  }

  // ============================================================
  //  v5.7 — DECODABLE READING BOOKS (Skolestart, 5y+)
  //  Library → book → page-by-page with word-level audio.
  //  Words light up as Aria reads each one (tracking eye to ear);
  //  any word is individually tappable for re-hear.
  // ============================================================

  /* Resolve a word to its MP3 path. Tries sight-words, voc,
     smabarn, animals folders in priority order. Returns null if
     no MP3 exists for that word — caller falls back to TTS. */
  const _audioWordCache = {};
  async function resolveWordAudio(word) {
    const key = (typeof normalizeWord === 'function') ? normalizeWord(word) : String(word).toLowerCase().replace(/[^a-z]/g, '');
    if (!key) return null;
    if (_audioWordCache[key] !== undefined) return _audioWordCache[key];
    if (profileSettings().customAudio !== 'auto') {
      _audioWordCache[key] = null;
      return null;
    }
    for (const folder of (typeof WORD_AUDIO_FOLDERS !== 'undefined' ? WORD_AUDIO_FOLDERS : ['sight-words', 'voc', 'smabarn', 'animals'])) {
      const path = `./audio/${folder}/${key}.mp3`;
      if (audioMissing.has(path)) continue;
      // HEAD-style probe via short fetch+abort is unreliable across browsers;
      // we just try to play and let audioPlayer mark missing on error.
      return new Promise((resolve) => {
        const a = new Audio();
        let settled = false;
        const finish = (ok) => {
          if (settled) return;
          settled = true;
          if (!ok) audioMissing.add(path);
          if (ok) _audioWordCache[key] = path;
          resolve(ok ? path : null);
        };
        a.addEventListener('canplaythrough', () => finish(true), { once: true });
        a.addEventListener('error', () => finish(false), { once: true });
        a.preload = 'metadata';
        a.src = path;
        setTimeout(() => finish(false), 2000);
      });
    }
    _audioWordCache[key] = null;
    return null;
  }

  async function sayWordPath(word) {
    const path = await resolveWordAudio(word);
    if (path) {
      return audioPlayer.play(path);
    }
    VoiceEngine.speak([word]);
    return Promise.resolve(true);
  }

  /* ── Library view ── */
  function openReadingLibrary() {
    if (!el.readingLibraryList) return;
    el.readingLibraryList.innerHTML = '';
    const books = (typeof READING_BOOKS !== 'undefined' ? READING_BOOKS : []);
    /* Group by level so the library displays as a clear progression */
    const grouped = { 1: [], 2: [], 3: [] };
    books.forEach((b) => { (grouped[b.level || 1] ||= []).push(b); });

    const levelNames = {
      1: 'Beginner',
      2: 'Getting comfortable',
      3: 'Reading along'
    };

    for (const lvl of [1, 2, 3]) {
      if (!grouped[lvl].length) continue;
      const header = document.createElement('h3');
      header.className = 'library-level-header';
      header.innerHTML = `${'★'.repeat(lvl)}${'☆'.repeat(3 - lvl)} <span>${levelNames[lvl]}</span>`;
      el.readingLibraryList.appendChild(header);

      const rowGrid = document.createElement('div');
      rowGrid.className = 'library-level-grid';
      grouped[lvl].forEach((book) => {
        const profile = activeProfile();
        const skill = SKILLS_BY_ID[`reading-${book.id}`];
        const reads = profile && skill ? getSkillProgress(skill, profile).successes : 0;
        const mastered = profile && skill ? isSkillMastered(skill, profile) : false;
        const card = document.createElement('button');
        card.className = `library-book color-${book.color || 'accent'}` + (mastered ? ' mastered' : '');
        card.innerHTML = `
          <div class="library-cover">${book.cover}</div>
          <div class="library-title">${escapeHtml(book.title)}</div>
          <div class="library-meta">${book.pages.length} pages${reads > 0 ? ' · read ' + reads + 'x' : ''}</div>
          ${mastered ? '<div class="library-mastered-badge">✓ confident</div>' : ''}
        `;
        card.addEventListener('click', () => openReadingBook(book));
        rowGrid.appendChild(card);
      });
      el.readingLibraryList.appendChild(rowGrid);
    }
    showScreen('readingLibrary');
  }

  /* ── Book view ── */
  let currentBook = null;
  let currentPageIdx = 0;
  let isReadingAloud = false;

  function openReadingBook(book) {
    currentBook = book;
    currentPageIdx = 0;
    renderReadingPage();
    showScreen('readingBook');
  }

  function renderReadingPage() {
    if (!currentBook) return;
    const page = currentBook.pages[currentPageIdx];
    if (el.readingTitle) el.readingTitle.textContent = currentBook.title;
    if (el.readingEmoji) el.readingEmoji.textContent = page.emoji;
    if (el.readingPageInd) {
      el.readingPageInd.textContent = `${currentPageIdx + 1} / ${currentBook.pages.length}`;
    }
    if (el.readingSentence) {
      el.readingSentence.innerHTML = '';
      /* Split into word tokens (preserving trailing punctuation as a
         non-tappable suffix so "cat." reads as "cat" + ".") */
      page.text.split(/\s+/).forEach((token, i) => {
        const wordOnly = token.replace(/[.,!?]+$/, '');
        const punct    = token.slice(wordOnly.length);
        const span = document.createElement('span');
        span.className = 'reading-word';
        span.dataset.word = wordOnly;
        span.innerHTML = `<span class="reading-word-text">${escapeHtml(wordOnly)}</span>${punct ? `<span class="reading-punct">${escapeHtml(punct)}</span>` : ''}`;
        span.addEventListener('click', () => onWordTap(span));
        el.readingSentence.appendChild(span);
        // small spacer between words (CSS gap handles it)
      });
    }
    /* Update nav button states */
    if (el.readingPrevBtn) el.readingPrevBtn.disabled = currentPageIdx === 0;
    if (el.readingNextBtn) {
      el.readingNextBtn.textContent = (currentPageIdx === currentBook.pages.length - 1) ? 'Done ✓' : 'Next →';
    }
  }

  async function onWordTap(span) {
    if (isReadingAloud) return;
    span.classList.add('lit');
    setTimeout(() => span.classList.remove('lit'), 700);
    await sayWordPath(span.dataset.word);
  }

  async function readPageAloud() {
    if (!currentBook || isReadingAloud) return;
    isReadingAloud = true;
    if (el.readingReadBtn) el.readingReadBtn.disabled = true;
    const wordSpans = [...el.readingSentence.querySelectorAll('.reading-word')];
    for (const span of wordSpans) {
      span.classList.add('lit');
      await sayWordPath(span.dataset.word);
      span.classList.remove('lit');
      await new Promise((r) => setTimeout(r, 120));
    }
    isReadingAloud = false;
    if (el.readingReadBtn) el.readingReadBtn.disabled = false;
  }

  el.readingReadBtn?.addEventListener('click', readPageAloud);
  el.readingPrevBtn?.addEventListener('click', () => {
    if (currentPageIdx > 0) { currentPageIdx--; renderReadingPage(); }
  });
  el.readingNextBtn?.addEventListener('click', () => {
    if (!currentBook) return;
    if (currentPageIdx === currentBook.pages.length - 1) {
      // Book complete — record one read-through
      const profile = activeProfile();
      const skill = SKILLS_BY_ID[`reading-${currentBook.id}`];
      if (profile && skill) {
        recordAttempt(skill.id, true, 0);
        spawnSparkles(el.readingEmoji);
      }
      // Bounce back to library after a short celebration
      setTimeout(() => openReadingLibrary(), 900);
    } else {
      currentPageIdx++;
      renderReadingPage();
    }
  });
  el.readingLibBtn?.addEventListener('click', openReadingLibrary);

  // ============================================================
  //  v5.5 — SMÅBARN TAP (toddler band, 1-3y)
  //  Cause-effect exploration. Big grid of emoji buttons (animals,
  //  objects, people). Tap → speak word in Aria + button pops.
  //  No rounds, no rights/wrongs, no skill tracking. Pure sensory
  //  + naming. Always available (every age band).
  // ============================================================

  async function sayTapItem(item) {
    const key = String(item.name).toLowerCase();
    if (profileSettings().customAudio === 'auto') {
      const cat = item.category === 'animal' ? 'animals' : 'smabarn';
      const ok = await tryAudio(`./audio/${cat}/${key}.mp3`);
      if (ok) return;
    }
    VoiceEngine.speak([item.name]);
  }

  function startTapMode() {
    if (!el.tapGrid) return;
    el.tapGrid.innerHTML = '';
    if (typeof SMABARN_TAPS === 'undefined') return;
    /* Show a generous 12 tiles, shuffled, mixing animals + objects + people */
    const tiles = shuffle(SMABARN_TAPS).slice(0, 12);
    tiles.forEach((item, i) => {
      const btn = document.createElement('button');
      btn.className = `tap-tile cat-${item.category}`;
      btn.innerHTML = `<span class="tap-emoji">${item.e}</span><span class="tap-word">${escapeHtml(item.name)}</span>`;
      btn.style.animationDelay = (i * 40) + 'ms';
      btn.addEventListener('click', () => onTapItem(btn, item));
      el.tapGrid.appendChild(btn);
    });
  }

  function onTapItem(btn, item) {
    btn.classList.remove('tapped');
    void btn.offsetWidth;
    btn.classList.add('tapped');
    setTimeout(() => btn.classList.remove('tapped'), 700);
    sayTapItem(item);
    /* Bump interest in the underlying symbol — useful signal even though
       there are no formal skills here. */
    const profile = activeProfile();
    if (profile) {
      profile.interests = profile.interests || {};
      const k = String(item.name).toUpperCase();
      profile.interests[k] = (profile.interests[k] || 0) + 1;
      saveStorage();
    }
  }

  el.tapShuffle?.addEventListener('click', () => {
    VoiceEngine.stop();
    startTapMode();
  });

  // ============================================================
  //  v5.2 — CALM CORNER (Rammeplan: omsorg / care)
  //  60-second guided breathing for self-regulation. Especially
  //  useful for ADHD-aware design — children can step away from
  //  performance and just breathe with the app. No skills, no
  //  tracking, no judgement.
  // ============================================================

  /* ──────────────────────────────────────────────────────────────
     v5.21 — Calm Corner expansion (Session 4 of ADHD-aware plan)
     ──────────────────────────────────────────────────────────────
     The original Calm Corner (single 4-4 breath cycle) becomes the
     'Just breathe' flow inside a new menu that adds:
       - Pattern selector (Natural 4-4 / Box 4-4-4-4 / Steady 4-7-8)
       - Body scan — sequential prompts head-to-toes
       - Feelings thermometer — pre/post mood check that records
         emotional-regulation events to the parent dashboard
     All flows are reflective, not measurable — no scoring, no
     punishment for skipping, no tracking the kid sees.
     ────────────────────────────────────────────────────────────── */

  let calmTimer = null;
  let calmPhaseTimer = null;
  let calmActivePattern = 'natural';
  let thermBefore = null;     // mood reading taken before settling
  let thermAfter  = null;     // post-settling reading
  let thermPhase  = 'before'; // 'before' | 'after' | 'result'

  /* Breathing patterns. Each is a sequence of phases with duration
     in ms and a label. Returning a generator keeps the loop simple
     and the data structure trivially extensible. */
  const BREATH_PATTERNS = {
    natural: [
      { label: 'Breathe in…',  ms: 4000, cls: 'inhaling' },
      { label: 'Breathe out…', ms: 4000, cls: 'exhaling' }
    ],
    box: [
      { label: 'Breathe in…',  ms: 4000, cls: 'inhaling' },
      { label: 'Hold…',        ms: 4000, cls: 'holding'  },
      { label: 'Breathe out…', ms: 4000, cls: 'exhaling' },
      { label: 'Hold…',        ms: 4000, cls: 'holding'  }
    ],
    steady: [
      { label: 'Breathe in…',  ms: 4000, cls: 'inhaling' },
      { label: 'Hold…',        ms: 7000, cls: 'holding'  },
      { label: 'Breathe out…', ms: 8000, cls: 'exhaling' }
    ]
  };

  function openCalmCorner() {
    showScreen('calmCorner');
  }

  function startBreathing(patternKey = 'natural') {
    calmActivePattern = patternKey;
    showScreen('calmBreath');
    if (el.calmCircle) {
      el.calmCircle.classList.remove('inhaling', 'exhaling', 'holding');
      void el.calmCircle.offsetWidth;
    }
    // Pattern pill state
    document.querySelectorAll('#calm-pattern-pills .calm-pill').forEach((b) => {
      b.setAttribute('aria-pressed', b.dataset.pattern === patternKey ? 'true' : 'false');
    });
    const seq = BREATH_PATTERNS[patternKey] || BREATH_PATTERNS.natural;
    const sessionMs = 90 * 1000;
    let i = 0;
    const setPhase = (idx) => {
      const ph = seq[idx];
      if (!el.calmCircle || !el.calmText) return;
      el.calmCircle.classList.remove('inhaling', 'exhaling', 'holding');
      void el.calmCircle.offsetWidth;
      el.calmCircle.classList.add(ph.cls);
      // CSS animations honor the phase duration via a custom property
      el.calmCircle.style.setProperty('--calm-phase-ms', ph.ms + 'ms');
      el.calmText.textContent = ph.label;
    };
    setPhase(0);
    const tick = () => {
      i = (i + 1) % seq.length;
      setPhase(i);
      calmPhaseTimer = setTimeout(tick, seq[i].ms);
    };
    calmPhaseTimer = setTimeout(tick, seq[0].ms);
    calmTimer = setTimeout(stopBreathing, sessionMs);
  }

  function stopBreathing() {
    if (calmTimer) { clearTimeout(calmTimer); calmTimer = null; }
    if (calmPhaseTimer) { clearTimeout(calmPhaseTimer); calmPhaseTimer = null; }
    if (el.calmCircle) {
      el.calmCircle.classList.remove('inhaling', 'exhaling', 'holding');
      el.calmCircle.style.removeProperty('--calm-phase-ms');
    }
    if (el.calmText) el.calmText.textContent = '';
    // If we're inside a thermometer flow, advance to the After step;
    // otherwise return to the calm menu.
    if (thermPhase === 'before' && thermBefore != null) {
      thermPhase = 'after';
      openThermometer('after');
    } else {
      openCalmCorner();
    }
  }

  /* ----- Body scan ----- */

  const BODY_SCAN_STEPS = [
    { emoji: '🦶', text: 'Squeeze your feet… now let them be soft.' },
    { emoji: '🦵', text: 'Tighten your legs… now let them rest.' },
    { emoji: '🫁', text: 'Take a slow breath into your belly.' },
    { emoji: '🤲', text: 'Make tight fists… now let your hands open.' },
    { emoji: '💪', text: 'Lift your shoulders up… now let them drop.' },
    { emoji: '😌', text: 'Soften your face. Even your eyes.' },
    { emoji: '✨', text: 'Notice your whole body, calm and still.' }
  ];
  let bsTimer = null;
  let bsStepIdx = 0;
  const BS_STEP_MS = 7500;

  function startBodyScan() {
    bsStepIdx = 0;
    showScreen('bodyScan');
    renderBodyScanStep();
    bsTimer = setInterval(advanceBodyScan, BS_STEP_MS);
  }
  function renderBodyScanStep() {
    const step = BODY_SCAN_STEPS[bsStepIdx];
    if (!step) return;
    if (el.bodyScan) {
      const emoji = el.bodyScan.querySelector('#bs-emoji');
      const text  = el.bodyScan.querySelector('#bs-prompt');
      const bar   = el.bodyScan.querySelector('#bs-progress-bar');
      if (emoji) emoji.textContent = step.emoji;
      if (text)  text.textContent  = step.text;
      if (bar)   bar.style.width = `${((bsStepIdx + 1) / BODY_SCAN_STEPS.length) * 100}%`;
    }
    // Soft chime per step using the audioPlayer's WebAudio context if available
    try {
      if (typeof GameSFX === 'function') {
        const sfx = new GameSFX();
        sfx.unlock();
        sfx.chimeUp();
      }
    } catch {}
  }
  function advanceBodyScan() {
    bsStepIdx++;
    if (bsStepIdx >= BODY_SCAN_STEPS.length) {
      stopBodyScan();
      return;
    }
    renderBodyScanStep();
  }
  function stopBodyScan() {
    if (bsTimer) { clearInterval(bsTimer); bsTimer = null; }
    bsStepIdx = 0;
    // Record an EF emotional-regulation event for the parent dashboard
    if (typeof recordAttempt === 'function') {
      try { recordAttempt('ef-emotional-regulation-body-scan', true, 0); } catch {}
    }
    openCalmCorner();
  }

  /* ----- Feelings thermometer ----- */

  function openThermometer(phase = 'before') {
    thermPhase = phase;
    showScreen('thermometer');
    if (!el.thermometer) return;
    const title  = el.thermometer.querySelector('#therm-title');
    const sub    = el.thermometer.querySelector('#therm-sub');
    const ladder = el.thermometer.querySelector('#therm-ladder');
    const result = el.thermometer.querySelector('#therm-result');
    const goBtn  = el.thermometer.querySelector('#therm-go');
    if (phase === 'before') {
      title.textContent = 'How am I right now?';
      sub.textContent   = 'Pick the one that\'s closest.';
      result.hidden = true;
      goBtn.textContent = 'Breathe →';
      goBtn.disabled = true;
      buildThermLadder(ladder, 'before');
    } else if (phase === 'after') {
      title.textContent = 'How am I now?';
      sub.textContent   = 'Check in with yourself again.';
      result.hidden = true;
      goBtn.textContent = 'See change →';
      goBtn.disabled = true;
      buildThermLadder(ladder, 'after');
    } else { // result
      title.textContent = 'Nice noticing.';
      sub.textContent   = '';
      result.hidden = false;
      ladder.innerHTML = '';
      const before = el.thermometer.querySelector('#therm-before');
      const after  = el.thermometer.querySelector('#therm-after');
      const emojis = ['😞','🙁','😐','🙂','😄'];
      if (before) before.textContent = thermBefore ? emojis[thermBefore - 1] : '—';
      if (after)  after.textContent  = thermAfter  ? emojis[thermAfter  - 1] : '—';
      goBtn.textContent = 'Done';
      goBtn.disabled = false;
    }
  }
  function buildThermLadder(ladder, phase) {
    if (!ladder) return;
    ladder.innerHTML = '';
    ['😞','🙁','😐','🙂','😄'].forEach((emoji, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'therm-step';
      b.dataset.value = String(i + 1);
      b.textContent = emoji;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', 'false');
      b.addEventListener('click', () => {
        const v = Number(b.dataset.value);
        ladder.querySelectorAll('.therm-step').forEach((x) => {
          const on = x === b;
          x.setAttribute('aria-checked', on ? 'true' : 'false');
          x.classList.toggle('selected', on);
        });
        if (phase === 'before') thermBefore = v;
        else                    thermAfter  = v;
        const goBtn = el.thermometer.querySelector('#therm-go');
        if (goBtn) goBtn.disabled = false;
      });
      ladder.appendChild(b);
    });
  }
  function thermContinue() {
    if (thermPhase === 'before' && thermBefore != null) {
      // Record before reading then run a short breathing session
      if (typeof recordAttempt === 'function') {
        try { recordAttempt(`ef-emotional-regulation-before-${thermBefore}`, true, 0); } catch {}
      }
      startBreathing('natural');
    } else if (thermPhase === 'after' && thermAfter != null) {
      if (typeof recordAttempt === 'function') {
        try { recordAttempt(`ef-emotional-regulation-after-${thermAfter}`, true, 0); } catch {}
        if (thermBefore != null && thermAfter != null) {
          const delta = thermAfter - thermBefore;
          const tag = delta > 0 ? 'better' : delta < 0 ? 'lower' : 'same';
          try { recordAttempt(`ef-emotional-regulation-delta-${tag}`, true, 0); } catch {}
        }
      }
      openThermometer('result');
    } else if (thermPhase === 'result') {
      thermBefore = null;
      thermAfter = null;
      thermPhase = 'before';
      openCalmCorner();
    }
  }

  /* ----- Wiring ----- */

  el.calmCornerBtn?.addEventListener('click', () => {
    closeSettings();
    thermBefore = null;
    thermAfter  = null;
    thermPhase  = 'before';
    openCalmCorner();
  });

  // Menu cards
  document.querySelectorAll('[data-calm-go]').forEach((card) => {
    card.addEventListener('click', () => {
      const dest = card.dataset.calmGo;
      if (dest === 'breath')       startBreathing('natural');
      if (dest === 'body-scan')    startBodyScan();
      if (dest === 'thermometer')  openThermometer('before');
    });
  });
  document.getElementById('calm-menu-close')?.addEventListener('click', goHome);

  // Breathing pattern pills
  document.querySelectorAll('#calm-pattern-pills .calm-pill').forEach((b) => {
    b.addEventListener('click', () => {
      const next = b.dataset.pattern;
      if (next === calmActivePattern) return;
      // Restart breathing with the new pattern
      if (calmTimer) { clearTimeout(calmTimer); calmTimer = null; }
      if (calmPhaseTimer) { clearTimeout(calmPhaseTimer); calmPhaseTimer = null; }
      startBreathing(next);
    });
  });

  el.calmStop?.addEventListener('click', stopBreathing);
  document.getElementById('bs-stop')?.addEventListener('click', stopBodyScan);
  document.getElementById('therm-skip')?.addEventListener('click', () => {
    thermBefore = null;
    thermAfter  = null;
    thermPhase  = 'before';
    openCalmCorner();
  });
  document.getElementById('therm-go')?.addEventListener('click', thermContinue);

  /* ──────────────────────────────────────────────────────────────
     v5.22 — Pre-session check-in + body breaks
     (Session 5 of ADHD-aware expansion plan — Scattered to Focused)
     ────────────────────────────────────────────────────────────── */

  // ---- Check-in ----
  let checkinResolver = null;
  let checkinPick = null;

  function shouldRunCheckIn() {
    const p = activeProfile();
    if (!p) return false;
    if (p.settings.sessionCheckIn !== 'on') return false;
    // Only once per day — if today's journal already has a mood, skip
    if (!window.JournalAPI) return false;
    const e = JournalAPI.getEntry(p, JournalAPI.todayKey());
    return e.mood == null;
  }

  function runCheckIn() {
    return new Promise((resolve) => {
      const modal = document.getElementById('modal-checkin');
      if (!modal) { resolve(); return; }
      checkinResolver = resolve;
      checkinPick = null;
      modal.querySelectorAll('.checkin-step').forEach((b) => {
        b.classList.remove('selected');
        b.setAttribute('aria-checked', 'false');
      });
      const goBtn = document.getElementById('checkin-go');
      if (goBtn) goBtn.disabled = true;
      modal.classList.add('active');
    });
  }

  function finishCheckIn(save) {
    const modal = document.getElementById('modal-checkin');
    if (modal) modal.classList.remove('active');
    if (save && checkinPick != null) {
      const p = activeProfile();
      if (p && window.JournalAPI) {
        JournalAPI.setEntry(p, JournalAPI.todayKey(), { mood: checkinPick });
        saveStorage();
      }
      if (typeof recordAttempt === 'function') {
        try { recordAttempt(`ef-self-awareness-checkin-${checkinPick}`, true, 0); } catch {}
      }
    }
    const r = checkinResolver;
    checkinResolver = null;
    checkinPick = null;
    if (r) r();
  }

  document.querySelectorAll('#checkin-ladder .checkin-step').forEach((b) => {
    b.addEventListener('click', () => {
      checkinPick = Number(b.dataset.value);
      document.querySelectorAll('#checkin-ladder .checkin-step').forEach((x) => {
        const on = x === b;
        x.setAttribute('aria-checked', on ? 'true' : 'false');
        x.classList.toggle('selected', on);
      });
      const goBtn = document.getElementById('checkin-go');
      if (goBtn) goBtn.disabled = false;
    });
  });
  document.getElementById('checkin-go')?.addEventListener('click', () => finishCheckIn(true));
  document.getElementById('checkin-skip')?.addEventListener('click', () => finishCheckIn(false));

  // ---- Body break ----
  const BODY_BREAK_INTERVAL_MS = 8 * 60 * 1000;   // every 8 min of session time
  const BODY_BREAK_STEPS = [
    { emoji: '🧍', text: 'Stand up tall!' },
    { emoji: '🙆', text: 'Reach for the sky…' },
    { emoji: '🤸', text: 'Touch your toes…' },
    { emoji: '👏', text: 'Shake your hands!' },
    { emoji: '🌀', text: 'Roll your shoulders…' },
    { emoji: '😌', text: 'Big breath… and back to play!' }
  ];
  const BODY_BREAK_STEP_MS = 5000;
  let lastBodyBreakAt = 0;
  let bodyBreakStepIdx = 0;
  let bodyBreakTimer = null;

  function maybeSuggestBodyBreak() {
    const p = activeProfile();
    if (!p || p.settings.bodyBreaks !== 'on') return;
    if (!state.sessionStartedAt) return;
    const elapsed = Date.now() - state.sessionStartedAt;
    // Fire at every BODY_BREAK_INTERVAL_MS boundary, but never more than
    // once per real-time interval
    const boundary = Math.floor(elapsed / BODY_BREAK_INTERVAL_MS);
    if (boundary === 0) return;
    if (lastBodyBreakAt === boundary) return;
    lastBodyBreakAt = boundary;
    setTimeout(showBodyBreak, 1200);
  }

  function showBodyBreak() {
    const modal = document.getElementById('modal-body-break');
    if (!modal) return;
    bodyBreakStepIdx = 0;
    renderBodyBreakStep();
    modal.classList.add('active');
    const doneBtn = document.getElementById('body-break-done');
    if (doneBtn) doneBtn.hidden = true;
    bodyBreakTimer = setInterval(advanceBodyBreak, BODY_BREAK_STEP_MS);
  }
  function renderBodyBreakStep() {
    const step = BODY_BREAK_STEPS[bodyBreakStepIdx];
    if (!step) return;
    const e = document.getElementById('body-break-emoji');
    const t = document.getElementById('body-break-prompt');
    const b = document.getElementById('body-break-bar');
    if (e) e.textContent = step.emoji;
    if (t) t.textContent = step.text;
    if (b) b.style.width = `${((bodyBreakStepIdx + 1) / BODY_BREAK_STEPS.length) * 100}%`;
  }
  function advanceBodyBreak() {
    bodyBreakStepIdx++;
    if (bodyBreakStepIdx >= BODY_BREAK_STEPS.length) {
      if (bodyBreakTimer) { clearInterval(bodyBreakTimer); bodyBreakTimer = null; }
      const doneBtn = document.getElementById('body-break-done');
      if (doneBtn) doneBtn.hidden = false;
      if (typeof recordAttempt === 'function') {
        try { recordAttempt('ef-body-break-complete', true, 0); } catch {}
      }
      return;
    }
    renderBodyBreakStep();
  }
  function closeBodyBreak() {
    if (bodyBreakTimer) { clearInterval(bodyBreakTimer); bodyBreakTimer = null; }
    document.getElementById('modal-body-break')?.classList.remove('active');
    bodyBreakStepIdx = 0;
  }
  document.getElementById('body-break-skip')?.addEventListener('click', closeBodyBreak);
  document.getElementById('body-break-done')?.addEventListener('click', closeBodyBreak);

  // Expose body-break check globally inside the IIFE so the existing
  // maybeSuggestBreak() implementation can call it (patched below).
  // (Direct edit is in the original definition; this comment marks intent.)

  // ============================================================
  //  v5.6 — PRINTABLE WORKSHEETS (Rammeplan: real materials matter)
  //  Renders SVG-based printable views of the alphabet / tracing
  //  paths / numbers and triggers the browser print dialog.
  //  Pure off-screen extension — no screen time, no app session.
  // ============================================================

  function renderAlphabetWorksheet() {
    const rows = [];
    rows.push('<h1 class="ws-h1">Alphabet — Letters & Numbers app</h1>');
    rows.push('<table class="ws-alpha-table"><thead><tr><th>Uppercase</th><th>Lowercase</th><th>Picture word</th></tr></thead><tbody>');
    LETTERS.forEach((L) => {
      const word = (typeof LETTER_WORDS !== 'undefined' && LETTER_WORDS[L]) ? LETTER_WORDS[L] : { word: '', emoji: '' };
      rows.push(`<tr><td class="ws-up">${L}</td><td class="ws-low">${L.toLowerCase()}</td><td class="ws-pic">${word.emoji} <span class="ws-word">${escapeHtml(word.word)}</span></td></tr>`);
    });
    rows.push('</tbody></table>');
    rows.push('<p class="ws-footer">letters.guardcybersolutionsllc.com</p>');
    return rows.join('');
  }

  function renderTracingWorksheet(paths, isLowercase = false) {
    const title = isLowercase ? 'Lowercase letter tracing' : 'Uppercase letter tracing';
    const items = Object.entries(paths);
    let html = `<h1 class="ws-h1">${title}</h1>`;
    html += '<p class="ws-intro">Trace each letter with a finger or pencil. Start at the dot.</p>';
    html += '<div class="ws-trace-grid">';
    items.forEach(([letter, strokes]) => {
      // Build SVG with dashed outline + start dot
      const strokeSvgs = strokes.map((s) => `<path d="${s.d}" class="ws-trace-path" />`).join('');
      // First stroke's start point becomes the start dot
      // We'll inject a script-less version with an explicit circle at the start of stroke 0
      const firstPath = strokes[0]?.d || '';
      const startMatch = firstPath.match(/^M\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/);
      const sx = startMatch ? startMatch[1] : '100';
      const sy = startMatch ? startMatch[2] : '120';
      html += `
        <div class="ws-trace-cell">
          <div class="ws-trace-label">${letter}</div>
          <svg viewBox="0 0 200 240" class="ws-trace-svg" xmlns="http://www.w3.org/2000/svg">
            ${strokeSvgs}
            <circle cx="${sx}" cy="${sy}" r="6" class="ws-start-dot" />
          </svg>
        </div>
      `;
    });
    html += '</div>';
    html += '<p class="ws-footer">letters.guardcybersolutionsllc.com</p>';
    return html;
  }

  function renderWorksheet(kind) {
    if (!el.printableContent) return;
    let html = '';
    if (kind === 'alphabet') html = renderAlphabetWorksheet();
    else if (kind === 'trace-upper')   html = renderTracingWorksheet(LETTER_PATHS, false);
    else if (kind === 'trace-lower' && typeof LOWERCASE_LETTER_PATHS !== 'undefined') {
      html = renderTracingWorksheet(LOWERCASE_LETTER_PATHS, true);
    }
    else if (kind === 'trace-numbers') html = renderTracingWorksheet(NUMBER_PATHS, false);
    el.printableContent.innerHTML = html;
    /* Toggle the body class so the print stylesheet shows only the
       printable view, then call window.print(). The browser dialog
       handles save-as-PDF on every modern platform. */
    document.body.classList.add('printing');
    setTimeout(() => {
      window.print();
      // Browser blocks until print dialog closes
      document.body.classList.remove('printing');
    }, 100);
  }

  el.worksheetsBtn?.addEventListener('click', () => {
    closeSettings();
    el.modalWorksheets?.classList.add('active');
  });
  el.worksheetsClose?.addEventListener('click', () => el.modalWorksheets?.classList.remove('active'));
  el.modalWorksheets?.addEventListener('click', (e) => {
    if (e.target === el.modalWorksheets) el.modalWorksheets.classList.remove('active');
    const btn = e.target.closest('[data-ws]');
    if (btn) {
      el.modalWorksheets.classList.remove('active');
      renderWorksheet(btn.dataset.ws);
    }
  });

  // ============================================================
  //  PLAY MODE  (v3.2 — non-evaluative free exploration)
  //  No skill picker, no progress recording, no streaks, no breaks.
  //  Aligned with Norwegian Rammeplan principle of child agency.
  // ============================================================
  const PLAY_LAYOUT = { letters: 6, numbers: 3, words: 3 };

  function buildPlayTiles() {
    const profile = activeProfile();
    const age = profile?.ageMonths ?? 48;
    /* Age-appropriate weighting: younger kids see more pictures and fewer
       letters; older kids see more letters and numbers. */
    let counts;
    if (age < 36)      counts = { letters: 3, numbers: 2, words: 6 };
    else if (age < 48) counts = { letters: 5, numbers: 3, words: 4 };
    else               counts = PLAY_LAYOUT;

    const tiles = [];
    shuffle(LETTERS).slice(0, counts.letters).forEach((L) => tiles.push({ type: 'letter', value: L }));
    shuffle(NUMBERS).slice(0, counts.numbers).forEach((N) => tiles.push({ type: 'number', value: N }));
    shuffle(LETTERS).slice(0, counts.words).forEach((L) => tiles.push({ type: 'word', value: L }));
    return shuffle(tiles);
  }

  function startPlayMode() {
    if (!el.playGrid) return;
    el.playGrid.innerHTML = '';
    const tiles = buildPlayTiles();
    tiles.forEach((tile, i) => {
      const btn = document.createElement('button');
      btn.className = `play-tile type-${tile.type}`;
      btn.style.animationDelay = (i * 30) + 'ms';
      if (tile.type === 'word') {
        const info = LETTER_WORDS[tile.value] || { word: tile.value, emoji: '❓' };
        btn.innerHTML = `<span class="play-tile-emoji">${info.emoji}</span><span class="play-tile-word">${escapeHtml(info.word)}</span>`;
      } else {
        const span = document.createElement('span');
        span.className = 'play-tile-symbol';
        span.textContent = tile.value;
        btn.appendChild(span);
      }
      btn.addEventListener('click', () => onPlayTap(btn, tile));
      el.playGrid.appendChild(btn);
    });
  }

  function onPlayTap(btn, tile) {
    btn.classList.remove('play-tapped');
    void btn.offsetWidth;
    btn.classList.add('play-tapped');
    setTimeout(() => btn.classList.remove('play-tapped'), 700);
    if (tile.type === 'letter')      sayLetter(tile.value);
    else if (tile.type === 'number') sayNumber(tile.value);
    else if (tile.type === 'word')   sayWord(tile.value);

    /* Free play also signals interest. Tracked silently — never shown to
       the child, used only by the picker on subsequent structured rounds. */
    const profile = activeProfile();
    if (profile && tile.value) {
      profile.interests = profile.interests || {};
      const k = String(tile.value).toUpperCase();
      profile.interests[k] = (profile.interests[k] || 0) + 1;
      saveStorage();
    }
  }

  el.playShuffle?.addEventListener('click', () => {
    VoiceEngine.stop();
    startPlayMode();
  });

  // ============================================================
  //  TRACER
  // ============================================================
  const SVGNS = 'http://www.w3.org/2000/svg';

  class Tracer {
    constructor(svg, strokes, onComplete) {
      this.svg = svg;
      this.strokes = strokes;
      this.onComplete = onComplete;
      this.cur = 0;
      this.outlines = [];
      this.trails = [];
      this.lengths = [];
      this.samples = [];
      this.progress = [];
      this.dragging = false;
      this.activePointer = null;
      this.threshold = 32;
      this.lookAhead = 18;
      this.lookBack = 2;
      this.minStrokeCompletion = 0.92;
      this.build();
      this.bind();
    }

    build() {
      while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
      this.strokes.forEach((s) => {
        const outline = document.createElementNS(SVGNS, 'path');
        outline.setAttribute('d', s.d);
        outline.setAttribute('class', 'trace-outline');
        this.svg.appendChild(outline);

        const trail = document.createElementNS(SVGNS, 'path');
        trail.setAttribute('d', s.d);
        trail.setAttribute('class', 'trace-trail');
        const len = outline.getTotalLength();
        trail.style.strokeDasharray  = String(len);
        trail.style.strokeDashoffset = String(len);
        this.svg.appendChild(trail);

        this.outlines.push(outline);
        this.trails.push(trail);
        this.lengths.push(len);

        const N = Math.max(40, Math.round(len / 6));
        const pts = new Array(N + 1);
        for (let k = 0; k <= N; k++) pts[k] = outline.getPointAtLength((k / N) * len);
        this.samples.push(pts);
        this.progress.push(-1);
      });

      this.startDot = document.createElementNS(SVGNS, 'circle');
      this.startDot.setAttribute('r', '15');
      this.startDot.setAttribute('class', 'trace-start');
      this.svg.appendChild(this.startDot);
      this.updateStartDot();
    }

    updateStartDot() {
      if (this.cur >= this.strokes.length) {
        this.startDot.style.display = 'none';
        return;
      }
      const first = this.samples[this.cur][0];
      this.startDot.setAttribute('cx', first.x);
      this.startDot.setAttribute('cy', first.y);
      this.startDot.style.display = '';
    }

    bind() {
      this._onDown = this.onDown.bind(this);
      this._onMove = this.onMove.bind(this);
      this._onUp   = this.onUp.bind(this);
      this.svg.addEventListener('pointerdown', this._onDown);
      this.svg.addEventListener('pointermove', this._onMove);
      this.svg.addEventListener('pointerup', this._onUp);
      this.svg.addEventListener('pointercancel', this._onUp);
    }
    destroy() {
      this.svg.removeEventListener('pointerdown', this._onDown);
      this.svg.removeEventListener('pointermove', this._onMove);
      this.svg.removeEventListener('pointerup', this._onUp);
      this.svg.removeEventListener('pointercancel', this._onUp);
    }

    toSvgCoords(clientX, clientY) {
      const pt = this.svg.createSVGPoint();
      pt.x = clientX; pt.y = clientY;
      const ctm = this.svg.getScreenCTM();
      if (!ctm) return null;
      return pt.matrixTransform(ctm.inverse());
    }

    onDown(e) {
      if (this.cur >= this.strokes.length) return;
      this.dragging = true;
      this.activePointer = e.pointerId;
      try { this.svg.setPointerCapture(e.pointerId); } catch {}
      this.handlePoint(e);
    }
    onMove(e) {
      if (!this.dragging || e.pointerId !== this.activePointer) return;
      this.handlePoint(e);
    }
    onUp(e) {
      if (e.pointerId !== this.activePointer) return;
      this.dragging = false;
      this.activePointer = null;
      try { this.svg.releasePointerCapture(e.pointerId); } catch {}
    }

    handlePoint(e) {
      if (this.cur >= this.strokes.length) return;
      const p = this.toSvgCoords(e.clientX, e.clientY);
      if (!p) return;
      const samples = this.samples[this.cur];
      const lastIdx = samples.length - 1;
      const cur = this.progress[this.cur];

      const startIdx = Math.max(0, cur - this.lookBack);
      const endIdx   = Math.min(lastIdx, cur + this.lookAhead);
      let bestIdx = cur;
      let bestDist = Infinity;
      for (let i = startIdx; i <= endIdx; i++) {
        const dx = samples[i].x - p.x;
        const dy = samples[i].y - p.y;
        const d  = dx*dx + dy*dy;
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      const thresh2 = this.threshold * this.threshold;
      if (bestDist > thresh2) return;
      if (bestIdx > cur) {
        this.progress[this.cur] = bestIdx;
        this.refreshTrail();
      }
      if (bestIdx / lastIdx >= this.minStrokeCompletion) this.completeStroke();
    }

    refreshTrail() {
      const idx = this.cur;
      const samples = this.samples[idx];
      const trail   = this.trails[idx];
      const len     = this.lengths[idx];
      const progress = (this.progress[idx] + 1) / samples.length;
      trail.style.strokeDashoffset = String(Math.max(0, len * (1 - progress)));
    }

    completeStroke() {
      const idx = this.cur;
      this.progress[idx] = this.samples[idx].length - 1;
      this.trails[idx].style.strokeDashoffset = '0';
      this.trails[idx].classList.add('done');
      this.outlines[idx].classList.add('done');
      this.cur++;
      if (this.cur >= this.strokes.length) {
        this.startDot.style.display = 'none';
        setTimeout(() => this.onComplete && this.onComplete(), 600);
      } else {
        this.updateStartDot();
      }
      updateTraceDots();
    }
  }

  function updateTraceDots() {
    if (!state.tracer) return;
    el.traceDots.innerHTML = '';
    state.tracer.strokes.forEach((_, i) => {
      const d = document.createElement('span');
      d.className = 'trace-stroke-dot';
      if (i < state.tracer.cur) d.classList.add('done');
      else if (i === state.tracer.cur) d.classList.add('active');
      el.traceDots.appendChild(d);
    });
  }

  function startTraceRound() {
    state.advancing = false;
    const profile = activeProfile();
    if (!profile) return;

    /* v3.3 — use child's pre-picked skill on first round of mode if agency
       mode is on. After that, normal picker takes over for natural rotation. */
    let skill = state.chosenForRound;
    state.chosenForRound = null;
    if (!skill) skill = pickNextSkill(profile, state.mode, state.lastSkillId);
    if (!skill) return;
    state.currentSkill = skill;
    state.lastSkillId  = skill.id;
    state.target = skill.target;

    const isLetters = state.mode === 'trace-letters';
    /* v5.2 — case-aware tracing.
       case = 'upper' → uppercase paths
       case = 'lower' → lowercase paths
       case = 'both'  → 50/50 random per round */
    let strokes, displayLabel;
    if (isLetters) {
      const caseSetting = profileSettings().case;
      const useLower = caseSetting === 'lower' ||
                       (caseSetting === 'both' && Math.random() < 0.5);
      strokes = (useLower ? LOWERCASE_LETTER_PATHS : LETTER_PATHS)[skill.target];
      displayLabel = useLower ? skill.target.toLowerCase() : skill.target;
    } else {
      strokes = NUMBER_PATHS[skill.target];
      displayLabel = skill.target;
    }
    el.traceLabel.textContent = `Trace ${displayLabel}`;

    if (state.tracer) state.tracer.destroy();
    state.tracer = new Tracer(el.traceSvg, strokes, onTraceComplete);
    updateTraceDots();

    state.roundStartedAt = Date.now();
    setTimeout(() => {
      if (isLetters) sayLetter(skill.target);
      else sayNumber(skill.target);
    }, 250);
  }

  function onTraceComplete() {
    if (state.advancing) return;
    state.advancing = true;
    recordAttempt(state.currentSkill.id, true, roundDuration());
    const rect = el.traceSvg.getBoundingClientRect();
    spawnSparkles({ getBoundingClientRect: () => rect });
    if (state.mode === 'trace-letters') sayLetter(state.target);
    else sayNumber(state.target);
    advanceAfterSpeech(startTraceRound);
  }

  // ============================================================
  //  PARENT GATE
  // ============================================================
  let gateOnPass = null;

  function openGate(onPass) {
    gateOnPass = onPass;
    const pool = NUMBERS.filter((n) => n !== '0' && n !== '10');
    const target = pool[Math.floor(Math.random() * pool.length)];
    el.gateTarget.textContent = target;
    el.gateNumbers.innerHTML = '';
    shuffle(pool).forEach((n) => {
      const b = document.createElement('button');
      b.className = 'gate-num';
      b.textContent = n;
      b.addEventListener('click', () => {
        if (n === target) {
          el.modalGate.classList.remove('active');
          const fn = gateOnPass; gateOnPass = null;
          if (fn) fn();
        } else {
          b.classList.add('dim');
        }
      });
      el.gateNumbers.appendChild(b);
    });
    el.modalGate.classList.add('active');
  }

  el.modalGate.addEventListener('click', (e) => {
    if (e.target === el.modalGate) el.modalGate.classList.remove('active');
  });

  // ============================================================
  //  SETTINGS
  // ============================================================
  function populateVoiceSelect() {
    const sel = el.voiceSelect;
    if (!sel) return;
    sel.innerHTML = '';
    const auto = document.createElement('option');
    auto.value = '';
    auto.textContent = '— Best available (auto) —';
    sel.appendChild(auto);

    const voices = (VoiceEngine.voices || []).slice().sort((a, b) => VoiceEngine.score(b) - VoiceEngine.score(a));
    voices.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v.voiceURI;
      const tag = v.localService ? '' : ' • online';
      opt.textContent = `${v.name} (${v.lang})${tag}`;
      sel.appendChild(opt);
    });
    sel.value = profileSettings().voiceURI || '';
  }

  function syncSettingsUI() {
    el.modalSettings.querySelectorAll('.segmented').forEach((seg) => {
      const key = seg.dataset.setting;
      const val = String(profileSettings()[key] ?? '');
      seg.querySelectorAll('button').forEach((b) => {
        b.setAttribute('aria-pressed', b.dataset.value === val ? 'true' : 'false');
      });
    });
    populateVoiceSelect();
  }

  function openSettings() {
    if (!activeProfile()) return;
    syncSettingsUI();
    el.modalSettings.classList.add('active');
  }

  function closeSettings() {
    el.modalSettings.classList.remove('active');
  }

  el.modalSettings.querySelectorAll('.segmented').forEach((seg) => {
    const key = seg.dataset.setting;
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-value]');
      if (!b) return;
      const profile = activeProfile();
      if (!profile) return;
      profile.settings[key] = b.dataset.value;

      // v5.13 — flag explicit user choice when they turn the MP3 pack OFF,
      // so the healing migration doesn't flip it back to 'auto' on next load.
      if (key === 'customAudio' && b.dataset.value === 'off') {
        profile.settings.__customAudioUserChosenOff = true;
      } else if (key === 'customAudio' && b.dataset.value === 'auto') {
        profile.settings.__customAudioUserChosenOff = false;
      }

      saveStorage();
      seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      if (key === 'theme')        applyTheme();
      if (key === 'showAllModes') { refreshModeLocks(); }
      // v5.30 — locale change: re-pick voice + notify i18n subscribers
      if (key === 'locale' && typeof I18n !== 'undefined') {
        I18n.setLocale(b.dataset.value);
        if (typeof VoiceEngine !== 'undefined') VoiceEngine.refresh();
      }
      // v5.15 — audible preview of speech speed so the parent hears
      // the difference immediately (otherwise they'd have to leave
      // Settings and tap into a mode to test).
      if (key === 'speechSpeed') {
        // Use the friendly target-style phrase the kid will most often hear,
        // routed through the same sayLetter() path so MP3 / TTS priority
        // chain is identical to in-game playback.
        if (typeof sayLetter === 'function') {
          sayLetter('A', { mode: 'name' });
        } else {
          VoiceEngine.speak(['A']);
        }
      }
    });
  });

  el.voiceSelect?.addEventListener('change', () => {
    const profile = activeProfile();
    if (!profile) return;
    // v5.13 — persist both URI (this device) and fingerprint (any device)
    const uri = el.voiceSelect.value;
    const match = uri ? VoiceEngine.voices.find((v) => v.voiceURI === uri) : null;
    VoiceEngine.rememberChoice(match);
    VoiceEngine.speak(['Hello!']);
    refreshVoiceBanner();
  });

  el.settingsClose.addEventListener('click', closeSettings);
  el.modalSettings.addEventListener('click', (e) => {
    if (e.target === el.modalSettings) closeSettings();
  });

  // ============================================================
  //  PROGRESS SCREEN
  // ============================================================
  function renderProgressCells(container, items, getSkillIdFor) {
    container.innerHTML = '';
    const profile = activeProfile();
    items.forEach((sym) => {
      const skillId = getSkillIdFor(sym);
      const skill = SKILLS_BY_ID[skillId];
      const t = skill ? getSkillProgress(skill, profile) : { successes: 0 };
      const mastered = skill ? isSkillMastered(skill, profile) : false;
      const fading   = skill ? isSkillFading(skill, profile)   : false;
      const stars = mastered ? '★★★' :
                    t.successes >= 4 ? '★★' :
                    t.successes >= 1 ? '★' : '';
      let cls = '';
      if (fading) cls = 'fading';
      else if (mastered) cls = 'mastered';
      else if (t.successes > 0) cls = 'practiced';

      const cell = document.createElement('button');
      cell.className = `progress-cell ${cls}`;
      cell.setAttribute('aria-label', `Skill detail for ${sym}`);
      const s = document.createElement('div');
      s.className = 'sym';
      s.textContent = sym;
      const st = document.createElement('div');
      st.className = 'stars';
      st.textContent = stars;
      cell.appendChild(s);
      cell.appendChild(st);
      cell.addEventListener('click', () => openSkillDetail(sym, items === LETTERS ? 'letter' : 'number'));
      container.appendChild(cell);
    });
  }

  function renderProgressStandards() {
    if (!el.progressStandardsList) return;
    const profile = activeProfile();
    el.progressStandardsList.innerHTML = '';

    /* Group by framework family so parents see US standards, EU, and
       Norwegian Rammeplan in separate sections — the same gameplay
       maps to all of them. */
    const byFamily = standardsByFramework();
    const familyOrder = [
      'CCSS-K (United States)',
      'NAEYC ELOF (United States)',
      'EU Quality Framework for ECEC',
      'Rammeplan (Norway)',
      'Other'
    ];

    familyOrder.forEach((family) => {
      const codes = byFamily[family];
      if (!codes || !codes.length) return;
      const header = document.createElement('h3');
      header.className = 'standard-family';
      header.textContent = family;
      el.progressStandardsList.appendChild(header);

      codes.forEach((code) => {
        const stat = getStandardProgress(code, profile);
        if (stat.total === 0) return; // skip codes not yet attached to any skill
        const card = document.createElement('div');
        card.className = 'standard-card';
        const pct = Math.round(stat.ratio * 100);
        card.innerHTML = `
          <div class="standard-head">
            <span class="standard-code">${escapeHtml(code)}</span>
            <span class="standard-pct">${pct}%</span>
          </div>
          <div class="standard-desc">${escapeHtml(stat.description)}</div>
          <div class="standard-bar"><div class="standard-bar-fill" style="width: ${pct}%"></div></div>
          <div class="standard-meta">${stat.mastered} mastered · ${stat.available} available · ${stat.total} total${stat.fading ? ` · ${stat.fading} fading` : ''}</div>
        `;
        el.progressStandardsList.appendChild(card);
      });
    });
  }

  function setProgressTab(name) {
    el.progressTabs.forEach((b) => {
      b.setAttribute('aria-pressed', b.dataset.progressTab === name ? 'true' : 'false');
    });
    if (el.progressViewArea)     el.progressViewArea.style.display     = name === 'area'     ? '' : 'none';
    if (el.progressViewTarget)   el.progressViewTarget.style.display   = name === 'target'   ? '' : 'none';
    if (el.progressViewStandard) el.progressViewStandard.style.display = name === 'standard' ? '' : 'none';
    if (name === 'standard') renderProgressStandards();
    if (name === 'area')     renderProgressByArea();
  }

  /* v5.2 — Rammeplan-area dashboard.
     Renders each of the 7 Norwegian learning areas as a section
     with progress dots per skill category. Norwegian framing:
     breadth of exploration, not percentage benchmarks. */
  function renderProgressByArea() {
    if (!el.progressAreasList) return;
    const profile = activeProfile();
    if (!profile) return;
    el.progressAreasList.innerHTML = '';
    RAMMEPLAN_AREAS.forEach((area) => {
      const totals = computeAreaProgress(area, profile);
      const card = document.createElement('div');
      card.className = 'area-card';
      card.innerHTML = `
        <div class="area-head">
          <span class="area-emoji">${area.emoji}</span>
          <div class="area-titles">
            <div class="area-en">${escapeHtml(area.en)}</div>
            <div class="area-no">${escapeHtml(area.no)}</div>
          </div>
        </div>
        <div class="area-intro">${escapeHtml(area.intro)}</div>
        <div class="area-groups"></div>
        <div class="area-totals">
          ${totals.mastered} confident · ${totals.practiced} exploring · ${totals.available} of ${totals.total} available at this age
        </div>
      `;
      const groupsContainer = card.querySelector('.area-groups');
      area.groups.forEach((g) => {
        const stats = computeCategoryProgress(g.category, profile);
        const row = document.createElement('div');
        row.className = 'area-group';
        const dotsHTML = stats.dots.map((kind) => `<span class="area-dot ${kind}"></span>`).join('');
        row.innerHTML = `
          <div class="area-group-label">${escapeHtml(g.label)}</div>
          <div class="area-group-dots">${dotsHTML}</div>
          <div class="area-group-meta">${stats.mastered}/${stats.available || stats.total}</div>
        `;
        groupsContainer.appendChild(row);
      });
      el.progressAreasList.appendChild(card);
    });
  }

  function renderProgressSummary() {
    const p = activeProfile();
    if (!p || !el.progressSummary) return;
    const stats = computeProfileStats(p);
    el.progressSummary.innerHTML = '';

    const sessionsLast30 = (p.progress.sessions || []).filter((s) => {
      const d = new Date(s.date);
      return (Date.now() - d.getTime()) / 86400000 <= 30;
    });
    const minutesLast30 = sessionsLast30.reduce((acc, s) => acc + (s.durationMs || 0), 0) / 60000;

    /* Rammeplan framing: this is a parent dashboard, but even here we
       avoid evaluative/competitive vocabulary. */
    const rows = [
      ['Child',                p.name],
      ['Age',                  `${Math.floor(p.ageMonths / 12)}y ${p.ageMonths % 12}mo`],
      ['Where they are',       stats.abilityLevel],
      ['Things age-appropriate', `${stats.availableSkills} of ${stats.totalSkills}`],
      ['Confident with',       `${stats.masteredSkills} of ${stats.availableSkills}`],
      ['Currently exploring',  `${stats.practicedSkills}`],
      ['Play time last 30d',   `${Math.round(minutesLast30)} min over ${sessionsLast30.length} day${sessionsLast30.length === 1 ? '' : 's'}`]
    ];
    rows.forEach(([k, v]) => {
      const row = document.createElement('div');
      row.className = 'summary-row';
      row.innerHTML = `<span class="summary-key">${k}</span><span class="summary-val">${v}</span>`;
      el.progressSummary.appendChild(row);
    });
  }

  function renderStreak() {
    if (!el.progressStreak) return;
    const p = activeProfile();
    if (!p || !p.streaks || p.streaks.current < 2) {
      el.progressStreak.style.display = 'none';
      return;
    }
    el.progressStreak.style.display = '';
    /* Growth metaphor, not pressure. A "streak" should never become anxiety. */
    el.progressStreak.innerHTML = `🌱 <strong>${p.streaks.current} play days in a row</strong> · Best so far: ${p.streaks.longest}`;
  }

  function openProgress() {
    renderProgressSummary();
    renderStreak();
    renderRecommendations();      // v5.10 — adaptive parent panel
    renderProgressCells(el.progressLetters, LETTERS, (sym) => `letter-recognize-${sym.toUpperCase()}`);
    renderProgressCells(el.progressNumbers, NUMBERS, (sym) => `number-recognize-${sym}`);
    setProgressTab('area');
    el.modalSettings.classList.remove('active');
    el.modalProgress.classList.add('active');
  }

  /* v5.10 — Parent recommendations panel.
     Surfaces "ready to advance" and "needs practice" insights based
     on recent error rates. Empty state is hidden entirely; if there
     are no patterns yet (fewer than 3 attempts on most skills) the
     panel doesn't appear, avoiding noise. */
  function renderRecommendations() {
    if (!el.progressRecs) return;
    const profile = activeProfile();
    if (!profile) { el.progressRecs.style.display = 'none'; return; }
    const recs = computeRecommendations(profile, 4);
    if (!recs.stuck.length && !recs.advancing.length) {
      el.progressRecs.style.display = 'none';
      return;
    }
    el.progressRecs.style.display = '';
    el.progressRecs.innerHTML = '';

    if (recs.stuck.length) {
      const card = document.createElement('div');
      card.className = 'rec-card rec-stuck';
      const items = recs.stuck.map((r) => {
        const pct = Math.round(r.errorRate * 100);
        return `<li><strong>${escapeHtml(r.skill.label)}</strong> <span class="rec-meta">${pct}% off recently</span></li>`;
      }).join('');
      card.innerHTML = `
        <div class="rec-head"><span class="rec-icon">🌱</span><span class="rec-title">Could use more practice</span></div>
        <p class="rec-intro">These skills have been tricky in the last few rounds. The picker is already showing them more — you can also try them off-screen.</p>
        <ul class="rec-list">${items}</ul>
      `;
      el.progressRecs.appendChild(card);
    }

    if (recs.advancing.length) {
      const card = document.createElement('div');
      card.className = 'rec-card rec-advancing';
      const items = recs.advancing.map((r) => `<li><strong>${escapeHtml(r.skill.label)}</strong> <span class="rec-meta">confident</span></li>`).join('');
      card.innerHTML = `
        <div class="rec-head"><span class="rec-icon">📈</span><span class="rec-title">Ready for more</span></div>
        <p class="rec-intro">These are settled. The Norwegian way is not to push faster — just notice and celebrate.</p>
        <ul class="rec-list">${items}</ul>
      `;
      el.progressRecs.appendChild(card);
    }
  }

  // ============================================================
  //  SKILL DETAIL (v3)
  // ============================================================
  function openSkillDetail(symbol, kind /* 'letter' | 'number' */) {
    const profile = activeProfile();
    if (!profile || !el.modalSkill) return;
    const key = kind === 'letter' ? symbol.toUpperCase() : symbol;

    const skillIds = kind === 'letter'
      ? [`letter-recognize-${key}`, `letter-sound-${key}`, `letter-trace-${key}`]
      : [`number-recognize-${key}`, `number-trace-${key}`, `count-${key}`].filter(id => SKILLS_BY_ID[id]);

    el.skillTitle.textContent = kind === 'letter' ? `Letter ${key}` : `Number ${key}`;
    el.skillDetails.innerHTML = '';

    skillIds.forEach((id) => {
      const skill = SKILLS_BY_ID[id];
      if (!skill) return;
      const p = getSkillProgress(skill, profile);
      const pct = Math.min(100, Math.round((p.successes / skill.masteryThreshold) * 100));
      const available = isSkillAvailable(skill, profile, { relaxPrereqs: true });
      const ageOk = (profile.ageMonths ?? 48) >= skill.minAgeMonths;
      const mastered = isSkillMastered(skill, profile);
      const fading = isSkillFading(skill, profile);

      const item = document.createElement('div');
      item.className = `skill-item ${mastered ? 'mastered' : ''} ${fading ? 'fading' : ''}`;

      /* Norwegian-framed labels — never "mastered/failed/behind" language */
      const statusBadge = !ageOk
        ? `<span class="skill-badge muted">Suggested at ${Math.floor(skill.minAgeMonths/12)}y+</span>`
        : mastered
          ? (fading ? `<span class="skill-badge fading">Confident · time to revisit</span>` : `<span class="skill-badge mastered">Confident</span>`)
          : p.successes > 0 ? `<span class="skill-badge practiced">Exploring</span>` : '';

      const standardChips = (skill.standards || []).map((code) => {
        const desc = STANDARDS_REFERENCE[code] || code;
        return `<span class="standard-chip" title="${escapeHtml(desc)}">${escapeHtml(code)}</span>`;
      }).join(' ');

      item.innerHTML = `
        <div class="skill-row-head">
          <span class="skill-row-name">${prettySkillName(skill)}</span>
          ${statusBadge}
        </div>
        <div class="skill-bar"><div class="skill-bar-fill" style="width: ${pct}%"></div></div>
        <div class="skill-row-meta">
          <span>${p.successes} of ${skill.masteryThreshold} correct${p.attempts > p.successes ? ` · ${p.attempts - p.successes} miss${p.attempts - p.successes === 1 ? '' : 'es'}` : ''}</span>
          ${p.lastSeen ? `<span>last seen ${relativeDate(p.lastSeen)}</span>` : '<span>not yet practiced</span>'}
        </div>
        <div class="skill-row-standards">${standardChips}</div>
      `;
      el.skillDetails.appendChild(item);
    });

    el.modalProgress.classList.remove('active');
    el.modalSkill.classList.add('active');
  }

  function prettySkillName(skill) {
    switch (skill.category) {
      case 'letter-recognize': return 'Recognize the letter';
      case 'letter-sound':     return 'Letter sound (phonics)';
      case 'letter-trace':     return 'Trace the letter';
      case 'number-recognize': return 'Recognize the number';
      case 'number-trace':     return 'Trace the number';
      case 'count':            return 'Count objects';
      default:                 return skill.label || skill.id;
    }
  }

  function relativeDate(ts) {
    const diffMs = Date.now() - ts;
    const diffMin = diffMs / 60000;
    if (diffMin < 1)    return 'just now';
    if (diffMin < 60)   return `${Math.round(diffMin)} min ago`;
    const diffHr = diffMin / 60;
    if (diffHr < 24)    return `${Math.round(diffHr)}h ago`;
    const diffDays = diffHr / 24;
    if (diffDays < 14)  return `${Math.round(diffDays)}d ago`;
    return new Date(ts).toLocaleDateString();
  }

  // ============================================================
  //  EXPORT / PRINT (v3)
  // ============================================================
  function exportProgressJSON() {
    const profile = activeProfile();
    if (!profile) return;
    const stats = computeProfileStats(profile);
    const standards = {};
    Object.keys(groupSkillsByStandard()).forEach((code) => {
      standards[code] = getStandardProgress(code, profile);
    });
    const data = {
      exportedAt: new Date().toISOString(),
      schemaVersion: 'lnum-v3',
      profile: {
        name: profile.name,
        ageMonths: profile.ageMonths,
        createdAt: profile.createdAt
      },
      stats,
      streaks: profile.streaks || null,
      skills: profile.progress.skills || {},
      sessions: profile.progress.sessions || [],
      standards
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (profile.name || 'child').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    a.href = url;
    a.download = `${safeName}-progress-${todayString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function printProgress() {
    /* The progress modal stays open; @media print hides everything else.
       Browser print dialog lets the parent save as PDF. */
    window.print();
  }

  el.progressBtn?.addEventListener('click', openProgress);
  el.progressClose?.addEventListener('click', () => el.modalProgress.classList.remove('active'));
  el.modalProgress?.addEventListener('click', (e) => {
    if (e.target === el.modalProgress) el.modalProgress.classList.remove('active');
  });
  el.resetProgressBtn?.addEventListener('click', () => {
    const profile = activeProfile();
    if (!profile) return;
    if (!confirm(`Reset progress for ${profile.name}? This cannot be undone.`)) return;
    profile.progress = { skills: {}, events: [], sessions: [] };
    profile.streaks  = { current: 0, longest: 0, lastPlayedDate: null };
    saveStorage();
    refreshHeader();
    renderProgressSummary();
    renderStreak();
    renderProgressCells(el.progressLetters, LETTERS, (sym) => `letter-recognize-${sym.toUpperCase()}`);
    renderProgressCells(el.progressNumbers, NUMBERS, (sym) => `number-recognize-${sym}`);
    renderProgressStandards();
  });

  // v3 progress wiring — tabs, export, print, skill detail close
  el.progressTabs?.forEach((btn) => {
    btn.addEventListener('click', () => setProgressTab(btn.dataset.progressTab));
  });
  el.exportProgressBtn?.addEventListener('click', exportProgressJSON);
  el.printProgressBtn?.addEventListener('click', printProgress);
  el.skillClose?.addEventListener('click', () => {
    el.modalSkill.classList.remove('active');
    el.modalProgress.classList.add('active');
  });
  el.modalSkill?.addEventListener('click', (e) => {
    if (e.target === el.modalSkill) {
      el.modalSkill.classList.remove('active');
      el.modalProgress.classList.add('active');
    }
  });

  // ============================================================
  //  VOICE RECORDING UI (v3.1)
  //  Parent records letters/sounds/words/numbers in their own voice.
  //  Stored in IndexedDB, played back instead of synthetic TTS.
  // ============================================================
  let activeRecorder = null;
  let recordingKey   = null;
  let recordingChunks = [];
  let micStream      = null;
  let autoStopTimer  = null;
  let activeRecordTab = 'letter-name';
  const MAX_RECORDING_MS = 4000;

  async function getMic() {
    if (micStream) return micStream;
    if (!navigator.mediaDevices?.getUserMedia) return null;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return micStream;
    } catch (err) {
      alert('Microphone access denied. Enable it in your browser/site settings, then try again.');
      return null;
    }
  }

  function releaseMic() {
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      micStream = null;
    }
  }

  async function startRecordingFor(key) {
    if (activeRecorder) { try { activeRecorder.stop(); } catch {} }
    const stream = await getMic();
    if (!stream) return false;
    recordingChunks = [];

    let mime = '';
    if (typeof MediaRecorder !== 'undefined') {
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      for (const c of candidates) {
        if (MediaRecorder.isTypeSupported(c)) { mime = c; break; }
      }
    } else {
      alert('Recording is not supported in this browser.');
      return false;
    }

    activeRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recordingKey = key;
    activeRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) recordingChunks.push(e.data); };
    activeRecorder.onstop = async () => {
      const blob = new Blob(recordingChunks, { type: activeRecorder?.mimeType || 'audio/webm' });
      const stoppedKey = recordingKey;
      activeRecorder = null;
      recordingKey = null;
      if (blob.size > 200) await saveRecording(stoppedKey, blob);
      renderRecordList();
      // v5.13 — first recording proves the parent took the better path;
      // hide the home banner.
      refreshVoiceBanner();
    };
    activeRecorder.start();
    clearTimeout(autoStopTimer);
    autoStopTimer = setTimeout(stopActiveRecording, MAX_RECORDING_MS);
    return true;
  }

  function stopActiveRecording() {
    clearTimeout(autoStopTimer);
    autoStopTimer = null;
    if (activeRecorder && activeRecorder.state !== 'inactive') {
      try { activeRecorder.stop(); } catch {}
    }
  }

  function recordItemsForTab(tab) {
    if (tab === 'letter-name') {
      return LETTERS.map((L) => ({
        key: idbKey('letter', 'name', L),
        symbol: L,
        hint: `Say the letter name: "${L}"`
      }));
    }
    if (tab === 'letter-sound') {
      return LETTERS.map((L) => ({
        key: idbKey('letter', 'sound', L),
        symbol: L,
        hint: `Say the phonetic sound: "${LETTER_SOUNDS[L]}"`
      }));
    }
    if (tab === 'letter-word') {
      return LETTERS.map((L) => {
        const w = LETTER_WORDS[L] || { word: L, emoji: '' };
        return {
          key: idbKey('letter', 'word', L),
          symbol: `${w.emoji} ${L}`,
          hint: `Say the word: "${w.word}"`
        };
      });
    }
    if (tab === 'number') {
      return NUMBERS.map((N) => ({
        key: idbKey('number', 'name', N),
        symbol: N,
        hint: `Say the number: "${N}"`
      }));
    }
    return [];
  }

  function renderRecordList() {
    if (!el.recordList) return;
    const items = recordItemsForTab(activeRecordTab);
    el.recordList.innerHTML = '';
    items.forEach((item) => {
      const hasRec    = recordedKeys.has(item.key);
      const isActive  = recordingKey === item.key && activeRecorder;
      const row = document.createElement('div');
      row.className = 'record-row' + (isActive ? ' recording' : '') + (hasRec ? ' has-rec' : '');
      row.innerHTML = `
        <div class="record-row-left">
          <span class="record-symbol">${escapeHtml(item.symbol)}</span>
          <span class="record-hint">${escapeHtml(item.hint)}</span>
        </div>
        <div class="record-row-actions">
          <button class="record-btn ${isActive ? 'stop' : 'rec'}" data-action="${isActive ? 'stop' : 'record'}" data-key="${item.key}" aria-label="${isActive ? 'Stop' : 'Record'}">
            ${isActive ? '⏹' : '●'}
          </button>
          <button class="record-btn play" data-action="play" data-key="${item.key}" ${hasRec ? '' : 'disabled'} aria-label="Play">▶</button>
          <button class="record-btn del" data-action="delete" data-key="${item.key}" ${hasRec ? '' : 'disabled'} aria-label="Delete">✕</button>
        </div>
      `;
      el.recordList.appendChild(row);
    });
    updateRecordSummary();
  }

  function updateRecordSummary() {
    if (!el.recordSummary) return;
    const total = LETTERS.length * 3 + NUMBERS.length; // 26×3 + 11 = 89
    const recorded = [...recordedKeys].filter((k) => k.startsWith('letter/') || k.startsWith('number/')).length;
    el.recordSummary.textContent = `${recorded} of ${total} recorded`;
  }

  // ============================================================
  //  v5.13 — BULK RECORDER
  //  Sequencer that walks every item in the active tab, recording each
  //  for MAX_RECORDING_MS with a short cool-down + audible cue between
  //  items. Cancellable via the Stop button or by closing the modal.
  // ============================================================
  const BULK_GAP_MS = 1100;          // pause between items (write-back + breath)
  const BULK_COUNTDOWN_MS = 800;     // "get ready" beat before each recording
  let bulkRecording = false;
  let bulkCancelled = false;

  function setBulkStatus(text, active = false) {
    if (!el.recordBulkStatus) return;
    el.recordBulkStatus.textContent = text || '';
    el.recordBulkStatus.classList.toggle('active', !!active);
  }

  function setBulkButtons(running) {
    if (el.recordBulkStart) {
      el.recordBulkStart.hidden = running;
      el.recordBulkStart.disabled = false;
    }
    if (el.recordBulkStop) {
      el.recordBulkStop.hidden = !running;
    }
  }

  /* Play a short tone so the parent has an audible cue between items.
     Uses WebAudio (no extra MP3 dependency). Falls back to silent gap if
     the browser doesn't expose AudioContext (vanishingly rare). */
  function playBulkCue(kind = 'go') {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.value = kind === 'go' ? 880 : 660;
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      o.start();
      o.stop(ctx.currentTime + 0.22);
      setTimeout(() => { try { ctx.close(); } catch {} }, 400);
    } catch {}
  }

  async function startBulkRecording() {
    if (bulkRecording) return;
    bulkCancelled = false;
    bulkRecording = true;
    setBulkButtons(true);

    // Make sure the mic is granted up front — failing here is friendlier
    // than failing item-by-item halfway through the alphabet.
    const stream = await getMic();
    if (!stream) {
      bulkRecording = false;
      setBulkButtons(false);
      setBulkStatus('Microphone access was denied — enable it in your browser settings and try again.', false);
      return;
    }

    const items = recordItemsForTab(activeRecordTab);
    for (let i = 0; i < items.length; i++) {
      if (bulkCancelled) break;
      const item = items[i];

      // Highlight the row in the list and scroll it into view
      const row = el.recordList?.querySelector(`[data-key="${CSS.escape(item.key)}"]`)?.closest('.record-row');
      if (row) {
        el.recordList.querySelectorAll('.bulk-target').forEach((n) => n.classList.remove('bulk-target'));
        row.classList.add('bulk-target');
        row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }

      setBulkStatus(`Get ready — ${item.symbol}  (${i + 1} of ${items.length})`, true);
      await sleep(BULK_COUNTDOWN_MS);
      if (bulkCancelled) break;

      playBulkCue('go');
      setBulkStatus(`Speak now: "${item.hint.replace(/^Say (the )?/i, '')}"  (${i + 1} of ${items.length})`, true);
      const started = await startRecordingFor(item.key);
      if (!started) {
        setBulkStatus('Recording could not start — stopping bulk.', false);
        break;
      }

      // Wait for the recording window to finish (auto-stops at MAX_RECORDING_MS,
      // or sooner if cancelled).
      const waitUntil = Date.now() + MAX_RECORDING_MS;
      while (activeRecorder && Date.now() < waitUntil && !bulkCancelled) {
        await sleep(120);
      }
      if (activeRecorder) stopActiveRecording();
      // Wait for the onstop handler to finish saving + re-render the list
      await sleep(180);
      if (bulkCancelled) break;

      // Brief cool-down + cue between items
      playBulkCue('done');
      setBulkStatus(`Saved ${item.symbol}. Next…`, true);
      await sleep(BULK_GAP_MS);
    }

    // Clear highlight + restore UI
    el.recordList?.querySelectorAll('.bulk-target').forEach((n) => n.classList.remove('bulk-target'));
    bulkRecording = false;
    setBulkButtons(false);
    setBulkStatus(bulkCancelled ? 'Stopped.' : 'Done — all items in this tab recorded.', false);
    refreshVoiceBanner();
  }

  function cancelBulkRecording() {
    if (!bulkRecording) return;
    bulkCancelled = true;
    stopActiveRecording();
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // About / Pedagogy modal wiring
  el.aboutBtn?.addEventListener('click', () => {
    closeSettings();
    el.modalAbout?.classList.add('active');
  });
  el.aboutClose?.addEventListener('click', () => el.modalAbout?.classList.remove('active'));
  el.modalAbout?.addEventListener('click', (e) => {
    if (e.target === el.modalAbout) el.modalAbout.classList.remove('active');
  });

  // ============================================================
  //  v5.19 — PARENT OBSERVATION JOURNAL (Finally Focused)
  //  Parent-only tool — Settings gates entry. The JournalAPI module
  //  owns storage / aggregates / export; this section is pure UI.
  // ============================================================
  let activeJournalTab = 'today';
  let activeJournalKey = null;   // YYYY-MM-DD the form is currently editing

  function buildLadders() {
    // 1-5 emoji ladder, one per dimension (mood, focus, energy)
    document.querySelectorAll('.j-ladder').forEach((ladder) => {
      if (ladder.childElementCount > 0) return;  // built once
      const labels = ['😞','🙁','😐','🙂','😄'];
      labels.forEach((emoji, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'j-ladder-step';
        btn.dataset.value = String(i + 1);
        btn.textContent = emoji;
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', 'false');
        btn.setAttribute('aria-label', `Level ${i + 1} of 5`);
        ladder.appendChild(btn);
      });
    });
  }

  function loadEntryIntoForm() {
    const profile = activeProfile();
    if (!profile || !window.JournalAPI) return;
    activeJournalKey = JournalAPI.todayKey();
    const entry = JournalAPI.getEntry(profile, activeJournalKey);
    // Sliders + readouts
    el.jSleep.value = entry.sleep ?? 0;
    el.jSleepReadout.textContent = entry.sleep != null ? entry.sleep.toFixed(1) : '—';
    el.jScreen.value = entry.screen ?? 0;
    el.jScreenReadout.textContent = entry.screen != null ? `${entry.screen} min` : '—';
    el.jOutdoor.value = entry.outdoor ?? 0;
    el.jOutdoorReadout.textContent = entry.outdoor != null ? `${entry.outdoor} min` : '—';
    // Ladders
    ['mood', 'focus', 'energy'].forEach((field) => {
      const v = entry[field];
      document.querySelectorAll(`.j-ladder[data-field="${field}"] .j-ladder-step`).forEach((b) => {
        const on = (v != null && Number(b.dataset.value) === v);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.classList.toggle('selected', on);
      });
    });
    el.jSupplements.value = entry.supplements || '';
    el.jNotes.value = entry.notes || '';
  }

  function patchEntry(patch) {
    const profile = activeProfile();
    if (!profile || !window.JournalAPI || !activeJournalKey) return;
    JournalAPI.setEntry(profile, activeJournalKey, patch);
    saveStorage();
  }

  function renderWeekTrend() {
    if (!el.jTrend || !window.JournalAPI) return;
    const profile = activeProfile();
    if (!profile) return;
    el.jTrend.innerHTML = '';
    const range = JournalAPI.entriesForRange(profile, 7);
    const moodVals   = range.map((e) => e.mood);
    const focusVals  = range.map((e) => e.focus);
    const energyVals = range.map((e) => e.energy);
    const sleepVals  = range.map((e) => e.sleep);

    const mkRow = (label, values, opts) => {
      const row = document.createElement('div');
      row.className = 'j-trend-row';
      const lbl = document.createElement('div');
      lbl.className = 'j-trend-label';
      const avg = JournalAPI.average(range, opts.field);
      lbl.innerHTML = `<span>${label}</span><span class="j-trend-avg">${avg != null ? avg.toFixed(1) : '—'}</span>`;
      row.appendChild(lbl);
      const chartWrap = document.createElement('div');
      chartWrap.className = 'j-trend-chart';
      const chart = JournalAPI.sparkline(values, {
        min: opts.min, max: opts.max,
        stroke: opts.stroke, width: 280, height: 36
      });
      chartWrap.appendChild(chart);
      row.appendChild(chartWrap);
      el.jTrend.appendChild(row);
    };
    mkRow('Mood',    moodVals,   { field: 'mood',    min: 1, max: 5,  stroke: 'var(--accent)' });
    mkRow('Focus',   focusVals,  { field: 'focus',   min: 1, max: 5,  stroke: 'var(--secondary)' });
    mkRow('Energy',  energyVals, { field: 'energy',  min: 1, max: 5,  stroke: 'var(--success)' });
    mkRow('Sleep',   sleepVals,  { field: 'sleep',   min: 0, max: 12, stroke: 'var(--warning)' });
  }

  function renderMonthCalendar() {
    if (!el.jCalendar || !window.JournalAPI) return;
    const profile = activeProfile();
    if (!profile) return;
    el.jCalendar.innerHTML = '';
    const range = JournalAPI.entriesForRange(profile, 30);
    // Day-of-week header
    const dayLabels = ['S','M','T','W','T','F','S'];
    dayLabels.forEach((d) => {
      const h = document.createElement('div');
      h.className = 'j-cal-dayhead';
      h.textContent = d;
      el.jCalendar.appendChild(h);
    });
    // Pad the start so the first cell aligns to the correct day-of-week
    const first = new Date(range[0].date);
    const pad = first.getDay();
    for (let i = 0; i < pad; i++) {
      const blank = document.createElement('div');
      blank.className = 'j-cal-cell j-cal-blank';
      el.jCalendar.appendChild(blank);
    }
    // Cells
    range.forEach((entry) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'j-cal-cell';
      const score = JournalAPI.dayScore(entry);
      if (score != null) {
        cell.classList.add('j-cal-filled');
        // Composite score → alpha. 0 → 0.18, 1 → 1.0
        const a = 0.18 + score * 0.82;
        cell.style.background = `oklch(from var(--accent) l c h / ${a.toFixed(2)})`;
      }
      const d = new Date(entry.date);
      cell.textContent = String(d.getDate());
      cell.title = entry.date + (score != null ? ` — mood/focus/energy ${(score * 4 + 1).toFixed(1)} / 5` : ' — no entry');
      cell.addEventListener('click', () => {
        // Jump back to Today tab and (for future) edit historical
        switchJournalTab('today');
      });
      el.jCalendar.appendChild(cell);
    });
  }

  function switchJournalTab(name) {
    activeJournalTab = name;
    el.journalTabs?.forEach((b) =>
      b.setAttribute('aria-pressed', b.dataset.journalTab === name ? 'true' : 'false'));
    ['today', 'week', 'month', 'export'].forEach((t) => {
      const pane = document.getElementById('journal-pane-' + t);
      if (pane) pane.hidden = (t !== name);
    });
    if (name === 'today')  loadEntryIntoForm();
    if (name === 'week')   renderWeekTrend();
    if (name === 'month')  renderMonthCalendar();
  }

  function openJournal() {
    if (!el.modalJournal) return;
    buildLadders();
    closeSettings();
    el.modalJournal.classList.add('active');
    switchJournalTab('today');
  }
  function closeJournal() {
    el.modalJournal?.classList.remove('active');
  }

  el.journalBtn?.addEventListener('click', openJournal);

  // v6.1 — Parent dashboard button
  document.getElementById('dashboard-btn')?.addEventListener('click', () => {
    closeSettings();
    if (typeof openDashboard === 'function') openDashboard();
  });

  // v6.2 — Today's adventure card (above the mode grid on home).
  function refreshTodaysAdventure() {
    const card  = document.getElementById('today-adventure-card');
    const char  = document.getElementById('today-adventure-char');
    const title = document.getElementById('today-adventure-title');
    const hook  = document.getElementById('today-adventure-hook');
    if (!card || typeof todaysAdventure !== 'function') return;
    const adv = todaysAdventure();
    if (!adv) { card.hidden = true; return; }
    char.textContent  = adv.character;
    title.textContent = adv.title;
    hook.textContent  = adv.hook;
    card.hidden = false;
  }
  document.getElementById('today-adventure-card')?.addEventListener('click', () => {
    if (typeof startTodaysAdventure === 'function') startTodaysAdventure();
  });
  // Expose startMode to the adventure runner
  window.startMode = startMode;
  el.journalClose?.addEventListener('click', closeJournal);
  el.modalJournal?.addEventListener('click', (e) => {
    if (e.target === el.modalJournal) closeJournal();
  });

  el.journalTabs?.forEach((b) =>
    b.addEventListener('click', () => switchJournalTab(b.dataset.journalTab)));

  // Today-form change handlers — save on every change so nothing is lost
  el.jSleep?.addEventListener('input', () => {
    const v = parseFloat(el.jSleep.value);
    el.jSleepReadout.textContent = v.toFixed(1);
    patchEntry({ sleep: v });
  });
  el.jScreen?.addEventListener('input', () => {
    const v = parseInt(el.jScreen.value, 10);
    el.jScreenReadout.textContent = `${v} min`;
    patchEntry({ screen: v });
  });
  el.jOutdoor?.addEventListener('input', () => {
    const v = parseInt(el.jOutdoor.value, 10);
    el.jOutdoorReadout.textContent = `${v} min`;
    patchEntry({ outdoor: v });
  });
  el.jSupplements?.addEventListener('input', () => patchEntry({ supplements: el.jSupplements.value }));
  el.jNotes?.addEventListener('input',       () => patchEntry({ notes: el.jNotes.value }));

  // Ladder clicks
  document.querySelectorAll('.j-ladder').forEach((ladder) => {
    ladder.addEventListener('click', (e) => {
      const btn = e.target.closest('.j-ladder-step');
      if (!btn) return;
      const field = ladder.dataset.field;
      const v = Number(btn.dataset.value);
      ladder.querySelectorAll('.j-ladder-step').forEach((b) => {
        const on = b === btn;
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.classList.toggle('selected', on);
      });
      patchEntry({ [field]: v });
    });
  });

  // Export buttons
  el.jExportJson?.addEventListener('click', () => {
    const p = activeProfile(); if (!p || !window.JournalAPI) return;
    const json = JournalAPI.exportJSON(p);
    JournalAPI.downloadBlob(json, `journal-${p.name}-${JournalAPI.todayKey()}.json`, 'application/json');
  });
  el.jExportCsv?.addEventListener('click', () => {
    const p = activeProfile(); if (!p || !window.JournalAPI) return;
    const csv = JournalAPI.exportCSV(p);
    JournalAPI.downloadBlob(csv, `journal-${p.name}-${JournalAPI.todayKey()}.csv`, 'text/csv');
  });
  el.jExportPdf?.addEventListener('click', () => {
    // Reuses the existing print pipeline — a styled snapshot of the
    // calendar + week trend would be cleaner; for now print the whole
    // modal which is already a clean one-pager.
    window.print();
  });

  // Agency picker backdrop close
  el.modalAgency?.addEventListener('click', (e) => {
    if (e.target === el.modalAgency) {
      el.modalAgency.classList.remove('active');
      // Treat as "Surprise me" — pick first candidate or fall back to home
      goHome();
    }
  });

  el.recordList?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const key = btn.dataset.key;
    if (action === 'record') {
      await startRecordingFor(key);
      renderRecordList();
    } else if (action === 'stop') {
      stopActiveRecording();
    } else if (action === 'play') {
      await playRecording(key);
    } else if (action === 'delete') {
      if (confirm('Delete this recording?')) {
        await deleteRecording(key);
        renderRecordList();
      }
    }
  });

  el.recordTabs?.forEach((b) => {
    b.addEventListener('click', () => {
      if (bulkRecording) cancelBulkRecording();
      el.recordTabs.forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      activeRecordTab = b.dataset.recordTab;
      stopActiveRecording();
      renderRecordList();
      setBulkStatus('');
    });
  });

  // v5.13 — bulk recorder buttons
  el.recordBulkStart?.addEventListener('click', () => { startBulkRecording(); });
  el.recordBulkStop?.addEventListener('click',  () => { cancelBulkRecording(); });

  el.recordBtn?.addEventListener('click', () => {
    closeSettings();
    el.modalRecord.classList.add('active');
    activeRecordTab = 'letter-name';
    el.recordTabs?.forEach((x) => x.setAttribute('aria-pressed', x.dataset.recordTab === 'letter-name' ? 'true' : 'false'));
    renderRecordList();
  });

  // v5.13 — robotic-voice banner wiring
  el.voiceBannerRecord?.addEventListener('click', () => {
    // Quietly dismiss the banner (the parent's clearly engaged) and open
    // the recording modal directly.
    const profile = activeProfile();
    if (profile) { profile.settings.roboticVoiceBannerDismissed = true; saveStorage(); }
    if (el.voiceBanner) el.voiceBanner.hidden = true;
    el.modalRecord?.classList.add('active');
    activeRecordTab = 'letter-name';
    el.recordTabs?.forEach((x) => x.setAttribute('aria-pressed', x.dataset.recordTab === 'letter-name' ? 'true' : 'false'));
    renderRecordList();
  });
  el.voiceBannerDismiss?.addEventListener('click', () => {
    const profile = activeProfile();
    if (profile) { profile.settings.roboticVoiceBannerDismissed = true; saveStorage(); }
    if (el.voiceBanner) el.voiceBanner.hidden = true;
  });

  el.recordClose?.addEventListener('click', () => {
    if (bulkRecording) cancelBulkRecording();
    stopActiveRecording();
    releaseMic();
    el.modalRecord.classList.remove('active');
    setBulkStatus('');
  });
  el.modalRecord?.addEventListener('click', (e) => {
    if (e.target === el.modalRecord) {
      if (bulkRecording) cancelBulkRecording();
      stopActiveRecording();
      releaseMic();
      el.modalRecord.classList.remove('active');
      setBulkStatus('');
    }
  });

  // v3 break-suggestion wiring
  el.breakContinue?.addEventListener('click', () => {
    el.modalBreak.classList.remove('active');
    startNewSession(); // reset clock; next break in another full window
  });
  el.breakDone?.addEventListener('click', () => {
    el.modalBreak.classList.remove('active');
    goHome();
  });
  el.modalBreak?.addEventListener('click', (e) => {
    if (e.target === el.modalBreak) el.modalBreak.classList.remove('active');
  });

  // ============================================================
  //  PROFILE PICKER + EDIT
  // ============================================================
  function renderProfileList() {
    el.profileList.innerHTML = '';
    state.profiles.forEach((p) => {
      const stats = computeProfileStats(p);
      const row = document.createElement('div');
      row.className = 'profile-row' + (p.id === state.activeProfileId ? ' active' : '');

      const main = document.createElement('button');
      main.className = 'profile-row-main';
      main.innerHTML = `
        <span class="profile-row-name">${escapeHtml(p.name)}</span>
        <span class="profile-row-meta">${Math.floor(p.ageMonths / 12)}y · ${stats.abilityLevel} · ${stats.masteredSkills}/${stats.availableSkills}</span>
      `;
      main.addEventListener('click', () => {
        state.activeProfileId = p.id;
        saveStorage();
        applyTheme();
        VoiceEngine.pick();
        refreshHeader();          // band + mode locks
        refreshTodaySessionCard();
        el.modalProfile.classList.remove('active');
      });

      const edit = document.createElement('button');
      edit.className = 'profile-row-edit';
      edit.setAttribute('aria-label', 'Edit profile');
      edit.textContent = '✎';
      edit.addEventListener('click', (e) => {
        e.stopPropagation();
        openProfileEdit(p);
      });

      row.appendChild(main);
      row.appendChild(edit);
      el.profileList.appendChild(row);
    });
  }

  function openProfilePicker() {
    renderProfileList();
    el.modalProfile.classList.add('active');
  }

  el.profileSwitchBtn?.addEventListener('click', () => {
    closeSettings();
    openProfilePicker();
  });
  el.profileChip?.addEventListener('click', () => {
    openGate(openProfilePicker);
  });
  el.profileClose?.addEventListener('click', () => el.modalProfile.classList.remove('active'));
  el.modalProfile?.addEventListener('click', (e) => {
    if (e.target === el.modalProfile) el.modalProfile.classList.remove('active');
  });
  el.profileAdd?.addEventListener('click', () => {
    openProfileEdit(null);
  });

  let editingProfileId = null;
  function openProfileEdit(profile) {
    editingProfileId = profile?.id || null;
    el.profileEditTitle.textContent = profile ? 'Edit profile' : 'Add a child';
    el.profileEditName.value = profile?.name || '';
    setAgeButtons(el.profileEditAge, profile?.ageMonths || 48);
    el.profileEditDelete.style.display = (profile && state.profiles.length > 1) ? '' : 'none';
    el.modalProfile.classList.remove('active');
    el.modalProfileEdit.classList.add('active');
  }
  el.profileEditCancel?.addEventListener('click', () => {
    el.modalProfileEdit.classList.remove('active');
    openProfilePicker();
  });
  el.profileEditSave?.addEventListener('click', () => {
    const name = el.profileEditName.value.trim() || 'Friend';
    const ageMonths = parseInt(el.profileEditAge.querySelector('button[aria-pressed="true"]')?.dataset.months || '48', 10);
    if (editingProfileId) {
      const p = state.profiles.find((x) => x.id === editingProfileId);
      if (p) {
        p.name = name;
        p.ageMonths = clampAgeMonths(ageMonths);
        // Age changed → rebuild today's session for the new band
        delete p.dailySession;
      }
    } else {
      const p = newProfileObject(name, ageMonths);
      state.profiles.push(p);
      state.activeProfileId = p.id;
      applyTheme();
    }
    saveStorage();
    refreshHeader();           // updates band display + mode locks
    refreshTodaySessionCard(); // rebuild for new age
    el.modalProfileEdit.classList.remove('active');
    openProfilePicker();
  });
  el.profileEditDelete?.addEventListener('click', () => {
    if (!editingProfileId) return;
    if (state.profiles.length <= 1) return;
    const p = state.profiles.find((x) => x.id === editingProfileId);
    if (!p) return;
    if (!confirm(`Delete ${p.name}'s profile and all their progress? This cannot be undone.`)) return;
    state.profiles = state.profiles.filter((x) => x.id !== editingProfileId);
    if (state.activeProfileId === editingProfileId) {
      state.activeProfileId = state.profiles[0]?.id || null;
      applyTheme();
    }
    saveStorage();
    refreshHeader();
    el.modalProfileEdit.classList.remove('active');
    openProfilePicker();
  });

  function setAgeButtons(container, currentMonths) {
    container.querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-pressed', parseInt(b.dataset.months, 10) === currentMonths ? 'true' : 'false');
    });
  }
  function bindAgeGroup(container) {
    container.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-months]');
      if (!b) return;
      container.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    });
  }
  bindAgeGroup(el.welcomeAge);
  bindAgeGroup(el.profileEditAge);

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  // ============================================================
  //  WELCOME (first launch)
  // ============================================================
  el.welcomeSubmit?.addEventListener('click', () => {
    const name = el.welcomeName.value.trim() || 'Friend';
    const ageMonths = parseInt(el.welcomeAge.querySelector('button[aria-pressed="true"]')?.dataset.months || '48', 10);
    const profile = newProfileObject(name, ageMonths);
    state.profiles.push(profile);
    state.activeProfileId = profile.id;
    saveStorage();
    applyTheme();
    VoiceEngine.pick();
    refreshHeader();
    showScreen('home');
  });

  // ============================================================
  //  HOME — mode launch
  // ============================================================
  document.querySelectorAll('.mode-card, .freeplay-cta').forEach((card) => {
    card.addEventListener('click', () => {
      if (!activeProfile()) return;
      /* Tapping a single mode card cancels any in-flight daily session;
         the kid wants to do their own thing. */
      endSessionEarly();
      startMode(card.dataset.mode);
    });
  });

  // v5.1 — daily-session wiring
  el.todayStartBtn?.addEventListener('click', () => {
    if (!activeProfile()) return;
    startTodaysSession();
  });
  el.todayRebuildBtn?.addEventListener('click', () => {
    const p = activeProfile();
    if (!p) return;
    delete p.dailySession;            // force rebuild
    saveStorage();
    refreshTodaySessionCard();
  });
  el.scDoneBtn?.addEventListener('click', goHome);
  el.scAgainBtn?.addEventListener('click', startTodaysSession);

  // Tap the prompt to re-hear the target. Replaces auto-repeat-on-wrong;
  // gives the child (and parent) on-demand control.
  el.findTarget?.addEventListener('click', () => {
    if (state.advancing || !state.target) return;
    clearHintTimer();
    if (state.mode === 'find-letters') sayLetter(state.target);
    else if (state.mode === 'find-numbers') sayNumber(state.target);
  });
  el.soundsPic?.addEventListener('click', async () => {
    if (state.advancing || !state.target) return;
    clearHintTimer();
    // MP3 chain — word, then sound
    await sayWord(state.target);
    sayLetter(state.target, { mode: 'sound' });
  });
  el.countStage?.addEventListener('click', () => {
    if (state.advancing) return;
    clearHintTimer();
    /* Rotating MP3 prompt (matches startCountRound) */
    const prompts = ['how-many', 'count-them', 'lets-count', 'how-many-do-you-see'];
    const fallbacks = ['How many?', 'Count them.', "Let's count.", 'How many do you see?'];
    const i = Math.floor(Math.random() * prompts.length);
    sayPromptKey(prompts[i], fallbacks[i]);
  });

  // Home button — press-and-hold (500ms) with visible progress ring.
  // Visual feedback removes the "is this broken?" feel of pure hold-to-confirm.
  (() => {
    const HOLD_MS = 500;
    let timer = null;
    const start = (e) => {
      // Only respond to primary pointer — prevents double-fires on touch + mouse
      if (e.isPrimary === false) return;
      clearTimeout(timer);
      el.homeBtn.classList.add('holding');
      timer = setTimeout(() => {
        el.homeBtn.classList.remove('holding');
        goHome();
      }, HOLD_MS);
    };
    const cancel = () => {
      clearTimeout(timer);
      el.homeBtn.classList.remove('holding');
    };
    el.homeBtn.addEventListener('pointerdown', start);
    el.homeBtn.addEventListener('pointerup', cancel);
    el.homeBtn.addEventListener('pointerleave', cancel);
    el.homeBtn.addEventListener('pointercancel', cancel);
  })();

  el.settingsBtn.addEventListener('click', () => openGate(openSettings));

  // ============================================================
  //  INPUT GUARDS
  // ============================================================
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd < 350) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });

  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // ============================================================
  //  PWA
  // ============================================================
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    if (el.installPrompt && !window.matchMedia('(display-mode: standalone)').matches) {
      el.installPrompt.classList.add('active');
    }
  });
  el.installBtn?.addEventListener('click', async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    try { await deferredInstall.userChoice; } catch {}
    deferredInstall = null;
    el.installPrompt.classList.remove('active');
  });
  el.installDismiss?.addEventListener('click', () => el.installPrompt.classList.remove('active'));
  window.addEventListener('appinstalled', () => el.installPrompt?.classList.remove('active'));

  /* Service worker policy:
     - On localhost: SKIP registration (so dev iteration isn't blocked by SW caching).
       Also actively unregister any leftover SW from previous sessions.
       Override by adding ?sw=1 to the URL to test PWA behavior locally.
     - Everywhere else: register normally.
     - Listen for NEW_VERSION messages from an activating SW and soft-reload once,
       so users don't have to manually clear the SW after each deploy. */
  const _isLocalHost = /^(localhost|127\.|\[?::1\]?)$/.test(location.hostname) || location.hostname === '';
  const _forceSW = new URLSearchParams(location.search).has('sw');
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    if (_isLocalHost && !_forceSW) {
      navigator.serviceWorker.getRegistrations()
        .then((rs) => Promise.all(rs.map((r) => r.unregister())))
        .catch(() => {});
    } else {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }

    let reloadingForUpdate = false;
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.type === 'NEW_VERSION' && !reloadingForUpdate) {
        try {
          if (sessionStorage.getItem('ln.swReloaded') === e.data.version) return;
          sessionStorage.setItem('ln.swReloaded', e.data.version);
        } catch {}
        reloadingForUpdate = true;
        location.reload();
      }
    });
  }

  // ============================================================
  //  INIT
  // ============================================================
  applyTheme();
  refreshHeader();
  refreshTodaySessionCard();
  if (typeof refreshTodaysAdventure === 'function') refreshTodaysAdventure();
  showScreen(state.profiles.length === 0 ? 'welcome' : 'home');
  refreshRecordedKeys().then(() => refreshVoiceBanner()); // load IDB key index so speech can fast-path

  if ('speechSynthesis' in window) {
    let tries = 0;
    const t = setInterval(() => {
      VoiceEngine.refresh();
      if (VoiceEngine.voices.length || tries++ > 20) {
        clearInterval(t);
        // v5.13 — banner depends on knowing the voice pool, which on Safari
        // arrives several ticks after page load. Re-check once stable.
        refreshVoiceBanner();
      }
    }, 250);
  } else {
    // No speechSynthesis at all — surface the banner immediately
    refreshVoiceBanner();
  }

  // ============================================================
  //  v6.0 — Sync UI wiring
  //  Renders the Settings → Cross-device sync row reactively
  //  against Sync.status(). The actual flush loop + session check
  //  runs in sync.js; we only paint state here.
  // ============================================================
  function renderSyncUI(st) {
    const stateEl   = document.getElementById('sync-state');
    const actionsEl = document.getElementById('sync-actions');
    if (!stateEl || !actionsEl) return;

    if (!st.signedIn) {
      stateEl.innerHTML = '<span class="sync-status-off">Not signed in</span> — sync is off';
      actionsEl.innerHTML = `
        <input type="email" id="sync-email" placeholder="Your email" autocomplete="email" />
        <button class="btn btn-primary" id="sync-request">Send sign-in link</button>
      `;
      const email = document.getElementById('sync-email');
      const btn   = document.getElementById('sync-request');
      btn?.addEventListener('click', async () => {
        const addr = (email?.value || '').trim();
        if (!addr) return;
        btn.disabled = true;
        btn.textContent = 'Sending…';
        const result = await Sync.requestLink(addr);
        if (!result.ok) {
          stateEl.innerHTML = `<span class="sync-status-err">${escapeHtml(result.error)}</span>`;
          btn.disabled = false;
          btn.textContent = 'Send sign-in link';
          return;
        }
        if (result.sent === 'stubbed' && result.link) {
          // Self-hosted single-family — show the link inline
          actionsEl.innerHTML = `
            <p style="font-size:13px; color:var(--text-soft); line-height:1.45;">
              Sign-in link below. Tap it to complete sign-in:
            </p>
            <a class="btn btn-primary" id="sync-link" href="${escapeAttr(result.link)}">Open sign-in link</a>
            <button class="btn btn-secondary" id="sync-cancel">Cancel</button>
          `;
          document.getElementById('sync-cancel')?.addEventListener('click', () => renderSyncUI(Sync.status()));
        } else {
          stateEl.innerHTML = `<span class="sync-status-ok">Check your email for the sign-in link.</span>`;
          actionsEl.innerHTML = `<button class="btn btn-secondary" id="sync-cancel">Back</button>`;
          document.getElementById('sync-cancel')?.addEventListener('click', () => renderSyncUI(Sync.status()));
        }
      });
      return;
    }
    // Signed in — show toggle + status + sign out
    const lastPush = st.lastPush
      ? `Last sync ${Math.max(1, Math.round((Date.now() - st.lastPush) / 1000))}s ago`
      : (st.syncEnabled ? 'Waiting to sync…' : 'Sync is paused');
    stateEl.innerHTML = `
      <div><span class="sync-status-ok">Signed in</span> as ${escapeHtml(st.email)}</div>
      <div style="font-size:12px; color:var(--text-soft);">${lastPush}${st.outbox ? ` · ${st.outbox} pending` : ''}</div>
    `;
    actionsEl.innerHTML = `
      <div class="segmented sync-toggle">
        <button data-sync="on"  aria-pressed="${st.syncEnabled ? 'true' : 'false'}">Sync on</button>
        <button data-sync="off" aria-pressed="${st.syncEnabled ? 'false' : 'true'}">Off</button>
      </div>
      <button class="btn btn-secondary" id="sync-signout">Sign out</button>
    `;
    actionsEl.querySelectorAll('[data-sync]').forEach((b) => {
      b.addEventListener('click', () => Sync.setEnabled(b.dataset.sync === 'on'));
    });
    document.getElementById('sync-signout')?.addEventListener('click', () => Sync.signOut());
  }
  function escapeAttr(s) { return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  if (typeof Sync !== 'undefined') {
    Sync.onChange(renderSyncUI);
    Sync.init();
    // Paint initial loading state quickly
    renderSyncUI(Sync.status());

    // v6.0 — Handle the magic-link landing.
    // The link in the parent's email lands at /auth/verify?token=X;
    // Caddy try_files serves index.html for that path, so we detect
    // it here and complete the sign-in via fetch (the API endpoint
    // sets the session cookie + we then clean the URL).
    (async function handleMagicLinkLanding() {
      if (window.location.pathname === '/auth/verify') {
        const token = new URLSearchParams(window.location.search).get('token');
        if (!token) return;
        try {
          const r = await fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`, {
            credentials: 'same-origin',
          });
          if (r.ok) {
            await Sync.refreshSession();
            // Auto-enable sync on first successful sign-in
            if (!Sync.status().syncEnabled) Sync.setEnabled(true);
          }
        } catch {}
        // Clean the URL regardless so the token doesn't sit in history
        if (history.replaceState) history.replaceState(null, '', '/');
      }
    })();
  }
})();
