/* ============================================================
   Offline Extensions — v7.1
   ============================================================
   Per-category 'try this with your kid away from the screen'
   prompts. Surfaced two places:

     1. After the session-cap break modal — gives the parent a
        specific embodied / outdoor / pencil-and-paper bridge
        instead of just 'time for a break'.
     2. Inside the parent dashboard 'Observe today' tab as a
        bottom-of-card suggestion.

   The starter calls these offlineExtension. We call them
   AwayFromScreen — same idea. Rammeplan-aligned: screen time
   should support, not replace, embodied learning.

   Public API (window.OfflineExtensions):
     forCategory(cat)     → string | null
     forSkillId(skillId)  → string | null
     pickForToday(cats)   → one rotating prompt from today's
                            played categories
   ============================================================ */
(function (global) {
  'use strict';

  const EXT = {
    'letter-recognize':       "Find three of the letters your child played with today in real life — signs, food labels, books.",
    'letter-sound':           "Pick one sound today and make a list (in your head) of objects in the room that start with it.",
    'letter-trace':           "Trace the letters on a steamy bathroom mirror, in sand, or with chalk outside.",
    'letter-word':            "Look at picture books together and let your child point to objects on each page.",
    'number-recognize':       "Look for numbers on doors, license plates, clocks — let your child point them out.",
    'number-trace':           "Try drawing numbers in flour, sand, or shaving cream.",
    'count':                  "Count things together while doing something else — stairs you climb, peas on the plate, steps to the door.",
    'phoneme-rhyme':          "Make up silly rhyming pairs while walking somewhere together.",
    'phoneme-first':          "Play 'I spy' but with first sounds: 'I spy something that starts with /sss/.'",
    'phoneme-blend':          "Stretch a word slowly — c... a... t — and ask your child to put it together.",
    'sight-word':             "Read a short book together. Let your child spot any sight words they recognize on the page.",
    'math-+':                 "Bake or cook together — adding ingredients is real math.",
    'math--':                 "Eat something with countable pieces (grapes, blueberries) and notice how many are left after each one.",
    'math-measure':           "Compare two things at home today — which is longer, heavier, taller?",
    'math-spatial':           "Hide a small toy and give location clues: 'under the chair', 'beside the lamp'.",
    'shape':                  "Go on a shape hunt around the house — point out circles, squares, triangles.",
    'color':                  "Pick a color of the day. Notice it everywhere you go.",
    'feeling':                "When your child has a big feeling today, name it together: 'I see you're feeling ___'.",
    'body':                   "During a bath, name body parts together as you wash.",
    'animal':                 "Visit an outdoor space and notice what animals live there. Listen, don't just look.",
    'helper':                 "Notice the helpers in your day together — bus driver, cashier, teacher. Say thanks.",
    'health-food-sort':       "Let your child help sort the groceries when you get home.",
    'nature':                 "Take a 'noticing walk' — three minutes, no destination, just notice things.",
    'society-family':         "Look at family photos together and let your child name everyone they know.",
    'society-routine':        "Tell your child what's happening next, every time. Predictable routines build trust.",
    'ethics-empathy':         "When you see someone being kind today, point it out: 'Did you see what they did?'",
    'ethics-gratitude':       "At dinner or bedtime, name one thing each that you're grateful for.",
    'ef-working-memory':      "Give your child a 3-step task: 'Find your shoes, put them on, then come get me.'",
    'ef-response-inhibition': "Play 'red light, green light' or 'Simon says' — both train waiting.",
    'ef-cognitive-flexibility': "Change a small routine on purpose today. Talk about how it feels.",
    'ef-sustained-attention': "Sit with your child while they build something for as long as they're interested.",
    'ef-metacognition':       "After any activity today, ask: 'How did that feel? What was easy? What was tricky?'",
    'ef-emotional-regulation':"Practice three slow breaths together when nothing's wrong, so the skill is there when something is.",
    'ef-body-movement':       "Dance together to one favorite song.",
    'arts-drawing':           "Draw something side-by-side, then trade and add to each other's pictures.",
    'arts-rhythm':            "Make a song with pots and pans for one minute. Loud is allowed."
  };

  function forCategory(cat) {
    return EXT[cat] || null;
  }

  function forSkillId(skillId) {
    if (!skillId || typeof Reflective === 'undefined') return null;
    const cat = Reflective.categoryOf(skillId);
    return cat ? forCategory(cat) : null;
  }

  /* Pick one extension to surface — randomly from today's played
     categories, with anti-repeat across same-day calls. */
  let lastPickedCat = null;
  function pickForToday(cats) {
    if (!Array.isArray(cats) || !cats.length) {
      // Fallback: a generic extension that always applies
      return "Take three minutes outside together. No goal. Just notice.";
    }
    const fresh = cats.filter((c) => c !== lastPickedCat);
    const pool = fresh.length ? fresh : cats;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    lastPickedCat = pick;
    return forCategory(pick) || pickForToday(cats.filter((c) => c !== pick));
  }

  global.OfflineExtensions = { forCategory, forSkillId, pickForToday };
})(window);
