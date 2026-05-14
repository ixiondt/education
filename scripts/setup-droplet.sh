#!/usr/bin/env bash
# ============================================================
#  Letters & Numbers — one-time droplet setup
#
#  Run this ONCE on the droplet (not your laptop). It:
#    1. Creates the lnum-deploy tenant user
#    2. Creates /opt/apps/letters-and-numbers/ with correct perms
#    3. Backs up the shared Caddyfile
#    4. Appends the letters block (idempotent — checks first)
#    5. Validates the Caddyfile BEFORE reloading
#    6. Reloads Caddy and confirms it's running
#    7. Waits for Let's Encrypt to issue the cert
#    8. Smoke-tests the URL locally on the droplet
#
#  Usage (from your laptop):
#    scp scripts/setup-droplet.sh caddy-letters.conf deploy@192.241.132.219:/tmp/
#    ssh deploy@192.241.132.219 "bash /tmp/setup-droplet.sh"
#
#  Idempotent: safe to re-run. Each step checks whether work is already done.
# ============================================================
set -euo pipefail

# ── Config (overridable via env) ──────────────────────────────
TENANT_USER="${TENANT_USER:-lnum-deploy}"
APP_DIR="${APP_DIR:-/opt/apps/letters-and-numbers}"
CADDYFILE="${CADDYFILE:-/opt/apps/shared/caddy/Caddyfile}"
DOMAIN="${DOMAIN:-letters.guardcybersolutionsllc.com}"
SNIPPET="${SNIPPET:-/tmp/caddy-letters.conf}"

# ── Pretty output ─────────────────────────────────────────────
ok()   { echo "  ✓ $*"; }
note() { echo "  → $*"; }
fail() { echo "  ✗ $*" >&2; exit 1; }
hr()   { echo "==========================================================="; }

hr
echo "  Letters & Numbers — droplet setup"
hr
note "Tenant user: $TENANT_USER"
note "App dir:     $APP_DIR"
note "Caddyfile:   $CADDYFILE"
note "Domain:      $DOMAIN"
note "Snippet:     $SNIPPET"
echo

# ── 1. Tenant user ────────────────────────────────────────────
echo "[1/8] Tenant user"
if id -u "$TENANT_USER" >/dev/null 2>&1; then
  ok "User $TENANT_USER already exists"
else
  sudo useradd -r -m -s /bin/bash "$TENANT_USER"
  sudo loginctl enable-linger "$TENANT_USER" 2>/dev/null || true
  ok "Created $TENANT_USER"
fi
echo

# ── 2. App directory ──────────────────────────────────────────
echo "[2/8] App directory"
sudo mkdir -p "$APP_DIR"
sudo chown "$TENANT_USER:$TENANT_USER" "$APP_DIR"
sudo chmod 755 "$APP_DIR"
ok "$APP_DIR exists, owner=$TENANT_USER, mode=755"
echo

# ── 3. Caddyfile sanity ───────────────────────────────────────
echo "[3/8] Caddyfile sanity"
[[ -f "$CADDYFILE" ]] || fail "Caddyfile not found at $CADDYFILE"
ok "Found existing Caddyfile ($(wc -l < "$CADDYFILE") lines)"
echo

# ── 4. Append the block (idempotent) ──────────────────────────
echo "[4/8] Caddy block for $DOMAIN"
if sudo grep -qE "^[[:space:]]*${DOMAIN//./\\.}[[:space:]]*\{" "$CADDYFILE"; then
  ok "Block already present — not modifying Caddyfile"
else
  [[ -f "$SNIPPET" ]] || fail "Snippet not found at $SNIPPET — scp caddy-letters.conf first"

  BACKUP="${CADDYFILE}.bak.$(date +%Y%m%d-%H%M%S)"
  sudo cp "$CADDYFILE" "$BACKUP"
  note "Backup saved → $BACKUP"

  # Append with leading blank line for cleanliness
  sudo bash -c "echo '' >> '$CADDYFILE' && cat '$SNIPPET' >> '$CADDYFILE'"
  ok "Block appended to $CADDYFILE"
fi
echo

# ── 5. Validate BEFORE reload ─────────────────────────────────
echo "[5/8] Validate Caddyfile"
if sudo caddy validate --config "$CADDYFILE" >/tmp/caddy-validate.log 2>&1; then
  ok "Caddyfile is valid"
else
  echo "  Validation output:"
  sed 's/^/    /' /tmp/caddy-validate.log
  fail "Caddyfile validation FAILED — NOT reloading. Restore from backup if needed."
fi
echo

# ── 6. Reload Caddy ───────────────────────────────────────────
echo "[6/8] Reload Caddy"
sudo systemctl reload caddy
sleep 1
if sudo systemctl is-active --quiet caddy; then
  ok "Caddy is active"
else
  fail "Caddy is not active. Check: sudo journalctl -u caddy -n 50"
fi
echo

# ── 7. Wait for Let's Encrypt ─────────────────────────────────
echo "[7/8] Waiting for Let's Encrypt cert (up to 60s)"
LIVE=0
for i in $(seq 1 30); do
  # Hit Caddy directly with the correct SNI/Host
  CODE=$(curl -sk -o /dev/null -w "%{http_code}" \
    --resolve "${DOMAIN}:443:127.0.0.1" \
    --max-time 3 \
    "https://${DOMAIN}/" 2>/dev/null || echo "000")
  if [[ "$CODE" =~ ^[12345][0-9][0-9]$ ]] && [[ "$CODE" != "000" ]]; then
    ok "Local Caddy responding for $DOMAIN — HTTP $CODE (404 is fine, means \"site up, no files yet\")"
    LIVE=1
    break
  fi
  echo -n "."
  sleep 2
done
echo
[[ $LIVE -eq 1 ]] || echo "  ⚠ Cert may still be issuing. Check: sudo journalctl -u caddy -n 50"
echo

# ── 8. Public smoke test through Cloudflare ───────────────────
echo "[8/8] Public smoke test (through Cloudflare)"
CODE=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 8 "https://${DOMAIN}/" 2>/dev/null || echo "000")
case "$CODE" in
  200|404)
    ok "Public URL responds: HTTP $CODE"
    [[ "$CODE" == "404" ]] && note "404 just means /opt/apps/letters-and-numbers/ is empty. Run 'npm run deploy' from your laptop."
    ;;
  521|522|523|524|525|526)
    echo "  ⚠ Cloudflare error $CODE — origin Caddy not reachable through CF"
    echo "    Check UFW: sudo ufw status (need 443/tcp open)"
    echo "    Check Cloudflare SSL/TLS mode: must be Full or Full (Strict)"
    ;;
  000)
    echo "  ⚠ No response. DNS propagating? Wait 2-3 minutes and retry."
    ;;
  *)
    echo "  ⚠ Unexpected HTTP $CODE — check Caddy logs: sudo journalctl -u caddy -n 50"
    ;;
esac
echo

hr
echo "  Setup complete."
hr
echo
echo "Next step (from your laptop):"
echo "  npm run deploy"
echo
