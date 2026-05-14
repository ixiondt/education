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

## Privacy, hosting, and the v5 backend

- **No accounts. No servers. No analytics. No telemetry. No ads.**
- All data — profile, progress, voice recordings — stays in `localStorage` and `IndexedDB` on the device.
- The app remains **fully usable with the network off**. The service worker caches the app shell for full offline operation. Sync is strictly opt-in (off by default).

The v5 backend is **provisioned and reachable** as of 2026-05-14, but it is **dormant from the client's perspective**: no profile is auto-synced, no telemetry is captured, no PII leaves the device unless a parent explicitly opts in (planned for v5.2+ — magic-link based, no passwords).

Tenant allocation (live):

| Layer | Endpoint | Behavior |
|---|---|---|
| Static PWA | `https://letters.guardcybersolutionsllc.com/` | Caddy file-server (no upstream) |
| Backend API | `https://letters.guardcybersolutionsllc.com/api/*` | Next.js standalone, rootless Podman on 127.0.0.1:3013 |
| Health | `/api/health` | DB ping, returns `{status,db,dbLatencyMs}` |
| Probe | `/api/sync/probe` | Schema readiness check (lists table row counts) |

Marginal monthly cost: ~$0 (reuse of existing GuardCyber droplet) plus optionally $10/yr for a dedicated domain later.

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
├── curriculum.js               # skill graph: ~290 skills across 4 international frameworks
├── letters.js                  # static data: stroke paths, phonics, picture-words, books
├── world.js                    # broader content: feelings, shapes, habitats, helpers, time
├── manifest.webmanifest        # PWA install metadata
├── sw.js                       # service worker (offline cache, versioned)
├── icons/                      # PWA icons (SVG primary, PNG via tools/make-icons.html)
├── tools/make-icons.html       # one-shot tool to render PNGs from SVG for iOS
├── caddy-letters.conf          # Caddy block for the live tenant (static + /api/* proxy)
├── api/                        # v5 backend — Next.js 16 + Drizzle + Postgres 16
│   ├── src/app/api/            # route handlers (health, sync/probe)
│   ├── src/lib/                # schema, db, logger, api-error envelope
│   ├── drizzle/0000_initial.sql  # idempotent initial migration (7 tables)
│   ├── Dockerfile              # multi-stage Node 20 alpine standalone build
│   └── podman-compose.yml      # rootless service binding 127.0.0.1:3013
└── scripts/                    # deploy.sh (static), deploy-api.sh (backend),
                                # setup-droplet.sh, setup-droplet-api.sh (one-shot
                                # tenant + DB + pg_hba bootstrap)
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

Production is a **two-layer tenant** on the existing GuardCyber droplet — Caddy serves the static PWA directly, and proxies `/api/*` to a rootless-Podman Next.js container. Same multi-tenant pattern as the other GuardCyber sub-domains documented in `~/Nextcloud/Projects/GuardCyber/README.md`. Marginal cost is **$0** (shared droplet) plus $10/year if/when a dedicated domain replaces the subdomain.

Tenant allocation (live):

| Item | Value |
|---|---|
| Domain | `letters.guardcybersolutionsllc.com` |
| Droplet | `192.241.132.219` (DigitalOcean NYC1, existing) |
| Static app directory | `/opt/apps/letters-and-numbers/` (owner `lnum-deploy`, chmod 755) |
| Backend app directory | `/opt/apps/letters-and-numbers-api/` (owner `lnum-deploy`, chmod 700) |
| Backend port | `127.0.0.1:3013` (loopback only — exposed via Caddy) |
| Database | PostgreSQL 16 — `db_lnum` / user `lnum_user` (shared instance) |
| Web server | Caddy (existing multi-tenant Caddyfile) |
| TLS | Cloudflare Full Strict + Caddy auto-Let's-Encrypt |

**One-time droplet setup**

The static PWA tenant is bootstrapped by `scripts/setup-droplet.sh`. The backend tenant — subuid range for rootless Podman, app directory, DB + user, `pg_hba` rule, schema migration — is bootstrapped idempotently by `scripts/setup-droplet-api.sh`:

```bash
# From your laptop, one shot:
scp scripts/setup-droplet-api.sh api/drizzle/0000_initial.sql deploy@192.241.132.219:/tmp/
ssh deploy@192.241.132.219 "bash /tmp/setup-droplet-api.sh"
```

The script is safe to re-run; each step checks before acting. It also generates a strong DB password and writes `${APP_DIR}/.env` with chmod 600.

Then append the Caddy block from `caddy-letters.conf` to `/opt/apps/shared/caddy/Caddyfile` (it must include both `handle /api/*` and the static `handle` block — see the file) and `sudo systemctl reload caddy`. Cloudflare DNS: A record `letters → 192.241.132.219` (Proxied), SSL/TLS Full (Strict).

