/* ============================================================
   Adventures — narrative glue layer (v6.2)

   Wraps the existing 44 game/EF/Rammeplan modes in story arcs so
   the kid feels they're HELPING SOMEONE rather than "doing
   find-letters round 4 again." Same mechanics, new meaning.

   Each adventure has:
     - A character + 1-line hook (shown on home as 'Today's Adventure')
     - 3-5 chapters, each pointing to an existing mode with optional
       overrides (fixed target, word sequence, round count)
     - A final celebration chapter (no mode — just narration + animation)

   Modes opt in to honoring the adventure context via opts.adventure:
     - count          → opts.adventure.fixedCount → uses that count
     - find-letters   → opts.adventure.wordSequence → walks the letters in order
     - feelings/colors/shapes → opts.adventure.target → picks that as the round target
     - food-sort, animals, where-is-it, etc. → run normally (still feels themed
       because the chapter narration sets the context)

   The runner is fault-tolerant: a mode that doesn't honor the
   adventure context still runs and the kid still gets a useful
   activity. Worst case the chapter feels like "a regular round
   of X." We never break the flow.

   Adventures auto-rotate by day (Math.floor(epoch/day) % N) so the
   kid sees a new one each day. We track completed adventures per
   profile so the picker can skip recently-played ones.

   Public entry points (window-attached):
     todaysAdventure()         → returns { id, title, character, hook }
     startTodaysAdventure()    → kicks off the chapter loop
     stopAdventure()           → bail out cleanly
     isInAdventure()           → bool — game modes check this to know
                                  they're running under a story
     adventureContext()        → returns the current chapter's params,
                                  for modes to honor
   ============================================================ */
