/* ============================================================
   Worlds + Characters — v7.0
   ============================================================
   Replaces the flat 44-card mode grid with 6 themed Worlds, each
   hosted by a recurring animal character. Hybrid model:
     - Kid sees: a world ("Forest, where Bram the Bear lives")
     - Parent dashboard sees: Rammeplan area mapping under the hood

   Each World holds:
     - A host CHARACTER (emoji + name + 1-line bio + greeting)
     - A SCENE description (sets the visual mood when the kid enters)
     - A subset of existing modes, themed for that world
     - Activities can appear in multiple worlds (e.g. count appears
       in Farm AND Shapes & Building)

   Inspired by:
     - Rammeplan-kids-app-starter's PlayWorld concept
     - Lingokids' character-driven scene framing
     - Norwegian Rammeplan's 7 learning areas (covered across 6 worlds)

   Public API (window.Worlds):
     all()                       → array of all worlds
     get(id)                     → one world by id
     worldFor(mode)              → which world a mode primarily belongs to
     character(worldId)          → host character data
     entryGreeting(worldId)      → first-time-in-world spoken line
   ============================================================ */
(function (global) {
  'use strict';

  /* ===================  Characters  =================== */

  const CHARACTERS = {
    bram: {
      id: 'bram',
      name: 'Bram',
      species: 'Bear',
      emoji: '🐻',
      voice: 'en-US-AriaNeural',
      bio: "Bram is a gentle bear who knows every tree in the forest.",
      moods: { idle: '🐻', greet: '🐻', cheer: '🤗', sleep: '😴' }
    },
    daisy: {
      id: 'daisy',
      name: 'Daisy',
      species: 'Cow',
      emoji: '🐄',
      voice: 'en-US-AriaNeural',
      bio: "Daisy is a friendly cow who helps everyone on the farm.",
      moods: { idle: '🐄', greet: '🐄', cheer: '🐮', sleep: '😴' }
    },
    coco: {
      id: 'coco',
      name: 'Coco',
      species: 'Cat',
      emoji: '🐱',
      voice: 'en-US-AriaNeural',
      bio: "Coco is a curious cat who turns home into a treasure hunt.",
      moods: { idle: '🐱', greet: '🐱', cheer: '😺', sleep: '😴' }
    },
    luna: {
      id: 'luna',
      name: 'Luna',
      species: 'Owl',
      emoji: '🦉',
      voice: 'en-US-AriaNeural',
      bio: "Luna is a wise owl who loves stories and quiet thinking.",
      moods: { idle: '🦉', greet: '🦉', cheer: '🦉', sleep: '😴' }
    },
    pip: {
      id: 'pip',
      name: 'Pip',
      species: 'Fox',
      emoji: '🦊',
      voice: 'en-US-AriaNeural',
      bio: "Pip is a clever fox who builds and sorts the world.",
      moods: { idle: '🦊', greet: '🦊', cheer: '🦊', sleep: '😴' }
    },
    sunny: {
      id: 'sunny',
      name: 'Sunny',
      species: 'Sun',
      emoji: '☀️',
      voice: 'en-US-AriaNeural',
      bio: "Sunny notices feelings and helps friends be kind.",
      moods: { idle: '☀️', greet: '☀️', cheer: '🌞', sleep: '🌙' }
    }
  };

  /* ===================  Worlds  ===================
     Each world maps to one or more Rammeplan areas. Modes from
     the existing curriculum are listed in `modes` — they keep their
     original behavior, just get a themed home in the world. */

  const WORLDS = [
    {
      id: 'forest',
      title: 'The Forest',
      character: 'bram',
      emoji: '🌲',
      sceneShort: "A mossy clearing where leaves whisper.",
      sceneLong:  "Tall trees, soft moss, sunlight through the leaves. Birds and animals everywhere.",
      bgGradient: 'linear-gradient(180deg, #d4e7c5 0%, #a8c39a 100%)',
      accentHue: 145,
      audioKey: 'world-forest-greet',
      areas: ['comm-lang', 'nature'],
      modes: ['letter-lander', 'find-letters', 'animals', 'weather', 'sort-it-out', 'first-sound', 'rhyme', 'stargazer'],
      ageBands: ['smabarn', 'yngre', 'eldre', 'skolestart']
    },
    {
      id: 'farm',
      title: 'The Farm',
      character: 'daisy',
      emoji: '🐄',
      sceneShort: "A big red barn and a sunny field.",
      sceneLong:  "Cows, chickens, and a sleepy dog by the gate. Vegetables grow in long rows.",
      bgGradient: 'linear-gradient(180deg, #ffe7c2 0%, #ffce85 100%)',
      accentHue: 60,
      audioKey: 'world-farm-greet',
      areas: ['math', 'nature', 'self-body'],
      modes: ['count', 'find-numbers', 'number-lander', 'number-blaster', 'food-sort', 'animals', 'helpers', 'addition', 'subtraction'],
      ageBands: ['smabarn', 'yngre', 'eldre', 'skolestart']
    },
    {
      id: 'home',
      title: 'Home Sweet Home',
      character: 'coco',
      emoji: '🏠',
      sceneShort: "A cozy kitchen with morning light.",
      sceneLong:  "Familiar rooms, family members, daily routines. Soft and safe.",
      bgGradient: 'linear-gradient(180deg, #ffe0eb 0%, #ffb7d0 100%)',
      accentHue: 355,
      audioKey: 'world-home-greet',
      areas: ['self-body', 'society', 'comm-lang'],
      modes: ['body', 'family', 'routines', 'feelings', 'tap', 'helpers'],
      ageBands: ['smabarn', 'yngre', 'eldre', 'skolestart']
    },
    {
      id: 'story',
      title: 'Story Corner',
      character: 'luna',
      emoji: '📚',
      sceneShort: "Pillows, blankets, a stack of bright books.",
      sceneLong:  "A quiet reading nook. Pages waiting to turn. Whispered words and rhymes.",
      bgGradient: 'linear-gradient(180deg, #d9d0f5 0%, #b3a3eb 100%)',
      accentHue: 280,
      audioKey: 'world-story-greet',
      areas: ['comm-lang', 'ethics'],
      modes: ['reading', 'sight-words', 'rhyme', 'blend', 'first-sound', 'empathy', 'trace-letters'],
      ageBands: ['yngre', 'eldre', 'skolestart']
    },
    {
      id: 'shapes',
      title: 'Shapes & Building',
      character: 'pip',
      emoji: '🧱',
      sceneShort: "Blocks, circles, and patterns to discover.",
      sceneLong:  "A workshop with shapes to sort, patterns to extend, and numbers to count.",
      bgGradient: 'linear-gradient(180deg, #d4eaff 0%, #92c4f5 100%)',
      accentHue: 220,
      audioKey: 'world-shapes-greet',
      areas: ['math'],
      modes: ['shapes', 'colors', 'patterns', 'measure', 'where-is-it', 'trace-numbers', 'count', 'switch-it', 'sequence-star'],
      ageBands: ['yngre', 'eldre', 'skolestart']
    },
    {
      id: 'feelings',
      title: 'Feelings & Friends',
      character: 'sunny',
      emoji: '💛',
      sceneShort: "A bright spot for noticing how you feel.",
      sceneLong:  "Soft pillows, friendly faces, a place to breathe and notice and care.",
      bgGradient: 'linear-gradient(180deg, #fff4cd 0%, #ffe48a 100%)',
      accentHue: 85,
      audioKey: 'world-feelings-greet',
      areas: ['self-body', 'ethics', 'ef'],
      modes: ['feelings', 'empathy', 'gratitude', 'calm-corner', 'reflect', 'stop-go', 'launch-pad', 'move-with-me', 'draw', 'rhythm'],
      ageBands: ['smabarn', 'yngre', 'eldre', 'skolestart']
    }
  ];

  /* ===================  Lookups  =================== */

  /* worldFor(mode) — which world does this mode primarily belong to?
     A mode can appear in multiple worlds (we want overlap for breadth),
     but each has a canonical "home" world for the picker and dashboard. */
  const PRIMARY_WORLD = {
    'find-letters':   'forest',
    'letter-lander':  'forest',
    'first-sound':    'forest',
    'rhyme':          'forest',
    'animals':        'forest',
    'weather':        'forest',
    'sort-it-out':    'forest',
    'stargazer':      'forest',

    'count':          'farm',
    'find-numbers':   'farm',
    'number-lander':  'farm',
    'number-blaster': 'farm',
    'food-sort':      'farm',
    'helpers':        'farm',
    'addition':       'farm',
    'subtraction':    'farm',

    'body':           'home',
    'family':         'home',
    'routines':       'home',
    'tap':            'home',

    'reading':        'story',
    'sight-words':    'story',
    'blend':          'story',
    'trace-letters':  'story',

    'shapes':         'shapes',
    'colors':         'shapes',
    'patterns':       'shapes',
    'measure':        'shapes',
    'where-is-it':    'shapes',
    'trace-numbers':  'shapes',
    'switch-it':      'shapes',
    'sequence-star':  'shapes',

    'feelings':       'feelings',
    'empathy':        'feelings',
    'gratitude':      'feelings',
    'calm-corner':    'feelings',
    'reflect':        'feelings',
    'stop-go':        'feelings',
    'launch-pad':     'feelings',
    'move-with-me':   'feelings',
    'draw':           'feelings',
    'rhythm':         'feelings'
  };

  /* ===================  Public API  =================== */

  function all() { return WORLDS; }
  function get(id) { return WORLDS.find((w) => w.id === id) || null; }
  function character(worldOrId) {
    const w = typeof worldOrId === 'string' ? get(worldOrId) : worldOrId;
    return w ? CHARACTERS[w.character] : null;
  }
  function worldFor(mode) { return PRIMARY_WORLD[mode] || null; }
  function entryGreeting(worldId) {
    const w = get(worldId);
    if (!w) return '';
    const c = CHARACTERS[w.character];
    return `Welcome to ${w.title}! I'm ${c.name} the ${c.species}.`;
  }

  /* Eligible worlds for the active profile's age band — used by the
     home renderer so very young kids don't see Story Corner if the
     parent thinks it's too text-heavy. */
  function eligibleFor(ageBandId) {
    return WORLDS.filter((w) => !w.ageBands || w.ageBands.includes(ageBandId));
  }

  global.Worlds = {
    all, get, character, worldFor, entryGreeting, eligibleFor,
    characters: CHARACTERS
  };
})(window);
