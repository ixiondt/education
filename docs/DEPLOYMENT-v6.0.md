# Deployment notes — v6.0 magic-link auth + sync

Operational runbook for the v6.0 backend changes. If anything goes
sideways with the live `lnum-api` container, this is where to look.

## One-time droplet setup

Required env var added in v6.0:

| Variable | Required | Default | Notes |
|---|---|---|---|
| `LNUM_SESSION_SECRET` | **yes (prod)** | random per process in dev | 32+ chars. HMAC key for session cookies. Generate via `openssl rand -hex 48`. |
| `RESEND_API_KEY` | no | unset → stub mode | When set, real email goes out via Resend. When unset, magic link returns in the response JSON (self-hosted single-family setups). |
| `LNUM_EMAIL_FROM` | no | `'Letters & Numbers <letters@guardcybersolutionsllc.com>'` | Resend From header. Only matters when `RESEND_API_KEY` is set. |
| `EMAIL_STUB` | no | `1` if no Resend key | Force stub mode even when key is present (testing). |
| `PUBLIC_ORIGIN` | no | derived from request host | Override the origin used to build magic-link URLs in the email. Useful when running behind a proxy that strips host headers. |

Drop them into `/opt/apps/letters-and-numbers-api/.env` (chmod 600) and `podman restart lnum-api`.

## Endpoints

| Route | Auth | Body / Query | Notes |
|---|---|---|---|
| `POST /api/auth/request-link` | none | `{ email }` | Always returns 200; never leaks "this email is registered." Rate-limited 3/10s. |
| `GET /api/auth/verify?token=X` | none | — | Single-use token; sets `lnum_session` cookie on success. |
| `GET /api/auth/me` | optional | — | Returns `{signedIn:bool, parent?:{id,email}}` |
| `POST /api/auth/logout` | optional | — | Clears the cookie. Stateless — no server-side invalidation step. |
| `POST /api/sync/push` | required | `{ childId?, childName?, childAgeMonths?, deviceId?, events:[…] }` | Max 500 events / batch. Idempotent on `clientEventId`. First push without `childId` mints one. |
| `GET /api/sync/pull?since=ISO&childId=UUID` | required | — | Returns parent's child roster + events since cursor. Max 500 per page. |

## Rolling the container manually

CI is preferred but when it's blocked, run from your laptop:

```bash
bash scripts/deploy-api.sh
```

(Fixed in `4eed341` — the pre-v6.0 version had a heredoc-quoting bug that silently no-op'd the build step.)

For pure SSH-based restart without code change:

```bash
ssh deploy@<droplet>
sudo -u lnum-deploy -i bash -c 'cd /opt/apps/letters-and-numbers-api && podman restart lnum-api'
```

## Rollback

The `:latest` ghcr tag is what `podman-compose up -d --no-build` picks up. SHA-tagged images stay on the droplet for at least 7 days (per CLAUDE.md § CI/CD). To roll back:

```bash
ssh deploy@<droplet>
sudo -u lnum-deploy -i bash <<'EOF'
cd /opt/apps/letters-and-numbers-api
PREV_SHA=<paste from podman images>
podman tag ghcr.io/ixiondt/letters-and-numbers-api:$PREV_SHA \
           ghcr.io/ixiondt/letters-and-numbers-api:latest
podman ps -a --filter name=lnum-api -q | xargs -r podman rm -f
podman-compose up -d --no-build
sleep 4
curl -s http://127.0.0.1:3013/api/health
EOF
```

## CVE-clearing history

v6.0.0 build flagged by Trivy with HIGH/CRITICAL findings:

| CVE / Advisory | Source | Fix |
|---|---|---|
| CVE-2026-26960 / -29786 / -31802 | `node-tar` bundled with npm in `node:20-alpine` runner stage | v6.0.1 — `RUN rm -rf /usr/local/lib/node_modules/npm …` in Dockerfile runner |
| GHSA-h25m-26qc-wcjf | Next.js using insecure React | v6.0.2 — bump `next` 16.0.0 → 16.2.6 |
| GHSA-mwv6-3258-q52c | Next.js DoS with Server Components | v6.0.2 — same bump |
| GHSA-q4gf-8mx6-v5v3 | Next.js DoS with Server Components (second) | v6.0.2 — same bump |

The workflow runs `ignore-unfixed: true`, so future scans only block on advisories with fixes available.

## Operational sanity checks

After any deploy:

```bash
# 1. Container is up
ssh deploy@<droplet> "sudo -u lnum-deploy -i podman ps --filter name=lnum-api --format '{{.Names}} {{.Status}} {{.Image}}'"

# 2. Health 200 + DB reachable
curl -s https://letters.guardcybersolutionsllc.com/api/health

# 3. Auth ping (no cookie → signedIn:false)
curl -s https://letters.guardcybersolutionsllc.com/api/auth/me

# 4. Sync rejects without cookie
curl -s https://letters.guardcybersolutionsllc.com/api/sync/pull
# expect: {"error":{"code":"UNAUTHORIZED",...}}
```

If any of these fail, check container logs:

```bash
ssh deploy@<droplet> "sudo -u lnum-deploy -i podman logs --tail 50 lnum-api"
```
