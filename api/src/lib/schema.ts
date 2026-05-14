/* Drizzle schema for the Letters & Numbers backend.
 *
 * Tables in order of creation:
 *   parents              account holders (1 parent → many children → many devices)
 *   children             individual kid profiles, owned by a parent
 *   devices              installed PWA instances, claimed by a parent
 *   skill_progress       per-(child, skill) mastery aggregates
 *   play_events          append-only attempt log, idempotent per client_event_id
 *   session_summaries    daily rollups for fast dashboards
 *   magic_links          short-lived passwordless email-link auth tokens
 *
 * Design notes:
 *   - All IDs are UUIDs (gen_random_uuid()) except play_events which uses
 *     bigserial for append-fast insert performance.
 *   - skill_progress is a (child_id, skill_id) composite PK so we can
 *     UPSERT on event ingest without a separate read-then-write.
 *   - play_events.client_event_id is UNIQUE so the same event uploaded
 *     twice (device retried) doesn't double-count.
 *   - sessions_summaries is intentionally a denormalised cache that the
 *     daily rollup job recomputes — never updated client-side.
 */

import {
  pgTable, uuid, text, timestamp, integer, boolean, jsonb,
  bigserial, primaryKey, date, index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/* ────────────────────────────  parents  ──────────────────────────── */
export const parents = pgTable('parents', {
  id:         uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email:      text('email').notNull().unique(),
  createdAt:  timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastLogin:  timestamp('last_login', { withTimezone: true }),
});

/* ────────────────────────────  children  ─────────────────────────── */
export const children = pgTable('children', {
  id:        uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  parentId:  uuid('parent_id').notNull().references(() => parents.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  ageMonths: integer('age_months').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  /* Mirrors profile.settings on the PWA side (jsonb so we can evolve
     without migrations). */
  settings:  jsonb('settings').notNull().default({}),
  /* Optional fields that may be sync'd from device */
  interests: jsonb('interests').notNull().default({}),
  streaks:   jsonb('streaks').notNull().default({}),
}, (t) => ({
  parentIdx: index('children_parent_idx').on(t.parentId),
}));

/* ────────────────────────────  devices  ──────────────────────────── */
/* Each installed PWA has a stable client-generated device ID stored
   in localStorage. Claiming a device links it to a (parent, child)
   so events from that device sync into the right account. */
export const devices = pgTable('devices', {
  id:          text('id').primaryKey(),   // client-generated UUID
  childId:     uuid('child_id').references(() => children.id, { onDelete: 'cascade' }),
  parentId:    uuid('parent_id').references(() => parents.id, { onDelete: 'cascade' }),
  claimedAt:   timestamp('claimed_at', { withTimezone: true }),
  lastSyncAt:  timestamp('last_sync_at', { withTimezone: true }),
  userAgent:   text('user_agent'),
}, (t) => ({
  childIdx:  index('devices_child_idx').on(t.childId),
  parentIdx: index('devices_parent_idx').on(t.parentId),
}));

/* ────────────────────────  skill_progress  ───────────────────────── */
/* Per-(child, skill) mastery aggregate. UPSERT-friendly composite PK. */
export const skillProgress = pgTable('skill_progress', {
  childId:    uuid('child_id').notNull().references(() => children.id, { onDelete: 'cascade' }),
  skillId:    text('skill_id').notNull(),      // e.g. 'letter-recognize-A'
  successes:  integer('successes').notNull().default(0),
  attempts:   integer('attempts').notNull().default(0),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  masteredAt: timestamp('mastered_at', { withTimezone: true }),
}, (t) => ({
  pk:          primaryKey({ columns: [t.childId, t.skillId] }),
  masteredIdx: index('skill_progress_mastered_idx').on(t.childId, t.masteredAt),
}));

/* ─────────────────────────  play_events  ─────────────────────────── */
/* Append-only event log. Each event has a client-generated UUID
   (client_event_id) so the same event uploaded twice is dedup'd. */
export const playEvents = pgTable('play_events', {
  id:             bigserial('id', { mode: 'bigint' }).primaryKey(),
  childId:        uuid('child_id').notNull().references(() => children.id, { onDelete: 'cascade' }),
  skillId:        text('skill_id').notNull(),
  success:        boolean('success').notNull(),
  durationMs:     integer('duration_ms'),
  mode:           text('mode'),
  clientTs:       timestamp('client_ts', { withTimezone: true }).notNull(),
  serverTs:       timestamp('server_ts', { withTimezone: true }).defaultNow().notNull(),
  deviceId:       text('device_id').references(() => devices.id, { onDelete: 'set null' }),
  clientEventId:  text('client_event_id').notNull().unique(),
}, (t) => ({
  childTsIdx:    index('play_events_child_ts_idx').on(t.childId, t.clientTs),
  serverTsIdx:   index('play_events_server_ts_idx').on(t.serverTs),
}));

/* ───────────────────────  session_summaries  ─────────────────────── */
export const sessionSummaries = pgTable('session_summaries', {
  childId:         uuid('child_id').notNull().references(() => children.id, { onDelete: 'cascade' }),
  day:             date('day').notNull(),
  attempts:        integer('attempts').notNull().default(0),
  successes:       integer('successes').notNull().default(0),
  durationMinutes: integer('duration_minutes').notNull().default(0),
}, (t) => ({
  pk: primaryKey({ columns: [t.childId, t.day] }),
}));

/* ─────────────────────────  magic_links  ─────────────────────────── */
/* Passwordless email auth tokens. Created when a parent enters their
   email; consumed when they click the link in the email. 15 min TTL. */
export const magicLinks = pgTable('magic_links', {
  token:      text('token').primaryKey(),
  email:      text('email').notNull(),
  parentId:   uuid('parent_id').references(() => parents.id, { onDelete: 'cascade' }),
  expiresAt:  timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt:     timestamp('used_at', { withTimezone: true }),
  createdAt:  timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  emailIdx: index('magic_links_email_idx').on(t.email),
}));
