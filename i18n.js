/* ============================================================
   i18n — minimal string layer (v5.30)

   Rammeplan Session G — Norwegian language module.
   Two-locale string bundle (en-US / nb-NO) for the most common
   prompts. Per-mode game speech still flows through Speech.phrase
   which respects profile.settings.locale for MP3 path resolution
   (audio/<locale>/phrases/<key>.mp3 with en-US fallback).

   Public API:
     t(key)          → translated string for current locale
     setLocale(loc)  → persist + apply
     onLocaleChange(fn) → subscribe (e.g. re-render home labels)

   Storage: profile.settings.locale ('en-US' default).
   ============================================================ */
(function (global) {
  'use strict';

  const STRINGS = {
    'en-US': {
      // Home section headings
      'home.title':            "What would you like to play?",
      'home.games':            'Games',
      'home.focus-memory':     'Focus & memory',
      'home.math-shapes':      'Math & shapes',
      'home.self-feelings':    'Self & feelings',
      'home.art-creativity':   'Art & creativity',
      'home.heart-thinking':   'Heart & thinking',
      'home.world':            'World around us',
      'home.listening':        'Listening games',
      // Game prompts (a small bilingual sample — generate-voices.py
      // can render these into audio/nb-NO/phrases/*.mp3 when ready)
      'find-letter':           'Find the letter',
      'find-number':           'Find the',
      'pick-what':             'Pick what you want to play with.',
      'how-many':              'How many?',
      'whats-next':            'What comes next?'
    },
    'nb-NO': {
      'home.title':            'Hva har du lyst til å leke med?',
      'home.games':            'Spill',
      'home.focus-memory':     'Konsentrasjon og minne',
      'home.math-shapes':      'Tall og former',
      'home.self-feelings':    'Følelser og kropp',
      'home.art-creativity':   'Kunst og skapning',
      'home.heart-thinking':   'Hjerte og tanker',
      'home.world':            'Verden rundt oss',
      'home.listening':        'Lyttespill',
      'find-letter':           'Finn bokstaven',
      'find-number':           'Finn tallet',
      'pick-what':             'Velg hva du vil leke med.',
      'how-many':              'Hvor mange?',
      'whats-next':            'Hva kommer nå?'
    }
  };

  const subs = [];

  function currentLocale() {
    try {
      const p = (typeof activeProfile === 'function') ? activeProfile() : null;
      return p?.settings?.locale || 'en-US';
    } catch {
      return 'en-US';
    }
  }

  function t(key) {
    const loc = currentLocale();
    const bundle = STRINGS[loc] || STRINGS['en-US'];
    return bundle[key] ?? STRINGS['en-US'][key] ?? key;
  }

  function setLocale(loc) {
    if (!STRINGS[loc]) return;
    const p = (typeof activeProfile === 'function') ? activeProfile() : null;
    if (p) {
      p.settings = p.settings || {};
      p.settings.locale = loc;
      if (typeof saveStorage === 'function') saveStorage();
    }
    document.documentElement.lang = loc.split('-')[0];
    subs.forEach((fn) => { try { fn(loc); } catch {} });
  }

  function onLocaleChange(fn) {
    if (typeof fn === 'function') subs.push(fn);
  }

  global.I18n = { t, setLocale, onLocaleChange, current: currentLocale, locales: Object.keys(STRINGS) };
})(window);
