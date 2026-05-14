/* ============================================================
   Letters & Numbers — v5 world / self / society content
   Covers Rammeplan areas 3, 4, 5, 6, 7 (the ones we previously
   touched only indirectly). Each dataset is curated for strong
   emoji support and age-appropriate vocabulary.
   ============================================================ */

/* -----------------------------------------------------------
   FEELINGS — Rammeplan area 6 (Ethics, religion & philosophy)
   Eight core emotions; faces are universal Unicode emoji so
   they render identically across devices. Pedagogical pairing:
   emotion → simple naming. Especially valuable for ADHD-aware
   design — emotion recognition underpins self-regulation.
   ----------------------------------------------------------- */
const FEELINGS = [
  { key: 'happy',     emoji: '😀', label: 'happy',     description: 'smiling, eyes bright' },
  { key: 'sad',       emoji: '😢', label: 'sad',       description: 'eyes down, maybe a tear' },
  { key: 'angry',     emoji: '😠', label: 'angry',     description: 'brows together, eyes hard' },
  { key: 'surprised', emoji: '😲', label: 'surprised', description: 'eyes wide, mouth open' },
  { key: 'scared',    emoji: '😨', label: 'scared',    description: 'eyes big, body tense' },
  { key: 'tired',     emoji: '😴', label: 'tired',     description: 'eyes closed, body soft' },
  { key: 'excited',   emoji: '🤩', label: 'excited',   description: 'big smile, sparkly eyes' },
  { key: 'calm',      emoji: '😌', label: 'calm',      description: 'soft face, slow breath' }
];

/* -----------------------------------------------------------
   SHAPES — Rammeplan area 5 (Quantity, space & shape)
   Eight basic shapes. `svgInner` is the inner element used in
   the recognize-shape display (single SVG element per shape).
   `paths` is the stroke-by-stroke trace data for shape tracing,
   plugged into the existing SVG-path tracer engine.
   ----------------------------------------------------------- */
const SHAPES = [
  { key: 'circle',
    label: 'circle',
    svgInner: '<circle cx="100" cy="120" r="70" />',
    paths: [{ d: 'M 100 50 A 70 70 0 1 0 100 190 A 70 70 0 1 0 100 50' }]
  },
  { key: 'square',
    label: 'square',
    svgInner: '<rect x="30" y="50" width="140" height="140" rx="4" />',
    paths: [{ d: 'M 30 50 L 170 50 L 170 190 L 30 190 L 30 50' }]
  },
  { key: 'triangle',
    label: 'triangle',
    svgInner: '<polygon points="100,40 175,190 25,190" />',
    paths: [{ d: 'M 100 40 L 175 190 L 25 190 L 100 40' }]
  },
  { key: 'rectangle',
    label: 'rectangle',
    svgInner: '<rect x="20" y="75" width="160" height="90" rx="4" />',
    paths: [{ d: 'M 20 75 L 180 75 L 180 165 L 20 165 L 20 75' }]
  },
  { key: 'oval',
    label: 'oval',
    svgInner: '<ellipse cx="100" cy="120" rx="80" ry="55" />',
    paths: [{ d: 'M 100 65 A 80 55 0 1 0 100 175 A 80 55 0 1 0 100 65' }]
  },
  { key: 'star',
    label: 'star',
    svgInner: '<polygon points="100,40 121,99 183,99 133,134 152,193 100,158 48,193 67,134 17,99 79,99" />',
    paths: [{ d: 'M 100 40 L 121 99 L 183 99 L 133 134 L 152 193 L 100 158 L 48 193 L 67 134 L 17 99 L 79 99 L 100 40' }]
  },
  { key: 'heart',
    label: 'heart',
    svgInner: '<path d="M 100 190 C 30 140 30 70 70 70 C 90 70 100 90 100 110 C 100 90 110 70 130 70 C 170 70 170 140 100 190 Z" />',
    paths: [{ d: 'M 100 190 C 30 140 30 70 70 70 C 90 70 100 90 100 110 C 100 90 110 70 130 70 C 170 70 170 140 100 190' }]
  },
  { key: 'hexagon',
    label: 'hexagon',
    svgInner: '<polygon points="100,50 165,85 165,155 100,190 35,155 35,85" />',
    paths: [{ d: 'M 100 50 L 165 85 L 165 155 L 100 190 L 35 155 L 35 85 L 100 50' }]
  }
];

