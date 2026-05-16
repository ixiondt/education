/* ============================================================
   Observation Prompts — v7.1
   ============================================================
   Mirrors the rammeplan-kids-app-starter's observationPrompts
   model. Parent-facing questions to think about / discuss with
   the kid based on what they played today.

   Surfaces in the Parent Dashboard (dashboard.js) under a new
   'Observe today' tab. Each prompt category corresponds to a
   skill category the kid touched in the last 24h.

   The tone is the starter's exactly: noticing language, never
   ranking. "Did your child imitate sounds?" — not "How many
   sounds did they get right?"

   Public API (window.Observations):
     forCategories(cats)  → array of relevant prompts for the
                            categories the kid played today
     all()                → full bank (used by future Norwegian
                            translation flow)
   ============================================================ */
(function (global) {
  'use strict';

  const PROMPTS = {
    'letter-recognize': [
      "Which letters did your child gravitate toward today?",
      "Have you noticed your child pointing out letters in everyday signs or labels?",
      "Did your child invent any letter shapes with their body or fingers?"
    ],
    'letter-sound': [
      "Does your child connect a sound to a specific letter when you say a word?",
      "Has your child started to 'sound out' words they see?"
    ],
    'letter-trace': [
      "Does your child want to copy letters with a pencil, finger, or stick outside?",
      "Which letters does your child trace most confidently?"
    ],
    'number-recognize': [
      "Does your child point out numbers on clocks, doors, or signs?",
      "When you ask 'how old are you?', what does your child show?"
    ],
    'count': [
      "Can your child count along with you up to ten? Higher?",
      "Does your child notice when there are 'too many' or 'not enough' of something?",
      "What does your child like to count outside?"
    ],
    'phoneme-rhyme': [
      "Does your child make up silly rhyming words?",
      "When you read a rhyming book, does your child finish the line?"
    ],
    'phoneme-first': [
      "Does your child notice the first letter of their own name in things around them?"
    ],
    'phoneme-blend': [
      "Can your child put two sounds together to guess a word?"
    ],
    'sight-word': [
      "Has your child recognized any small written words in the wild yet?"
    ],
    'math-+': [
      "Does your child solve small 'how many altogether?' problems in play?"
    ],
    'math--': [
      "When you take a thing away, does your child notice it's gone?"
    ],
    'math-measure': [
      "Does your child use comparison words — bigger, longer, heavier — on their own?"
    ],
    'math-spatial': [
      "Does your child use direction words — over, under, beside — in conversation?"
    ],
    'shape': [
      "What shapes does your child point out in the world?"
    ],
    'color': [
      "Which color does your child seek out most often?",
      "Does your child describe things by their color when telling a story?"
    ],
    'feeling': [
      "When your child is upset, can they name the feeling — or do you still help them name it?",
      "What helps your child come back from a big feeling?"
    ],
    'body': [
      "Does your child name body parts when getting dressed or hurt?"
    ],
    'animal': [
      "What animals has your child shown sustained interest in?",
      "Does your child invent stories about animals?"
    ],
    'helper': [
      "Who does your child consider a 'helper' in their own life?"
    ],
    'health-food-sort': [
      "Does your child have words for 'everyday foods' vs. 'sometimes foods'?",
      "Does your child want to help in the kitchen?"
    ],
    'nature': [
      "Does your child notice changes in the weather without prompting?",
      "Does your child sort things at home — recycling, toys by type, dishes?"
    ],
    'society-family': [
      "When your child describes their family, who do they include?"
    ],
    'society-routine': [
      "Which part of the daily routine does your child anticipate most?",
      "Does the predictable sequence of the day help your child settle?"
    ],
    'ethics-empathy': [
      "Has your child noticed when someone needs help and offered any kind of response?",
      "How does your child respond when a friend is sad?"
    ],
    'ethics-gratitude': [
      "Does your child name what they're thankful for without prompting?"
    ],
    'ef-working-memory': [
      "Can your child follow a 2-step instruction without reminders? A 3-step one?"
    ],
    'ef-response-inhibition': [
      "When excited, can your child still wait their turn?"
    ],
    'ef-cognitive-flexibility': [
      "When plans change, how does your child adjust?"
    ],
    'ef-sustained-attention': [
      "How long can your child stay with a quiet activity (puzzle, drawing, book) right now?"
    ],
    'ef-metacognition': [
      "Does your child name when something is too easy, too hard, or 'just right'?"
    ],
    'ef-emotional-regulation': [
      "What strategies has your child started using on their own when overwhelmed?"
    ],
    'ef-body-movement': [
      "Which kinds of movement help your child feel best?"
    ],
    'arts-drawing': [
      "What does your child draw most often — and what do they tell you about it?"
    ],
    'arts-rhythm': [
      "Does your child make up songs or beats during the day?"
    ]
  };

  function forCategories(cats) {
    if (!Array.isArray(cats)) return [];
    const out = [];
    const seen = new Set();
    for (const cat of cats) {
      const list = PROMPTS[cat];
      if (!list) continue;
      for (const p of list) {
        if (!seen.has(p)) { seen.add(p); out.push({ category: cat, prompt: p }); }
      }
    }
    return out;
  }

  function all() { return PROMPTS; }

  global.Observations = { forCategories, all };
})(window);
