import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

/* GET /api/health
 *
 * Cheap liveness probe — process is up + DB ping succeeds.
 * Used by:
 *   - Container healthcheck in podman-compose.yml
 *   - The PWA's first contact when sync is enabled
 *   - Uptime monitoring (Uptime Kuma on the droplet)
 *
 * Returns 200 with status info, or 503 if the DB ping fails.
 * Per ~/.claude/CLAUDE.md: this is liveness, not readiness — that's
 * /api/sync/probe (which actually queries the schema). */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    const dbMs = Date.now() - start;
    return NextResponse.json({
      status:    'ok',
      version:   '0.1.0',
      db:        'reachable',
      dbLatencyMs: dbMs,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    logger.error({ err: message }, 'Health check DB ping failed');
    return NextResponse.json({
      status:    'degraded',
      version:   '0.1.0',
      db:        'unreachable',
    }, { status: 503 });
  }
}
