import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api-error';
import { logger } from '@/lib/logger';

/* GET /api/sync/probe
 *
 * Readiness — confirms the schema is migrated and counts rows in each
 * expected table. Returns the same 'ready: true' shape v5 Turn 2's
 * actual sync push/pull endpoints will use, so the PWA can branch on
 * 'is this server v1+'.
 *
 * Public endpoint (no auth) — only returns counts, never row data. */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TABLES = [
  'parents',
  'children',
  'devices',
  'skill_progress',
  'play_events',
  'session_summaries',
  'magic_links',
] as const;

interface ProbeResult {
  ready: boolean;
  version: string;
  tables: Record<string, number>;
  missing?: string[];
  timestamp: string;
}

export async function GET() {
  const tables: Record<string, number> = {};
  const missing: string[] = [];
  for (const table of TABLES) {
    try {
      const rows = await db.execute(
        sql.raw(`SELECT COUNT(*)::int AS n FROM ${table}`),
      );
      const row = (Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows) as { n: number }[] | undefined;
      tables[table] = row?.[0]?.n ?? 0;
    } catch (err) {
      missing.push(table);
      logger.warn({ table, err: err instanceof Error ? err.message : err }, 'Probe table check failed');
    }
  }

  const ready = missing.length === 0;
  if (!ready) {
    return apiError('INTERNAL', 'Schema not fully migrated', {
      details: { missing },
      retryable: false,
    });
  }

  const result: ProbeResult = {
    ready,
    version: '0.1.0',
    tables,
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(result);
}
