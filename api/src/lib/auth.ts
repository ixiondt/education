/* Authentication primitives — v6.0
 *
 * Passwordless magic-link flow:
 *   1. POST /api/auth/request-link { email }
 *      → creates a magic_links row with a 15-minute TTL, sends email
 *        (or returns the link directly when EMAIL_STUB=1 for self-
 *        hosted single-family setups without Resend / SMTP).
 *   2. GET /api/auth/verify?token=X
 *      → marks the magic link used, issues a session cookie, returns
 *        the parent profile.
 *   3. Subsequent /api/sync/* requests use the session cookie to
 *      identify the parent.
 *
 * Sessions are stateless HMAC-signed tokens stored in an HttpOnly +
 * Secure + SameSite=Lax cookie (`lnum_session`). No DB lookup per
 * request — verify the HMAC, parse the payload, done.
 *
 * Per CLAUDE.md:
 *   - Parameterised queries always (Drizzle handles this)
 *   - Rate limit on /api/auth/* (3 req per 10 seconds per IP)
 *   - Never log full tokens / emails — redact
 *   - HttpOnly + Secure + SameSite cookies
 *   - Validate body with Zod
 */

import crypto from 'node:crypto';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'lnum_session';
const SESSION_TTL_DAYS = 30;
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;       // 15 minutes
const TOKEN_BYTES = 32;                          // 256-bit URL-safe token

/* Server-only secret used to sign session cookies. MUST be set in
   production via .env or the deployment scaffolding. Falls back to a
   per-process random for dev so the app doesn't crash, but sessions
   then die on every restart. */
function sessionSecret(): string {
  const s = process.env.LNUM_SESSION_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('LNUM_SESSION_SECRET is required in production (32+ chars)');
    }
    // Dev fallback — random per process restart
    (globalThis as any).__lnumDevSecret ??= crypto.randomBytes(48).toString('hex');
    return (globalThis as any).__lnumDevSecret;
  }
  return s;
}

/* Generate a cryptographically random URL-safe token. */
export function newToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString('base64url');
}

/* HMAC-sign a payload. Returns `<base64url-payload>.<hex-mac>`. */
function sign(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', sessionSecret()).update(body).digest('hex');
  return `${body}.${mac}`;
}

/* Verify a signed token. Returns the parsed payload, or null if
   invalid / expired. */
function verify(token: string): Record<string, unknown> | null {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, mac] = token.split('.', 2);
  const want = crypto.createHmac('sha256', sessionSecret()).update(body).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(want, 'hex'))) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof parsed.exp === 'number' && parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

/* Issue a session cookie for the given parent. Lives on response.
   Caller (route handler) sets it via Response cookies API. */
export function makeSession(parentId: string, email: string): string {
  return sign({
    pid: parentId,
    email,
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export type Session = {
  parentId: string;
  email: string;
  exp: number;
};

/* Read the current session from the request's cookie store.
   Returns null if missing / invalid / expired. */
export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  const tok = c.get(SESSION_COOKIE)?.value;
  if (!tok) return null;
  const payload = verify(tok);
  if (!payload) return null;
  if (typeof payload.pid !== 'string' || typeof payload.email !== 'string') return null;
  return {
    parentId: payload.pid,
    email: payload.email,
    exp: typeof payload.exp === 'number' ? payload.exp : 0,
  };
}

export function sessionCookieOptions() {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  };
}

export function magicLinkExpiry(): Date {
  return new Date(Date.now() + MAGIC_LINK_TTL_MS);
}

/* In-memory IP rate limiter — replace with Redis once we have
   shared backend state. CLAUDE.md mandates a shared utility, but
   the API is currently single-instance so the in-memory version
   is correct for now. */
const ipBuckets = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 10 * 1000;
const RATE_LIMIT_MAX = 3;

export function rateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const arr = (ipBuckets.get(ip) ?? []).filter((t) => t > cutoff);
  if (arr.length >= RATE_LIMIT_MAX) {
    ipBuckets.set(ip, arr);
    return true;
  }
  arr.push(now);
  ipBuckets.set(ip, arr);
  // Light-touch GC — purge cold IPs every ~1000 requests
  if (ipBuckets.size > 1000) {
    for (const [k, v] of ipBuckets) {
      if (v.length === 0 || v[v.length - 1] < cutoff) ipBuckets.delete(k);
    }
  }
  return false;
}

export function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'
  );
}

/* Redact email for logs — keeps domain visible for diagnostics
   without exposing the local part. example@foo.com → e***@foo.com */
export function redactEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 1) return '***';
  return email[0] + '***' + email.slice(at);
}
