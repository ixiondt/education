/* ============================================================
   Reflective Responses — v7.1
   ============================================================
   Replaces the generic 'Yes!' chime pattern with character-aware,
   curiosity-opening responses inspired by the rammeplan-kids-app
   starter's choice.response model + Lingokids' per-tap character
   reactions.

   Goal: every tap is a CONVERSATION, not a verdict. Instead of
     "Yes!" / "Try again."
   the kid hears
     "You found Owl! What other quiet animals live in the forest?"

   How it works:
     - Reflective.maybeSay(skillId, success, opts) is called from
       app.js recordAttempt() after each tap
     - Cooldown: at most once every ~3 correct answers (we don't
       want to drown the kid in talking)
     - Bank is grouped by skill-category prefix (letter-recognize-X,
       count-N, math-+, ef-working-memory-*, etc.)
     - Lines support {target} substitution from the skillId tail
     - Voice routes through Speech.phrase if a key is provided,
       else Speech.cheer (TTS via picker — Aria if available)
     - Anti-repeat: never the same line twice in a row per category

   Public API (window.Reflective):
     maybeSay(skillId, success, opts)
       opts.target    — overrides target extraction from skillId
       opts.force     — bypass cooldown
       opts.character — prefix with character ("Bram: ...")
   ============================================================ */
