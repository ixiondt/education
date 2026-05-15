/* POST /api/auth/request-link
 *
 * Body: { email: string }
 *
 * Creates (or reuses) a parent record + a magic_links row with
 * 15-minute TTL, then attempts to email the link. If EMAIL_STUB=1
 * (default for self-hosted), returns the link in the response so
 * the parent can use it directly.
 *
 * Rate limited to 3 requests / 10 seconds per IP.
 * Always responds 200 to avoid leaking "this email is registered."
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { parents, magicLinks } from '@/lib/schema';
import { newToken, magicLinkExpiry, rateLimited, clientIp, redactEmail } from '@/lib/auth';
import { sendMagicLink } from '@/lib/email';
import { apiError } from '@/lib/api-error';
import { createRouteLogger } from '@/lib/logger';

const RequestSchema = z.object({
  email: z.string().email().max(200).toLowerCase(),
});

function siteOrigin(req: NextRequest): string {
  return (
    process.env.PUBLIC_ORIGIN
    ?? req.headers.get('origin')
    ?? `https://${req.headers.get('host') ?? 'letters.guardcybersolutionsllc.com'}`
  );
}

export async function POST(req: NextRequest) {
  const traceId = crypto.randomUUID();
  const log = createRouteLogger('auth.request-link', traceId);

  const ip = clientIp(req);
  if (rateLimited(ip)) {
    log.warn({ ip }, 'rate limited');
    return apiError('RATE_LIMITED', 'Too many requests, try again shortly', {
      retryAfter: 10,
    });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError('INVALID_INPUT', 'Body must be JSON', { status: 400 }); }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('INVALID_INPUT', 'Email is required and must be valid',
                    { status: 400, details: { issues: parsed.error.issues.map((i) => i.path.join('.')) } });
  }

  const email = parsed.data.email;
  log.info({ email: redactEmail(email) }, 'magic-link requested');

  try {
    // Upsert the parent
    const existing = await db.select().from(parents).where(eq(parents.email, email)).limit(1);
    let parentId: string;
    if (existing.length) {
      parentId = existing[0].id;
    } else {
      const created = await db.insert(parents).values({ email }).returning({ id: parents.id });
      parentId = created[0].id;
    }

    // Create the magic link row
    const token = newToken();
    await db.insert(magicLinks).values({
      token,
      email,
      parentId,
      expiresAt: magicLinkExpiry(),
    });

    const link = `${siteOrigin(req)}/auth/verify?token=${encodeURIComponent(token)}`;

    // Try to send. Stubbed in dev / self-hosted → link comes back in
    // response. Real Resend → success, link NOT echoed.
    const result = await sendMagicLink({ email, link });
    if (!result.ok) {
      // Don't leak send failures to the client beyond generic — log full server-side
      return Response.json({ ok: true, sent: 'queued', traceId }, { status: 200 });
    }
    return Response.json({
      ok: true,
      sent: result.stubbed ? 'stubbed' : 'email',
      // Only echo the link in stub mode — never in production-email mode
      link: result.stubbed ? result.link : undefined,
      traceId,
    }, { status: 200 });
  } catch (err) {
    log.error({ err: (err as Error).message }, 'request-link failed');
    return apiError('INTERNAL', 'Could not create sign-in link', { status: 500, retryable: true });
  }
}
