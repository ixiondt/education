# Letters & Numbers

An early-childhood educational platform for ages 2–6, grounded in the **Norwegian Rammeplan** approach to pre-school education. Play-based, child-led, and explicitly designed to avoid the anxiety-inducing patterns of conventional "drill the alphabet" apps.

**This is not a game with educational packaging — it is an educational tool that happens to look like a game.** Every design choice is rooted in early-childhood pedagogical research. The full philosophy and academic basis are documented in [PEDAGOGY.md](PEDAGOGY.md). Read that first if you want to understand *why* the app behaves the way it does.

The full architecture roadmap from current v3.3 → v5 (cross-device sync on a self-hosted backend) is in [ROADMAP.md](ROADMAP.md).

---

## The educational stance — short version

This app is built on the [Norwegian Framework Plan for Kindergartens](https://www.udir.no/contentassets/7c4387bb50314f33b828789ed767329e/framework-plan-for-kindergartens--rammeplan-engelsk-pdf.pdf), Udir's national framework for early-childhood education in Norway. Four pillars guide every design choice:

- **Care (omsorg)** — emotional safety first; no anxiety-inducing UI
- **Play (lek)** — play is *the* learning mode, not a reward for finishing work
- **Learning (læring)** — emerges through play and care, not as drilled activity
- **Cultivation (danning)** — the holistic formation of a whole person, including curiosity and agency

It is **standards-aligned** with four international curricula simultaneously: Norwegian Rammeplan, EU Quality Framework for ECEC, US CCSS-K, and US NAEYC ELOF. Every activity carries codes from all four so progress is legible to caregivers and educators across systems.

It **deliberately refuses** what the Rammeplan and contemporary early-childhood research consistently warn against:

- ❌ Standardized testing for under-6s
- ❌ Leaderboards, badges, "level up" effects, or extrinsic-reward gimmicks
- ❌ Punishing streaks ("you broke your streak!")
- ❌ Comparison to other children or developmental timelines
- ❌ Formal reading instruction (a Grade 1 task)
- ❌ Performance anxiety as a teaching tool

---

## Six structured activities + one free-play space

| Activity | What it teaches | Rammeplan area | Min. age |
|---|---|---|---|
| **Find Letters** | Letter recognition (visual ↔ name) | Communication, Language & Text | ~2.5y |
| **Find Numbers** | Numeral recognition | Quantities, Spaces & Shapes | ~2.5y |
| **Sounds** | Letter-sound correspondence (phonics) via pictures | Communication, Language & Text | ~3y |
| **Trace Letters** | Letter formation, fine motor | Communication, Language & Text + emergent writing | ~3.5y |
| **Trace Numbers** | Numeral formation, fine motor | Quantities, Spaces & Shapes | ~3.5y |
| **Count** | Quantity ↔ numeral correspondence | Quantities, Spaces & Shapes | ~3y |
| **🎨 Free play** | Non-evaluative exploration | Child agency principle (Rammeplan Section 5) | All ages |

Free play deliberately has **no targets, no judgment, no progress recording, no break suggestions** — children tap anything they're drawn to, hear its name, and move on. This honors the Rammeplan's foundational principle that children are competent agentic learners who explore on their own initiative.

---

## Profiles, age-awareness, and adaptive picker

The app stores **multiple child profiles** locally (no accounts, no servers, fully offline). Each profile records age and progress separately. Per-profile settings include theme, voice, sensory mode, letter case preference.

The activity picker is **age-gated** (letter sounds appear at 3y, tracing at 3.5y), **prerequisite-aware** (letter sounds unlock after recognition becomes confident), and **interest-aware** (letters and numbers a child shows curiosity about appear more often). A child who taps "L" in Free play repeatedly will see L surface more in other activities — because that's where her interest is.

Mastery is tracked but **never shown to the child during play**. Stars, percentages, and the standards-aligned dashboard are parent-facing only, and even there the language deliberately uses Norwegian framings: "Confident" (not "Mastered"), "Exploring" (not "Practicing"), "Hasn't met yet" (not "Failed").

---

## Voice — your own, not robotic

The app uses on-device text-to-speech by default and aggressively picks the least-robotic voice available (Microsoft Aria/Jenny, Apple Samantha/Karen, Google US English when present; the older Microsoft David/Zira engines are scored down).

Better: open Settings → 🎙 **Record your voice**, record letters/sounds/words in your own voice. Recordings live in IndexedDB on the device. The speech priority chain becomes:

1. **Your recording** (instant, offline, your voice)
2. MP3 file drop-in *(only if customAudio = auto — advanced opt-in)*
3. Synthetic TTS fallback

Recording 89 clips (26 letter names + 26 sounds + 26 picture-words + 11 numbers) takes about 10 minutes and replaces all TTS forever for that device. Kids learn from familiar voices.

---

## Privacy, hosting, and the v5 backend plan

- **No accounts. No servers. No analytics. No telemetry. No ads.**
- All data — profile, progress, voice recordings — stays in `localStorage` and `IndexedDB` on the device.
- No external network requests after first load. The service worker caches the app shell for full offline operation.

When (and only when) cross-device sync becomes a need, v5 deploys as another tenant on the existing GuardCyber droplet at `letters.guardcybersolutionsllc.com`. The infrastructure plan is fully detailed in `ROADMAP.md`. Marginal monthly cost: ~$0 (reuse of existing droplet) plus optionally $10/yr for a dedicated domain later.

---

## How the app is structured

```
/
├── PEDAGOGY.md                 # the educational philosophy (read this first)
├── ROADMAP.md                  # phased plan v1 → v5 with hosting details
├── README.md                   # this file
├── index.html                  # app shell — welcome, home, play screens, modals
├── styles.css                  # theme (calm + bright), layout, motion
├── app.js                      # main logic: profiles, modes, voice, tracer, recording, PWA
├── curriculum.js               # skill graph: ~120 skills across 4 international frameworks
├── letters.js                  # static data: stroke paths, phonics, picture-words
├── manifest.webmanifest        # PWA install metadata
├── sw.js                       # service worker (offline cache, versioned)
├── icons/                      # PWA icons (SVG primary, PNG via tools/make-icons.html)
└── tools/make-icons.html       # one-shot tool to render PNGs from SVG for iOS
```

---

## Getting started

This is a **zero-build, vanilla** PWA. No transpilation, no bundler, no npm dependencies at runtime. Source files are served directly.

### Local development

Any static file server works. Three convenient options:

```bash
# Option A — npm script (preferred — no install, uses npx)
npm run dev               # http://localhost:8000 via `npx serve`

# Option B — Python (zero install, always available)
npm run dev:python        # http://localhost:8000 via Python's http.server

# Option C — Caddy local (best DX if you have Caddy installed)
npm run dev:caddy         # http://localhost:8000 via Caddy file-server
```

The service worker is **automatically skipped on `localhost`** so iteration is fast. To test the SW + PWA install behavior locally, add `?sw=1` to the URL.

Chrome treats `http://localhost` as a secure origin for SW / PWA purposes, so HTTPS is not required locally.

### Production deployment

Production is **Caddy serving static files** on the existing GuardCyber droplet — no Node runtime, no container, same pattern as the Dark Moon Security tenant documented in `~/Nextcloud/Projects/GuardCyber/README.md`. The marginal cost is **$0** (reuse of existing infrastructure) plus $10/year if/when a dedicated domain replaces the subdomain.

Tenant allocation (already chosen, see `ROADMAP.md`):

| Item | Value |
|---|---|
| Domain | `letters.guardcybersolutionsllc.com` |
| Droplet | `192.241.132.219` (DigitalOcean NYC1, existing) |
| App directory | `/opt/apps/letters-and-numbers/` |
| OS user | `lnum-deploy` (chmod 755, owned by tenant) |
| Web server | Caddy (existing instance, multi-tenant Caddyfile) |
| TLS | Cloudflare Full Strict + Caddy auto-Let's-Encrypt |

**One-time droplet setup** (run on the droplet as the `deploy` user):

```bash
# Create the tenant user
sudo useradd -r -m -s /bin/bash lnum-deploy
sudo loginctl enable-linger lnum-deploy

# Create the app directory
sudo mkdir -p /opt/apps/letters-and-numbers
sudo chown lnum-deploy:lnum-deploy /opt/apps/letters-and-numbers
sudo chmod 755 /opt/apps/letters-and-numbers

# Append the Caddy block from caddy-letters.conf to the shared Caddyfile
sudo nano /opt/apps/shared/caddy/Caddyfile
# (paste contents of caddy-letters.conf)
sudo systemctl reload caddy

# DNS — in Cloudflare, add an A record:
#   letters.guardcybersolutionsllc.com → 192.241.132.219 (Proxied / orange cloud)
# Set SSL/TLS to Full (Strict).
```

**Recurring deploy** (run from your laptop, every release):

```bash
npm run deploy
# Or directly:
bash scripts/deploy.sh

# Dry-run first if you want to see what changes:
DRY_RUN=1 bash scripts/deploy.sh
```

The deploy script:
1. Verifies you're at project root (sanity check)
2. Echoes the `sw.js` version it's about to ship
3. `rsync`s files to a staging area on the droplet
4. `sudo rsync`s into `/opt/apps/letters-and-numbers/` (owned by `lnum-deploy`)
5. Reloads Caddy
6. Curls the live URL and confirms it serves 200 + matches the local SW version

For the rsync exclude list and staging conventions, see `scripts/deploy.sh`. The Caddy config (security headers, CSP, cache policy) is in `caddy-letters.conf`.

### Why no build step?

Vanilla HTML/CSS/JS works fine for this app's size (~130 KB raw, ~35 KB gzipped). A bundler (Vite, Rollup, etc.) would buy you tree-shaking and minification, but:

- **Caddy already does gzip + zstd compression**, capturing most of the size win.
- The PWA caches the shell after first load — repeat visits are 0-byte network anyway.
- A build step would just produce a `dist/` folder that Caddy serves the same way it serves the source.
- Vanilla means **zero supply-chain surface**: no `node_modules`, no transitive deps, no `npm audit` to maintain.

A build step is reserved for v5+ when one of these is needed:
- TypeScript (the app is getting large enough that types would pay back)
- Tailwind v4 (would compile to a single CSS file)
- Importing npm libraries the code can't ship raw (e.g., Drizzle, Auth.js once the backend lands)

When that happens, the production serve still goes through Caddy — only the dev/build pipeline changes.

---

## Settings overview (parent-gated)

The settings panel sits behind a "tap the 7" challenge — easy for an adult, hard for a 3-year-old. From there:

| Setting | Default | What it does |
|---|---|---|
| Letter speech | Both | Speak letter name, sound, or both ("A… ah") |
| Letter case | ABC | Upper / lower / mixed in Find and Sounds |
| Theme | Calm | Muted Montessori palette, or Bright |
| Number of choices | 3 | 2 / 3 / 4 — lower = easier; 2 is sensory-friendly |
| Sensory mode | Normal | "Calm" reduces sparkle density and shortens break window |
| Voice | Auto | Pick a specific OS voice; the picker scores neural voices higher |
| Skill prerequisites | Strict | Strict respects the curriculum order; Relaxed lets everything appear |
| Custom audio | Off | Advanced opt-in to use MP3 files in `audio/` instead of TTS |
| **🎙 Record your voice** | — | Record letters / sounds / words / numbers in your own voice |
| **View progress** | — | Parent dashboard: skills, standards (CCSS / NAEYC / EU / Rammeplan), play days, export |
| **About our approach** | — | Brief in-app summary of the Norwegian educational stance |

---

## What's next

See [ROADMAP.md](ROADMAP.md) for the full plan.

**v4** content expansion: lowercase tracing (52 new path definitions + 52 new skills), phonemic awareness (rhyming, first-sound isolation, blending), Dolch sight words, stroke-order animations.

**v5** backend: cross-device sync, parent web dashboard accessible separately from the kid's device, optionally a teacher/family-account model. Deploys as another tenant on the existing GuardCyber droplet — see ROADMAP.

---

## References

The pedagogical and standards basis is documented in detail in [PEDAGOGY.md](PEDAGOGY.md). Primary sources:

- [Norwegian Rammeplan for barnehagens (English)](https://www.udir.no/contentassets/7c4387bb50314f33b828789ed767329e/framework-plan-for-kindergartens--rammeplan-engelsk-pdf.pdf)
- [EU Quality Framework for ECEC (Council of EU, 2019)](https://www.earlychildhoodireland.ie/wp-content/uploads/2024/02/Explainers_EUQualityFramework.pdf)
- [European Commission — About ECEC](https://education.ec.europa.eu/education-levels/early-childhood-education-and-care/about-early-childhood-education-and-care)
- Alvestad — [Norwegian Preschool Teachers' Thoughts on Curriculum Planning](https://ecrp.illinois.edu/v1n2/alvestad.html)
- NAEYC Early Learning Outcomes Framework
- CCSS for English Language Arts and Mathematics (NGA Center & CCSSO, 2010)
