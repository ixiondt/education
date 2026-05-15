# Letters & Numbers — Roadmap

A phased plan from current v2 → v5+, written to slot into the existing GuardCyber droplet infrastructure rather than introduce a new stack.

---

## Status

| Phase | State | Date |
|---|---|---|
| v1 — single-user offline PWA | ✅ Shipped | 2026-05-14 |
| v2 — profiles + age-aware curriculum | ✅ Shipped | 2026-05-14 |
| v3 — standards dashboard + mastery | ✅ Shipped | 2026-05-14 |
| v3.1 — voice fixes, in-app recording, dev-mode SW skip | ✅ Shipped | 2026-05-14 |
| v3.2 — EU + Rammeplan standards, Free play mode | ✅ Shipped | 2026-05-14 |
| v3.3 — Educational platform reframe: Norwegian pedagogy, child agency, interest tracking, in-app About | ✅ Shipped | 2026-05-14 |
| v4.0 — Phonemic awareness modes (First sound, Rhyme, Blend) | ✅ Shipped | 2026-05-14 |
| **Live in production at `letters.guardcybersolutionsllc.com`** | ✅ Deployed | 2026-05-14 |
| v5.0 — Whole-child platform: 7 new modes covering Rammeplan areas 2–7; parent activity cards; reading log; free Edge-TTS voice-pack script | ✅ Shipped | 2026-05-14 |
| v5.0-be — Backend tenant: Next.js 16 + Drizzle + Postgres 16, idempotent schema (7 tables), `/api/health` + `/api/sync/probe` live through Caddy → rootless Podman | ✅ Shipped | 2026-05-14 |
| v5.11–v5.12 — CI auto-deploy: GHA → typecheck/build/Trivy → ghcr.io → droplet pull. Static + API workflows, both blocking-gated. | ✅ Shipped | 2026-05-14 |
| v5.13–v5.15 — Voice overhaul: customAudio 'auto' default, S/Z phoneme fix, Speech.speakSequence, robotic-voice banner, voiceFingerprint, locale field, scripts/generate-voices.py multi-locale. Bulk-record UX. Snappier transitions. Speech speed slider. | ✅ Shipped | 2026-05-14 |
| v5.16–v5.17 — **Educational video games**: shared canvas/rAF engine + Letter Lander (calm-arcade) + Number Lander + Number Blaster (full arcade Math Blaster homage, score/lives/levels/DDA) | ✅ Shipped | 2026-05-15 |
| v5.18–v5.22 — **ADHD-aware expansion** (Scattered to Focused + Finally Focused): 6 EF skill trainers + Parent Observation Journal + Calm Corner expansion + pre-session check-in + body-break prompts | ✅ Shipped | 2026-05-15 |
| v5.23 — Game tuning + `Speech` single-source-of-truth + game phrase MP3s | ✅ Shipped | 2026-05-15 |
| v5.24–v5.30 — **Rammeplan depth pass** (one session per area): Body/Movement (🤸🍎), Art/Creativity (🎨🥁), Ethics/Philosophy (❤️🙏), Nature/Environment (🌦️♻️), Spatial/Measurement (📏🧭), Society (🏠🗓), Norwegian language toggle + Norsk pack scaffolding | ✅ Shipped | 2026-05-15 |
| v5.31 — Codebase audit (docs/AUDIT-v5.31.md): 44 modes, ~19,600 LOC, all static checks green | ✅ Shipped | 2026-05-15 |
| v5.32 — Documentation refresh | ✅ Shipped | 2026-05-15 |
| v5.33 — Game screens fixed to viewport (no more page scroll inside games) | ✅ Shipped | 2026-05-15 |
| v6.0 — Magic-link parent auth + opt-in cross-device sync. 6 new routes (request-link / verify / me / logout / sync push / sync pull), HMAC session cookies, IP rate limiting, idempotent event ingest. Client `window.Sync` API + Settings row + magic-link landing handler. ~1,200 LOC. | ✅ Shipped | 2026-05-15 |
| v6.0.1 — Stripped npm + node-tar from runtime image (3 HIGH CVEs cleared, image −40 MB) | ✅ Shipped | 2026-05-15 |
| v6.0.2 — Next.js 16.0.0 → 16.2.6 (3 advisories: GHSA-h25m, GHSA-mwv6, GHSA-q4gf) | ✅ Shipped | 2026-05-15 |
| v6.1 — Parent web dashboard route at `/dashboard` showing aggregate progress across devices (read-side of sync data) | Planned | — |
| v7+ — K-12 architecture refactor (subject/grade/band schema), upper-elementary content (CCSS Grades 1-5), additional arcade games (Word Munchers, Fraction Frenzy, Capital Quest, Sentence Builder) | Planned | — |