(function (global) {
  'use strict';

  /* ===================  Story bank  ===================
     Each adventure is independent — a mode's start function reads
     its opts.adventure and uses whatever fields it understands.
     `chapter.mode = null` means "celebration only — no game." */

  const ADVENTURES = [
    {
      id: 'bunny-picnic', character: '🐰', title: "Bunny's picnic",
      hook: "Bunny is going on a picnic. Can you help?",
      bands: ['yngre', 'eldre'],
      chapters: [
        { audioKey: 'adv-bunny-picnic-1', narration: "Bunny is packing food. Help sort what to bring!", mode: 'food-sort' },
        { audioKey: 'adv-bunny-picnic-2', narration: "Count the carrots in the basket.", mode: 'count', params: { fixedCount: 5 } },
        { audioKey: 'adv-bunny-picnic-3', narration: "Now find the letters that spell BUNNY.", mode: 'find-letters', params: { wordSequence: 'BUNNY' } },
        { audioKey: 'adv-bunny-picnic-4', narration: "Bunny had a wonderful picnic. Thank you!", celebrate: true }
      ]
    },
    {
      id: 'fox-fix-shoes', character: '🦊', title: "Fox's lost shoes",
      hook: "Fox can't find their shoes. Help search!",
      bands: ['yngre', 'eldre'],
      chapters: [
        { audioKey: 'adv-fox-shoes-1', narration: "Fox is hopping on one foot. Where are the shoes?", mode: 'body' },
        { audioKey: 'adv-fox-shoes-2', narration: "Spell FOX to call them back!", mode: 'find-letters', params: { wordSequence: 'FOX' } },
        { audioKey: 'adv-fox-shoes-3', narration: "Count Fox's two new shoes.", mode: 'count', params: { fixedCount: 2 } },
        { audioKey: 'adv-fox-shoes-4', narration: "Hooray! Fox can run again.", celebrate: true }
      ]
    },
    {
      id: 'rainbow-day', character: '🌈', title: "Rainbow day",
      hook: "A rainbow appeared! Let's celebrate it.",
      bands: ['smabarn', 'yngre', 'eldre'],
      chapters: [
        { audioKey: 'adv-rainbow-1', narration: "Find each color of the rainbow!", mode: 'colors' },
        { audioKey: 'adv-rainbow-2', narration: "Draw your favorite rainbow.", mode: 'draw' },
        { audioKey: 'adv-rainbow-3', narration: "Play a happy rhythm!", mode: 'rhythm' },
        { audioKey: 'adv-rainbow-4', narration: "What a beautiful day.", celebrate: true }
      ]
    },
    {
      id: 'snowy-day', character: '❄️', title: "Snowy day",
      hook: "Snow is falling! What shall we do?",
      bands: ['yngre', 'eldre', 'skolestart'],
      chapters: [
        { audioKey: 'adv-snowy-1', narration: "Brrr, it's so cold! Tap how the snow makes you feel.", mode: 'feelings' },
        { audioKey: 'adv-snowy-2', narration: "Take a moment to breathe like snow drifting.", mode: 'calm-corner' },
        { audioKey: 'adv-snowy-3', narration: "What's the weather like today?", mode: 'weather' },
        { audioKey: 'adv-snowy-4', narration: "A peaceful snow day. Well done.", celebrate: true }
      ]
    },
    {
      id: 'pirate-treasure', character: '🏴‍☠️', title: "Pirate treasure",
      hook: "X marks the spot! Find the treasure.",
      bands: ['eldre', 'skolestart'],
      chapters: [
        { audioKey: 'adv-pirate-1', narration: "Spell out T-R-E-A-S-U-R-E to unlock the chest.", mode: 'find-letters', params: { wordSequence: 'TREASURE' } },
        { audioKey: 'adv-pirate-2', narration: "Count the gold coins inside!", mode: 'count', params: { fixedCount: 10 } },
        { audioKey: 'adv-pirate-3', narration: "Sort the shiny things from the rocks.", mode: 'shapes' },
        { audioKey: 'adv-pirate-4', narration: "Aaarrr! What a haul, matey.", celebrate: true }
      ]
    },
    {
      id: 'garden-grows', character: '🌱', title: "The garden grows",
      hook: "Spring is here — let's plant!",
      bands: ['yngre', 'eldre'],
      chapters: [
        { audioKey: 'adv-garden-1', narration: "Sort the seeds by shape.", mode: 'shapes' },
        { audioKey: 'adv-garden-2', narration: "Water the garden — count the buckets.", mode: 'count', params: { fixedCount: 3 } },
        { audioKey: 'adv-garden-3', narration: "Look at the patterns the leaves make.", mode: 'patterns' },
        { audioKey: 'adv-garden-4', narration: "Your garden is growing beautifully.", celebrate: true }
      ]
    },
    {
      id: 'space-mission', character: '🚀', title: "Space mission",
      hook: "Mission Control, ready for takeoff?",
      bands: ['eldre', 'skolestart'],
      chapters: [
        { audioKey: 'adv-space-1', narration: "Get ready for liftoff!", mode: 'launch-pad' },
        { audioKey: 'adv-space-2', narration: "Solve the asteroid equations to clear the way!", mode: 'number-blaster' },
        { audioKey: 'adv-space-3', narration: "Find the planet shapes in the sky.", mode: 'shapes' },
        { audioKey: 'adv-space-4', narration: "Welcome back to Earth, astronaut!", celebrate: true }
      ]
    },
    {
      id: 'forest-hike', character: '🌲', title: "Forest hike",
      hook: "Pack your boots — we're going hiking.",
      bands: ['yngre', 'eldre', 'skolestart'],
      chapters: [
        { audioKey: 'adv-forest-1', narration: "What's the weather like for our hike?", mode: 'weather' },
        { audioKey: 'adv-forest-2', narration: "Spot the animals along the trail.", mode: 'animals' },
        { audioKey: 'adv-forest-3', narration: "Help keep the forest clean — sort the trash.", mode: 'sort-it-out' },
        { audioKey: 'adv-forest-4', narration: "Nature thanks you.", celebrate: true }
      ]
    },
    {
      id: 'birthday-party', character: '🎂', title: "Birthday party",
      hook: "It's a birthday! Let's get ready.",
      bands: ['yngre', 'eldre'],
      chapters: [
        { audioKey: 'adv-birthday-1', narration: "Count the candles on the cake.", mode: 'count', params: { fixedCount: 4 } },
        { audioKey: 'adv-birthday-2', narration: "Spell P-A-R-T-Y!", mode: 'find-letters', params: { wordSequence: 'PARTY' } },
        { audioKey: 'adv-birthday-3', narration: "Birthdays are so exciting! Tap the happy face.", mode: 'feelings' },
        { audioKey: 'adv-birthday-4', narration: "Happy birthday! What a great party.", celebrate: true }
      ]
    },
    {
      id: 'kindness-day', character: '❤️', title: "Kindness day",
      hook: "Someone needs help today. Can you be kind?",
      bands: ['eldre', 'skolestart'],
      chapters: [
        { audioKey: 'adv-kindness-1', narration: "A friend needs help. What would YOU do? Tap the kindest answer.", mode: 'empathy' },
        { audioKey: 'adv-kindness-2', narration: "Now think about you. Who makes you feel cared for?", mode: 'gratitude' },
        { audioKey: 'adv-kindness-3', narration: "What does kindness look like? Tap the happy face!", mode: 'feelings' },
        { audioKey: 'adv-kindness-4', narration: "Kindness is its own gift. Thank you for noticing.", celebrate: true }
      ]
    },
    {
      id: 'music-time', character: '🎵', title: "Music time",
      hook: "The music is calling — let's play!",
      bands: ['smabarn', 'yngre', 'eldre'],
      chapters: [
        { audioKey: 'adv-music-1', narration: "Tap a rhythm with the band.", mode: 'rhythm' },
        { audioKey: 'adv-music-2', narration: "Move your body to the beat!", mode: 'move-with-me' },
        { audioKey: 'adv-music-3', narration: "Listen to the sound — can you hear the letters?", mode: 'first-sound' },
        { audioKey: 'adv-music-4', narration: "What a song!", celebrate: true }
      ]
    },
    {
      id: 'morning-routine', character: '🌅', title: "Morning routine",
      hook: "A new day begins. Walk through your morning.",
      bands: ['yngre', 'eldre', 'skolestart'],
      chapters: [
        { audioKey: 'adv-morning-1', narration: "Put your morning in order.", mode: 'routines' },
        { audioKey: 'adv-morning-2', narration: "How are you feeling today?", mode: 'feelings' },
        { audioKey: 'adv-morning-3', narration: "Take three slow breaths to wake up gently.", mode: 'calm-corner' },
        { audioKey: 'adv-morning-4', narration: "You're ready for the day. Have a good one!", celebrate: true }
      ]
    },
    {
      id: 'baby-bird', character: '🐣', title: "Baby bird wakes up",
      hook: "A little bird is learning everything new.",
      bands: ['smabarn', 'yngre'],
      chapters: [
        { audioKey: 'adv-baby-bird-1', narration: "Hear the bird's first chirp — what letter is that?", mode: 'first-sound' },
        { audioKey: 'adv-baby-bird-2', narration: "Spell B-I-R-D to call them home.", mode: 'find-letters', params: { wordSequence: 'BIRD' } },
        { audioKey: 'adv-baby-bird-3', narration: "Two little eggs are still in the nest. Count them!", mode: 'count', params: { fixedCount: 2 } },
        { audioKey: 'adv-baby-bird-4', narration: "The whole family is together now.", celebrate: true }
      ]
    },
    {
      id: 'starry-night', character: '⭐', title: "Starry night",
      hook: "The night sky is full of stars. Look up!",
      bands: ['yngre', 'eldre', 'skolestart'],
      chapters: [
        { audioKey: 'adv-starry-1', narration: "Watch the night sky carefully.", mode: 'stargazer' },
        { audioKey: 'adv-starry-2', narration: "Sort the stars by what you see.", mode: 'shapes' },
        { audioKey: 'adv-starry-3', narration: "Take a deep breath and look at the moon.", mode: 'calm-corner' },
        { audioKey: 'adv-starry-4', narration: "Goodnight, stars.", celebrate: true }
      ]
    },
    {
      id: 'whale-deep-dive', character: '🐳', title: "Whale's deep dive",
      hook: "Dive with Whale to the ocean floor.",
      bands: ['yngre', 'eldre'],
      chapters: [
        { audioKey: 'adv-whale-1', narration: "Whales live in the water — let's match the animals.", mode: 'animals' },
        { audioKey: 'adv-whale-2', narration: "Hold your breath like Whale. Slow… deep…", mode: 'calm-corner' },
        { audioKey: 'adv-whale-3', narration: "Count the fish swimming past!", mode: 'count', params: { fixedCount: 7 } },
        { audioKey: 'adv-whale-4', narration: "Back to the surface — what a deep dive.", celebrate: true }
      ]
    }
  ];

  /* ===================  Picker  =================== */

  const STORAGE_KEY = 'ln.adventureHistory';

  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }
  function saveHistory(obj) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); } catch {}
  }

  /* Pick today's adventure. Stable for a given day so the kid sees
     the same one all day, but rotates daily. Prefers adventures the
     kid hasn't played in the last 14 days. */
  function todaysAdventure() {
    const profile = (typeof activeProfile === 'function') ? activeProfile() : null;
    const band = (profile && typeof bandForMonths === 'function')
      ? bandForMonths(profile.ageMonths || 48).id
      : 'eldre';

    // Filter by age band
    const eligible = ADVENTURES.filter((a) => !a.bands || a.bands.includes(band));
    if (!eligible.length) return ADVENTURES[0];

    // Day index — same day = same adventure
    const dayIdx = Math.floor(Date.now() / (24 * 60 * 60 * 1000));

    // Penalise recently-played
    const history = loadHistory();
    const profileKey = profile?.id || 'default';
    const recent = history[profileKey] || {};
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const fresh = eligible.filter((a) => (recent[a.id] || 0) < cutoff);
    const pool = fresh.length ? fresh : eligible;

    return pool[dayIdx % pool.length];
  }

  function recordPlayed(advId) {
    const profile = activeProfile?.();
    if (!profile) return;
    const history = loadHistory();
    const key = profile.id || 'default';
    history[key] = history[key] || {};
    history[key][advId] = Date.now();
    saveHistory(history);
  }

  /* ===================  Runner state  =================== */

  let active = null;       // current adventure
  let chapterIdx = 0;
  let host = null;         // #screen-adventure-narrator

  function isInAdventure() { return active != null; }
  function adventureContext() {
    if (!active) return null;
    const ch = active.chapters[chapterIdx];
    return ch ? (ch.params || {}) : null;
  }

  /* ===================  Narrator screen  =================== */

  function renderNarrator(text, opts = {}) {
    host = document.getElementById('screen-adventure-narrator');
    if (!host) { console.warn('Narrator screen missing'); return; }
    if (typeof showScreen === 'function') showScreen('adventureNarrator');
    const isFinal = !!opts.final;
    const buttonLabel = isFinal ? 'Done' : (opts.startBtn || 'Continue');
    host.innerHTML = `
      <div class="adv-narrator">
        <div class="adv-character${isFinal ? ' adv-celebrate' : ''}">${escapeHtml(active.character)}</div>
        <div class="adv-title">${escapeHtml(active.title)}</div>
        <p class="adv-text">${escapeHtml(text)}</p>
        <button class="btn btn-primary adv-next">${escapeHtml(buttonLabel)}</button>
      </div>
    `;
    const btn = host.querySelector('.adv-next');
    btn?.addEventListener('click', () => {
      if (isFinal) {
        recordPlayed(active.id);
        active = null;
        if (typeof goHome === 'function') goHome();
      } else {
        runChapter();
      }
    });
    // Speak the narration through the existing voice chain
    /* v6.5.1 — route through Speech.phrase so the MP3 pack catches the
       narration line. The audio key on each chapter maps to a file in
       audio/phrases/adv-*.mp3 rendered by scripts/generate-voices.py.
       Falls back to TTS only when the MP3 is missing (e.g., a future
       adventure that hasn't been generated yet). */
    if (typeof Speech !== 'undefined' && Speech.phrase) {
      const ch = active && active.chapters[chapterIdx];
      const key = ch?.audioKey || 'adv-narrator-fallback';
      Speech.phrase(key, text);
    }
  }

  /* ===================  Chapter runner  =================== */

  function startAdventure(adv) {
    if (!adv) return;
    active = adv;
    chapterIdx = -1;
    advanceChapter();
  }

  function startTodaysAdventure() {
    startAdventure(todaysAdventure());
  }

  function advanceChapter() {
    chapterIdx++;
    if (!active) return;
    if (chapterIdx >= active.chapters.length) {
      // Out of chapters — go home
      active = null;
      if (typeof goHome === 'function') goHome();
      return;
    }
    const ch = active.chapters[chapterIdx];
    if (!ch) { advanceChapter(); return; }
    // Show narrator first, then on tap → run the mode (or celebrate if final)
    if (ch.celebrate || !ch.mode) {
      renderNarrator(ch.narration || '', { final: true });
      return;
    }
    renderNarrator(ch.narration || '', { startBtn: 'Let\'s go!' });
  }

  /* When the narrator's "Continue" / "Let's go!" is tapped on a
     chapter that has a mode, run the mode. The mode's start
     function reads window.AdventureContext for overrides. */
  function runChapter() {
    if (!active) return;
    const ch = active.chapters[chapterIdx];
    if (!ch || !ch.mode) { advanceChapter(); return; }
    // Mode runs normally; on its onComplete we advance to the next
    // chapter. We re-route the mode's onComplete by stashing a flag
    // that the global startMode reads.
    global.__adventureNextChapter = () => advanceChapter();
    if (typeof startMode === 'function') {
      startMode(ch.mode);
    } else {
      // Fallback — bail out
      advanceChapter();
    }
  }

  function stopAdventure() {
    active = null;
    chapterIdx = 0;
    global.__adventureNextChapter = null;
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  global.todaysAdventure       = todaysAdventure;
  global.startTodaysAdventure  = startTodaysAdventure;
  global.startAdventure        = startAdventure;
  global.stopAdventure         = stopAdventure;
  global.isInAdventure         = isInAdventure;
  global.adventureContext      = adventureContext;
})(window);
