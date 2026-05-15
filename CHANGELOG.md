# Changelog

A condensed timeline of what landed when. For the deeper "why," see [PEDAGOGY.md](PEDAGOGY.md) and [ROADMAP.md](ROADMAP.md).

## v5.32 — Documentation refresh · 2026-05-15
- README structure tree + "What's next" updated to reflect v5.16→v5.31
- ROADMAP status table extended with every shipped version
- PEDAGOGY adds *Scattered to Focused* + *Smart but Scattered* + *Finally Focused* as ADHD-design references
- New `CHANGELOG.md` (this file)

## v5.31 — Codebase audit · 2026-05-15
- `docs/AUDIT-v5.31.md` — structured static-check pass
- 27/27 JS files parse, 44/44 mode bindings, 49/49 screen bindings, 21 game start/stop pairs
- No bugs found; three low-risk style notes deferred

## v5.24–v5.30 — Rammeplan depth pass (one session per area) · 2026-05-15
- 🤸 Move with me + 🍎 Food sort (area 2)
- 🎨 Draw + 🥁 Rhythm (area 3)
- ❤️ Kind choices + 🙏 Thankful (area 6)
- 🌦️ Today's weather + ♻️ Sort it out (area 4)
- 📏 Measure + 🧭 Where is it? (area 5)
- 🏠 My family + 🗓 Daily routines (area 7)
- Norwegian language toggle + Norsk pack scaffolding (area 1+G)

## v5.23 — Game tuning + Speech single-source-of-truth · 2026-05-15
- Eased six games per playtest feedback (sequence length, ratios, fall speeds, timing)
- `window.Speech.{letter, number, word, phrase, concept, cheer, stop}` API
- All game modules route through `Speech.phrase(key, fallback)`
- 15 new game-phrase MP3 keys queued in `scripts/generate-voices.py`

## v5.18–v5.22 — ADHD-aware expansion · 2026-05-15
- 🌟 Sequence Star (working memory)
- 🚦 Stop & Go (response inhibition)
- 🚀 Launch Pad (task initiation)
- 🔀 Switch It (cognitive flexibility)
- 🔭 Stargazer (sustained attention)
- 💭 Reflect (metacognition)
- 📔 Parent Observation Journal (Finally Focused) — 7/30-day views, CSV/PDF export
- Calm Corner expansion — breathing patterns + body scan + feelings thermometer
- Pre-session check-in + body-break prompts

## v5.16–v5.17 — Educational video-game modes · 2026-05-15
- Shared `game-engine.js` (canvas + rAF + entity system + procedural SFX)
- 🐰 Letter Lander (calm-arcade, ages 4-6)
- 🦊 Number Lander (variant of above)
- 🚀 Number Blaster (full arcade Math Blaster homage with score/lives/levels/DDA, ages 7-10)

## v5.11–v5.15 — CI auto-deploy + voice overhaul · 2026-05-14
- GitHub Actions: `deploy-static.yml` + `deploy-api.yml` (build off-host → ghcr.io → droplet pull, Trivy blocking)
- `customAudio` default flipped 'off' → 'auto' (305-MP3 neural Aria pack now on by default)
- `LETTER_SOUNDS.S` `'sss'` → `'suh'`, `Z` `'zzz'` → `'zuh'` (consistent voiced-release cadence)
- `VoiceEngine.speakSequence` (replaces two ad-hoc TTS bypass loops)
- Robotic-voice banner on home (one-time dismissable)
- `voiceFingerprint` + `locale` profile fields
- "Record all in this tab" bulk-record button
- Speech-speed slider (Slow / Normal / Fast) in Settings
- Snappier post-correct transitions (~150ms, was ~2-3s)

## v5.0–v5.10 — Whole-child platform · 2026-05-14
- 7 new modes covering Rammeplan areas 2-7
- Parent activity cards, reading log
- Free Edge-TTS voice-pack script (`scripts/generate-voices.py`)
- Backend tenant: Next.js 16 + Drizzle + Postgres 16 + `/api/health` + `/api/sync/probe`

## v3–v4 — Standards dashboard + Bridge to reading · 2026-05-14
- Lowercase tracing (52 path definitions + 52 skills)
- Phonemic awareness (First sound, Rhyme, Blend)
- Dolch sight words + decodable reading books
- Arithmetic (addition, subtraction)
- Calm corner
- Rammeplan dashboard (parent view)
- Age bands 1–6

## v1–v2 — Foundation · 2026-05-14
- v1: Single-user offline PWA with 6 modes
- v2: Profiles + age-aware curriculum + NAEYC/CCSS skill mapping
