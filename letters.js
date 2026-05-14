/* ============================================================
   Letters & Numbers — data
   Globals exposed: LETTER_PATHS, NUMBER_PATHS, LETTER_SOUNDS,
                    LETTER_WORDS, COUNT_EMOJIS, LETTERS, NUMBERS
   ============================================================ */

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const NUMBERS = ['0','1','2','3','4','5','6','7','8','9','10'];

/* Approximate letter sounds, tuned for synthetic TTS pronunciation.
   If these sound odd on your device, switch "Letter speech" to Names. */
const LETTER_SOUNDS = {
  A:'ah',  B:'buh', C:'kuh', D:'duh', E:'eh',
  F:'fuh', G:'guh', H:'huh', I:'ih',  J:'juh',
  K:'kuh', L:'luh', M:'muh', N:'nuh', O:'oh',
  P:'puh', Q:'kwuh', R:'ruh', S:'sss', T:'tuh',
  U:'uh',  V:'vuh', W:'wuh', X:'ks',  Y:'yuh', Z:'zzz'
};

/* Picture-word associations for the Sounds mode.
   Note: X uses a word containing the sound (Fox), since few words
   commonly used with toddlers actually start with X. */
const LETTER_WORDS = {
  A: { word: 'Apple',     emoji: '🍎' },
  B: { word: 'Bee',       emoji: '🐝' },
  C: { word: 'Cat',       emoji: '🐱' },
  D: { word: 'Dog',       emoji: '🐶' },
  E: { word: 'Elephant',  emoji: '🐘' },
  F: { word: 'Fish',      emoji: '🐟' },
  G: { word: 'Goat',      emoji: '🐐' },
  H: { word: 'Hat',       emoji: '🎩' },
  I: { word: 'Ice',       emoji: '🧊' },
  J: { word: 'Jellyfish', emoji: '🪼' },
  K: { word: 'Kite',      emoji: '🪁' },
  L: { word: 'Lion',      emoji: '🦁' },
  M: { word: 'Monkey',    emoji: '🐒' },
  N: { word: 'Nest',      emoji: '🪺' },
  O: { word: 'Octopus',   emoji: '🐙' },
  P: { word: 'Pig',       emoji: '🐷' },
  Q: { word: 'Queen',     emoji: '👑' },
  R: { word: 'Rabbit',    emoji: '🐰' },
  S: { word: 'Snake',     emoji: '🐍' },
  T: { word: 'Tree',      emoji: '🌳' },
  U: { word: 'Umbrella',  emoji: '☂️' },
  V: { word: 'Van',       emoji: '🚐' },
  W: { word: 'Whale',     emoji: '🐳' },
  X: { word: 'Fox',       emoji: '🦊', sound_in: 'end' },
  Y: { word: 'Yarn',      emoji: '🧶' },
  Z: { word: 'Zebra',     emoji: '🦓' }
};

/* Pool of fun emoji used in Count mode. Chosen for clear single-object
   shapes and high contrast — toddlers should be able to point to each one. */
const COUNT_EMOJIS = [
  '🍎','🍌','🍓','🍇','🍊','🥕','🌽',
  '⚽','🏀','🎈','⭐','🌟',
  '🐝','🐞','🐢','🐟','🦋','🐤','🐰',
  '🚗','🚌','🚲','🚀','⛵',
  '🌸','🌻','🍄','🌳','🌈'
];

/* ============================================================
   v4 — Phonemic awareness data
   These power three new modes that bridge from letter familiarity
   to actual reading: first-sound isolation, rhyme matching, blending.
   Pedagogical basis: CCSS-RF.K.2 / Rammeplan COMM-1.4 / NAEYC LL-2.x.
   ============================================================ */

/* Rhyme families — small curated set with strong emoji support.
   Each family shares a rime (the vowel + final consonants). The mode
   shows one word as target and asks the child to find a rhyming match
   among 3 picture choices. */
const RHYME_FAMILIES = [
  { key: 'at',  words: [{ w: 'cat',  e: '🐱' }, { w: 'hat',  e: '🎩' }, { w: 'bat',   e: '🦇' }] },
  { key: 'og',  words: [{ w: 'dog',  e: '🐶' }, { w: 'frog', e: '🐸' }, { w: 'log',   e: '🪵' }] },
  { key: 'un',  words: [{ w: 'sun',  e: '☀️' }, { w: 'bun',  e: '🍞' }] },
  { key: 'ee',  words: [{ w: 'bee',  e: '🐝' }, { w: 'tree', e: '🌳' }] },
  { key: 'ar',  words: [{ w: 'car',  e: '🚗' }, { w: 'star', e: '⭐' }, { w: 'jar',   e: '🫙' }] },
  { key: 'ake', words: [{ w: 'cake', e: '🎂' }, { w: 'snake',e: '🐍' }] },
  { key: 'all', words: [{ w: 'ball', e: '⚽' }, { w: 'wall', e: '🧱' }] },
  { key: 'ing', words: [{ w: 'ring', e: '💍' }, { w: 'king', e: '👑' }] }
];

