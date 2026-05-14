# CI auto-deploy — one-time setup

This repo has two GitHub Actions workflows under `.github/workflows/`:

| Workflow | Trigger | What it deploys |
|---|---|---|
| `deploy-static.yml` | push to `main` affecting `index.html`, `*.js`, `*.css`, `sw.js`, `manifest.webmanifest`, `icons/**`, `tools/**` | The static PWA. rsync → droplet → Caddy reload → smoke-test. |
| `deploy-api.yml` | push to `main` affecting `api/**` or `caddy-letters.conf` | The backend container. Build off-host → ghcr.io → droplet pulls → restart → smoke-test. |

Both follow the rules in `~/.claude/CLAUDE.md` § CI/CD: **build off-host, blocking gates, two image tags, image-based rollback.**

Manual deploys (`bash scripts/deploy.sh` / `bash scripts/deploy-api.sh`) still work and produce identical droplet state — useful when CI is down or for hot-fixes.

---

## One-time setup (~10 minutes)

You need three things in place before the first auto-deploy will succeed:

1. **An SSH key the runner can use to reach the droplet** (added to droplet + GH repo secrets)
2. **`DROPLET_HOST` repo secret** with the droplet IP
3. **The ghcr.io package set to public** after the first image push (so the droplet can pull without auth)

### 1. Create a dedicated SSH key for CI

Do this on your laptop. Keep the key **only for CI** — don't reuse your personal key. ed25519 is the modern default; smaller and faster than RSA.

```bash
# Make a CI-only key. No passphrase — the runner has no human to type one.
ssh-keygen -t ed25519 -C "ci-deploy@letters-and-numbers" -f ~/.ssh/lnum_ci_deploy -N ""

# Copy the PUBLIC key to the droplet's authorized_keys for the deploy user.
# (Append, don't overwrite — your personal key stays.)
cat ~/.ssh/lnum_ci_deploy.pub | ssh deploy@192.241.132.219 \
  "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"

# Verify the new key works (this should land you on the droplet without prompting):
ssh -i ~/.ssh/lnum_ci_deploy deploy@192.241.132.219 'echo "✓ CI key works on droplet"; whoami'
```

If `whoami` prints `deploy`, the key is good. You can now delete the public key from your laptop (`~/.ssh/lnum_ci_deploy.pub`) if you want — it's already on the droplet.

### 2. Add repo secrets

GitHub → your repo → **Settings → Secrets and variables → Actions → New repository secret**. Create both:

| Name | Value |
|---|---|
| `DROPLET_SSH_KEY` | **Full contents of `~/.ssh/lnum_ci_deploy`** (the *private* key). Open the file, copy everything from `-----BEGIN OPENSSH PRIVATE KEY-----` through `-----END OPENSSH PRIVATE KEY-----` including those lines and the trailing newline. |
| `DROPLET_HOST` | `192.241.132.219` (just the IP — the workflows use `deploy@` as the user) |

Quick check after saving: the workflow's "Configure SSH" step should print `Warning: Permanently added '192.241.132.219' (ED25519) to the list of known hosts.` on first run. If you see `Permission denied (publickey)` instead, the private-key paste is malformed (usually a missing trailing newline or BOM).

### 3. First deploy + make the ghcr image public

The first push that touches `api/**` will run `deploy-api.yml`. It will:

- Build the image and push to `ghcr.io/<your-github-user>/letters-and-numbers-api` (lowercased automatically)
- Try to pull it on the droplet — **this first pull will fail** because the package is private by default and the droplet has no GH auth

**To fix once after the first successful push:**

1. GitHub → your profile → **Packages** → click `letters-and-numbers-api`
2. **Package settings** (right side) → scroll to **Danger Zone** → **Change visibility** → **Public** → confirm with the package name

The next deploy will succeed. If you prefer to keep the image private, see "Private package" below.

### Verify

Trigger a no-op deploy to confirm everything wires up:

```bash
# From your laptop, on a clean working tree:
git commit --allow-empty -m "chore: trigger CI auto-deploy smoke test"
git push origin main
```

Watch the **Actions** tab. Both workflows skip themselves because no relevant paths changed — but you can manually fire either via **workflow_dispatch**:

GitHub → **Actions** → pick a workflow → **Run workflow** → branch `main` → green button.

Both should finish under 90s (static) or 4 min (API, includes Trivy scan).

---

## Rollback

CI tags every release with both `:<git-sha>` and `:latest`. Old images stay on the droplet for at least 7 days. To roll back without GHA:

```bash
ssh deploy@192.241.132.219
sudo -u lnum-deploy -i bash
cd /opt/apps/letters-and-numbers-api

# List images, find the previous SHA
podman images ghcr.io/ixiondt/letters-and-numbers-api

# Retag previous SHA as :latest and restart
PREV_SHA=<paste the SHA you want>
podman tag ghcr.io/ixiondt/letters-and-numbers-api:$PREV_SHA \
           ghcr.io/ixiondt/letters-and-numbers-api:latest
podman ps -a --filter name=lnum-api -q | xargs -r podman rm -f
podman-compose up -d --no-build
curl -s http://127.0.0.1:3013/api/health
```

---

## Private package (optional, advanced)

If the API image ever contains PII or proprietary code and you want it kept private, the droplet needs a GitHub PAT scoped to `read:packages` to pull it. One-time setup:

```bash
# On GitHub: create a fine-grained PAT with only `read:packages` permission,
# expiring in 1 year. Copy the token.

# On the droplet, as lnum-deploy:
ssh deploy@192.241.132.219
sudo -u lnum-deploy -i bash
echo "<PAT>" | podman login ghcr.io --username <github-user> --password-stdin
# Credentials are stored at ~/.config/containers/auth.json (chmod 600 by default).
```

After that, `podman pull` of private ghcr images works as the `lnum-deploy` user. Set a calendar reminder one month before the PAT expires.

---

## What CI does NOT touch

- `audio/` — gitignored, 290+ MP3s on the droplet. Updated separately via `bash scripts/deploy-audio.sh` from your laptop when you regenerate voices.
- `.env` on the droplet — written once by `scripts/setup-droplet-api.sh` (chmod 600), never touched by deploys.
- The Caddyfile itself — `caddy-letters.conf` is a tracked source snippet, but the workflow doesn't paste it into `/opt/apps/shared/caddy/Caddyfile`. Caddy edits stay manual to avoid one bad commit breaking every tenant. (Future: a dedicated `deploy-caddy.yml` that diffs + reloads if you want it.)
- DB migrations — the initial migration was applied by `setup-droplet-api.sh`. Future migrations should run via a separate workflow step before the container restart (`drizzle-kit migrate` against `DATABASE_URL`), once we add migration scripts under `api/scripts/migrate.ts`.

---

## Cost

GitHub Actions on a personal account: 2,000 minutes/month free. Each `deploy-api` run uses ~3 min, `deploy-static` ~30s. At 50 deploys/month that's still well under the cap — and most pushes touch only one of the two workflows.

GHCR storage: 500 MB free for public packages, free regardless for unauth pulls. Image size is ~150 MB so you can keep 3 full versions before pruning matters.
