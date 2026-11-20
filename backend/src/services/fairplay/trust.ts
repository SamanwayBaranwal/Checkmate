import crypto from 'crypto';
import type { Knex } from 'knex';
import { db } from '../../db/client';

/**
 * Money safety without KYC.
 *
 *  1. One person, one account: every login records a hashed device id (random id kept in the browser),
 *     a coarse browser fingerprint and the IP. Accounts on the same device/IP never get paired with each
 *     other, the starter bonus is once per device, a banned device cannot log in again, and admins see
 *     linked accounts as evidence.
 *  2. Trust levels: the maximum stake grows with clean, analysed games and account age.
 *  3. Locked winnings: every win is held until the game is analysed, the player is clean and a cooling
 *     period has passed. Big wins wait for an admin. Only released winnings can be withdrawn.
 */

const n = (k: string, d: number) => { const v = parseFloat(process.env[k] || ''); return Number.isFinite(v) ? v : d; };
export const HOLD_HOURS = n('HOLD_HOURS', 48);
export const MANUAL_APPROVAL_OVER = n('MANUAL_APPROVAL_OVER', 25);
export const LEVELS = {
  new: { maxStake: n('STAKE_NEW', 5) },
  trusted: { maxStake: n('STAKE_TRUSTED', 25), games: n('TRUSTED_GAMES', 20), days: n('TRUSTED_DAYS', 7) },
  verified: { maxStake: n('STAKE_VERIFIED', 100), games: n('VERIFIED_GAMES', 50), days: n('VERIFIED_DAYS', 30) },
};

const SALT = process.env.IDENTITY_SALT || process.env.JWT_SECRET || 'checkmate';
const hash = (v: string) => crypto.createHash('sha256').update(SALT + '|' + v).digest('hex').slice(0, 40);

