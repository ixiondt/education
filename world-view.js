/* ============================================================
   World View + Scene Cards — v7.0
   ============================================================
   The Worlds-first reframe of the home screen. Replaces the flat
   44-card mode grid with:

     1. World Map (home screen)
        - 6 world cards: Forest / Farm / Home / Story / Shapes /
          Feelings — themed gradient + host-character emoji
        - Today's Adventure card stays at the top
        - A "Classic view" toggle in Settings restores the old
          flat grid for parents who prefer it

     2. World View (per-world screen)
        - Big scene illustration (gradient + bobbing character)
        - Character greets the kid by name
        - Activity rail underneath: 4-8 cards that are existing
          modes themed for the world
        - Back button returns to the world map

     3. Scene Card (before activity launch)
        - Inspired by Lingokids — brief framing of WHAT the kid is
          about to do, WHY, and the character setting them up
        - "Let's play!" tap → mode launches as normal

   Public API (window.WorldUI):
     openWorldMap()       paint home as world map
     enterWorld(id)       transition to a world view
     enterActivity(mode)  show scene card → launch mode
     exitWorld()          back to world map
   ============================================================ */
(function (global) {
  'use strict';

  /* Mode → human display name. Used inside the activity rail of a
     world view. Mirrors the labels already on home mode cards;
     centralised here so the rail render doesn't have to re-derive
     from DOM. */
  const MODE_LABELS = {
    'find-letters':   { icon: 'Aa',  label: 'Find Letters' },
    'find-numbers':   { icon: '1 2', label: 'Find Numbers' },
    'sounds':         { icon: '🐝',  label: 'Sounds' },
    'trace-letters':  { icon: '✍️',  label: 'Trace Letters' },
    'trace-numbers':  { icon: '✏️',  label: 'Trace Numbers' },
    'count':          { icon: '🍎',  label: 'Count' },
    'letter-lander':  { icon: '🐰',  label: 'Letter Lander' },
    'number-lander':  { icon: '🦊',  label: 'Number Lander' },
    'number-blaster': { icon: '🚀',  label: 'Number Blaster' },
    'sequence-star':  { icon: '🌟',  label: 'Sequence Star' },
    'stop-go':        { icon: '🚦',  label: 'Stop & Go' },
    'launch-pad':     { icon: '🚀',  label: 'Launch Pad' },
    'switch-it':      { icon: '🔀',  label: 'Switch It' },
    'stargazer':      { icon: '🔭',  label: 'Stargazer' },
    'reflect':        { icon: '💭',  label: 'Reflect' },
    'shapes':         { icon: '🔷',  label: 'Shapes' },
    'colors':         { icon: '🎨',  label: 'Colors' },
    'patterns':       { icon: '🔁',  label: 'Patterns' },
    'addition':       { icon: '➕',  label: 'Add' },
    'subtraction':    { icon: '➖',  label: 'Subtract' },
    'feelings':       { icon: '😀',  label: 'Feelings' },
    'body':           { icon: '👃',  label: 'My body' },
    'move-with-me':   { icon: '🤸',  label: 'Move with me' },
    'food-sort':      { icon: '🍎',  label: 'Food sort' },
    'tap':            { icon: '👶',  label: 'Tap & explore' },
    'animals':        { icon: '🐻',  label: 'Animals' },
    'helpers':        { icon: '👩‍⚕️',  label: 'Helpers' },
    'weather':        { icon: '🌦️',  label: 'Today\'s weather' },
    'sort-it-out':    { icon: '♻️',  label: 'Sort it out' },
    'measure':        { icon: '📏',  label: 'Measure' },
    'where-is-it':    { icon: '🧭',  label: 'Where is it?' },
    'family':         { icon: '🏠',  label: 'My family' },
    'routines':       { icon: '🗓',  label: 'Daily routines' },
    'first-sound':    { icon: '👂',  label: 'First sound' },
    'rhyme':          { icon: '🎵',  label: 'Rhyme' },
    'blend':          { icon: '🧩',  label: 'Blend' },
    'sight-words':    { icon: '📖',  label: 'Sight words' },
    'reading':        { icon: '📚',  label: 'Read books' },
    'time-of-day':    { icon: '🕐',  label: 'Time of day' },
    'empathy':        { icon: '❤️',  label: 'Kind choices' },
    'gratitude':      { icon: '🙏',  label: 'Thankful' },
    'calm-corner':    { icon: '🌬️',  label: 'Calm corner' },
    'draw':           { icon: '🎨',  label: 'Draw' },
    'rhythm':         { icon: '🥁',  label: 'Rhythm' }
  };

  /* ===================  WORLD MAP (home)  =================== */

  function paintWorldMap() {
    const host = document.getElementById('world-map');
    if (!host || typeof Worlds === 'undefined') return;
    const profile = (typeof activeProfile === 'function') ? activeProfile() : null;
    const band = (profile && typeof bandForMonths === 'function')
      ? bandForMonths(profile.ageMonths || 48).id
      : 'eldre';
    const eligible = Worlds.eligibleFor(band);

    host.innerHTML = eligible.map((w) => {
      const c = Worlds.character(w);
      return `
        <button class="world-card" data-world="${w.id}" type="button"
                style="background:${w.bgGradient};">
          <span class="world-character" aria-hidden="true">${c.emoji}</span>
          <span class="world-info">
            <span class="world-title">${escapeHtml(w.title)}</span>
            <span class="world-scene">${escapeHtml(w.sceneShort)}</span>
            <span class="world-host">${escapeHtml(c.name)} the ${escapeHtml(c.species)}</span>
          </span>
        </button>
      `;
    }).join('');

    host.querySelectorAll('[data-world]').forEach((btn) => {
      btn.addEventListener('click', () => enterWorld(btn.dataset.world));
    });
  }

  /* ===================  WORLD VIEW (per-world)  =================== */

  let activeWorldId = null;

  function enterWorld(worldId) {
    const w = Worlds.get(worldId);
    if (!w) return;
    activeWorldId = worldId;
    const host = document.getElementById('screen-world');
    if (!host) return;
    const c = Worlds.character(w);
    const profile = (typeof activeProfile === 'function') ? activeProfile() : null;
    const kidName = profile?.name || 'Friend';

    host.innerHTML = `
      <div class="world-stage" style="background:${w.bgGradient};">
        <button class="world-back" type="button" aria-label="Back to all worlds">← Worlds</button>
        <div class="world-stage-head">
          <span class="world-stage-character" aria-hidden="true">${c.emoji}</span>
          <div class="world-stage-text">
            <h1 class="world-stage-title">${escapeHtml(w.title)}</h1>
            <p class="world-stage-greet">
              <strong>${escapeHtml(c.name)}:</strong>
              "Welcome, ${escapeHtml(kidName)}! ${escapeHtml(w.sceneLong)}"
            </p>
          </div>
        </div>
        <p class="world-stage-prompt">What would you like to do here?</p>
      </div>
      <div class="world-activities">
        ${w.modes.map((m) => {
          const meta = MODE_LABELS[m];
          if (!meta) return '';
          return `
            <button class="world-activity" data-mode="${m}" type="button">
              <span class="world-activity-icon">${meta.icon}</span>
              <span class="world-activity-label">${escapeHtml(meta.label)}</span>
            </button>
          `;
        }).join('')}
      </div>
    `;

    host.querySelector('.world-back')?.addEventListener('click', exitWorld);
    host.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => enterActivity(btn.dataset.mode, worldId));
    });

    if (typeof showScreen === 'function') showScreen('world');

    // Spoken greeting through the existing voice chain. If we have an
    // MP3 for this world's greeting, Speech.phrase uses it; otherwise
    // TTS reads the fallback. Either way: voice-led, Lingokids-style.
    if (typeof Speech !== 'undefined' && Speech.phrase) {
      Speech.phrase(w.audioKey, `Welcome to ${w.title}. I'm ${c.name} the ${c.species}.`);
    }
  }

  function exitWorld() {
    activeWorldId = null;
    if (typeof goHome === 'function') goHome();
  }

  /* ===================  SCENE CARD (before mode launch)  =================== */

  /* Brief framing card the kid sees BEFORE the mode opens. Sets the
     scene, names the character, gives the prompt. Tap "Let's play!"
     to launch the mode. */
  function enterActivity(mode, worldId) {
    const w = Worlds.get(worldId);
    if (!w) {
      // Fallback — just launch the mode directly
      if (typeof startMode === 'function') startMode(mode);
      return;
    }
    const c = Worlds.character(w);
    const meta = MODE_LABELS[mode];
    const host = document.getElementById('screen-scene');
    if (!host) {
      if (typeof startMode === 'function') startMode(mode);
      return;
    }
    host.innerHTML = `
      <div class="scene-card" style="background:${w.bgGradient};">
        <button class="scene-back" type="button" aria-label="Back">←</button>
        <div class="scene-character" aria-hidden="true">${c.emoji}</div>
        <h2 class="scene-host">${escapeHtml(c.name)}</h2>
        <p class="scene-line">
          "Let's play <strong>${escapeHtml(meta?.label || mode)}</strong> together!"
        </p>
        <button class="scene-go btn btn-primary" type="button">Let's play!</button>
      </div>
    `;
    if (typeof showScreen === 'function') showScreen('scene');

    // Light spoken cue
    if (typeof Speech !== 'undefined' && Speech.cheer) {
      Speech.cheer(`Let's play ${meta?.label || mode}!`);
    }

    host.querySelector('.scene-back')?.addEventListener('click', () => {
      if (activeWorldId) enterWorld(activeWorldId);
      else exitWorld();
    });
    host.querySelector('.scene-go')?.addEventListener('click', () => {
      if (typeof startMode === 'function') startMode(mode);
    });
  }

  /* ===================  helpers  =================== */

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function activeWorld() { return activeWorldId; }

  global.WorldUI = {
    paintWorldMap,
    enterWorld,
    enterActivity,
    exitWorld,
    activeWorld
  };
})(window);
