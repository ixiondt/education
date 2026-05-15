/* Email sending — v6.0
 *
 * Self-hosted single-family setups won't have Resend / SMTP set up
 * out of the box. EMAIL_STUB=1 (default) returns the magic link in
 * the API response so the parent can copy/paste it directly. When
 * RESEND_API_KEY is set, real email goes out via Resend.
 *
 * Per CLAUDE.md:
 *   - Never log full link tokens
 *   - Generic error to client on send failure
 *   - Server-side log full error
 */

import { logger } from './logger';
import { redactEmail } from './auth';

export type SendResult =
  | { ok: true; stubbed: true; link: string }   // dev / self-hosted
  | { ok: true; stubbed: false }                // real email sent
  | { ok: false; error: string };

const FROM_DEFAULT = 'Letters & Numbers <letters@guardcybersolutionsllc.com>';
const SUBJECT = 'Your sign-in link';

function htmlBody(link: string): string {
  return `
    <p>Hi!</p>
    <p>Tap the link below to sign in to Letters &amp; Numbers. It expires in 15 minutes.</p>
    <p><a href="${link}">${link}</a></p>
    <p>If you didn't ask for this, you can ignore the email.</p>
  `.trim();
}

function textBody(link: string): string {
  return `Hi!\n\nTap the link below to sign in to Letters & Numbers. It expires in 15 minutes.\n\n${link}\n\nIf you didn't ask for this, you can ignore the email.\n`;
}

export async function sendMagicLink(opts: { email: string; link: string }): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.LNUM_EMAIL_FROM || FROM_DEFAULT;
  const stub   = process.env.EMAIL_STUB === '1' || !apiKey;

  if (stub) {
    logger.info({ email: redactEmail(opts.email) }, 'magic-link stubbed (no email sent)');
    return { ok: true, stubbed: true, link: opts.link };
  }

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: opts.email,
        subject: SUBJECT,
        html: htmlBody(opts.link),
        text: textBody(opts.link),
      }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      logger.error({ email: redactEmail(opts.email), status: resp.status, body: text.slice(0, 500) }, 'Resend send failed');
      return { ok: false, error: 'send_failed' };
    }
    logger.info({ email: redactEmail(opts.email) }, 'magic-link sent');
    return { ok: true, stubbed: false };
  } catch (err) {
    logger.error({ email: redactEmail(opts.email), err: (err as Error).message }, 'Resend network error');
    return { ok: false, error: 'send_failed' };
  }
}
