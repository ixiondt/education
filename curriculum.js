/* ============================================================
   Letters & Numbers — curriculum
   Skill definitions + age gates + mastery thresholds + standards.

   Depends on letters.js (LETTERS, NUMBERS) being loaded first.

   Globals exposed:
     SKILLS              — array of skill objects
     SKILLS_BY_ID        — { id → skill }
     SKILLS_BY_MODE      — { mode → [skill, ...] }
     STANDARDS_REFERENCE — { code → human description }
     isSkillAvailable(skill, profile, opts?)
     isSkillMastered(skill, profile)
     getSkillProgress(skill, profile)
     pickNextSkill(profile, mode, excludeId?)
     recordSkillAttempt(profile, skillId, success)
     computeProfileStats(profile)
     skillsForMode(mode)
     ageBandForMonths(months) → 'pre-k' | 'k' | ...
   ============================================================ */

/* Standards mapping — for parent dashboards in v3.
   These codes are real (CCSS) or representative (NAEYC ELOF). */
const STANDARDS_REFERENCE = {
  /* ─── United States — CCSS-K (Common Core State Standards, Kindergarten) ─── */
  'CCSS-RF.K.1d':  'Recognize and name all upper- and lowercase letters of the alphabet (CCSS Kindergarten, Reading Foundations 1d)',
  'CCSS-RF.K.2':   'Demonstrate understanding of spoken words, syllables, and sounds (phonemes) (CCSS Kindergarten, Reading Foundations 2)',
  'CCSS-RF.K.2a':  'Recognize and produce rhyming words (CCSS Kindergarten, Reading Foundations 2a)',
  'CCSS-RF.K.2c':  'Blend and segment onsets and rimes of single-syllable spoken words (CCSS Kindergarten, Reading Foundations 2c)',
  'CCSS-RF.K.2d':  'Isolate and pronounce the initial, medial vowel, and final sounds (phonemes) in three-phoneme words (CCSS Kindergarten, Reading Foundations 2d)',
  'CCSS-RF.K.3a':  'Demonstrate basic knowledge of one-to-one letter-sound correspondence (CCSS Kindergarten, Reading Foundations 3a)',
  'CCSS-K.CC.3':   'Write numbers from 0 to 20. Represent a number of objects with a written numeral 0-20 (CCSS Kindergarten, Counting & Cardinality 3)',
  'CCSS-K.CC.4':   'Understand the relationship between numbers and quantities; connect counting to cardinality (CCSS Kindergarten, Counting & Cardinality 4)',
  'CCSS-K.CC.5':   'Count to answer "how many?" questions about as many as 20 things (CCSS Kindergarten, Counting & Cardinality 5)',

  /* ─── United States — NAEYC ELOF (Early Learning Outcomes Framework) ─── */
  'NAEYC-LL-1.1':  'Letter knowledge — recognizing and naming letters (NAEYC ELOF, Language & Literacy)',
  'NAEYC-LL-2.3':  'Phonological awareness — letter-sound correspondence (NAEYC ELOF, Language & Literacy)',
  'NAEYC-LL-3.2':  'Emergent writing — pre-writing and letter formation (NAEYC ELOF, Language & Literacy)',
  'NAEYC-M-1.1':   'Number sense — counting and quantity (NAEYC ELOF, Mathematics)',
  'NAEYC-M-2.1':   'Number recognition and written numerals (NAEYC ELOF, Mathematics)',
  'NAEYC-PMP-2.2': 'Fine motor development — pencil grip, controlled marks (NAEYC ELOF, Perceptual/Motor/Physical)',

  /* ─── European Union — Quality Framework for ECEC (Council of EU, 2019) ─── */
  'EU-ECEC-CURR-LANG':     'EU Quality Framework for ECEC — Curriculum pillar: emergent literacy and language development integrated into play',
  'EU-ECEC-CURR-NUMER':    'EU Quality Framework for ECEC — Curriculum pillar: early numeracy and quantitative reasoning in everyday context',
  'EU-ECEC-CURR-HOLISTIC': 'EU Quality Framework for ECEC — Curriculum pillar: holistic development across cognitive, social, emotional, and physical domains',
  'EU-ECEC-CURR-PLAY':     'EU Quality Framework for ECEC — Curriculum pillar: play-based, child-led learning as the primary mode of education',

  /* ─── Norway — Rammeplan (Framework Plan for Kindergartens, Udir) ─── */
  'RAMMEPLAN-COMM-1.1':  'Norwegian Rammeplan — Communication, Language & Text: recognizing letters and connecting letters to sounds',
  'RAMMEPLAN-COMM-1.2':  'Norwegian Rammeplan — Communication, Language & Text: emergent writing and exploring letter forms',
  'RAMMEPLAN-COMM-1.3':  'Norwegian Rammeplan — Communication, Language & Text: vocabulary growth through everyday words and naming',
  'RAMMEPLAN-COMM-1.4':  'Norwegian Rammeplan — Communication, Language & Text: phonological awareness — playing with rhyme, syllables, and sounds',
  'RAMMEPLAN-COMM-1.5':  'Norwegian Rammeplan — Communication, Language & Text: emergent reading — recognizing high-frequency words on sight',
  'CCSS-RF.K.3c':         'Read common high-frequency words by sight (CCSS Kindergarten, Reading Foundations 3c)',
  'NAEYC-LL-1.2':         'Emergent reading — recognizing familiar words in environmental print (NAEYC ELOF, Language & Literacy)',
  'RAMMEPLAN-QUANT-1.1': 'Norwegian Rammeplan — Quantities, Spaces & Shapes: number recognition and written numeral familiarity',
  'RAMMEPLAN-QUANT-1.2': 'Norwegian Rammeplan — Quantities, Spaces & Shapes: counting and one-to-one correspondence with concrete objects',
  'RAMMEPLAN-PRINCIPLE-CHILD-AGENCY': 'Norwegian Rammeplan — Foundational principle: children are competent, agentic learners who explore on their own initiative',

  /* ─── v5 — additional Rammeplan area mappings ─── */
  'RAMMEPLAN-KROPP-1.1':  'Norwegian Rammeplan — Body, movement, food & health: recognizing parts of the body',
  'RAMMEPLAN-KUNST-1.1':  'Norwegian Rammeplan — Art, culture & creativity: recognizing colors and aesthetic qualities',
  'RAMMEPLAN-NATUR-1.1':  'Norwegian Rammeplan — Nature, environment & technology: recognizing animals and their habitats',
  'RAMMEPLAN-ETIKK-1.1':  'Norwegian Rammeplan — Ethics, religion & philosophy: recognizing and naming emotions in self and others',
  'RAMMEPLAN-SAMFUNN-1.1':'Norwegian Rammeplan — Local community & society: recognizing community helpers and their roles',
  'RAMMEPLAN-QUANT-2.1':  'Norwegian Rammeplan — Quantities, spaces & shapes: recognizing two-dimensional shapes',
  'RAMMEPLAN-QUANT-2.2':  'Norwegian Rammeplan — Quantities, spaces & shapes: recognizing and continuing patterns',

  /* US CCSS additions for v5 */
  'CCSS-K.G.A.2':  'Correctly name shapes regardless of their orientations or overall size (CCSS Kindergarten, Geometry A.2)',
  'CCSS-K.G.A.3':  'Identify shapes as two-dimensional or three-dimensional (CCSS Kindergarten, Geometry A.3)',
  'CCSS-K.OA.A':   'Understand addition and subtraction; recognize patterns and quantity relationships (CCSS Kindergarten, Operations & Algebraic Thinking)',
  'CCSS-K.OA.A.1': 'Represent addition and subtraction with objects, fingers, and drawings (CCSS Kindergarten, OA A.1)',
  'CCSS-K.OA.A.5': 'Fluently add and subtract within 5 (CCSS Kindergarten, OA A.5)',

  /* NAEYC additions for v5 */
  'NAEYC-Math-3.1':       'Patterning and algebraic thinking — recognizing, copying, and extending patterns (NAEYC ELOF, Mathematics)',
  'NAEYC-Math-4.1':       'Geometry and spatial sense — recognizing and naming basic two-dimensional shapes (NAEYC ELOF, Mathematics)',
  'NAEYC-Math-5.1':       'Operations — combining and separating quantities (simple addition / subtraction with objects) (NAEYC ELOF, Mathematics)',
  'RAMMEPLAN-QUANT-2.3':  'Norwegian Rammeplan — Quantities, Spaces & Shapes: combining and separating quantities; emerging arithmetic',
  'RAMMEPLAN-QUANT-2.4':  'Norwegian Rammeplan — Quantities, Spaces & Shapes: temporal awareness — recognizing times of day and sequence',
  'NAEYC-Soc-Em-1.1':     'Social & emotional development — recognizing and naming emotions (NAEYC ELOF, Social Emotional)',
  'NAEYC-Soc-Em-2.1':     'Social & emotional development — self-regulation precursors (NAEYC ELOF, Social Emotional)',
  'NAEYC-Health-1.1':     'Health, safety & physical development — body awareness (NAEYC ELOF)',
  'NAEYC-Sci-1.1':        'Scientific reasoning — observing and classifying living things (NAEYC ELOF, Cognition)',
  'NAEYC-Soc-1.1':        'Social studies — recognizing community roles and helpers (NAEYC ELOF, Cognition)',
  'NAEYC-Arts-1.1':       'Creative arts expression — color recognition and aesthetic awareness (NAEYC ELOF)'
};

