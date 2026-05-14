#!/usr/bin/env bash
# ============================================================
#  Letters & Numbers — droplet setup for the BACKEND API tenant
#
#  Run ONCE on the droplet to provision:
#   1. lnum-deploy user gets subuid/subgid for rootless Podman
#   2. /opt/apps/letters-and-numbers-api/ directory
#   3. PostgreSQL: db_lnum + lnum_user with strong password
#   4. .env file populated with the DATABASE_URL
#   5. Initial schema migration applied (drizzle/0000_initial.sql)
#
#  Usage (from your laptop):
#    scp scripts/setup-droplet-api.sh api/drizzle/0000_initial.sql deploy@192.241.132.219:/tmp/
#    ssh deploy@192.241.132.219 "bash /tmp/setup-droplet-api.sh"
#
#  Idempotent: safe to re-run. Each step checks whether work is done.
# ============================================================
set -euo pipefail

TENANT_USER="${TENANT_USER:-lnum-deploy}"
APP_DIR="${APP_DIR:-/opt/apps/letters-and-numbers-api}"
DB_NAME="${DB_NAME:-db_lnum}"
DB_USER="${DB_USER:-lnum_user}"
SUBUID_START="${SUBUID_START:-1265536}"
SCHEMA_SQL="${SCHEMA_SQL:-/tmp/0000_initial.sql}"
# Rootless Podman NATs container traffic out to the droplet's public IP, so
# pg_hba.conf must allow that origin specifically (the 127.0.0.1/32 line
# alone is not enough). Set DROPLET_IP if your droplet has a different IP.
DROPLET_IP="${DROPLET_IP:-192.241.132.219}"
PG_VERSION="${PG_VERSION:-16}"
PG_HBA="${PG_HBA:-/etc/postgresql/${PG_VERSION}/main/pg_hba.conf}"

ok()   { echo "  ✓ $*"; }
note() { echo "  → $*"; }
fail() { echo "  ✗ $*" >&2; exit 1; }
hr()   { echo "==========================================================="; }

hr
echo "  Letters & Numbers — BACKEND API droplet setup"
hr
note "Tenant user:    $TENANT_USER"
note "App directory:  $APP_DIR"
note "Database:       $DB_NAME (user $DB_USER)"
note "Schema SQL:     $SCHEMA_SQL"
echo

# ── 1. subuid/subgid for rootless Podman ──────────────────────
echo "[1/5] Subuid range for rootless Podman"
if grep -q "^${TENANT_USER}:" /etc/subuid 2>/dev/null; then
  ok "subuid already configured for $TENANT_USER"
else
  sudo usermod --add-subuids "${SUBUID_START}-$((SUBUID_START + 65535))" \
                --add-subgids "${SUBUID_START}-$((SUBUID_START + 65535))" \
                "$TENANT_USER"
  ok "subuid/subgid added: ${SUBUID_START}-$((SUBUID_START + 65535))"
fi
sudo loginctl enable-linger "$TENANT_USER" 2>/dev/null || true
ok "linger enabled (systemd user services persist across reboots)"
echo

# ── 2. App directory ──────────────────────────────────────────
echo "[2/5] App directory"
sudo mkdir -p "$APP_DIR"
sudo chown "$TENANT_USER:$TENANT_USER" "$APP_DIR"
sudo chmod 700 "$APP_DIR"
ok "$APP_DIR exists (chmod 700, owner $TENANT_USER)"
echo

# ── 3. PostgreSQL database + user ─────────────────────────────
echo "[3/5] PostgreSQL"
EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null || echo "0")
if [[ "${EXISTS:-0}" == "1" ]]; then
  ok "Database $DB_NAME already exists"
else
  # Generate a strong password (24 bytes base64, URL-safe)
  DB_PASS=$(openssl rand -base64 24 | tr '+/' '-_' | tr -d '=' | head -c 32)
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<EOF
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
EOF
  ok "Created database $DB_NAME and user $DB_USER"

  # Write .env on the tenant directory
  sudo bash -c "cat > ${APP_DIR}/.env" <<EOF
DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@host.containers.internal:5432/${DB_NAME}
LOG_LEVEL=info
NODE_ENV=production
EOF
  sudo chown "$TENANT_USER:$TENANT_USER" "${APP_DIR}/.env"
  sudo chmod 600 "${APP_DIR}/.env"
  ok "Wrote $APP_DIR/.env (chmod 600)"
fi

# pg_hba.conf — allow connections from the rootless Podman container.
# The container reaches Postgres via host.containers.internal which NATs
# to the droplet's public IP, so we need an explicit host line for it.
# Without this, /api/health returns {"db":"unreachable"} forever.
if [[ -f "$PG_HBA" ]]; then
  HBA_RULE="host    ${DB_NAME}         ${DB_USER}       ${DROPLET_IP}/32      scram-sha-256"
  if sudo grep -q "^host[[:space:]]\+${DB_NAME}[[:space:]]\+${DB_USER}[[:space:]]\+${DROPLET_IP}/32" "$PG_HBA"; then
    ok "pg_hba.conf already allows $DB_USER@$DROPLET_IP"
  else
    echo "$HBA_RULE" | sudo tee -a "$PG_HBA" >/dev/null
    sudo systemctl reload postgresql
    ok "Appended pg_hba rule for $DB_USER@$DROPLET_IP and reloaded postgresql"
  fi
else
  note "pg_hba.conf not found at $PG_HBA — set PG_VERSION / PG_HBA env to fix"
fi
echo

# ── 4. Run initial schema migration ───────────────────────────
echo "[4/5] Schema migration"
if [[ ! -f "$SCHEMA_SQL" ]]; then
  fail "Schema SQL not found at $SCHEMA_SQL — scp drizzle/0000_initial.sql first"
fi
# Apply as postgres superuser so we own the schema cleanly, then ensure
# the tenant user has full privileges on it.
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$SCHEMA_SQL" >/tmp/migrate.log 2>&1 \
  && ok "Migration applied" \
  || { cat /tmp/migrate.log >&2; fail "Migration FAILED"; }

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" <<EOF >/dev/null
GRANT USAGE ON SCHEMA public TO ${DB_USER};
GRANT ALL ON ALL TABLES IN SCHEMA public TO ${DB_USER};
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};
EOF
ok "Privileges granted to $DB_USER"
echo

# ── 5. Sanity check — count tables as the tenant user ─────────
echo "[5/5] Sanity check"
DBURL=$(sudo grep -oP 'DATABASE_URL=\K.*' "${APP_DIR}/.env" 2>/dev/null || true)
if [[ -n "$DBURL" ]]; then
  COUNT=$(PGPASSWORD="$(echo "$DBURL" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')" \
          psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -tAc \
          "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null || echo "?")
  ok "Tenant user can read schema: $COUNT public tables"
fi
echo

hr
echo "  Backend setup complete. Next step (from your laptop):"
echo "    bash scripts/deploy-api.sh"
hr