/* -----------------------------------------------------------
   COLORS — Rammeplan area 3 (Art, culture & creativity)
   Ten basic colors. `oklch` keeps the swatch perceptually
   uniform across both themes; `fallback` is the hex for browsers
   that don't yet support oklch (rare in 2026).
   ----------------------------------------------------------- */
const COLORS = [
  { key: 'red',    label: 'red',    oklch: 'oklch(0.62 0.22 28)',  fallback: '#dc2626' },
  { key: 'blue',   label: 'blue',   oklch: 'oklch(0.58 0.18 245)', fallback: '#2563eb' },
  { key: 'yellow', label: 'yellow', oklch: 'oklch(0.88 0.18 95)',  fallback: '#facc15' },
  { key: 'green',  label: 'green',  oklch: 'oklch(0.65 0.18 145)', fallback: '#16a34a' },
  { key: 'orange', label: 'orange', oklch: 'oklch(0.72 0.18 50)',  fallback: '#ea580c' },
  { key: 'purple', label: 'purple', oklch: 'oklch(0.55 0.20 305)', fallback: '#9333ea' },
  { key: 'pink',   label: 'pink',   oklch: 'oklch(0.78 0.16 0)',   fallback: '#ec4899' },
  { key: 'brown',  label: 'brown',  oklch: 'oklch(0.42 0.08 60)',  fallback: '#78350f' },
  { key: 'black',  label: 'black',  oklch: 'oklch(0.20 0.01 0)',   fallback: '#1f2937' },
  { key: 'white',  label: 'white',  oklch: 'oklch(0.96 0.005 80)', fallback: '#f9fafb' }
];

/* -----------------------------------------------------------
   BODY PARTS — Rammeplan area 2 (Body, movement, food & health)
   Eight parts the child can identify on their own body and on
   a friendly figure. Uses standard emoji for cross-platform.
   ----------------------------------------------------------- */
const BODY_PARTS = [
  { key: 'eye',   emoji: '👁️', label: 'eye',   prompt: 'Where is the eye?' },
  { key: 'nose',  emoji: '👃', label: 'nose',  prompt: 'Where is the nose?' },
  { key: 'ear',   emoji: '👂', label: 'ear',   prompt: 'Where is the ear?' },
  { key: 'mouth', emoji: '👄', label: 'mouth', prompt: 'Where is the mouth?' },
  { key: 'hand',  emoji: '✋', label: 'hand',  prompt: 'Where is the hand?' },
  { key: 'foot',  emoji: '🦶', label: 'foot',  prompt: 'Where is the foot?' },
  { key: 'arm',   emoji: '💪', label: 'arm',   prompt: 'Where is the arm?' },
  { key: 'leg',   emoji: '🦵', label: 'leg',   prompt: 'Where is the leg?' }
];

/* -----------------------------------------------------------
   ANIMALS & HABITATS — Rammeplan area 4 (Nature)
   Each entry pairs an animal with the habitat it belongs in.
   Mode mechanic: show the animal, child picks the habitat.
   ----------------------------------------------------------- */
const ANIMAL_HABITATS = [
  { key: 'bear-forest',     animal: { e: '🐻', name: 'bear' },     habitat: { e: '🌲', name: 'forest' } },
  { key: 'fish-water',      animal: { e: '🐟', name: 'fish' },     habitat: { e: '🌊', name: 'water' } },
  { key: 'bird-tree',       animal: { e: '🐦', name: 'bird' },     habitat: { e: '🌳', name: 'tree' } },
  { key: 'lion-grassland',  animal: { e: '🦁', name: 'lion' },     habitat: { e: '🌾', name: 'grassland' } },
  { key: 'penguin-ice',     animal: { e: '🐧', name: 'penguin' },  habitat: { e: '🧊', name: 'ice' } },
  { key: 'camel-desert',    animal: { e: '🐪', name: 'camel' },    habitat: { e: '🏜️', name: 'desert' } },
  { key: 'cow-farm',        animal: { e: '🐄', name: 'cow' },      habitat: { e: '🏡', name: 'farm' } },
  { key: 'monkey-jungle',   animal: { e: '🐒', name: 'monkey' },   habitat: { e: '🌴', name: 'jungle' } },
  { key: 'frog-pond',       animal: { e: '🐸', name: 'frog' },     habitat: { e: '🪷', name: 'pond' } },
  { key: 'butterfly-flower',animal: { e: '🦋', name: 'butterfly' },habitat: { e: '🌸', name: 'flower' } }
];

/* -----------------------------------------------------------
   COMMUNITY HELPERS — Rammeplan area 7 (Local community & society)
   Mode mechanic: show a scenario emoji and a question; child
   picks which helper handles that situation.
   ----------------------------------------------------------- */
