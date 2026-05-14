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
  'RAMMEPLAN-QUANT-1.1': 'Norwegian Rammeplan — Quantities, Spaces & Shapes: number recognition and written numeral familiarity',
  'RAMMEPLAN-QUANT-1.2': 'Norwegian Rammeplan — Quantities, Spaces & Shapes: counting and one-to-one correspondence with concrete objects',
  'RAMMEPLAN-PRINCIPLE-CHILD-AGENCY': 'Norwegian Rammeplan — Foundational principle: children are competent, agentic learners who explore on their own initiative'
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
    // Mastered skills get 0.2x to keep them in light rotation, but FADING skills
    // (mastered + >30 days untouched) get 1.5x so they resurface for refresh.
    const mastered = isSkillMastered(s, profile);
    const fading   = mastered && isSkillFading(s, profile);
    const masteryFactor = fading ? 1.5 : (mastered ? 0.2 : 1.0);
    /* Interest-aware picker (Rammeplan: children's interests drive content).
       Letters/numbers a child gravitates toward — in Free play or any mode —
       appear more often. Capped via sqrt so heavy interests don't dominate. */
    const interestLevel = interests[String(s.target).toUpperCase()] || 0;
    const interestFactor = 1 + Math.sqrt(interestLevel) / 4;
    return successFactor * recencyFactor * masteryFactor * interestFactor + 0.01;
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
