/* GET /api/auth/verify?token=X
 *
 * Verifies a magic-link token, marks it used, sets a session cookie,
 * and returns the parent profile. Single-use — replaying a verified
 * token fails.
 *
 * Returns 200 + parent JSON on success, or 4xx with API Error envelope
 * on failure.
 */

import { NextRequest } from 'next/server';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { parents, magicLinks } from '@/lib/schema';
import { makeSession, sessionCookieOptions, rateLimited, clientIp } from '@/lib/auth';
import { apiError } from '@/lib/api-error';
import { createRouteLogger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  const traceId = crypto.randomUUID();
  const log = createRouteLogger('auth.verify', traceId);

  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return apiError('RATE_LIMITED', 'Too many requests, try again shortly', {
      retryAfter: 10,
    });
  }

  const token = req.nextUrl.searchParams.get('token')?.trim();
  if (!token || token.length < 16 || token.length > 200) {
    return apiError('INVALID_INPUT', 'Token is required', { status: 400 });
  }

  try {
    // Atomically: find unused, unexpired link → mark used. Single
    // UPDATE...WHERE so a parallel replay loses the race.
    const now = new Date();
    const claimed = await db.update(magicLinks)
      .set({ usedAt: now })
      .where(and(
        eq(magicLinks.token, token),
        isNull(magicLinks.usedAt),
        gt(magicLinks.expiresAt, now),
      ))
      .returning({ email: magicLinks.email, parentId: magicLinks.parentId });

    if (!claimed.length || !claimed[0].parentId) {
      log.warn({}, 'invalid or expired token');
      return apiError('UNAUTHORIZED', 'This sign-in link is invalid or has expired');
    }

    const { email, parentId } = claimed[0];

    // Update last_login
    await db.update(parents).set({ lastLogin: now }).where(eq(parents.id, parentId));

    const sessionToken = makeSession(parentId, email);
    const cookieOpts = sessionCookieOptions();

    const res = Response.json({
      ok: true,
      parent: { id: parentId, email },
      traceId,
    });
    res.headers.append('Set-Cookie',
      `${cookieOpts.name}=${sessionToken}; HttpOnly; ${cookieOpts.secure ? 'Secure; ' : ''}SameSite=${cookieOpts.sameSite}; Path=${cookieOpts.path}; Max-Age=${cookieOpts.maxAge}`
    );
    log.info({ parentId }, 'sign-in success');
    return res;
  } catch (err) {
    log.error({ err: (err as Error).message }, 'verify failed');
    return apiError('INTERNAL', 'Sign-in could not complete', { status: 500, retryable: true });
  }
}