const SKILLS = [];

/* Skills are tagged with codes from multiple frameworks so the same
   activity counts across US (CCSS, NAEYC), EU (ECEC Quality Framework),
   and Norwegian (Rammeplan) curricula. Each code is informational —
   the gameplay is identical regardless of which framework a parent
   prefers to view progress through. */

/* ---------- Letter recognition (uppercase) ---------- */
LETTERS.forEach((letter) => {
  SKILLS.push({
    id: `letter-recognize-${letter}`,
    category: 'letter-recognize',
    mode: 'find-letters',
    target: letter,
    label: letter,
    minAgeMonths: 30,             // 2.5y — old enough to point at letters
    masteryThreshold: 8,
    prereqs: [],
    standards: [
      'CCSS-RF.K.1d', 'NAEYC-LL-1.1',
      'EU-ECEC-CURR-LANG',
      'RAMMEPLAN-COMM-1.1'
    ]
  });
});

/* ---------- Letter sounds (phonics) ---------- */
LETTERS.forEach((letter) => {
  SKILLS.push({
    id: `letter-sound-${letter}`,
    category: 'letter-sound',
    mode: 'sounds',
    target: letter,
    label: `${letter} sound`,
    minAgeMonths: 36,             // 3y
    masteryThreshold: 6,
    prereqs: [`letter-recognize-${letter}`],
    standards: [
      'CCSS-RF.K.3a', 'NAEYC-LL-2.3',
      'EU-ECEC-CURR-LANG',
      'RAMMEPLAN-COMM-1.1', 'RAMMEPLAN-COMM-1.3'
    ]
  });
});

