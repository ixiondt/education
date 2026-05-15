/* GET /api/auth/me — return the current signed-in parent, if any.
 * Used by the client to check sign-in state on app load. */

import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ ok: true, signedIn: false });
  }
  return Response.json({
    ok: true,
    signedIn: true,
    parent: { id: session.parentId, email: session.email },
  });
}