export async function ensureTrustSchema() {
  await db.raw(`
    CREATE TABLE IF NOT EXISTS user_identifiers (
      user_id    UUID NOT NULL REFERENCES users(id),
      kind       TEXT NOT NULL,          -- device | fingerprint | ip | withdraw_address
      value      TEXT NOT NULL,          -- salted hash, never the raw value
      first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, kind, value)
    )`);
  await db.raw(`CREATE INDEX IF NOT EXISTS user_identifiers_kind_value ON user_identifiers (kind, value)`);
  await db.raw(`
    CREATE TABLE IF NOT EXISTS winnings_holds (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(id),
      game_id     UUID REFERENCES games(id),
      amount      NUMERIC(18,6) NOT NULL,
      status      TEXT NOT NULL DEFAULT 'held',   -- held | needs_approval | released | reversed
      reason      TEXT,
      release_at  TIMESTAMPTZ NOT NULL,
      decided_at  TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  await db.raw(`CREATE INDEX IF NOT EXISTS winnings_holds_user_status ON winnings_holds (user_id, status)`);
}

// ─────────────────────────────── identities ───────────────────────────────
export function clientIp(raw?: string | string[] | null): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  const ip = v.split(',')[0].trim().replace(/^::ffff:/, '');
  if (!ip || ip === '127.0.0.1' || ip === '::1') return null; // local development: not a real identity
  return ip;
}

// Mobile carriers (e.g. Jio/Airtel CGNAT) put many strangers behind one IP, so a shared IP is only a weak
// signal. It blocks matchmaking pairs unless PAIRING_BLOCK_SAME_IP=false; devices always block.
const BLOCK_SAME_IP = process.env.PAIRING_BLOCK_SAME_IP !== 'false';

export async function recordIdentifiers(userId: string, ids: { deviceId?: string; fingerprint?: string; ip?: string | null }) {
  const rows: { kind: string; value: string }[] = [];
  if (ids.deviceId && ids.deviceId.length >= 8) rows.push({ kind: 'device', value: hash(ids.deviceId) });
  if (ids.fingerprint && ids.fingerprint.length >= 8) rows.push({ kind: 'fingerprint', value: hash(ids.fingerprint) });
  if (ids.ip) rows.push({ kind: 'ip', value: hash(ids.ip) });
  for (const r of rows) {
    await db('user_identifiers').insert({ user_id: userId, ...r })
      .onConflict(['user_id', 'kind', 'value']).merge({ last_seen: new Date() });
  }
}

export async function recordWithdrawAddress(userId: string, address: string) {
  await db('user_identifiers').insert({ user_id: userId, kind: 'withdraw_address', value: hash(address.toLowerCase()) })
    .onConflict(['user_id', 'kind', 'value']).merge({ last_seen: new Date() });
}

/** Is this device (raw id) already used by a banned account? */
export async function deviceIsBanned(deviceId?: string): Promise<boolean> {
  if (!deviceId) return false;
  const row = await db('user_identifiers as i').join('users as u', 'i.user_id', 'u.id')
    .where({ 'i.kind': 'device', 'i.value': hash(deviceId) }).whereNotNull('u.banned_at').first('u.id');
  return !!row;
}

/** Other accounts sharing a device / fingerprint / IP / withdrawal address with this one. */
export async function linkedAccounts(userId: string) {
  const rows = await db('user_identifiers as mine')
    .join('user_identifiers as other', function () {
      this.on('other.kind', '=', 'mine.kind').andOn('other.value', '=', 'mine.value').andOn('other.user_id', '<>', 'mine.user_id');
    })
    .join('users as u', 'other.user_id', 'u.id')
    .where('mine.user_id', userId)
    .select('u.id', 'u.username', 'u.wallet', 'u.banned_at', 'u.fairplay_status', 'other.kind');
  const byUser = new Map<string, any>();
  for (const r of rows) {
    const e = byUser.get(r.id) || { id: r.id, username: r.username, wallet: r.wallet, banned: !!r.banned_at, fairplayStatus: r.fairplay_status, shared: [] as string[] };
    if (!e.shared.includes(r.kind)) e.shared.push(r.kind);
    byUser.set(r.id, e);
  }
  return [...byUser.values()];
}

/** True if two accounts share a device or an IP: they must never play each other for money. */
export async function sameOwnerLikely(a: string, b: string): Promise<boolean> {
  const row = await db('user_identifiers as x')
    .join('user_identifiers as y', function () { this.on('x.kind', '=', 'y.kind').andOn('x.value', '=', 'y.value'); })
    .where('x.user_id', a).where('y.user_id', b)
    .whereIn('x.kind', BLOCK_SAME_IP ? ['device', 'ip', 'withdraw_address'] : ['device', 'withdraw_address']).first('x.kind');
  return !!row;
}

/** Starter credits: once per device (and not twice from the same IP + browser fingerprint). */
// Pass the open transaction when calling from inside one: a second pool connection there can starve the pool.
export async function starterAlreadyClaimedNearby(userId: string, trx: Knex = db): Promise<boolean> {
  const row = await trx('user_identifiers as mine')
    .join('user_identifiers as other', function () {
      this.on('other.kind', '=', 'mine.kind').andOn('other.value', '=', 'mine.value').andOn('other.user_id', '<>', 'mine.user_id');
    })
    .join('balance_ledger as l', 'l.user_id', 'other.user_id')
    .where('mine.user_id', userId).where('mine.kind', 'device').where('l.tx_hash', 'like', 'starter_%').first('other.user_id');
  return !!row;
}

// ─────────────────────────────── trust levels ───────────────────────────────
export async function trustLevel(userId: string) {
  const u = await db('users').where({ id: userId }).select('created_at', 'fairplay_status', 'banned_at').first();
  if (!u) return { level: 'new' as const, maxStake: 0, cleanGames: 0, ageDays: 0, reason: 'User not found' };
  const ageDays = (Date.now() - new Date(u.created_at).getTime()) / 86400000;
  const c = await db('game_analysis').where({ user_id: userId }).where('suspicion', '<', 35).count('* as c').first();
  const cleanGames = parseInt((c as any)?.c || '0', 10);
  if (u.banned_at) return { level: 'new' as const, maxStake: 0, cleanGames, ageDays, reason: 'Account suspended' };
  if (u.fairplay_status === 'review') {
    return { level: 'new' as const, maxStake: 0, cleanGames, ageDays, reason: 'Paid games are paused while your recent games are under fair-play review.' };
  }
  const clean = u.fairplay_status === 'clean';
  let level: 'new' | 'trusted' | 'verified' = 'new';
  if (clean && cleanGames >= LEVELS.verified.games && ageDays >= LEVELS.verified.days) level = 'verified';
  else if (clean && cleanGames >= LEVELS.trusted.games && ageDays >= LEVELS.trusted.days) level = 'trusted';
  const next = level === 'new' ? { level: 'trusted', games: LEVELS.trusted.games, days: LEVELS.trusted.days, maxStake: LEVELS.trusted.maxStake }
    : level === 'trusted' ? { level: 'verified', games: LEVELS.verified.games, days: LEVELS.verified.days, maxStake: LEVELS.verified.maxStake } : null;
  return { level, maxStake: LEVELS[level].maxStake, cleanGames, ageDays: Math.floor(ageDays), next, reason: null as string | null };
}

/** Returns an error message if this player may not play for this stake, else null. */
export async function stakeError(userId: string, amount: number): Promise<string | null> {
  if (amount <= 0) return null;
  const t = await trustLevel(userId);
  if (t.maxStake <= 0) return t.reason || 'Paid games are not available for this account.';
  if (amount > t.maxStake) {
    const nx = t.next ? ` Play ${Math.max(0, t.next.games - t.cleanGames)} more clean games (account ${t.next.days}+ days old) to unlock up to $${t.next.maxStake}.` : '';
    return `Your current limit is $${t.maxStake} per game.${nx}`;
  }
  return null;
}

// ─────────────────────────────── locked winnings ───────────────────────────────
export async function holdWinnings(userId: string, gameId: string, amount: number) {
  if (amount <= 0) return;
  await db('winnings_holds').insert({
    user_id: userId, game_id: gameId, amount, status: 'held',
    release_at: new Date(Date.now() + HOLD_HOURS * 3600000), reason: 'cooling period + game check',
  });
}

export async function lockedAmount(userId: string, trx: Knex = db): Promise<number> {
  const r = await trx('winnings_holds').where({ user_id: userId }).whereIn('status', ['held', 'needs_approval']).sum('amount as s').first();
  return parseFloat((r as any)?.s || '0');
}

/** Runs every minute: release held winnings once checked + clean + cooled down; big ones go to an admin. */
export async function releaseDueHolds() {
  const due = await db('winnings_holds as h')
    .join('users as u', 'h.user_id', 'u.id')
    .leftJoin('games as g', 'h.game_id', 'g.id')
    .where('h.status', 'held').where('h.release_at', '<=', new Date())
    .whereNull('u.banned_at').where('u.fairplay_status', 'clean')
    .where(function () { this.whereNull('h.game_id').orWhereIn('g.analysis_status', ['done', 'skipped']); })
    .select('h.id', 'h.amount').limit(500);
  for (const h of due) {
    const big = parseFloat(h.amount) > MANUAL_APPROVAL_OVER;
    await db('winnings_holds').where({ id: h.id, status: 'held' }).update(
      big ? { status: 'needs_approval', reason: `win above $${MANUAL_APPROVAL_OVER}: admin approval` }
          : { status: 'released', decided_at: new Date() });
  }
}

export function startHoldReleaser() {
  setInterval(() => { releaseDueHolds().catch((e) => console.error('hold release failed', e)); }, 60000);
}

export async function reverseHolds(userId: string, trx = db) {
  await trx('winnings_holds').where({ user_id: userId }).whereIn('status', ['held', 'needs_approval'])
    .update({ status: 'reversed', decided_at: new Date(), reason: 'confirmed fair-play violation' });
}