/* ---------- Letter tracing ---------- */
LETTERS.forEach((letter) => {
  SKILLS.push({
    id: `letter-trace-${letter}`,
    category: 'letter-trace',
    mode: 'trace-letters',
    target: letter,
    label: `trace ${letter}`,
    minAgeMonths: 42,             // 3.5y — fine motor enough to drag a path
    masteryThreshold: 5,
    prereqs: [`letter-recognize-${letter}`],
    standards: [
      'NAEYC-LL-3.2', 'NAEYC-PMP-2.2',
      'EU-ECEC-CURR-LANG',
      'RAMMEPLAN-COMM-1.2'
    ]
  });
});

/* ---------- Number recognition ---------- */
NUMBERS.forEach((num) => {
  SKILLS.push({
    id: `number-recognize-${num}`,
    category: 'number-recognize',
    mode: 'find-numbers',
    target: num,
    label: num,
    minAgeMonths: 30,
    masteryThreshold: 6,
    prereqs: [],
    standards: [
      'CCSS-K.CC.3', 'NAEYC-M-2.1',
      'EU-ECEC-CURR-NUMER',
      'RAMMEPLAN-QUANT-1.1'
    ]
  });
});

/* ---------- Number tracing ---------- */
NUMBERS.forEach((num) => {
  SKILLS.push({
    id: `number-trace-${num}`,
    category: 'number-trace',
    mode: 'trace-numbers',
    target: num,
    label: `trace ${num}`,
    minAgeMonths: 42,
    masteryThreshold: 5,
    prereqs: [`number-recognize-${num}`],
    standards: [
      'NAEYC-M-2.1', 'NAEYC-PMP-2.2',
      'EU-ECEC-CURR-NUMER',
      'RAMMEPLAN-QUANT-1.1'
    ]
  });
});

/* ============================================================
   v5 — Whole-child skill registration
   These map gameplay to the remaining Rammeplan areas:
   - Feelings  → area 6 (Ethics, religion & philosophy)
   - Body      → area 2 (Body, movement, food & health)
   - Shapes    → area 5 (Quantities, spaces & shapes)
   - Colors    → area 3 (Art, culture & creativity)
   - Patterns  → area 5 (Quantities, spaces & shapes)
   - Animals   → area 4 (Nature, environment & technology)
   - Helpers   → area 7 (Local community & society)
   ============================================================ */

/* ---------- Feelings (emotion recognition) ---------- */
if (typeof FEELINGS !== 'undefined') {
  FEELINGS.forEach((f) => {
    SKILLS.push({
      id: `feeling-${f.key}`,
      category: 'feeling',
      mode: 'feelings',
      target: f.key,
      label: f.label,
      minAgeMonths: 30,
      masteryThreshold: 5,
      prereqs: [],
      standards: [
        'RAMMEPLAN-ETIKK-1.1',
        'NAEYC-Soc-Em-1.1', 'NAEYC-Soc-Em-2.1',
        'EU-ECEC-CURR-HOLISTIC'
      ]
    });
  });
}

/* ---------- Body parts ---------- */
if (typeof BODY_PARTS !== 'undefined') {
  BODY_PARTS.forEach((b) => {
    SKILLS.push({
      id: `body-${b.key}`,
      category: 'body',
      mode: 'body',
      target: b.key,
      label: b.label,
      minAgeMonths: 30,
      masteryThreshold: 5,
      prereqs: [],
      standards: [
        'RAMMEPLAN-KROPP-1.1',
        'NAEYC-Health-1.1',
        'EU-ECEC-CURR-HOLISTIC'
      ]
    });
  });
}

/* ---------- Shapes ---------- */
if (typeof SHAPES !== 'undefined') {
  SHAPES.forEach((s) => {
    SKILLS.push({
      id: `shape-${s.key}`,
      category: 'shape',
      mode: 'shapes',
      target: s.key,
      label: s.label,
      minAgeMonths: 30,
      masteryThreshold: 5,
      prereqs: [],
      standards: [
        'CCSS-K.G.A.2', 'NAEYC-Math-4.1',
        'RAMMEPLAN-QUANT-2.1',
        'EU-ECEC-CURR-NUMER'
      ]
    });
  });
}

/* ---------- Colors ---------- */
if (typeof COLORS !== 'undefined') {
  COLORS.forEach((c) => {
    SKILLS.push({
      id: `color-${c.key}`,
      category: 'color',
      mode: 'colors',
      target: c.key,
      label: c.label,
      minAgeMonths: 30,
      masteryThreshold: 5,
      prereqs: [],
      standards: [
        'NAEYC-Arts-1.1',
        'RAMMEPLAN-KUNST-1.1',
        'EU-ECEC-CURR-HOLISTIC'
      ]
    });
  });
}