---

## v1 — Single-user offline PWA  *(done)*

**Scope:** One device, one kid, six modes (Find Letters/Numbers, Trace Letters/Numbers, Sounds, Count). Installable PWA. Calm Montessori + Bright themes. Parent-gated settings. Local progress.

**Stack:** Vanilla HTML/CSS/JS, no build step. Service worker for offline. localStorage for state.

**Hosting:** Static. Currently runs from `file://` (game) or any static host (full PWA).

---

## v2 — Profiles + age-aware curriculum  *(done)*

**Goal:** Make the game work for *any* kid at any ability level, not just one.

**What changed from v1:**

| Concern | v1 | v2 |
|---|---|---|
| Storage shape | `ln.settings`, `ln.progress` (flat) | `ln.v2 = { profiles[], activeProfileId }` |
| Target selection | Random with recency weight | Curriculum-driven `pickNextSkill()` |
| Skill granularity | "letter A" (one bucket) | `letter-recognize-A`, `letter-sound-A`, `letter-trace-A` — three distinct skills |
| Age awareness | None | Each skill has `minAgeMonths`; only age-appropriate skills served |
| Prerequisites | None | Skills have `prereqs[]` (e.g., sounds requires recognition mastered) |
| Settings | Global | Per-profile |
| Standards | Implicit | Each skill tagged with NAEYC ELOF + CCSS K codes |
| Migration | — | v1 data auto-imports into a default profile |

**New files:** `curriculum.js` (~150 lines) defining ~120 skills with thresholds, prereqs, and standards. `app.js` refactored to consume the curriculum + manage profiles.

**Skills generated (v2):**

```
26 × letter-recognize-X      (age 30 mo+, mastery 8 correct)
26 × letter-sound-X          (age 36 mo+, mastery 6 correct, prereqs recognize)
26 × letter-trace-X          (age 42 mo+, mastery 5 successes, prereqs recognize)
11 × number-recognize-0..10  (age 30 mo+, mastery 6 correct)
11 × number-trace-0..10      (age 42 mo+, mastery 5 successes, prereqs recognize)
10 × count-1..10             (age 36 mo+, mastery 5 correct, prereqs recognize)
———
110 skills total
```

**Standards mapped:** CCSS-RF.K.1d, CCSS-RF.K.2, CCSS-RF.K.3a, CCSS-K.CC.3, CCSS-K.CC.4, CCSS-K.CC.5, NAEYC-LL-1.1, NAEYC-LL-2.3, NAEYC-LL-3.2, NAEYC-M-1.1, NAEYC-M-2.1, NAEYC-PMP-2.2. Codes live in `curriculum.js` for the v3 dashboard.

**UI added:**
- First-launch welcome screen (name + age picker)
- Profile chip on home (tap → parent-gated picker)
- Profile picker modal (switch / add / edit / delete)
- Profile edit modal with age buttons (2/3/4/5/6+)
- Sensory mode toggle (normal / calm — calm reduces sparkle density)
- Per-profile ability level shown ("Discovering", "Practicing", "Confident")
- Progress modal now shows summary stats (age, ability, mastered/available)

**Hosting:** Still static. Same Cloudflare Pages / file:// story.

---

## v3 — Standards dashboard + true mastery

**Goal:** Parents see real progress against real frameworks. Confidence that the tool teaches what schools teach.

**Build:**
- **Skill detail screen** — tap any letter/number in progress view, see all 3-4 skills for that target (recognize, sound, trace) + their standards mapping with human descriptions
- **Standards view** — group skills by CCSS/NAEYC code so parents can answer "where is my kid on RF.K.1d?"
- **Session tracking** — count taps/minutes per session, gentle "great session, take a break" after 10 min for kids on `sensoryMode: low`
- **Daily streaks** (gentle — shows current streak, never punishes a missed day)
- **JSON export** — parent dashboard → "Export progress" → downloads `{ profile, skills, events }.json`
- **PDF export** of progress (printable, share with preschool teacher)
- **Mastery decay** — skills mastered >30 days ago drop one star until re-practiced (forgetting curve)
- **Prereqs enforcement toggle** — strict (default for v3) or "let me skip ahead" mode

