# Codebase audit — v5.31

Structured pass after the 7 Rammeplan content sessions (v5.18 → v5.30).
Goal: catch orphans, bugs, dead code, inconsistencies before the
documentation refresh.

## Inventory

| File | Lines |
|---|---|
| `index.html` | 1,411 |
| `app.js` | 5,041 |
| `styles.css` | 4,412 |
| `curriculum.js` | 1,048 |
| `letters.js` | 579 |
| `world.js` | 274 |
| `journal.js` | 258 |
| `i18n.js` | 92 |
| `sw.js` | 142 |
| `game-engine.js` | 660 |
| `game-*.js` (17 mode files) | ~3,400 |
| **Total** | **~19,600** |

## Static checks — all green

| Check | Status |
|---|---|
| All JS files parse (Node `--check`) | ✅ 27/27 |
| YAML workflows parse | ✅ both deploy-*.yml |
| Python `generate-voices.py` parses | ✅ |
| Every `data-mode="X"` in HTML has a `case 'X':` in `app.js` | ✅ 44/44 modes |
| Every `id="screen-X"` in HTML has an `el.screens.X` entry | ✅ 49/49 screens |
| Every game module exports matching `start* + stop*` | ✅ 21 pairs |
| Every `start*()` has a corresponding `stop*()` call in `goHome()` | ✅ 20+ teardowns |
| No syntax errors, no orphan references, no dead switch cases | ✅ |

## Architecture observations

1. **Mode count up 105% from baseline.** v5.15 had ~21 modes; v5.30 has 44.
   The flat `el.screens` map + switch-case dispatch in `app.js`
   handles this scale fine for now, but at 60+ modes I'd want to
   convert to a registry (`MODES = { 'find-letters': { screen, start, stop } }`)
   to remove the boilerplate. Track this for v6.

2. **MODE_AREAS now spans 8 areas** (language / math / selfWorld /
   ef / arts / ethics / nature / society). The daily-session
   builder iterates all of them and picks one mode per area —
   this is correct Rammeplan-aligned behavior (breadth before
   depth). However the **dashboard "By Rammeplan area" view**
   was originally written for 3 areas — should re-check it
   surfaces the new 5 cleanly. *(Carried into v5.32 docs pass.)*

3. **Speech single-source-of-truth (v5.23) is consistently used.**
   Only one `VoiceEngine.speak` call remains in any game module —
   the `defaultSpeak` fallback inside `game-letter-lander.js`,
   which is only reached if the host forgets to wire `opts.speak`.
   Every active mode goes through `Speech.phrase(key, fallback)`.

4. **Curriculum-aware modes vs. content-only modes.**
   Curriculum-aware (records into `recordAttempt`):
   `find-*`, `trace-*`, `count`, `sounds`, `first-sound`, `rhyme`,
   `blend`, `sight-words`, `addition`, `subtraction`,
   `time-of-day`, `letter-lander`, `number-lander`, `number-blaster`,
   `feelings`, `body`, `shapes`, `colors`, `patterns`, `animals`,
   `helpers`, `tap`.
   Content-only (synthetic skill IDs):
   `sequence-star`, `stop-go`, `launch-pad`, `switch-it`,
   `stargazer`, `reflect`, `move-with-me`, `food-sort`, `draw`,
   `rhythm`, `empathy`, `gratitude`, `weather`, `sort-it-out`,
   `measure`, `where-is-it`, `family`, `routines`.
   Both paths flow through the same `recordAttempt()` so the parent
   dashboard sees them uniformly.

## Bugs found + fixed in this audit

1. **No bugs blocking correct behavior.** Every mode reachable
   from the home screen launches, plays, records skill events,
   and teardown-closes cleanly.

## Minor improvements deferred (low-risk)

These are notes for future sessions, not blockers:

- **`PHRASES` bank in `app.js`** (line ~1095) is still dead code
  from pre-v5.13. Could be removed for cleanliness, but the data
  might inform future cheer-MP3 generation, so leaving it.
- **`game-letter-lander.js`'s `defaultSpeak`** could route through
  `Speech.cheer` when present (`Speech.cheer = (text) => VoiceEngine.speak([text])`,
  same outcome but consistent). Not a behavior fix — purely style.
- **i18n string bundle is sparse** — only 11 keys per locale.
  When the Norsk pack ships and the parent flips to Norsk, only
  the home headings + a few prompts translate. Most game text
  stays in English. This is intentional for v5.30 (foundation
  shipped, content fills in incrementally), but worth noting in
  the README so users aren't surprised.
- **DOM-form modes don't have keyboard shortcuts.** Tab-navigable
  but no "1/2/3 for choice" hotkeys. Could matter for accessibility
  on Chromebooks in classrooms. Defer until that's an actual user.

## v5.31 closes with…

No code changes — this audit just documents the state. The next
commit (v5.32) refreshes README / ROADMAP / PEDAGOGY to reflect
v5.18→v5.30 reality.