/* CVC words (consonant-vowel-consonant) for the Blend mode.
   `phonemes` is the spoken sound-by-sound breakdown — the voice engine
   plays them with a brief pause between each, then the child picks the
   matching picture. `firstLetter` doubles as data for the First-sound
   mode when a richer word pool is wanted. */
const CVC_WORDS = [
  { word: 'cat', emoji: '🐱', phonemes: ['kuh', 'ah',  'tuh'], firstLetter: 'C' },
  { word: 'dog', emoji: '🐶', phonemes: ['duh', 'oh',  'guh'], firstLetter: 'D' },
  { word: 'pig', emoji: '🐷', phonemes: ['puh', 'ih',  'guh'], firstLetter: 'P' },
  { word: 'bus', emoji: '🚌', phonemes: ['buh', 'uh',  'sss'], firstLetter: 'B' },
  { word: 'sun', emoji: '☀️', phonemes: ['sss', 'uh',  'nuh'], firstLetter: 'S' },
  { word: 'bug', emoji: '🪲', phonemes: ['buh', 'uh',  'guh'], firstLetter: 'B' },
  { word: 'cup', emoji: '🥤', phonemes: ['kuh', 'uh',  'puh'], firstLetter: 'C' },
  { word: 'bat', emoji: '🦇', phonemes: ['buh', 'ah',  'tuh'], firstLetter: 'B' },
  { word: 'hat', emoji: '🎩', phonemes: ['huh', 'ah',  'tuh'], firstLetter: 'H' },
  { word: 'jam', emoji: '🫙', phonemes: ['juh', 'ah',  'muh'], firstLetter: 'J' },
  { word: 'leg', emoji: '🦵', phonemes: ['luh', 'eh',  'guh'], firstLetter: 'L' },
  { word: 'web', emoji: '🕸️', phonemes: ['wuh', 'eh',  'buh'], firstLetter: 'W' },
  { word: 'net', emoji: '🥅', phonemes: ['nuh', 'eh',  'tuh'], firstLetter: 'N' },
  { word: 'fox', emoji: '🦊', phonemes: ['fuh', 'oh',  'ks' ], firstLetter: 'F' },
  { word: 'van', emoji: '🚐', phonemes: ['vuh', 'ah',  'nuh'], firstLetter: 'V' }
];

/* Picture-word categories mapped to Norwegian Rammeplan learning areas.
   Lets the Sounds mode (and themed Free play) rotate through one area at a
   time, addressing the Rammeplan's principle of integrated cross-area
   learning rather than isolated letter drill. */
const LETTER_WORD_THEMES = {
  nature: {
    label: 'Nature & animals',
    rammeplan: 'Natur, miljø og teknologi',
    letters: ['B','C','D','E','F','G','L','M','O','R','S','W','Z']
  },
  home: {
    label: 'Home & everyday',
    rammeplan: 'Nærmiljø og samfunn',
    letters: ['H','I','K','N','P','Q','T','U','V','X','Y']
  },
  food: {
    label: 'Food',
    rammeplan: 'Kropp, bevegelse, mat og helse',
    letters: ['A','J']
  }
};

/* ============================================================
   STROKE PATH DATA
   ViewBox: 200 × 240. Letter bounds roughly x: 20..180, y: 30..210.
   Each entry is an array of strokes; each stroke is a single SVG path.
   Order roughly follows school-style stroke order.
   ============================================================ */