**Data model addition:**
```js
profile.progress.events = [
  { skillId, success: bool, ts: ms, durationMs: ms }  // append-only event log
]
profile.streaks = { currentDays, longestDays, lastPlayedDate }
```

Keeping events lets us replay/aggregate without losing the per-event detail. Older events can be summarized into the existing `skills[].successes` and dropped to save space.

**Hosting:** Still static. JSON-only data. No backend needed.

**LOC:** ~+500.

---

## v4 — Bridge to actual reading

**Goal:** Take the kid from "I know letters" to "I can read short words."

**New content:**
- **Lowercase letter recognition + tracing** — adds 52 more skills (26 lower recognize + 26 lower trace). New entries in `letters.js` (lowercase SVG paths).
- **Phonemic awareness modes** (the cognitive bridge to reading):
  - **Rhyming** — "which rhymes with cat?" 3 picture/word choices.
  - **First sound isolation** — "what does cat start with?" picture cue + 3 letters.
  - **Blending** — voice spells "c… a… t" with pauses; kid taps the matching picture.
  - **Segmenting** — kid hears "cat", taps a 3-box "c/a/t" splitter (advanced).
- **Sight words** — Dolch list pre-primer and primer (~80 words). Mode shows word + 3 picture/word matches.
- **Letter formation animations** — when tracing starts, animate the stroke path once to demonstrate before the kid traces. Toggle in settings.
- **Audio recording UI** — `Settings → Record voice` lets a parent record letters/numbers/words in their own voice. Stored as Blobs in IndexedDB. Played back via the existing custom-audio override pipe.

**Data model addition:**
```js
// New skill categories
'phoneme-rhyme-<word>'      // e.g. phoneme-rhyme-cat
'phoneme-first-<letter>'    // e.g. phoneme-first-S
'phoneme-blend-<word>'      // e.g. phoneme-blend-cat
'sight-<word>'              // e.g. sight-the
```

**Hosting:** Still static. Audio recordings stay in IndexedDB. If we add a CDN bucket for pre-recorded audio packs, Cloudflare R2 (free egress) or just bundle them with the app.

**LOC:** ~+1500.

---

## v5 — Backend

> **v5.0 is live as of 2026-05-14.** The tenant is provisioned, the schema is migrated, the container is running behind Caddy. The PWA is unchanged — it does not yet call `/api/*` for anything but health probes. v5.1+ is the client work that opts users into sync.

### Turn-by-turn status

| Turn | Scope | Status |
|---|---|---|
| 1   | Tenant provisioning, schema, health probes | ✅ 2026-05-14 |
| 1.5 | CI auto-deploy: GHA → typecheck/build/Trivy → ghcr.io → droplet pull, separate workflow for static rsync | ✅ 2026-05-14 |
| 2   | Magic-link auth (Resend), parent web dashboard route | Planned |
| 3   | `/api/sync/push` + `/api/sync/pull`, IndexedDB outbox in client | Planned |
| 4   | Aggregate dashboards (per-child, per-standard, per-day) + PDF export | Planned |

### Infrastructure plan — slots into the existing GuardCyber droplet

This app fits as another tenant on `192.241.132.219`, following the exact pattern in `~/Nextcloud/Projects/GuardCyber/README.md`. Nothing new to provision.

**Tenant allocation:**

| Item | Value |
|---|---|
| OS user | `lnum-deploy` |
| subuid range | `1265536–1331071` (next clean 65536 block after `uap-deploy`) |
| App dir | `/opt/apps/letters-and-numbers/` (chmod 700, owned by `lnum-deploy`) |
| Container port | `3013` (next free; binds `127.0.0.1:3013` only) |
| Postgres DB | `db_lnum` on the shared instance (host:5432) |
| DB user | `lnum_user` |
| Domain | **Phase 1:** `letters.guardcybersolutionsllc.com` (subdomain — zero registrar work). **Phase 2:** dedicated domain, later. Decision recorded 2026-05-14. |
| Caddy block | Added to `/opt/apps/shared/caddy/Caddyfile` |
| TLS | Full Strict via Cloudflare proxy + Caddy auto-Let's-Encrypt |
| Email | Scoped Resend API key, sends from `letters@guardcybersolutionsllc.com` |
| Auth | Either Auth.js (email magic links via Resend) OR the shared Keycloak at `auth.guardcybersolutionsllc.com` |
| CI/CD | GitHub Actions → ghcr.io → droplet pulls (NextGen pattern, ~5s downtime vs 2min for on-server builds) |
| Backups | Same nightly `pg_dump` cron the other tenants use |