**Recurring deploys — CI auto-deploy (primary path)**

Two GitHub Actions workflows under `.github/workflows/` deploy on every push to `main`:

- `deploy-static.yml` — fires on changes to `index.html`, `*.js`, `*.css`, `sw.js`, `manifest.webmanifest`, `icons/**`, `tools/**`. rsync → droplet → Caddy reload → smoke-test. ~30s.
- `deploy-api.yml` — fires on changes to `api/**` or `caddy-letters.conf`. CI gates (typecheck, build, Trivy HIGH/CRITICAL scan) → buildx → ghcr.io with two tags (`:<sha>` and `:latest`) → droplet pulls → `podman-compose up -d --no-build` → smoke-test. ~3–4 min.

Both follow `~/.claude/CLAUDE.md` § CI/CD: build off-host, blocking gates, two image tags, image-based rollback.

One-time setup (SSH key + GH secrets + ghcr public visibility) is in [`docs/CI-SETUP.md`](docs/CI-SETUP.md).

**Manual deploys (fallback when CI is down, or for hot-fixes)**

```bash
# Static PWA — same flow CI runs, just from your laptop
npm run deploy                          # rsync + Caddy reload + smoke test
DRY_RUN=1 bash scripts/deploy.sh        # dry-run first if you want

# Backend API — local podman build on the droplet (slower than CI's ghcr pull)
bash scripts/deploy-api.sh              # rsync src → podman-compose build + up -d
```

`deploy.sh` (static):
1. Verifies project root, echoes the `sw.js` version
2. `rsync`s to a staging dir on the droplet, then `sudo rsync`s into `/opt/apps/letters-and-numbers/`
3. Reloads Caddy
4. Curls the live URL and confirms it serves 200 + matches the local SW version

`deploy-api.sh` (backend):
1. `rsync`s `api/` to `/tmp/lnum-api-staging` on the droplet
2. Writes a remote build script to `/tmp/lnum-api-build.sh` and runs it as `lnum-deploy`
3. The remote script `podman-compose build`s and `up -d`s the `lnum-api` container
4. Smoke-tests `https://letters.guardcybersolutionsllc.com/api/health`

CI and manual deploys converge on identical droplet state — `api/podman-compose.yml` declares both `image:` (used by CI's pull flow) and `build:` (used by the manual flow). The `:latest` tag is what runs; both flows retag to it.

The Caddy config (security headers, CSP, cache policy, `/api/*` reverse proxy) is in `caddy-letters.conf`. Schema migrations live under `api/drizzle/` and use idempotent `IF NOT EXISTS` clauses, applied as the `postgres` superuser by `setup-droplet-api.sh` per the multi-phase remediation rules in `~/.claude/CLAUDE.md`.

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

**v4** ✅ shipped: lowercase tracing (52 path definitions, 52 skills), phonemic awareness (rhyming, first-sound isolation, blending), Dolch sight words, decodable reading books, arithmetic, calm corner, Rammeplan dashboard, age bands 1–6.

**v5.0** ✅ shipped: backend tenant provisioned. Next.js 16 + Drizzle on Postgres 16, idempotent schema (7 tables), `/api/health` and `/api/sync/probe` live behind Cloudflare → Caddy → rootless Podman.

**v5.1** next: opt-in profile sync (magic-link auth, no passwords), parent web dashboard accessible separately from the kid's device. The schema (`parents`, `children`, `devices`, `skill_progress`, `play_events`, `session_summaries`, `magic_links`) is already in place; client and route handlers are the remaining work.

---

## References

The pedagogical and standards basis is documented in detail in [PEDAGOGY.md](PEDAGOGY.md). Primary sources:

- [Norwegian Rammeplan for barnehagens (English)](https://www.udir.no/contentassets/7c4387bb50314f33b828789ed767329e/framework-plan-for-kindergartens--rammeplan-engelsk-pdf.pdf)
- [EU Quality Framework for ECEC (Council of EU, 2019)](https://www.earlychildhoodireland.ie/wp-content/uploads/2024/02/Explainers_EUQualityFramework.pdf)
- [European Commission — About ECEC](https://education.ec.europa.eu/education-levels/early-childhood-education-and-care/about-early-childhood-education-and-care)
- Alvestad — [Norwegian Preschool Teachers' Thoughts on Curriculum Planning](https://ecrp.illinois.edu/v1n2/alvestad.html)
- NAEYC Early Learning Outcomes Framework
- CCSS for English Language Arts and Mathematics (NGA Center & CCSSO, 2010)
