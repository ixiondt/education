#!/usr/bin/env bash
# ============================================================
#  Letters & Numbers — production deploy
#
#  Slots into the GuardCyber droplet multi-tenant pattern as the
#  next static-site tenant (alongside Dark Moon Security). No
#  container, no Node runtime — Caddy serves the files directly.
#
#  Usage:
#    bash scripts/deploy.sh
#    HOST=deploy@1.2.3.4 bash scripts/deploy.sh   # override target
#    DRY_RUN=1 bash scripts/deploy.sh             # show what would deploy
#
#  Prerequisites (one-time, done on the droplet):
#    1. Tenant user created:
#       sudo useradd -r -m -s /bin/bash lnum-deploy
#       sudo loginctl enable-linger lnum-deploy
#    2. App dir owned by tenant:
#       sudo mkdir -p /opt/apps/letters-and-numbers
#       sudo chown lnum-deploy:lnum-deploy /opt/apps/letters-and-numbers
#       sudo chmod 755 /opt/apps/letters-and-numbers    # Caddy needs read
#    3. Caddy block added to /opt/apps/shared/caddy/Caddyfile
#       (see caddy-letters.conf in this repo)
#    4. DNS A record pointed at the droplet IP, Cloudflare proxied
# ============================================================
set -euo pipefail

# ── Configuration (overridable via env) ───────────────────────
HOST="${HOST:-deploy@192.241.132.219}"
REMOTE_DIR="${REMOTE_DIR:-/opt/apps/letters-and-numbers}"
TENANT_USER="${TENANT_USER:-lnum-deploy}"
STAGING_DIR="${STAGING_DIR:-/tmp/lnum-deploy-staging}"
DRY_RUN="${DRY_RUN:-0}"

# ── Banner ────────────────────────────────────────────────────
echo "==========================================================="
echo "  Deploy Letters & Numbers → ${HOST}:${REMOTE_DIR}"
echo "  Tenant user: ${TENANT_USER}"
[[ "${DRY_RUN}" == "1" ]] && echo "  (DRY RUN — no files will move)"
echo "==========================================================="

# ── Sanity check: must be at project root ─────────────────────
if [[ ! -f "index.html" || ! -f "manifest.webmanifest" ]]; then
  echo "ERROR: run from project root (index.html + manifest.webmanifest must exist)" >&2
  exit 1
fi

# ── Pre-flight verification (versioning sanity) ───────────────
SW_VERSION=$(grep -E "^const VERSION = " sw.js | sed -E "s/.*'(.*)'.*/\1/")
PKG_VERSION=$(grep -E '"version":' package.json | head -1 | sed -E 's/.*"version": "(.*)".*/\1/')
echo "→ service worker version: ${SW_VERSION}"
echo "→ package.json version:   ${PKG_VERSION}"

# ── Files to include / exclude ────────────────────────────────
# We deploy the static app + its documentation (README and PEDAGOGY
# are referenced from the in-app About modal and are part of the
# educational credibility). We exclude dev-only files.
RSYNC_FLAGS=(
  -avz
  --delete
  --exclude='.git/'
  --exclude='.github/'
  --exclude='.gitignore'
  --exclude='.claude/'
  --exclude='node_modules/'
  --exclude='scripts/'
  --exclude='package.json'
  --exclude='package-lock.json'
  --exclude='.DS_Store'
  --exclude='Thumbs.db'
  --exclude='audio/'                      # parent-provided MP3 drop-ins are device-local
  --exclude='caddy-letters.conf'          # config snippet, not a runtime artifact
)
[[ "${DRY_RUN}" == "1" ]] && RSYNC_FLAGS+=(--dry-run)

# ── Stage to droplet ──────────────────────────────────────────
echo "→ Staging files to ${HOST}:${STAGING_DIR}"
ssh "${HOST}" "mkdir -p '${STAGING_DIR}'"
rsync "${RSYNC_FLAGS[@]}" ./ "${HOST}:${STAGING_DIR}/"

if [[ "${DRY_RUN}" == "1" ]]; then
  echo "✓ Dry run complete. No remote changes made."
  exit 0
fi

# ── Move into place, set ownership, reload Caddy ──────────────
# IMPORTANT: --exclude='audio/' on the final rsync protects the
# audio/ directory on the droplet from being wiped by --delete.
# Voice-pack MP3s are device-/server-local (gitignored) and updated
# via scripts/generate-voices.py + a separate sync.
echo "→ Moving into ${REMOTE_DIR} and fixing ownership"
ssh "${HOST}" "set -e
  sudo rsync -a --delete --exclude='audio/' '${STAGING_DIR}/' '${REMOTE_DIR}/'
  sudo chown -R '${TENANT_USER}:${TENANT_USER}' '${REMOTE_DIR}'
  # Caddy runs as its own user — files must be world-readable
  sudo find '${REMOTE_DIR}' -type f -exec chmod 644 {} \;
  sudo find '${REMOTE_DIR}' -type d -exec chmod 755 {} \;
  rm -rf '${STAGING_DIR}'
  sudo systemctl reload caddy
  echo '  ✓ Caddy reloaded'
"

# ── Smoke test ────────────────────────────────────────────────
echo "→ Smoke testing the live URL"
DOMAIN="${DOMAIN:-letters.guardcybersolutionsllc.com}"
HTTP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" "https://${DOMAIN}/" || echo "000")
if [[ "${HTTP_CODE}" == "200" ]]; then
  echo "  ✓ https://${DOMAIN}/ → 200"
else
  echo "  ⚠ https://${DOMAIN}/ → ${HTTP_CODE} (check DNS + Caddy)"
fi

# Check that the SW version we just deployed is actually live (cache-busts via timestamp)
LIVE_SW=$(curl -sk "https://${DOMAIN}/sw.js?ts=$(date +%s)" 2>/dev/null | grep -E "^const VERSION = " | head -1 | sed -E "s/.*'(.*)'.*/\1/" || echo "?")
if [[ "${LIVE_SW}" == "${SW_VERSION}" ]]; then
  echo "  ✓ live sw.js VERSION matches local (${SW_VERSION})"
else
  echo "  ⚠ live sw.js VERSION is '${LIVE_SW}', expected '${SW_VERSION}'"
fi

echo "==========================================================="
echo "  ✓ Deployed."
echo "  Open https://${DOMAIN}/ to verify."
echo "==========================================================="