### v5 stack (matches your other Next.js tenants)

```
Next.js 16 (App Router, TS strict)
  ├── Tailwind v4 (matching patterns-design.md)
  ├── Drizzle ORM + Postgres (matching patterns-web.md)
  ├── Auth.js with email magic link via Resend, OR Keycloak SSO
  ├── Pino structured logging with trace IDs
  ├── Prometheus /metrics on 127.0.0.1:9100 (per patterns-web.md § Observability)
  ├── API Error envelope `{ error: { code, message, details, retryable } }`
  ├── responseSchema validation (per patterns-web.md)
  └── Service worker for offline-first sync (PWA stays)
```

### Schema (Drizzle, db_lnum)

```ts
// parents — magic-link or Keycloak-linked accounts
parents (id uuid pk, email citext unique, created_at, last_login)

// children — multiple kids per parent
children (
  id uuid pk,
  parent_id uuid fk parents on delete cascade,
  name text not null,
  age_months int not null check (age_months between 18 and 144),
  device_id_hash text,                  // optional: which devices have played
  created_at,
  // mirrors local profile.settings shape (jsonb for flexibility)
  settings jsonb not null default '{}'
)
create index children_parent_idx on children(parent_id);

// skill mastery — one row per (child, skill_id); upsert on event ingest
skill_progress (
  child_id uuid fk children on delete cascade,
  skill_id text not null,               // e.g. 'letter-recognize-A'
  successes int not null default 0,
  attempts int not null default 0,
  last_seen_at timestamptz,
  mastered_at timestamptz,              // null until first time threshold crossed
  primary key (child_id, skill_id)
);
create index skill_progress_mastered_idx on skill_progress(child_id, mastered_at);

// raw events (append-only, for dashboards + replay)
play_events (
  id bigserial pk,
  child_id uuid fk children on delete cascade,
  skill_id text not null,
  success bool not null,
  duration_ms int,
  client_ts timestamptz not null,       // when it happened on device
  server_ts timestamptz not null default now(),
  device_id_hash text
);
create index play_events_child_ts_idx on play_events(child_id, client_ts desc);

// session rollups (computed nightly to keep play_events queryable)
session_summaries (
  child_id uuid,
  day date,
  attempts int,
  successes int,
  duration_minutes int,
  primary key (child_id, day)
);
```

### Sync protocol (local-first, eventually-consistent)

The PWA stays the source of truth offline. Sync is conflict-free because each event is append-only and immutable.

1. **Push (PWA → server)** — every 30s while online, or on app close: POST `/api/sync/push` with `{ since: <last_synced_event_ts>, events: [...] }`. Server appends to `play_events`, upserts `skill_progress` aggregates.
2. **Pull (server → PWA)** — on app start or profile switch: GET `/api/sync/pull?since=<ts>&child_id=<id>` returns events from other devices since `ts`. PWA replays them into local state.
3. **Conflict resolution:** none needed — append-only + idempotent (each event has a client-generated UUID; server dedupes).
4. **Offline:** events buffer in IndexedDB. Sync resumes when network returns.

This is the same pattern Linear uses. Simple, robust, no merge conflicts.

### Parent dashboard (separate route, parent-auth required)

`https://letters.guardcybersolutionsllc.com/dashboard` — Next.js server-rendered:
- **Children grid** — one card per kid, mastery progress bar
- **Per-child detail** — all 110 skills grouped by standard (CCSS/NAEYC), filterable, exportable as PDF/JSON
- **Practice trends** — last 30 days, minutes/day, mastery delta
- **Recommendations** — "spend more time on letter sounds; B and D are confusable" (rule-based v5, ML-flavored later)

### CI/CD (matches NextGen pattern)

```
.github/workflows/deploy.yml on push to main:
  1. lint (eslint) + typecheck (tsc --noEmit) + test (vitest) + scan (Trivy)
  2. docker build, push to ghcr.io/<org>/letters-and-numbers:<sha> and :latest
  3. SSH to droplet, run /opt/apps/scripts/deploy.sh letters-and-numbers
     which sudo's to lnum-deploy and pulls the new image + restarts container
```