/* ---------- Patterns ---------- */
if (typeof PATTERN_RULES !== 'undefined') {
  PATTERN_RULES.forEach((p) => {
    SKILLS.push({
      id: `pattern-${p.key}`,
      category: 'pattern',
      mode: 'patterns',
      target: p.key,
      label: p.key.toUpperCase() + ' pattern',
      minAgeMonths: 42,
      masteryThreshold: 4,
      prereqs: [],
      standards: [
        'CCSS-K.OA.A', 'NAEYC-Math-3.1',
        'RAMMEPLAN-QUANT-2.2',
        'EU-ECEC-CURR-NUMER'
      ]
    });
  });
}

/* ---------- Animals & habitats ---------- */
if (typeof ANIMAL_HABITATS !== 'undefined') {
  ANIMAL_HABITATS.forEach((a) => {
    SKILLS.push({
      id: `animal-${a.key}`,
      category: 'animal',
      mode: 'animals',
      target: a.key,
      label: `${a.animal.name} → ${a.habitat.name}`,
      minAgeMonths: 36,
      masteryThreshold: 4,
      prereqs: [],
      standards: [
        'NAEYC-Sci-1.1',
        'RAMMEPLAN-NATUR-1.1',
        'EU-ECEC-CURR-HOLISTIC'
      ]
    });
  });
}

/* ---------- Community helpers ---------- */
if (typeof COMMUNITY_HELPERS !== 'undefined') {
  COMMUNITY_HELPERS.forEach((h) => {
    SKILLS.push({
      id: `helper-${h.key}`,
      category: 'helper',
      mode: 'helpers',
      target: h.key,
      label: h.helper.name,
      minAgeMonths: 42,
      masteryThreshold: 4,
      prereqs: [],
      standards: [
        'NAEYC-Soc-1.1',
        'RAMMEPLAN-SAMFUNN-1.1',
        'EU-ECEC-CURR-HOLISTIC'
      ]
    });
  });
}

/* ---------- First-sound isolation (phonemic awareness) ---------- */
/* Uses LETTER_WORDS — child hears the word, identifies its starting letter. */
LETTERS.forEach((letter) => {
  SKILLS.push({
    id: `first-sound-${letter}`,
    category: 'first-sound',
    mode: 'first-sound',
    target: letter,
    label: `first sound of ${letter}`,
    minAgeMonths: 42,
    masteryThreshold: 5,
    prereqs: [`letter-sound-${letter}`],
    standards: [
      'CCSS-RF.K.2d', 'CCSS-RF.K.3a', 'NAEYC-LL-2.3',
      'EU-ECEC-CURR-LANG',
      'RAMMEPLAN-COMM-1.4'
    ]
  });
});

/* ---------- Rhyme matching (phonemic awareness) ---------- */
/* One skill per rhyme family (-at, -og, -un, etc.). The child finds
   a rhyming match among picture choices. */
if (typeof RHYME_FAMILIES !== 'undefined') {
  RHYME_FAMILIES.forEach((fam) => {
    SKILLS.push({
      id: `rhyme-${fam.key}`,
      category: 'rhyme',
      mode: 'rhyme',
      target: fam.key,
      label: `-${fam.key} rhyme family`,
      minAgeMonths: 42,
      masteryThreshold: 4,
      prereqs: [],
      standards: [
        'CCSS-RF.K.2a', 'CCSS-RF.K.2', 'NAEYC-LL-2.3',
        'EU-ECEC-CURR-LANG',
        'RAMMEPLAN-COMM-1.4'
      ]
    });
  });
}

/* ---------- Blending (phonemic awareness) ---------- */
/* Child hears phonemes one at a time with pauses (c... a... t), picks
   the matching picture. Higher cognitive load — recommended 4y+. */
if (typeof CVC_WORDS !== 'undefined') {
  CVC_WORDS.forEach((cvc) => {
    SKILLS.push({
      id: `blend-${cvc.word}`,
      category: 'blend',
      mode: 'blend',
      target: cvc.word,
      label: `blend ${cvc.word}`,
      minAgeMonths: 48,
      masteryThreshold: 4,
      prereqs: [],
      standards: [
        'CCSS-RF.K.2c', 'CCSS-RF.K.2', 'NAEYC-LL-2.3',
        'EU-ECEC-CURR-LANG',
        'RAMMEPLAN-COMM-1.4'
      ]
    });
  });
}

/* ---------- Addition (Eldre/Skolestart) ---------- */
if (typeof ADDITION_SUMS !== 'undefined') {
  ADDITION_SUMS.forEach((sum) => {
    SKILLS.push({
      id: `addition-sum-${sum}`,
      category: 'addition',
      mode: 'addition',
      target: sum,
      label: `addition to ${sum}`,
      minAgeMonths: 54,           // ~4.5y — late eldre / early skolestart
      masteryThreshold: 5,
      prereqs: [],
      standards: [
        'CCSS-K.OA.A.1', 'CCSS-K.OA.A.5', 'NAEYC-Math-5.1',
        'EU-ECEC-CURR-NUMER',
        'RAMMEPLAN-QUANT-2.3'
      ]
    });
  });
}

