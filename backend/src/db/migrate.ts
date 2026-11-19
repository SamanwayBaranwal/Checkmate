// Database migrations. Runs at server start (awaited, before the server accepts traffic) and via
// `npm run db:migrate`. Each migration runs once, in order, inside a transaction, and is recorded in
// schema_migrations. A failed migration stops the boot instead of being silently ignored.
import { db } from './client';
import * as m001 from './migrations/001_baseline';
import * as m002 from './migrations/002_legacy_upgrades';
import * as m003 from './migrations/003_integrity';

type Migration = { name: string; sql?: string; statements?: string[] };
const MIGRATIONS: Migration[] = [m001, m002, m003];

export async function runMigrations(log = console.log): Promise<void> {
  await db.raw(`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  // One server at a time (two Railway instances booting together must not both migrate)
  await db.transaction(async (trx) => {
    await trx.raw('SELECT pg_advisory_xact_lock(727274)');
    const done = new Set((await trx('schema_migrations').select('name')).map((r: { name: string }) => r.name));

    // Databases created before this runner already have the tables: record the baseline instead of running it.
    if (!done.has(m001.name)) {
      const { rows } = await trx.raw(`SELECT to_regclass('public.users') IS NOT NULL AS exists`);
      if (rows[0].exists) {
        await trx('schema_migrations').insert({ name: m001.name });
        done.add(m001.name);
        log('migrate: existing database detected, baseline marked as applied');
      }
    }

    for (const m of MIGRATIONS) {
      if (done.has(m.name)) continue;
      if (m.sql) await trx.raw(m.sql);
      for (const s of m.statements || []) await trx.raw(s);
      await trx('schema_migrations').insert({ name: m.name });
      log(`migrate: applied ${m.name}`);
    }
  });
}

// `npm run db:migrate`
if (require.main === module) {
  runMigrations()
    .then(() => { console.log('migrate: up to date'); return db.destroy(); })
    .catch(async (err) => { console.error('migrate: FAILED', err); await db.destroy(); process.exit(1); });
}
