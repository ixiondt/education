/* POST /api/sync/push
 *
 * Auth: session cookie required.
 *
 * Body: {
 *   childId?: uuid,      // server-known child id (only after first push)
 *   childKey?: string,   // local stable id from device (used to mint childId)
 *   childName?: string,  // for first-push child creation
 *   childAgeMonths?: number,
 *   deviceId?: string,
 *   events: [
 *     { clientEventId: string, skillId: string, success: bool,
 *       durationMs?: int, mode?: string, clientTs: ISO8601 }
 *   ]
 * }
 *
 * Idempotent: each event has a client-generated unique id; the
 * play_events.client_event_id UNIQUE constraint dedups replays.
 * Returns the canonical child + the count accepted.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { children, playEvents, skillProgress, devices } from '@/lib/schema';
import { getSession } from '@/lib/auth';
import { apiError } from '@/lib/api-error';
import { createRouteLogger } from '@/lib/logger';

const EventSchema = z.object({
  clientEventId: z.string().min(8).max(64),
  skillId:       z.string().min(1).max(120),
  success:       z.boolean(),
  durationMs:    z.number().int().min(0).max(600000).optional(),
  mode:          z.string().max(60).optional(),
  clientTs:      z.string().datetime(),
});

const BodySchema = z.object({
  childId:        z.string().uuid().optional(),
  childKey:       z.string().min(1).max(80).optional(),
  childName:      z.string().min(1).max(80).optional(),
  childAgeMonths: z.number().int().min(0).max(240).optional(),
  deviceId:       z.string().min(1).max(80).optional(),
  events:         z.array(EventSchema).min(0).max(500),
});

export async function POST(req: NextRequest) {
  const traceId = crypto.randomUUID();
  const log = createRouteLogger('sync.push', traceId);
  const session = await getSession();
  if (!session) return apiError('UNAUTHORIZED', 'Sign in to sync', { status: 401 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError('INVALID_INPUT', 'Body must be JSON', { status: 400 }); }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError('INVALID_INPUT', 'Invalid sync body', {
      status: 400,
      details: { issues: parsed.error.issues.map((i) => i.path.join('.')) },
    });
  }
  const data = parsed.data;

  try {
    // 1) Resolve / create the child
    let childId = data.childId ?? null;
    if (!childId) {
      // First push for this child: childName + ageMonths required
      if (!data.childName || data.childAgeMonths == null) {
        return apiError('INVALID_INPUT', 'childId or (childName + childAgeMonths) required', { status: 400 });
      }
      const created = await db.insert(children).values({
        parentId:  session.parentId,
        name:      data.childName,
        ageMonths: data.childAgeMonths,
      }).returning({ id: children.id });
      childId = created[0].id;
      log.info({ childId }, 'created child');
    } else {
      // Authorisation — child must belong to this parent
      const own = await db.select({ id: children.id })
        .from(children)
        .where(and(eq(children.id, childId), eq(children.parentId, session.parentId)))
        .limit(1);
      if (!own.length) return apiError('FORBIDDEN', 'Not your child', { status: 403 });
    }

    // 2) Claim / refresh the device row (best-effort)
    if (data.deviceId) {
      // ON CONFLICT (id) DO UPDATE — simple upsert
      await db.insert(devices).values({
        id: data.deviceId,
        childId,
        parentId: session.parentId,
        claimedAt: new Date(),
        lastSyncAt: new Date(),
        userAgent: req.headers.get('user-agent')?.slice(0, 200) ?? null,
      }).onConflictDoUpdate({
        target: devices.id,
        set: {
          childId,
          parentId: session.parentId,
          lastSyncAt: new Date(),
        },
      });
    }

    // 3) Insert events — ON CONFLICT (client_event_id) DO NOTHING
    let accepted = 0;
    if (data.events.length) {
      const rows = data.events.map((e) => ({
        childId: childId!,
        skillId: e.skillId,
        success: e.success,
        durationMs: e.durationMs ?? null,
        mode: e.mode ?? null,
        clientTs: new Date(e.clientTs),
        deviceId: data.deviceId ?? null,
        clientEventId: e.clientEventId,
      }));
      const inserted = await db.insert(playEvents).values(rows)
        .onConflictDoNothing({ target: playEvents.clientEventId })
        .returning({ id: playEvents.id });
      accepted = inserted.length;

      // 4) Bump skill_progress aggregates per (child, skill)
      // One UPSERT per distinct skillId. Cheap enough for the small
      // batches a single device produces.
      const perSkill = new Map<string, { successes: number; attempts: number; last: Date }>();
      for (const e of data.events) {
        const cur = perSkill.get(e.skillId) ?? { successes: 0, attempts: 0, last: new Date(0) };
        cur.attempts += 1;
        if (e.success) cur.successes += 1;
        const ts = new Date(e.clientTs);
        if (ts > cur.last) cur.last = ts;
        perSkill.set(e.skillId, cur);
      }
      for (const [skillId, agg] of perSkill) {
        await db.insert(skillProgress).values({
          childId: childId!,
          skillId,
          successes: agg.successes,
          attempts:  agg.attempts,
          lastSeenAt: agg.last,
        }).onConflictDoUpdate({
          target: [skillProgress.childId, skillProgress.skillId],
          set: {
            successes:  sql`${skillProgress.successes} + ${agg.successes}`,
            attempts:   sql`${skillProgress.attempts}  + ${agg.attempts}`,
            lastSeenAt: agg.last,
          },
        });
      }
    }

    log.info({ childId, total: data.events.length, accepted }, 'sync push complete');
    return Response.json({
      ok: true,
      childId,
      received: data.events.length,
      accepted,
      traceId,
    });
  } catch (err) {
    log.error({ err: (err as Error).message }, 'sync push failed');
    return apiError('INTERNAL', 'Could not sync', { status: 500, retryable: true });
  }
}