**LOC:** ~+2000 (Next.js app + Drizzle + auth + sync + dashboard).

### Cost estimate

| Line item | Cost | Notes |
|---|---|---|
| Droplet (existing) | $0 marginal | One more container on existing 4vCPU/8GB droplet |
| Postgres (existing) | $0 marginal | New isolated DB on shared instance |
| Domain | $0 if subdomain, $10/yr if dedicated | Cloudflare Registrar at cost |
| Resend (email) | $0 | Free tier 3K/mo, magic links easily fit |
| Cloudflare (DNS/WAF/proxy) | $0 | Free plan covers everything |
| GitHub Actions CI | $0 | Public/private free tier |
| **Total marginal** | **~$0/mo + $10/yr** | |

If/when you outgrow the droplet (~50+ active families), tenant migration to its own droplet is a `pg_dump` + new IP + Caddy/DNS swap. Not a rewrite.

### Subdomain → dedicated-domain migration (Phase 1 → Phase 2)

Confirmed Phase 1 is `letters.guardcybersolutionsllc.com`. To make the eventual move to a dedicated domain (`lettersandnumbers.app` or similar) painless, build the v5 backend with these conventions from day one:

- **CSP `form-action`, `connect-src`, `frame-ancestors`** — use Caddy variables so the value swaps with one Caddyfile edit, not a source-code change.
- **Manifest** — `start_url`, `scope`, and `id` are relative paths (`./`). The PWA stays installable regardless of host. **`id` stays stable forever** so the install isn't treated as a "new app" after the domain change.
- **Auth callbacks** — env-driven (`OAUTH_REDIRECT_URI`). Add the new origin to Keycloak/Resend allow-lists before the cutover, leave the old one in for a week.
- **Email sender** — start as `letters@guardcybersolutionsllc.com` per the existing Resend setup. When the new domain lands, verify it in Resend, swap `EMAIL_FROM`, container-recreate.
- **301 redirect** — keep `letters.guardcybersolutionsllc.com` alive after the move, serving a 301 to the new origin. Six months minimum so installed PWAs and browser bookmarks still find home.
- **No hardcoded URLs** — anywhere a fully-qualified URL is needed (canonical tags, OG images, sitemap), read from `process.env.PUBLIC_ORIGIN`.

With these in place, the Phase-2 migration is: register domain → Cloudflare DNS → Caddy block addition → env vars updated → restart container → 301 the subdomain. Probably an hour, including verification.

---

## v6+ — Possibilities

- **Spanish, French, Mandarin** — translate `LETTER_WORDS`, phonics map, voice. Curriculum data model handles it.
- **Decodable reading** — short books matched to mastered phonics (e.g., "Sam sat. Sam ran.")
- **Math beyond counting** — shape matching, pattern continuation, addition basics, time (clocks)
- **Adaptive ML difficulty** — once enough cross-user data exists, train a small model to predict next-best skill (don't rush this; rules work fine until thousands of users)
- **Multiplayer** — siblings on the same device, head-to-head "find the A faster" (or cooperative)
- **Teacher / classroom mode** — one parent account becomes a "teacher" managing 15-25 kids
- **iOS native wrap** — Capacitor or Tauri 2 if PWA install limitations on iOS get frustrating; the PWA codebase stays identical

---

## Data-model invariants (carried through every version)

These never change as we add features, so the migration path stays clean:

1. **Skills are immutable IDs.** `letter-recognize-A` means the same thing in v2, v3, v5. Adding new skills never renames existing ones.
2. **Events are append-only.** Each play attempt is a row, never modified.
3. **Profiles are local-first.** Even with v5 backend, the device is authoritative for its own events; server is authoritative for cross-device merges.
4. **Standards codes are stable.** `CCSS-RF.K.1d` stays the canonical reference.
5. **Settings are per-profile, namespaced.** Adding a new setting never breaks old ones — schema fills defaults on load.

---

## What I need from you to start each phase

- **v3:** Tell me your child uses v2 for a week and which letters they keep missing. That validates whether the curriculum/mastery thresholds are right. Then I build the dashboard.
- **v4:** Tell me if the phonics teaching style in v3 lands ("she's actually saying /sss/ for snake!") or feels rote. That decides how much phonemic-awareness scaffolding to add.
- **v5:** Tell me you actually need cross-device sync. Often you'll find you don't — one tablet on the kitchen counter covers the use case forever. If you do: it's a 1-week build on the existing droplet.
