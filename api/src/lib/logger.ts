import pino from 'pino';

/* Structured JSON logging. Respects LOG_LEVEL env (defaults to info in
 * production, debug in dev). Sensitive keys are redacted before serialization
 * per ~/.claude/CLAUDE.md guidance.
 *
 * Use createRouteLogger(routeName, traceId) inside API routes to thread
 * the trace ID through every log line of a single request, then echo
 * the trace ID back in the API error response so users can quote it. */

const isProd = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  redact: {
    /* Pino's redact path syntax doesn't accept bare hyphens in keys —
       wrap header names that contain hyphens with bracket notation. */
    paths: [
      'password', 'passwordHash', 'token', 'secret',
      'clientSecret', 'encryptionKey', 'DATABASE_URL',
      'authorization', 'cookie',
      '*["set-cookie"]', 'headers["set-cookie"]',
    ],
    censor: '[redacted]',
  },
  formatters: {
    level(label) { return { level: label }; },
  },
});

export function createRouteLogger(route: string, traceId: string) {
  return logger.child({ route, traceId });
}
