#!/usr/bin/env bash
# ============================================================
#  Letters & Numbers — deploy the BACKEND API container
#
#  Builds the Next.js standalone bundle inside Podman on the droplet
#  and (re)starts the container.
#
#  Usage:
#    bash scripts/deploy-api.sh
# ============================================================
set -euo pipefail

HOST="${HOST:-deploy@192.241.132.219}"
APP_DIR="${APP_DIR:-/opt/apps/letters-and-numbers-api}"
TENANT_USER="${TENANT_USER:-lnum-deploy}"
DOMAIN="${DOMAIN:-letters.guardcybersolutionsllc.com}"

if [[ ! -f "api/package.json" ]]; then
  echo "ERROR: run from project root (api/package.json must exist)" >&2
  exit 1
fi

echo "==========================================================="
echo "  Deploy Letters & Numbers API → ${HOST}:${APP_DIR}"
echo "==========================================================="

# ── Stage api/ source on the droplet ──
echo "→ Staging api/ source to ${HOST}:/tmp/lnum-api-staging"
ssh "$HOST" "rm -rf /tmp/lnum-api-staging && mkdir -p /tmp/lnum-api-staging"
rsync -avz --delete \
  --exclude='node_modules/' \
  --exclude='.next/' \
  --exclude='.env' \
  --exclude='*.log' \
  api/ "$HOST:/tmp/lnum-api-staging/"

# ── Run the build script on the droplet ──
# v6.0 fix: pipe the script over ssh stdin via `bash -s ARG1 ARG2`.
# The previous `ssh "$HOST" "cat > file << 'EOF' ${SCRIPT} EOF"` pattern
# collapsed newlines through the local-shell variable interpolation,
# squashing the multi-line script into one unparseable line on the
# remote. `bash -s` keeps the heredoc verbatim — no shell interpolation
# of the script body anywhere.
ssh "$HOST" "bash -s '$APP_DIR' '$TENANT_USER'" <<'REMOTE_EOF'
set -euo pipefail
APP_DIR="$1"
TENANT_USER="$2"

# Move staged files into the tenant directory, keeping .env
sudo rsync -a --delete --exclude='.env' /tmp/lnum-api-staging/ "${APP_DIR}/"
sudo chown -R "${TENANT_USER}:${TENANT_USER}" "${APP_DIR}"
sudo chmod 700 "${APP_DIR}"
rm -rf /tmp/lnum-api-staging

# Build + run as the tenant user. We use bash -s with an inner heredoc
# so the inner script's newlines + quotes survive the sudo wrapper.
sudo -u "${TENANT_USER}" -i bash -s "${APP_DIR}" <<'INNER_EOF'
set -e
APP_DIR="$1"
cd "${APP_DIR}"
if podman ps -a --format '{{.Names}}' | grep -q '^lnum-api$'; then
  podman stop lnum-api 2>/dev/null || true
  podman rm   lnum-api 2>/dev/null || true
fi
podman-compose build
podman-compose up -d
sleep 5
echo '--- container status ---'
podman ps --filter name=lnum-api --format '{{.Names}} {{.Status}}'
INNER_EOF
REMOTE_EOF

# ── Smoke test through Caddy ──
echo ""
echo "→ Smoke testing /api/health through Caddy"
sleep 3
CODE=$(curl -sk -o /dev/null -w "%{http_code}" "https://${DOMAIN}/api/health" 2>/dev/null || echo "000")
if [[ "$CODE" == "200" ]]; then
  echo "  ✓ https://${DOMAIN}/api/health → 200"
  curl -sk "https://${DOMAIN}/api/health"; echo
else
  echo "  ⚠ https://${DOMAIN}/api/health → ${CODE}"
  echo "    (Caddy block may not be updated yet — see caddy-letters.conf)"
  echo "    Check container logs:"
  echo "      ssh ${HOST} \"sudo -u ${TENANT_USER} -i podman logs lnum-api --tail 50\""
fi

echo ""
echo "==========================================================="
echo "  ✓ Backend deployment complete."
echo "==========================================================="
