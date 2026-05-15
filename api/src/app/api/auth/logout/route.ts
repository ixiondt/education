/* POST /api/auth/logout — clears the session cookie. Stateless: no
 * server-side session to invalidate (signed JWT-style token); we
 * just blank the cookie. */

import { sessionCookieOptions } from '@/lib/auth';

export async function POST() {
  const opts = sessionCookieOptions();
  const res = Response.json({ ok: true });
  res.headers.append('Set-Cookie',
    `${opts.name}=; HttpOnly; ${opts.secure ? 'Secure; ' : ''}SameSite=${opts.sameSite}; Path=${opts.path}; Max-Age=0`
  );
  return res;
}
