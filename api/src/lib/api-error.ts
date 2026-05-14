import { NextResponse } from 'next/server';
import { z } from 'zod';

/* Standard API error envelope per ~/.claude/CLAUDE.md § API Error Contracts.
 *
 *   { error: { code, message, details?, retryable, traceId? } }
 *
 * Stable codes; never leak DB error messages or stack traces. Clients
 * (PWA, future mobile app, CLI tooling) branch on `code`, not `message`.
 */

export type ApiErrorCode =
  | 'INVALID_INPUT'
  | 'RATE_LIMITED'
  | 'UPSTREAM_TIMEOUT'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL';

const STATUS: Record<ApiErrorCode, number> = {
  INVALID_INPUT:    400,
  UNAUTHORIZED:     401,
  FORBIDDEN:        403,
  NOT_FOUND:        404,
  CONFLICT:         409,
  RATE_LIMITED:     429,
  UPSTREAM_TIMEOUT: 504,
  INTERNAL:         500,
};

const RETRYABLE: Partial<Record<ApiErrorCode, boolean>> = {
  RATE_LIMITED:     true,
  UPSTREAM_TIMEOUT: true,
};

/* Zod schema for the envelope — useful for client-side validation and
 * for asserting in route contract tests. */
export const ApiErrorEnvelope = z.object({
  error: z.object({
    code:     z.string(),
    message:  z.string(),
    details:  z.unknown().optional(),
    retryable: z.boolean(),
    traceId:  z.string().optional(),
  }),
});

export interface ApiErrorOpts {
  details?: Record<string, unknown>;
  retryable?: boolean;
  status?: number;
  traceId?: string;
  retryAfter?: number; // seconds — sets Retry-After header on 429
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  opts: ApiErrorOpts = {},
) {
  const status = opts.status ?? STATUS[code];
  const headers = new Headers();
  if (code === 'RATE_LIMITED' && opts.retryAfter != null) {
    headers.set('Retry-After', String(opts.retryAfter));
  }
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details:  opts.details,
        retryable: opts.retryable ?? RETRYABLE[code] ?? false,
        traceId:  opts.traceId,
      },
    },
    { status, headers },
  );
}