/* ---------- Subtraction (Skolestart) ---------- */
if (typeof SUBTRACTION_DIFFS !== 'undefined') {
  SUBTRACTION_DIFFS.forEach((diff) => {
    SKILLS.push({
      id: `subtraction-diff-${diff}`,
      category: 'subtraction',
      mode: 'subtraction',
      target: diff,
      label: `subtraction with difference ${diff}`,
      minAgeMonths: 60,           // ~5y — skolestart only
      masteryThreshold: 5,
      // Prereq: comfortable with the same-numbered addition first
      prereqs: [`addition-sum-${diff}`],
      standards: [
        'CCSS-K.OA.A.1', 'CCSS-K.OA.A.5', 'NAEYC-Math-5.1',
        'EU-ECEC-CURR-NUMER',
        'RAMMEPLAN-QUANT-2.3'
      ]
    });
  });
}

/* ---------- Time of day (Skolestart, 5-6y) ---------- */
if (typeof TIMES_OF_DAY !== 'undefined') {
  TIMES_OF_DAY.forEach((t) => {
    SKILLS.push({
      id: `time-${t.key}`,
      category: 'time',
      mode: 'time-of-day',
      target: t.key,
      label: t.label,
      minAgeMonths: 54,          // ~4.5y — late eldre / skolestart
      masteryThreshold: 4,
      prereqs: [],
      standards: [
        'NAEYC-Math-1.1',        // number sense + temporal awareness
        'EU-ECEC-CURR-HOLISTIC',
        'RAMMEPLAN-QUANT-2.4'    // (new) time + sequence
      ]
    });
  });
}

/* ---------- Decodable books (Skolestart, 5-6y) ---------- */
if (typeof READING_BOOKS !== 'undefined') {
  READING_BOOKS.forEach((book) => {
    SKILLS.push({
      id: `reading-${book.id}`,
      category: 'reading',
      mode: 'reading',
      target: book.id,
      label: book.title,
      minAgeMonths: 60,
      masteryThreshold: 3, // 3 read-throughs = "confident"
      prereqs: [],         // intentionally loose — let kids try when curious
      standards: [
        'CCSS-RF.K.3c',  // sight words
        'CCSS-RF.K.2',   // phonological awareness
        'NAEYC-LL-1.2',  // emergent reading
        'EU-ECEC-CURR-LANG',
        'RAMMEPLAN-COMM-1.5'
      ]
    });
  });
}

/* ---------- Sight words (Dolch pre-primer) — Skolestart band ---------- */
if (typeof SIGHT_WORDS !== 'undefined') {
  SIGHT_WORDS.forEach((w) => {
    SKILLS.push({
      id: `sight-${w.toLowerCase()}`,
      category: 'sight-word',
      mode: 'sight-words',
      target: w,
      label: w,
      minAgeMonths: 60,  // skolestart band (5y+)
      masteryThreshold: 4,
      prereqs: [],
      standards: [
        'CCSS-RF.K.3c', 'NAEYC-LL-1.2',
        'EU-ECEC-CURR-LANG',
        'RAMMEPLAN-COMM-1.5'
      ]
    });
  });
}

/* ---------- Counting (0 excluded — can't show zero objects) ---------- */
NUMBERS.filter((n) => n !== '0').forEach((num) => {
  SKILLS.push({
    id: `count-${num}`,
    category: 'count',
    mode: 'count',
    target: num,
    label: `count ${num}`,
    minAgeMonths: 36,
    masteryThreshold: 5,
    prereqs: [`number-recognize-${num}`],
    standards: [
      'CCSS-K.CC.4', 'CCSS-K.CC.5', 'NAEYC-M-1.1',
      'EU-ECEC-CURR-NUMER',
      'RAMMEPLAN-QUANT-1.2'
    ]
  });
});

/* ---------- Indexes ---------- */
const SKILLS_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
const SKILLS_BY_MODE = SKILLS.reduce((acc, s) => {
  (acc[s.mode] ||= []).push(s);
  return acc;
}, {});

function skillsForMode(mode) {
  return SKILLS_BY_MODE[mode] || [];
}

/* Map a standard code to its framework family name (for dashboard grouping). */
function frameworkOf(code) {
  if (code.startsWith('CCSS-'))      return 'CCSS-K (United States)';
  if (code.startsWith('NAEYC-'))     return 'NAEYC ELOF (United States)';
  if (code.startsWith('EU-ECEC'))    return 'EU Quality Framework for ECEC';
  if (code.startsWith('RAMMEPLAN-')) return 'Rammeplan (Norway)';
  return 'Other';
}

/* Group all known standard codes by framework family, sorted within each. */
function standardsByFramework() {
  const map = {};
  Object.keys(STANDARDS_REFERENCE).forEach((code) => {
    const fw = frameworkOf(code);
    (map[fw] ||= []).push(code);
  });
  Object.keys(map).forEach((fw) => map[fw].sort());
  return map;
}

/* ============================================================
   Profile + curriculum helpers
   ============================================================ */

function getSkillProgress(skill, profile) {
  return (profile?.progress?.skills?.[skill.id]) || { successes: 0, attempts: 0, lastSeen: 0 };
}

function isSkillMastered(skill, profile) {
  if (!skill) return true;
  const p = getSkillProgress(skill, profile);
  return p.successes >= skill.masteryThreshold;
}

function isSkillAvailable(skill, profile, opts = {}) {
  const { relaxPrereqs = false, relaxAge = false } = opts;
  const age = profile?.ageMonths ?? 48;
  if (!relaxAge && age < skill.minAgeMonths) return false;
  if (relaxPrereqs) return true;
  if (!skill.prereqs || skill.prereqs.length === 0) return true;
  return skill.prereqs.every((id) => isSkillMastered(SKILLS_BY_ID[id], profile));
}