const COMMUNITY_HELPERS = [
  { key: 'firefighter', helper: { e: '👨‍🚒', name: 'firefighter' }, scenario: { e: '🔥', q: 'Who helps when there is a fire?' } },
  { key: 'doctor',      helper: { e: '🧑‍⚕️', name: 'doctor' },      scenario: { e: '🤒', q: 'Who helps when you are sick?' } },
  { key: 'teacher',     helper: { e: '🧑‍🏫', name: 'teacher' },     scenario: { e: '📚', q: 'Who helps you learn at school?' } },
  { key: 'police',      helper: { e: '👮', name: 'police officer' }, scenario: { e: '🚓', q: 'Who keeps people safe on the street?' } },
  { key: 'chef',        helper: { e: '🧑‍🍳', name: 'chef' },        scenario: { e: '🍳', q: 'Who makes food in a restaurant?' } },
  { key: 'farmer',      helper: { e: '🧑‍🌾', name: 'farmer' },      scenario: { e: '🌾', q: 'Who grows our food?' } },
  { key: 'mechanic',    helper: { e: '🧑‍🔧', name: 'mechanic' },    scenario: { e: '🔧', q: 'Who fixes cars?' } },
  { key: 'mail',        helper: { e: '📮', name: 'mail carrier' },  scenario: { e: '✉️', q: 'Who brings the mail?' } }
];

/* -----------------------------------------------------------
   SMÅBARN-TAP — cause-effect exploration set for the toddler band
   (1-3y). No right/wrong, no skill tracking. Tap → hear word in
   Aria's voice + button pops. Pure sensory + naming.
   Mixes common animals + everyday objects + family/people that a
   toddler is already learning to recognize and name.
   ----------------------------------------------------------- */
const SMABARN_TAPS = [
  // Common animals (most familiar to toddlers)
  { e: '🐶', name: 'dog',     category: 'animal' },
  { e: '🐱', name: 'cat',     category: 'animal' },
  { e: '🐮', name: 'cow',     category: 'animal' },
  { e: '🐷', name: 'pig',     category: 'animal' },
  { e: '🐑', name: 'sheep',   category: 'animal' },
  { e: '🐰', name: 'rabbit',  category: 'animal' },
  { e: '🦆', name: 'duck',    category: 'animal' },
  { e: '🐝', name: 'bee',     category: 'animal' },
  { e: '🐟', name: 'fish',    category: 'animal' },
  { e: '🦋', name: 'butterfly',category: 'animal' },
  // Everyday objects (Rammeplan: Local community & society)
  { e: '⚽', name: 'ball',    category: 'object' },
  { e: '🥛', name: 'milk',    category: 'object' },
  { e: '🍎', name: 'apple',   category: 'object' },
  { e: '🚗', name: 'car',     category: 'object' },
  { e: '🛁', name: 'bath',    category: 'object' },
  { e: '👟', name: 'shoe',    category: 'object' },
  { e: '🛏️', name: 'bed',     category: 'object' },
  { e: '☀️', name: 'sun',     category: 'object' },
  { e: '🌙', name: 'moon',    category: 'object' },
  // People / family
  { e: '👶', name: 'baby',    category: 'people' },
  { e: '👩', name: 'mama',    category: 'people' },
  { e: '👨', name: 'dada',    category: 'people' }
];

/* -----------------------------------------------------------
   PATTERNS — generative
   Pattern modes don't need a fixed dataset; we generate the
   pattern at round-start from COLORS or SHAPES, vary the rule
   (AB / ABC / AABB), and ask the child to complete it.
   The skill is on the rule type, not the specific items.
   ----------------------------------------------------------- */
const PATTERN_RULES = [
  { key: 'ab',   sequence: ['a','b','a','b','a','b'],   /* hide */ hideIdx: 5 },
  { key: 'abc',  sequence: ['a','b','c','a','b','c'],   hideIdx: 5 },
  { key: 'aabb', sequence: ['a','a','b','b','a','a'],   hideIdx: 5 },
  { key: 'abba', sequence: ['a','b','b','a','a','b'],   hideIdx: 5 }
];

/* -----------------------------------------------------------
   PARENT ACTIVITY CARDS
   Off-screen suggestions tied to Rammeplan learning areas.
   The parent dashboard shows 3 random ones at a time, filtered
   by the child's age and (if known) which areas they've been
   working on in-app most recently. Pure suggestion — never
   pushed at the child, never tracked, never gamified.
   ----------------------------------------------------------- */
