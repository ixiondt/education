/* GET /api/dashboard/summary
 *
 * Auth: session cookie required.
 *
 * Returns an aggregated read-side view of the synced data for
 * the parent's children, suitable for a one-pager dashboard:
 *
 *   {
 *     parent:   { id, email },
 *     children: [{ id, name, ageMonths,
 *                  totals: { attempts, successes, mastered },
 *                  bySkillCategory: { 'letter-recognize': {a,s,m}, ... },
 *                  byMode:          { 'find-letters': {a,s}, ... },
 *                  last7Days:       [{ day:'YYYY-MM-DD', attempts, successes }, ...],
 *                  recentEvents:    [{ skillId, success, clientTs }, ...]  (latest 10)
 *               }],
 *     devices:  [{ id, childId, lastSyncAt }],
 *   }
 *
 * The PWA renders this as charts + tables. Pure read; no mutation.
 * Mastered is computed inline: `mastered_at IS NOT NULL`.
 */

import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { children, devices, playEvents, skillProgress } from '@/lib/schema';
import { getSession } from '@/lib/auth';
import { apiError } from '@/lib/api-error';
import { createRouteLogger } from '@/lib/logger';

const RECENT_EVENT_LIMIT = 10;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function startOf7DaysAgo(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 6);
  return d;
}

/* skillId convention from curriculum.js + v5.18+ EF synthetic IDs:
     letter-recognize-A, letter-sound-X, letter-trace-Z,
     number-recognize-7, number-trace-3, count-5,
     phoneme-rhyme-cat, phoneme-first-S, phoneme-blend-cat,
     sight-the, math-+-7-6, ef-working-memory-len-3, ...
   We bucket by the leading segment(s) before the variable part. */
function skillCategory(skillId: string): string {
  // Specific multi-segment categories first
  if (skillId.startsWith('letter-recognize')) return 'letter-recognize';
  if (skillId.startsWith('letter-sound'))     return 'letter-sound';
  if (skillId.startsWith('letter-trace'))     return 'letter-trace';
  if (skillId.startsWith('letter-word'))      return 'letter-word';
  if (skillId.startsWith('number-recognize')) return 'number-recognize';
  if (skillId.startsWith('number-trace'))     return 'number-trace';
  if (skillId.startsWith('phoneme-rhyme'))    return 'phoneme-rhyme';
  if (skillId.startsWith('phoneme-first'))    return 'phoneme-first';
  if (skillId.startsWith('phoneme-blend'))    return 'phoneme-blend';
  if (skillId.startsWith('ef-working-memory'))      return 'ef-working-memory';
  if (skillId.startsWith('ef-response-inhibition')) return 'ef-response-inhibition';
  if (skillId.startsWith('ef-cognitive-flexibility')) return 'ef-cognitive-flexibility';
  if (skillId.startsWith('ef-sustained-attention')) return 'ef-sustained-attention';
  if (skillId.startsWith('ef-metacognition'))       return 'ef-metacognition';
  if (skillId.startsWith('ef-emotional-regulation')) return 'ef-emotional-regulation';
  if (skillId.startsWith('ef-body-movement'))       return 'ef-body-movement';
  if (skillId.startsWith('ef-self-awareness'))      return 'ef-self-awareness';
  if (skillId.startsWith('ef-body-break'))          return 'ef-body-break';
  if (skillId.startsWith('ef-gratitude'))           return 'ef-gratitude';
  if (skillId.startsWith('health-food-sort'))   return 'health-food-sort';
  if (skillId.startsWith('arts-drawing'))        return 'arts-drawing';
  if (skillId.startsWith('arts-rhythm'))         return 'arts-rhythm';
  if (skillId.startsWith('ethics-empathy'))      return 'ethics-empathy';
  if (skillId.startsWith('ethics-gratitude'))    return 'ethics-gratitude';
  if (skillId.startsWith('nature-'))             return 'nature';
  if (skillId.startsWith('math-measure'))        return 'math-measure';
  if (skillId.startsWith('math-spatial'))        return 'math-spatial';
  if (skillId.startsWith('society-'))            return 'society';
  if (skillId.startsWith('sight-'))              return 'sight-word';
  if (skillId.startsWith('count-'))              return 'count';
  if (skillId.startsWith('math-+'))              return 'math-add';
  if (skillId.startsWith('math--'))              return 'math-sub';
  if (skillId.startsWith('math-×'))              return 'math-mul';
  if (skillId.startsWith('math-÷'))              return 'math-div';
  // Fallback — leading dash-separated tag
  const dash = skillId.indexOf('-');
  return dash > 0 ? skillId.slice(0, dash) : skillId;
}

