import type { NextConfig } from 'next';

/* Letters & Numbers backend
 * - `output: 'standalone'` so the Docker image only ships node_modules
 *   the app actually uses + the .next bundle. Cuts image size in half.
 * - Telemetry disabled per ~/.claude/CLAUDE.md.
 * - No `x-powered-by` header. Server identification stripped at Caddy
 *   too (see caddy-letters.conf).
 */
const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  /* In v5+ when we add Auth.js / cookies we'll need to declare the
     cookie domain. For now this is a pure-API tenant. */
  experimental: {
    // (none yet)
  },
};

export default config;