const PARENT_ACTIVITIES = [
  // Language & text (Rammeplan 1)
  { id: 'lang-01', area: 'language', minAge: 30, t: 'Read a picture book together — point at the words as you say them.' },
  { id: 'lang-02', area: 'language', minAge: 36, t: 'Make up a silly rhyme together about something in the room.' },
  { id: 'lang-03', area: 'language', minAge: 42, t: 'Tell a round-robin story — you say one sentence, then they say one.' },
  { id: 'lang-04', area: 'language', minAge: 36, t: 'Sing a song you both know. Pause partway through and let them fill in the next word.' },
  { id: 'lang-05', area: 'language', minAge: 48, t: 'Look at family photos together. Ask them to tell you who is who and what is happening.' },
  // Body, movement, health (Rammeplan 2)
  { id: 'body-01', area: 'physical', minAge: 30, t: 'Try animal walks across the room: bear crawl, frog jump, snake slither, crab walk.' },
  { id: 'body-02', area: 'physical', minAge: 36, t: 'Cook a simple snack together. Let them measure, pour, and stir.' },
  { id: 'body-03', area: 'physical', minAge: 36, t: 'Have a dance break — put on a song and move however the music says to move.' },
  { id: 'body-04', area: 'physical', minAge: 36, t: 'Wash hands together and name each part you wash: thumb, palm, between fingers.' },
  // Art, culture, creativity (Rammeplan 3)
  { id: 'art-01',  area: 'art',      minAge: 30, t: 'Free draw with crayons. Do not ask what it is — ask them to tell you about it.' },
  { id: 'art-02',  area: 'art',      minAge: 36, t: 'Make music with kitchen pots and wooden spoons. Vary fast/slow, loud/soft.' },
  { id: 'art-03',  area: 'art',      minAge: 42, t: 'Build something together with whatever is around — blocks, cushions, cardboard.' },
  { id: 'art-04',  area: 'art',      minAge: 36, t: 'Mix two colors of paint or food coloring together. What new color did you make?' },
  // Nature, environment, technology (Rammeplan 4)
  { id: 'nat-01',  area: 'nature',   minAge: 30, t: 'Go outside and find five different kinds of leaves. Compare their shapes.' },
  { id: 'nat-02',  area: 'nature',   minAge: 42, t: 'Watch the clouds for five minutes. What shapes or animals do you see in them?' },
  { id: 'nat-03',  area: 'nature',   minAge: 36, t: 'Plant a seed in a cup and watch it for a week. Talk about what plants need.' },
  { id: 'nat-04',  area: 'nature',   minAge: 30, t: 'Listen for three different sounds outside. Try to name what is making each one.' },
  // Math & shapes (Rammeplan 5)
  { id: 'math-01', area: 'math',     minAge: 30, t: 'Count the steps as you walk up the stairs together.' },
  { id: 'math-02', area: 'math',     minAge: 36, t: 'Set the table together and count out forks and plates — one for each person.' },
  { id: 'math-03', area: 'math',     minAge: 36, t: 'Find three round things, three square things, and three triangle things in the room.' },
  { id: 'math-04', area: 'math',     minAge: 42, t: 'Sort their socks by color or by size. Talk about which group has more.' },
  { id: 'math-05', area: 'math',     minAge: 42, t: 'Make a pattern with anything: red sock, blue sock, red sock, blue sock — what comes next?' },
  // Ethics, feelings, philosophy (Rammeplan 6)
  { id: 'soc-01',  area: 'social',   minAge: 30, t: 'Before bed, name three feelings you had today. Ask them to name theirs.' },
  { id: 'soc-02',  area: 'social',   minAge: 42, t: "Play 'How would you feel if…' with simple scenarios. Listen without correcting them." },
  { id: 'soc-03',  area: 'social',   minAge: 36, t: 'Do a kind thing together: water a plant, share a snack with someone, write someone a note.' },
  { id: 'soc-04',  area: 'social',   minAge: 36, t: "Read a book where a character has a big feeling. Pause and ask: \"why do you think they feel that way?\"" },
  // Local community & society (Rammeplan 7)
  { id: 'com-01',  area: 'community',minAge: 42, t: 'On a walk, point out the people whose jobs help your neighborhood. Talk about what each one does.' },
  { id: 'com-02',  area: 'community',minAge: 36, t: 'Visit a library, a market, or a post office together. Talk about who works there.' },
  { id: 'com-03',  area: 'community',minAge: 42, t: 'Look at a map of where you live. Find your home, find their preschool, trace the path between them.' }
];
