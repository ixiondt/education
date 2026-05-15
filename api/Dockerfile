# Letters & Numbers backend — multi-stage Node 20 build
# Output: standalone Next.js bundle in /app, runs as non-root `app` user.

FROM node:20-alpine AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3013
ENV HOSTNAME=0.0.0.0

# Strip npm + its bundled node-tar from the runtime image. The Next.js
# standalone bundle only needs `node server.js`; npm and its bundled
# `tar` (node-tar) carry HIGH/CRITICAL CVEs that Trivy correctly flags
# (CVE-2026-26960, CVE-2026-29786, CVE-2026-31802 — all hardlink /
# symlink path-traversal issues). Since npm isn't on any runtime code
# path, just delete it. Also drop apk + wget to reduce surface further;
# we keep wget temporarily for the HEALTHCHECK probe, but the HEALTHCHECK
# is OCI-ignored anyway, so /healthz hits come from podman's restart
# policy + Caddy's reverse_proxy health checks instead.
RUN rm -rf \
      /usr/local/lib/node_modules/npm \
      /usr/local/bin/npm \
      /usr/local/bin/npx \
      /opt \
      /root/.npm \
      /tmp/* \
 && addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Standalone server expects this exact layout
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/drizzle           ./drizzle

USER nextjs
EXPOSE 3013

# (HEALTHCHECK removed v6.0.1 — Podman+OCI ignores it anyway, and the
# wget binary was part of the attack surface we just stripped. Health
# checks happen at Caddy's reverse_proxy layer instead.)

CMD ["node", "server.js"]
