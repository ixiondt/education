/* GET /api/sync/pull?since=<ISO8601>&childId=<uuid>
 *
 * Auth: session cookie required.
 * Returns events for one of the parent's children since the given
 * server_ts cursor. Caller persists the max server_ts they receive
 * and uses that as the next `since`.
 *
 * Includes a `children` summary so a fresh device can populate
 * the picker before syncing events.
 */

import { NextRequest } from 'next/server';
import { and, eq, gt, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { children, playEvents } from '@/lib/schema';
import { getSession } from '@/lib/auth';
import { apiError } from '@/lib/api-error';
import { createRouteLogger } from '@/lib/logger';

const MAX_BATCH = 500;

export async function GET(req: NextRequest) {
  const traceId = crypto.randomUUID();
  const log = createRouteLogger('sync.pull', traceId);
  const session = await getSession();
  if (!session) return apiError('UNAUTHORIZED', 'Sign in to sync', { status: 401 });

  const childId = req.nextUrl.searchParams.get('childId')?.trim();
  const sinceRaw = req.nextUrl.searchParams.get('since')?.trim();

  // Always return the parent's child roster so the client can render
  // the profile picker before any event arrives.
  const myChildren = await db.select({
    id: children.id, name: children.name, ageMonths: children.ageMonths, createdAt: children.createdAt,
  }).from(children).where(eq(children.parentId, session.parentId));

  if (!childId) {
    return Response.json({ ok: true, children: myChildren, events: [], traceId });
  }

  // Authorisation
  const own = myChildren.find((c) => c.id === childId);
  if (!own) return apiError('FORBIDDEN', 'Not your child', { status: 403 });

  const since = sinceRaw ? new Date(sinceRaw) : new Date(0);
  if (Number.isNaN(since.getTime())) {
    return apiError('INVALID_INPUT', 'since must be ISO8601', { status: 400 });
  }

  try {
    const rows = await db.select({
      id: playEvents.id,
      skillId: playEvents.skillId,
      success: playEvents.success,
      durationMs: playEvents.durationMs,
      mode: playEvents.mode,
      clientTs: playEvents.clientTs,
      serverTs: playEvents.serverTs,
    }).from(playEvents)
      .where(and(eq(playEvents.childId, childId), gt(playEvents.serverTs, since)))
      .orderBy(asc(playEvents.serverTs))
      .limit(MAX_BATCH);

    const nextCursor = rows.length ? rows[rows.length - 1].serverTs : since;

    log.info({ childId, returned: rows.length }, 'sync pull');
    return Response.json({
      ok: true,
      children: myChildren,
      events: rows,
      nextCursor: nextCursor instanceof Date ? nextCursor.toISOString() : null,
      hasMore: rows.length === MAX_BATCH,
      traceId,
    });
  } catch (err) {
    log.error({ err: (err as Error).message }, 'sync pull failed');
    return apiError('INTERNAL', 'Could not pull events', { status: 500, retryable: true });
  }
}
