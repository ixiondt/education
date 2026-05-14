import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/schema.ts',
  out:    './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://lnum_user:dev@localhost:5432/db_lnum',
  },
  verbose: true,
  strict: true,
} satisfies Config;
