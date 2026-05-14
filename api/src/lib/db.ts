import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/* Database connection — module-level singleton, lazily instantiated.
 * Connection pool sized for the small expected concurrency of a single
 * tenant on a shared Postgres instance. */

const connectionString = process.env.DATABASE_URL;
if (!connectionString && process.env.NODE_ENV !== 'test') {
  // Don't throw at import time during build — only when actually used.
  // eslint-disable-next-line no-console
  console.warn('DATABASE_URL not set; database calls will fail');
}

declare global {
  // eslint-disable-next-line no-var
  var __lnumPgClient: ReturnType<typeof postgres> | undefined;
}

const client =
  globalThis.__lnumPgClient ??
  postgres(connectionString || 'postgres://invalid', {
    max:                10,
    idle_timeout:       30,   // seconds
    connect_timeout:    10,
    /* Strict SSL only when the URL includes sslmode=require.
       Same-droplet Postgres connection doesn't need it. */
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__lnumPgClient = client;
}

export const db = drizzle(client, { schema });
export { client as pgClient };