export async function GET() {
  const traceId = crypto.randomUUID();
  const log = createRouteLogger('dashboard.summary', traceId);
  const session = await getSession();
  if (!session) return apiError('UNAUTHORIZED', 'Sign in to view dashboard');

  try {
    // Children belonging to the parent
    const kids = await db.select({
      id: children.id, name: children.name, ageMonths: children.ageMonths, createdAt: children.createdAt,
    }).from(children).where(eq(children.parentId, session.parentId));

    if (!kids.length) {
      return Response.json({
        ok: true,
        parent:   { id: session.parentId, email: session.email },
        children: [],
        devices:  [],
        traceId,
      });
    }

    const kidIds = kids.map((k) => k.id);

    // All skill_progress rows for these kids (one query for the lot)
    const progress = await db.select({
      childId:    skillProgress.childId,
      skillId:    skillProgress.skillId,
      successes:  skillProgress.successes,
      attempts:   skillProgress.attempts,
      lastSeenAt: skillProgress.lastSeenAt,
      masteredAt: skillProgress.masteredAt,
    }).from(skillProgress).where(sql`${skillProgress.childId} = ANY(${kidIds})`);

    // 7-day rollup per child via SQL (avoids pulling thousands of events)
    const sevenAgo = startOf7DaysAgo();
    const dailyRollup = await db.execute(sql`
      SELECT
        child_id::text AS child_id,
        date_trunc('day', client_ts)::date::text AS day,
        COUNT(*)::int                              AS attempts,
        COUNT(*) FILTER (WHERE success)::int       AS successes,
        mode
      FROM play_events
      WHERE child_id = ANY(${kidIds}::uuid[])
        AND client_ts >= ${sevenAgo}
      GROUP BY child_id, day, mode
      ORDER BY day ASC
    `);

    // Recent 10 events per child
    const recent = await db.select({
      childId:  playEvents.childId,
      skillId:  playEvents.skillId,
      success:  playEvents.success,
      mode:     playEvents.mode,
      clientTs: playEvents.clientTs,
    }).from(playEvents)
      .where(sql`${playEvents.childId} = ANY(${kidIds}::uuid[])`)
      .orderBy(desc(playEvents.clientTs))
      .limit(RECENT_EVENT_LIMIT * kidIds.length);

    // Devices for the parent
    const myDevices = await db.select({
      id: devices.id, childId: devices.childId, lastSyncAt: devices.lastSyncAt,
    }).from(devices).where(eq(devices.parentId, session.parentId));

    // Roll everything up per child
    const result = kids.map((k) => {
      const progressRows = progress.filter((p) => p.childId === k.id);
      const totals = progressRows.reduce(
        (acc, p) => ({
          attempts: acc.attempts + p.attempts,
          successes: acc.successes + p.successes,
          mastered: acc.mastered + (p.masteredAt ? 1 : 0),
        }),
        { attempts: 0, successes: 0, mastered: 0 }
      );
      // bySkillCategory: { category: { attempts, successes, mastered } }
      const bySkillCategory: Record<string, { attempts: number; successes: number; mastered: number }> = {};
      for (const p of progressRows) {
        const cat = skillCategory(p.skillId);
        const slot = bySkillCategory[cat] ?? { attempts: 0, successes: 0, mastered: 0 };
        slot.attempts  += p.attempts;
        slot.successes += p.successes;
        if (p.masteredAt) slot.mastered += 1;
        bySkillCategory[cat] = slot;
      }
      // byMode + last7Days from the rollup
      const byMode: Record<string, { attempts: number; successes: number }> = {};
      const dayMap: Record<string, { attempts: number; successes: number }> = {};
      for (const row of dailyRollup as unknown as Array<{
        child_id: string; day: string; attempts: number; successes: number; mode: string | null;
      }>) {
        if (row.child_id !== k.id) continue;
        const m = row.mode ?? 'unknown';
        const slot = byMode[m] ?? { attempts: 0, successes: 0 };
        slot.attempts  += row.attempts;
        slot.successes += row.successes;
        byMode[m] = slot;
        const d = dayMap[row.day] ?? { attempts: 0, successes: 0 };
        d.attempts  += row.attempts;
        d.successes += row.successes;
        dayMap[row.day] = d;
      }
      // Fill last7Days with zeros for missing days so the chart is gap-free
      const last7Days: Array<{ day: string; attempts: number; successes: number }> = [];
      const start = startOf7DaysAgo();
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const key = ymd(d);
        last7Days.push({ day: key, ...(dayMap[key] ?? { attempts: 0, successes: 0 }) });
      }
      const recentEvents = recent.filter((e) => e.childId === k.id).slice(0, RECENT_EVENT_LIMIT);
      return {
        id: k.id,
        name: k.name,
        ageMonths: k.ageMonths,
        totals,
        bySkillCategory,
        byMode,
        last7Days,
        recentEvents,
      };
    });

    log.info({ kids: kids.length, devices: myDevices.length }, 'dashboard summary');
    return Response.json({
      ok: true,
      parent:   { id: session.parentId, email: session.email },
      children: result,
      devices:  myDevices,
      traceId,
    });
  } catch (err) {
    log.error({ err: (err as Error).message }, 'dashboard summary failed');
    return apiError('INTERNAL', 'Could not load dashboard', { status: 500, retryable: true });
  }
}