/**
 * Pick the next skill to present in a given mode.
 * Strategy:
 *   1. Filter to skills in this mode that are available (age + prereqs).
 *   2. If none, relax prereqs (still respect age).
 *   3. If still none, ignore age (defensive — rare).
 *   4. Weight by inverse-success × recency × mastered-decay.
 */
function pickNextSkill(profile, mode, excludeId = null) {
  const all = skillsForMode(mode);
  if (!all.length) return null;

  // v3: respect the parent's prereqs setting
  const relax = profile?.settings?.prereqsMode === 'relaxed';
  let candidates = all.filter((s) => isSkillAvailable(s, profile, { relaxPrereqs: relax }));
  if (candidates.length === 0) {
    candidates = all.filter((s) => isSkillAvailable(s, profile, { relaxPrereqs: true }));
  }
  if (candidates.length === 0) candidates = all;

  let pool = excludeId ? candidates.filter((s) => s.id !== excludeId) : candidates;
  if (pool.length === 0) pool = candidates;

  const now = Date.now();
  const interests = profile?.interests || {};
  const weights = pool.map((s) => {
    const p = getSkillProgress(s, profile);
    const successFactor = 1 / Math.sqrt(1 + p.successes);
    const minutesSince = p.lastSeen ? (now - p.lastSeen) / 60000 : 10000;
    const recencyFactor = Math.min(1, Math.max(0.1, minutesSince / 30));
    const mastered = isSkillMastered(s, profile);
    const fading   = mastered && isSkillFading(s, profile);
    const masteryFactor = fading ? 1.5 : (mastered ? 0.2 : 1.0);
    const interestLevel = interests[String(s.target).toUpperCase()] || 0;
    const interestFactor = 1 + Math.sqrt(interestLevel) / 4;
    /* v5.10 — Adaptive: if the child is recently struggling with this
       skill (≥50% of last 5 attempts wrong), boost the weight so the
       picker surfaces it more often AND deprioritizes shiny-new
       skills that would compound their frustration. The base mastery
       factor already pulls untouched skills up, so we don't double-
       boost — we only apply when there's meaningful recent data. */
    const errorRate = recentErrorRate(profile, s.id, 5);
    let adaptiveBoost = 1.0;
    if (errorRate !== null) {
      if (errorRate >= 0.6)      adaptiveBoost = 2.4;  // genuinely stuck
      else if (errorRate >= 0.4) adaptiveBoost = 1.6;  // somewhat stuck
      else if (errorRate === 0)  adaptiveBoost = 0.7;  // mastering — drop weight a bit
    }
    return successFactor * recencyFactor * masteryFactor * interestFactor * adaptiveBoost + 0.01;
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function recordSkillAttempt(profile, skillId, success) {
  if (!profile) return;
  profile.progress ||= { skills: {} };
  profile.progress.skills ||= {};
  const s = (profile.progress.skills[skillId] ||= { successes: 0, attempts: 0, lastSeen: 0 });
  s.attempts++;
  if (success) s.successes++;
  s.lastSeen = Date.now();
}

/* ============================================================
   v5.10 — Adaptive helpers (recent error rate + recommendations)
   ============================================================ */

/* Look at the last N events for a given skill and compute its
   recent error rate. Returns null when not enough data to be
   meaningful (so the picker doesn't react to a single wrong tap). */
function recentErrorRate(profile, skillId, windowSize = 5) {
  const events = (profile?.progress?.events) || [];
  const recent = [];
  // Walk backwards through events for efficiency
  for (let i = events.length - 1; i >= 0 && recent.length < windowSize; i--) {
    if (events[i].skillId === skillId) recent.push(events[i]);
  }
  if (recent.length < 3) return null;
  const wrong = recent.filter((e) => !e.success).length;
  return wrong / recent.length;
}

/* Return a {stuck: [...], advancing: [...]} structure for the
   parent recommendations panel. Stuck = mastery progress under
   way but recent error rate high. Advancing = mastered + recent
   100% — ready for harder content. */
function computeRecommendations(profile, maxPerBucket = 3) {
  if (!profile?.progress?.skills) return { stuck: [], advancing: [] };
  const stuck = [];
  const advancing = [];
  for (const skill of SKILLS) {
    if (!isSkillAvailable(skill, profile, { relaxPrereqs: true })) continue;
    const p = getSkillProgress(skill, profile);
    if (p.attempts < 3) continue;
    const errorRate = recentErrorRate(profile, skill.id, 5);
    const mastered = isSkillMastered(skill, profile);
    if (errorRate !== null && errorRate >= 0.5 && !mastered) {
      stuck.push({ skill, errorRate, lastSeen: p.lastSeen });
    } else if (mastered && errorRate !== null && errorRate === 0 && p.attempts >= skill.masteryThreshold + 2) {
      advancing.push({ skill, lastSeen: p.lastSeen });
    }
  }
  // Sort: stuck → most-recently-seen first; advancing → also most-recent
  stuck.sort((a, b) => b.lastSeen - a.lastSeen);
  advancing.sort((a, b) => b.lastSeen - a.lastSeen);
  return {
    stuck:     stuck.slice(0, maxPerBucket),
    advancing: advancing.slice(0, maxPerBucket)
  };
}

function computeProfileStats(profile) {
  const available = SKILLS.filter((s) => isSkillAvailable(s, profile, { relaxPrereqs: true }));
  const mastered  = available.filter((s) => isSkillMastered(s, profile));
  const practiced = available.filter((s) => {
    const p = getSkillProgress(s, profile);
    return p.successes > 0 && !isSkillMastered(s, profile);
  });
  return {
    totalSkills: SKILLS.length,
    availableSkills: available.length,
    masteredSkills: mastered.length,
    practicedSkills: practiced.length,
    masteryRatio: available.length ? mastered.length / available.length : 0,
    abilityLevel: deriveAbilityLevel(mastered.length, available.length)
  };
}

function deriveAbilityLevel(mastered, available) {
  if (!available) return 'Exploring';
  const r = mastered / available;
  if (r >= 0.9) return 'Confident';
  if (r >= 0.5) return 'Practicing';
  if (r >= 0.2) return 'Discovering';
  return 'Exploring';
}

function ageBandForMonths(months) {
  if (months < 36) return 'toddler';
  if (months < 48) return 'pre-k-young';
  if (months < 60) return 'pre-k';
  if (months < 72) return 'kindergarten';
  return 'school-age';
}

/* ============================================================
   v5.1 — AGE BANDS (Norwegian Rammeplan style)
   These replace the numeric 2/3/4/5/6+ selection in the UI.
   Each band corresponds to a recognized Norwegian kindergarten
   life-stage with its own pedagogical emphasis. Mode visibility
   on the home screen is filtered by which modes are age-eligible
   for the active profile's band.
   ============================================================ */
const AGE_BANDS = [
  {
    id: 'smabarn',
    labelNo: 'Småbarn',
    labelEn: 'Toddler',
    minMonths: 18,
    maxMonths: 36,           // up to ~3y
    description: 'Exploration and recognition through play. Big targets, fewer choices, lots of free play.'
  },
  {
    id: 'yngre',
    labelNo: 'Yngre barnehagebarn',
    labelEn: 'Younger preschool',
    minMonths: 36,
    maxMonths: 48,           // 3-4y
    description: 'Letter and number recognition, picture-supported sounds, counting.'
  },
  {
    id: 'eldre',
    labelNo: 'Eldre barnehagebarn',
    labelEn: 'Older preschool',
    minMonths: 48,
    maxMonths: 60,           // 4-5y
    description: 'Tracing, phonemic awareness, patterns, deeper categorization.'
  },
  {
    id: 'skolestart',
    labelNo: 'Skolestart',
    labelEn: 'Pre-school year',
    minMonths: 60,
    maxMonths: 96,           // 5-8y (room to grow)
    description: 'Bridging to reading: blending, sight words, decoding, school readiness.'
  }
];

/* Map a profile age (months) to its band. Defaults to the closest
   band if the age falls outside any explicit range. */
function bandForMonths(months) {
  const m = Math.max(0, months || 0);
  for (const b of AGE_BANDS) {
    if (m >= b.minMonths && m < b.maxMonths) return b;
  }
  if (m < AGE_BANDS[0].minMonths) return AGE_BANDS[0];
  return AGE_BANDS[AGE_BANDS.length - 1];
}

/* Lowest minAgeMonths among all skills registered for a mode.
   Used to decide whether a mode card should appear / be locked
   on the home screen for the current profile. */
function modeMinAge(mode) {
  if (mode === 'play') return 0; // free play is always available
  const skills = SKILLS_BY_MODE[mode] || [];
  if (!skills.length) return 0;
  return Math.min(...skills.map((s) => s.minAgeMonths));
}

/* Group modes by pedagogical area — used by the session builder
   so a "Today's session" includes one activity per area instead
   of three letter-recognition rounds in a row. */
const MODE_AREAS = {
  language:  ['find-letters', 'sounds', 'first-sound', 'rhyme', 'blend', 'trace-letters', 'sight-words', 'reading'],
  math:      ['find-numbers', 'count', 'trace-numbers', 'shapes', 'patterns', 'colors', 'addition', 'subtraction', 'time-of-day'],
  selfWorld: ['feelings', 'body', 'animals', 'helpers']
};

function areaForMode(mode) {
  for (const [area, modes] of Object.entries(MODE_AREAS)) {
    if (modes.includes(mode)) return area;
  }
  return 'other';
}

/* ============================================================
   v5.2 — RAMMEPLAN AREA MAP
   The 7 Norwegian learning areas, each mapped to the skill
   categories from our curriculum. Powers the "By area" tab in
   the progress dashboard — a Norwegian-style parent view that
   shows breadth of exploration across the framework's 7 areas
   rather than performance percentages.
   ============================================================ */
const RAMMEPLAN_AREAS = [
  {
    id:  'comm-lang',
    no:  'Kommunikasjon, språk og tekst',
    en:  'Communication, Language & Text',
    emoji: '🅰️',
    intro: 'Letters, sounds, words, and the bridge to reading.',
    groups: [
      { label: 'Letter recognition',          category: 'letter-recognize' },
      { label: 'Letter sounds (phonics)',     category: 'letter-sound' },
      { label: 'Letter formation (tracing)',  category: 'letter-trace' },
      { label: 'First-sound identification',  category: 'first-sound' },
      { label: 'Rhyming',                     category: 'rhyme' },
      { label: 'Blending sounds into words',  category: 'blend' },
      { label: 'Sight words',                 category: 'sight-word' },
      { label: 'Reading short books',         category: 'reading' }
    ]
  },
  {
    id:  'quant-space',
    no:  'Antall, rom og form',
    en:  'Quantity, Space & Shape',
    emoji: '🔢',
    intro: 'Numbers, counting, shapes, and patterns.',
    groups: [
      { label: 'Number recognition',          category: 'number-recognize' },
      { label: 'Number formation (tracing)',  category: 'number-trace' },
      { label: 'Counting (1-to-1)',           category: 'count' },
      { label: 'Shapes',                      category: 'shape' },
      { label: 'Patterns',                    category: 'pattern' },
      { label: 'Addition (within 10)',        category: 'addition' },
      { label: 'Subtraction (within 8)',      category: 'subtraction' },
      { label: 'Time of day',                 category: 'time' }
    ]
  },
  {
    id:  'art-creative',
    no:  'Kunst, kultur og kreativitet',
    en:  'Art, Culture & Creativity',
    emoji: '🎨',
    intro: 'Colors and creative exploration.',
    groups: [
      { label: 'Colors',                      category: 'color' }
    ]
  },
  {
    id:  'nature',
    no:  'Natur, miljø og teknologi',
    en:  'Nature, Environment & Technology',
    emoji: '🌳',
    intro: 'Animals and habitats; a peek at the natural world.',
    groups: [
      { label: 'Animals & their habitats',    category: 'animal' }
    ]
  },
  {
    id:  'body-health',
    no:  'Kropp, bevegelse, mat og helse',
    en:  'Body, Movement, Food & Health',
    emoji: '👃',
    intro: 'Naming parts of the body. (Real movement happens off-screen.)',
    groups: [
      { label: 'Body parts',                  category: 'body' }
    ]
  },
  {
    id:  'ethics',
    no:  'Etikk, religion og filosofi',
    en:  'Ethics, Feelings & Philosophy',
    emoji: '😀',
    intro: 'Recognizing and naming emotions — the start of self-regulation.',
    groups: [
      { label: 'Feelings & emotions',         category: 'feeling' }
    ]
  },
  {
    id:  'community',
    no:  'Nærmiljø og samfunn',
    en:  'Local Community & Society',
    emoji: '👩‍⚕️',
    intro: 'Who does what in our community.',
    groups: [
      { label: 'Community helpers',           category: 'helper' }
    ]
  }
];

/* Helpers for the area dashboard */
function skillsInCategory(category) {
  return SKILLS.filter((s) => s.category === category);
}
function computeAreaProgress(area, profile) {
  let total = 0, available = 0, mastered = 0, practiced = 0;
  area.groups.forEach((g) => {
    const skills = skillsInCategory(g.category);
    total += skills.length;
    skills.forEach((s) => {
      if (isSkillAvailable(s, profile, { relaxPrereqs: true })) {
        available++;
        if (isSkillMastered(s, profile)) mastered++;
        else if (getSkillProgress(s, profile).successes > 0) practiced++;
      }
    });
  });
  return { total, available, mastered, practiced };
}
function computeCategoryProgress(category, profile) {
  const skills = skillsInCategory(category);
  let total = skills.length, available = 0, mastered = 0, practiced = 0;
  const dots = [];
  skills.forEach((s) => {
    const isAvail = isSkillAvailable(s, profile, { relaxPrereqs: true });
    const p = getSkillProgress(s, profile);
    if (isAvail) available++;
    if (isSkillMastered(s, profile)) { mastered++; dots.push('full'); }
    else if (p.successes > 0)         { practiced++; dots.push('half'); }
    else if (isAvail)                  dots.push('empty');
    else                                dots.push('locked');
  });
  return { total, available, mastered, practiced, dots };
}

/* ============================================================
   v3 — mastery decay (forgetting curve)
   A skill is "fading" if it was mastered, but hasn't been seen
   for FADE_DAYS days. The picker up-weights fading skills so they
   resurface for practice instead of being marked mastered forever.
   ============================================================ */
const FADE_DAYS = 30;

function isSkillFading(skill, profile) {
  if (!skill) return false;
  const p = getSkillProgress(skill, profile);
  if (!p.lastSeen) return false;
  if (!isSkillMastered(skill, profile)) return false;
  const daysSince = (Date.now() - p.lastSeen) / 86400000;
  return daysSince >= FADE_DAYS;
}

/* ============================================================
   v3 — standards grouping
   ============================================================ */
function groupSkillsByStandard() {
  const map = {};
  SKILLS.forEach((s) => {
    (s.standards || []).forEach((code) => {
      (map[code] ||= []).push(s);
    });
  });
  return map;
}

function getStandardProgress(code, profile) {
  const skills = SKILLS.filter((s) => (s.standards || []).includes(code));
  const available = skills.filter((s) => isSkillAvailable(s, profile, { relaxPrereqs: true }));
  const mastered = available.filter((s) => isSkillMastered(s, profile));
  const fading = available.filter((s) => isSkillFading(s, profile));
  return {
    code,
    description: STANDARDS_REFERENCE[code] || code,
    total: skills.length,
    available: available.length,
    mastered: mastered.length,
    fading: fading.length,
    ratio: available.length ? mastered.length / available.length : 0
  };
}