const LETTER_PATHS = {
  A: [
    { d: 'M 100 30 L 30 210' },
    { d: 'M 100 30 L 170 210' },
    { d: 'M 60 140 L 140 140' }
  ],
  B: [
    { d: 'M 50 30 L 50 210' },
    { d: 'M 50 30 A 50 45 0 0 1 50 120' },
    { d: 'M 50 120 A 55 45 0 0 1 50 210' }
  ],
  C: [
    { d: 'M 165 65 A 75 80 0 1 0 165 175' }
  ],
  D: [
    { d: 'M 50 30 L 50 210' },
    { d: 'M 50 30 L 105 30 A 70 90 0 0 1 105 210 L 50 210' }
  ],
  E: [
    { d: 'M 165 30 L 50 30 L 50 210 L 165 210' },
    { d: 'M 50 120 L 130 120' }
  ],
  F: [
    { d: 'M 165 30 L 50 30 L 50 210' },
    { d: 'M 50 120 L 130 120' }
  ],
  G: [
    { d: 'M 165 65 A 75 80 0 1 0 165 175' },
    { d: 'M 165 175 L 165 130 L 110 130' }
  ],
  H: [
    { d: 'M 30 30 L 30 210' },
    { d: 'M 170 30 L 170 210' },
    { d: 'M 30 120 L 170 120' }
  ],
  I: [
    { d: 'M 100 30 L 100 210' }
  ],
  J: [
    { d: 'M 140 30 L 140 175 A 50 35 0 0 1 50 175' }
  ],
  K: [
    { d: 'M 30 30 L 30 210' },
    { d: 'M 165 30 L 30 120 L 165 210' }
  ],
  L: [
    { d: 'M 30 30 L 30 210 L 165 210' }
  ],
  M: [
    { d: 'M 30 210 L 30 30' },
    { d: 'M 30 30 L 100 130 L 170 30' },
    { d: 'M 170 30 L 170 210' }
  ],
  N: [
    { d: 'M 30 210 L 30 30' },
    { d: 'M 30 30 L 170 210 L 170 30' }
  ],
  O: [
    { d: 'M 100 30 A 70 90 0 1 0 100 210 A 70 90 0 1 0 100 30' }
  ],
  P: [
    { d: 'M 50 30 L 50 210' },
    { d: 'M 50 30 A 55 45 0 0 1 50 120' }
  ],
  Q: [
    { d: 'M 100 30 A 70 90 0 1 0 100 210 A 70 90 0 1 0 100 30' },
    { d: 'M 125 165 L 175 215' }
  ],
  R: [
    { d: 'M 50 30 L 50 210' },
    { d: 'M 50 30 A 50 45 0 0 1 50 120' },
    { d: 'M 75 120 L 165 210' }
  ],
  S: [
    { d: 'M 155 60 C 150 25 60 25 60 75 C 60 125 150 125 150 165 C 150 215 50 215 55 175' }
  ],
  T: [
    { d: 'M 30 30 L 170 30' },
    { d: 'M 100 30 L 100 210' }
  ],
  U: [
    { d: 'M 30 30 L 30 160 A 70 60 0 0 0 170 160 L 170 30' }
  ],
  V: [
    { d: 'M 30 30 L 100 210 L 170 30' }
  ],
  W: [
    { d: 'M 30 30 L 70 210 L 100 90 L 130 210 L 170 30' }
  ],
  X: [
    { d: 'M 30 30 L 170 210' },
    { d: 'M 170 30 L 30 210' }
  ],
  Y: [
    { d: 'M 30 30 L 100 120 L 100 210' },
    { d: 'M 170 30 L 100 120' }
  ],
  Z: [
    { d: 'M 30 30 L 170 30 L 30 210 L 170 210' }
  ]
};

const NUMBER_PATHS = {
  '0': [
    { d: 'M 100 30 A 65 90 0 1 0 100 210 A 65 90 0 1 0 100 30' }
  ],
  '1': [
    { d: 'M 55 70 L 100 30 L 100 210' }
  ],
  '2': [
    { d: 'M 40 75 Q 100 0 160 75 L 40 210 L 160 210' }
  ],
  '3': [
    { d: 'M 50 50 Q 160 30 160 90 Q 160 130 95 120 Q 160 125 160 175 Q 160 215 50 195' }
  ],
  '4': [
    { d: 'M 130 30 L 40 140 L 165 140' },
    { d: 'M 130 30 L 130 210' }
  ],
  '5': [
    { d: 'M 165 30 L 60 30 L 60 110' },
    { d: 'M 60 110 A 60 50 0 0 1 60 210' }
  ],
  '6': [
    { d: 'M 150 50 Q 50 50 50 140 C 50 80 160 80 160 140 C 160 200 50 200 50 140' }
  ],
  '7': [
    { d: 'M 40 30 L 165 30 L 80 210' }
  ],
  '8': [
    { d: 'M 100 30 C 30 30 30 120 100 120 C 170 120 170 30 100 30' },
    { d: 'M 100 120 C 30 120 30 210 100 210 C 170 210 170 120 100 120' }
  ],
  '9': [
    { d: 'M 155 130 C 155 70 50 70 50 130 C 50 190 155 190 155 130 L 155 210' }
  ],
  '10': [
    { d: 'M 30 70 L 60 30 L 60 210' },
    { d: 'M 140 30 A 35 90 0 1 0 140 210 A 35 90 0 1 0 140 30' }
  ]
};