(function (global) {
  'use strict';

  /* ===================  Banks  ===================
     Each entry: an array of templates. {target} is filled from the
     skillId's trailing segment (letter-recognize-A → 'A'). */

  const BANK_CORRECT = {
    'letter-recognize': [
      "{target}! What word starts with {target}?",
      "Yes — that's {target}. Can you draw {target} in the air?",
      "{target}! Where else have you seen this letter today?",
      "You found {target}! Try saying its sound.",
      "Nice! What animal name has a {target} in it?"
    ],
    'letter-sound': [
      "Yes! Can you say it three times fast?",
      "That sound! What word has it at the start?",
      "Great listening! Where else does that sound show up?"
    ],
    'letter-trace': [
      "Beautiful tracing! Try it with your finger in the air.",
      "Nice. Can you trace it bigger this time?"
    ],
    'letter-word': [
      "Yes — {target}! What sound does it start with?",
      "{target}! Have you seen a {target} today?"
    ],
    'number-recognize': [
      "{target}! Can you show me {target} fingers?",
      "Yes — {target}. What can you count up to {target} of in this room?",
      "Found {target}! What comes after {target}?"
    ],
    'number-trace': [
      "Nice tracing. Try it bigger next time!"
    ],
    'count': [
      "{target} things! Can you find {target} fingers? {target} toes?",
      "{target}! Slow counting helps your brain remember.",
      "Yes — {target}. What else comes in groups of {target}?"
    ],
    'phoneme-rhyme': [
      "Rhyming friends! What else rhymes with this?",
      "Yes! Rhyming makes a song in your mouth."
    ],
    'phoneme-first': [
      "First sound found! What other words start that way?",
      "Yes! Beginning sounds help us read."
    ],
    'phoneme-blend': [
      "You blended it! That's how reading works.",
      "Yes — try saying it slow, then fast."
    ],
    'sight-word': [
      "{target}! That word is everywhere in books.",
      "You read {target}! Let's find it in a real book today."
    ],
    'math-+': [
      "Yes! Adding makes bigger.",
      "Right! Can you add it with your fingers too?"
    ],
    'math--': [
      "Yes! Taking away makes smaller.",
      "Right! Subtracting is sharing in a way."
    ],
    'math-×': ["Yes! Multiplying is like fast adding."],
    'math-÷': ["Yes! Dividing is fair sharing."],
    'math-measure': [
      "You noticed the difference! Big and small are everywhere.",
      "Yes — comparing helps us understand size."
    ],
    'math-spatial': [
      "You found the spot! Where else is something hiding?",
      "Yes — words for places help us tell stories."
    ],
    'shape': [
      "That shape! Where do you see it in your room?"
    ],
    'color': [
      "{target}! Can you spot something else that's {target} right now?",
      "Yes — {target}. What's your favorite {target} thing?"
    ],
    'feeling': [
      "{target}! Have you felt {target} today?",
      "Yes — {target}. Where in your body do you feel {target}?"
    ],
    'body': [
      "Yes! Your body knows so much.",
      "Right! Bodies are amazing — they grow every day."
    ],
    'animal': [
      "Yes! What sound does it make?",
      "Right! Where does it live? What does it eat?"
    ],
    'helper': [
      "Yes! Helpers keep us safe.",
      "Right! Who is a helper in YOUR family?"
    ],
    'health-food-sort': [
      "Nice sorting! Food helps your body grow.",
      "Yes! Some foods give us a lot of energy, some are for treats."
    ],
    'nature': [
      "Yes! Earth needs careful hands.",
      "Right! Every small choice helps the planet."
    ],
    'society-family': ["Yes! Families come in all shapes."],
    'society-routine': ["Yes! Routines help our brains feel safe."],
    'ethics-empathy': [
      "That was a kind choice. How do you think they felt?",
      "Yes — being kind is a superpower."
    ],
    'ethics-gratitude': [
      "Noticing what we love is its own gift.",
      "Yes — gratitude makes the heart bigger."
    ],
    'ef-working-memory': [
      "Memory power! Your brain just stretched.",
      "Yes — remembering takes practice."
    ],
    'ef-response-inhibition': [
      "Good stopping! Slowing down is its own win.",
      "Yes — waiting is harder than going."
    ],
    'ef-cognitive-flexibility': [
      "Nice switching! Brains love new patterns."
    ],
    'ef-sustained-attention': [
      "You stayed with it! That's focus."
    ],
    'ef-metacognition': [
      "Noticing how you feel is its own skill."
    ],
    'ef-emotional-regulation': [
      "Good noticing your feelings."
    ],
    'ef-body-movement': [
      "Your body and your brain just thanked you!"
    ],
    'arts-drawing':  ["You made something just yours."],
    'arts-rhythm':   ["Music lives in your hands now."]
  };

  /* Reflective for MISSES — Lingokids does this beautifully. A wrong
     tap shouldn't shame; it should re-invite curiosity. */
  const BANK_MISS = {
    'letter-recognize': [
      "That's a different letter. Look at the shape again — which one curves like {target}?",
      "Almost! {target} has a special shape. Look once more."
    ],
    'number-recognize': [
      "Not quite — but a good guess. {target} looks different.",
      "Look again — {target} has its own shape."
    ],
    'count': [
      "Let's count one more time, slowly: one, two, three…"
    ],
    'feeling': [
      "Feelings can look alike! Try once more."
    ],
    'animal': [
      "Different animal! Listen again — what kind of place does it live in?"
    ],
    'color': [
      "Different color! Look at it again — what does {target} remind you of?"
    ],
    'shape': [
      "Different shape — try once more!"
    ]
  };

  /* ===================  Category resolver  ===================
     Mirrors api/src/app/api/dashboard/summary/route.ts skillCategory()
     so the categories match across client + server. */
  function categoryOf(skillId) {
    if (skillId.startsWith('letter-recognize')) return 'letter-recognize';
    if (skillId.startsWith('letter-sound'))     return 'letter-sound';
    if (skillId.startsWith('letter-trace'))     return 'letter-trace';
    if (skillId.startsWith('letter-word'))      return 'letter-word';
    if (skillId.startsWith('number-recognize')) return 'number-recognize';
    if (skillId.startsWith('number-trace'))     return 'number-trace';
    if (skillId.startsWith('count-'))           return 'count';
    if (skillId.startsWith('phoneme-rhyme'))    return 'phoneme-rhyme';
    if (skillId.startsWith('phoneme-first'))    return 'phoneme-first';
    if (skillId.startsWith('phoneme-blend'))    return 'phoneme-blend';
    if (skillId.startsWith('sight-'))           return 'sight-word';
    if (skillId.startsWith('math-+'))           return 'math-+';
    if (skillId.startsWith('math--'))           return 'math--';
    if (skillId.startsWith('math-×'))           return 'math-×';
    if (skillId.startsWith('math-÷'))           return 'math-÷';
    if (skillId.startsWith('math-measure'))     return 'math-measure';
    if (skillId.startsWith('math-spatial'))     return 'math-spatial';
    if (skillId.startsWith('shape'))            return 'shape';
    if (skillId.startsWith('color'))            return 'color';
    if (skillId.startsWith('feeling'))          return 'feeling';
    if (skillId.startsWith('body'))             return 'body';
    if (skillId.startsWith('animal'))           return 'animal';
    if (skillId.startsWith('helper'))           return 'helper';
    if (skillId.startsWith('health-food'))      return 'health-food-sort';
    if (skillId.startsWith('nature-'))          return 'nature';
    if (skillId.startsWith('society-family'))   return 'society-family';
    if (skillId.startsWith('society-routine'))  return 'society-routine';
    if (skillId.startsWith('ethics-empathy'))   return 'ethics-empathy';
    if (skillId.startsWith('ethics-gratitude')) return 'ethics-gratitude';
    if (skillId.startsWith('ef-working-memory'))      return 'ef-working-memory';
    if (skillId.startsWith('ef-response-inhibition')) return 'ef-response-inhibition';
    if (skillId.startsWith('ef-cognitive-flexibility')) return 'ef-cognitive-flexibility';
    if (skillId.startsWith('ef-sustained-attention')) return 'ef-sustained-attention';
    if (skillId.startsWith('ef-metacognition'))       return 'ef-metacognition';
    if (skillId.startsWith('ef-emotional-regulation')) return 'ef-emotional-regulation';
    if (skillId.startsWith('ef-body-movement'))       return 'ef-body-movement';
    if (skillId.startsWith('arts-drawing'))           return 'arts-drawing';
    if (skillId.startsWith('arts-rhythm'))            return 'arts-rhythm';
    return null;
  }

  function targetFromSkill(skillId) {
    const parts = skillId.split('-');
    const last = parts[parts.length - 1];
    return last || '';
  }

  /* ===================  Cooldown + anti-repeat  =================== */

  const COOLDOWN_MS = 8000;          // at most once per ~8s
  let lastSpokeAt = 0;
  const lastByCategory = new Map();  // category → last index used

  function pickLine(bank, category, target) {
    const lines = bank[category];
    if (!lines || !lines.length) return null;
    const lastIdx = lastByCategory.get(category) ?? -1;
    let idx;
    if (lines.length === 1) idx = 0;
    else {
      do { idx = Math.floor(Math.random() * lines.length); }
      while (idx === lastIdx);
    }
    lastByCategory.set(category, idx);
    return lines[idx].replace(/\{target\}/g, target);
  }

  /* ===================  Public API  =================== */

  function maybeSay(skillId, success, opts = {}) {
    if (!skillId) return false;
    const now = Date.now();
    if (!opts.force && now - lastSpokeAt < COOLDOWN_MS) return false;

    const category = categoryOf(skillId);
    if (!category) return false;
    const bank = success ? BANK_CORRECT : BANK_MISS;
    const target = opts.target || targetFromSkill(skillId);
    const line = pickLine(bank, category, target);
    if (!line) return false;

    lastSpokeAt = now;

    // Speak through the existing voice chain. No audio key yet —
    // we let TTS handle it, but the picker is calibrated to prefer
    // Aria. If a parent wants Aria-rendered reflective MP3s, the
    // lines are stable strings that can be queued in
    // scripts/generate-voices.py later.
    if (typeof Speech !== 'undefined' && Speech.cheer) {
      Speech.cheer(line);
    }
    return true;
  }

  function listAll() {
    /* Useful for parents who want to read the full bank, or for
       the future MP3 generation script. */
    return { correct: BANK_CORRECT, miss: BANK_MISS };
  }

  global.Reflective = { maybeSay, listAll, categoryOf };
})(window);
