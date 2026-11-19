import { Chess } from 'chess.js';
import { db } from '../../db/client';
import { engine, engineAvailable } from './engine';
import { MoveSample, scorePlayerGame, playerStatus, FairplayStatus } from './metrics';

const DEPTH = parseInt(process.env.FAIRPLAY_DEPTH || '12', 10);
export const MIN_GAMES_BEFORE_WITHDRAW = parseInt(process.env.MIN_GAMES_BEFORE_WITHDRAW || '10', 10);
export const NEW_ACCOUNT_HOLD_HOURS = parseInt(process.env.NEW_ACCOUNT_HOLD_HOURS || '72', 10);

export interface MoveMeta { thinkMs: number; blurred: boolean }

// ---------------------------------------------------------------- schema
export async function ensureFairplaySchema() {
  await db.raw(`ALTER TABLE games ADD COLUMN IF NOT EXISTS move_meta JSONB`);
  await db.raw(`ALTER TABLE games ADD COLUMN IF NOT EXISTS analysis_status TEXT`);
  await db.raw(`
    CREATE TABLE IF NOT EXISTS game_analysis (
      game_id        UUID NOT NULL REFERENCES games(id),
      user_id        UUID NOT NULL REFERENCES users(id),
      color          TEXT NOT NULL,
      rating         INTEGER NOT NULL,
      analysed_moves INTEGER NOT NULL,
      acpl           NUMERIC(8,1) NOT NULL,
      engine_match   NUMERIC(5,1) NOT NULL,
      accuracy       NUMERIC(5,1) NOT NULL,
      blur_rate      NUMERIC(5,3) NOT NULL,
      move_time_cv   NUMERIC(6,2),
      avg_move_ms    INTEGER,
      suspicion      INTEGER NOT NULL,
      reasons        JSONB NOT NULL DEFAULT '[]',
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (game_id, user_id)
    )`);
  // per-game raw counts so the player decision can pool several games
  await db.raw(`ALTER TABLE game_analysis ADD COLUMN IF NOT EXISTS near_best_moves INTEGER NOT NULL DEFAULT 0`);
  await db.raw(`ALTER TABLE game_analysis ADD COLUMN IF NOT EXISTS loss_sum NUMERIC(12,1) NOT NULL DEFAULT 0`);
  await db.raw(`ALTER TABLE game_analysis ADD COLUMN IF NOT EXISTS blur_moves INTEGER NOT NULL DEFAULT 0`);
  await db.raw(`ALTER TABLE game_analysis ADD COLUMN IF NOT EXISTS total_moves INTEGER NOT NULL DEFAULT 0`);
  await db.raw(`ALTER TABLE game_analysis ADD COLUMN IF NOT EXISTS think_times JSONB NOT NULL DEFAULT '[]'`);
  await db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fairplay_reasons JSONB NOT NULL DEFAULT '[]'`);
  await db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fairplay_status TEXT NOT NULL DEFAULT 'clean'`);
  await db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fairplay_score INTEGER NOT NULL DEFAULT 0`);
  await db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fairplay_flagged_games INTEGER NOT NULL DEFAULT 0`);
  await db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fairplay_cleared_at TIMESTAMPTZ`);
  await db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fairplay_updated_at TIMESTAMPTZ`);
  await db.raw(`
    CREATE TABLE IF NOT EXISTS fairplay_actions (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID NOT NULL REFERENCES users(id),
      action     TEXT NOT NULL,
      details    JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
}

// ---------------------------------------------------------------- queue
const queue: string[] = [];
let working = false;
let engineOk: boolean | null = null;

export function queueGameAnalysis(gameId: string) {
  if (!queue.includes(gameId)) queue.push(gameId);
  void work();
}

async function work() {
  if (working) return;
  working = true;
  try {
    if (engineOk === null) {
      engineOk = await engineAvailable();
      if (!engineOk) console.warn('Fair play: Stockfish not found (set STOCKFISH_PATH). Games are queued but not analysed.');
    }
    while (engineOk && queue.length) {
      const id = queue.shift()!;
      try { await analyseGame(id); }
      catch (err) {
        console.error('Fair play analysis failed for', id, err);
        await db('games').where({ id }).update({ analysis_status: 'error' }).catch(() => {});
      }
    }
  } finally { working = false; }
}

/** Re-queue games that finished but were never analysed (e.g. after a restart). */
export async function resumePendingAnalysis() {
  const rows = await db('games').where({ status: 'completed', analysis_status: 'pending' }).select('id').limit(500);
  rows.forEach((r) => queueGameAnalysis(r.id));
}

export function isEngineReady() { return engineOk; }

// ---------------------------------------------------------------- analysis
export async function analyseGame(gameId: string) {
  const game = await db('games').where({ id: gameId }).first();
  if (!game || game.status !== 'completed' || !game.pgn) {
    await db('games').where({ id: gameId }).update({ analysis_status: 'skipped' });
    return;
  }
  const chess = new Chess();
  chess.loadPgn(game.pgn);
  const history = chess.history({ verbose: true });
  if (history.length < 4) {
    await db('games').where({ id: gameId }).update({ analysis_status: 'skipped' });
    return;
  }
  const meta: MoveMeta[] = Array.isArray(game.move_meta) ? game.move_meta : [];

  // Evaluate every position once (from the side to move).
  const replay = new Chess();
  const fens: string[] = [replay.fen()];
  const legal: number[] = [replay.moves().length];
  for (const mv of history) {
    replay.move(mv.san);
    fens.push(replay.fen());
    legal.push(replay.moves().length);
  }
  const evals = [] as { bestMove: string | null; cp: number }[];
  for (let i = 0; i < fens.length; i++) {
    const pos = new Chess(fens[i]);
    if (pos.isCheckmate()) evals.push({ bestMove: null, cp: -10000 });      // side to move is mated
    else if (pos.isDraw() || pos.isStalemate()) evals.push({ bestMove: null, cp: 0 });
    else evals.push(await engine.evaluate(fens[i], DEPTH));
  }

  const samples: Record<'white' | 'black', MoveSample[]> = { white: [], black: [] };
  history.forEach((mv, i) => {
    const color = mv.color === 'w' ? 'white' : 'black';
    const uci = mv.from + mv.to + (mv.promotion || '');
    samples[color].push({
      ply: i,
      color,
      cpBefore: evals[i].cp,
      cpAfter: -evals[i + 1].cp,
      matchedBest: evals[i].bestMove === uci,
      legalMoves: legal[i],
      thinkMs: meta[i]?.thinkMs,
      blurred: meta[i]?.blurred,
    });
  });

  const rows = (['white', 'black'] as const).map((color) => {
    const userId = color === 'white' ? game.player_white : game.player_black;
    const rating = color === 'white' ? game.white_elo_before : game.black_elo_before;
    const m = scorePlayerGame(samples[color], rating);
    return {
      game_id: gameId, user_id: userId, color, rating,
      analysed_moves: m.judged, acpl: m.acpl, engine_match: m.nearBestPct, accuracy: m.accuracy,
      blur_rate: m.blurRate, move_time_cv: m.moveTimeCv, avg_move_ms: m.avgMoveMs,
      suspicion: m.suspicion, reasons: JSON.stringify(m.reasons),
      near_best_moves: m.nearBest, loss_sum: m.lossSum, blur_moves: m.blurMoves, total_moves: m.totalMoves,
      think_times: JSON.stringify(m.times),
    };
  });
  await db('game_analysis').insert(rows).onConflict(['game_id', 'user_id']).merge();
  await db('games').where({ id: gameId }).update({ analysis_status: 'done' });
  for (const r of rows) await recomputePlayer(r.user_id);
}

// ---------------------------------------------------------------- player status
export async function recomputePlayer(userId: string) {
  const user = await db('users').where({ id: userId }).select('elo', 'fairplay_status', 'fairplay_cleared_at', 'banned_at').first();
  if (!user) return;
  let q = db('game_analysis as a').join('games as g', 'a.game_id', 'g.id')
    .where('a.user_id', userId).orderBy('g.completed_at', 'desc').limit(10)
    .select('a.suspicion', 'a.analysed_moves', 'a.near_best_moves', 'a.loss_sum', 'a.blur_moves', 'a.total_moves', 'a.think_times', 'a.rating');
  if (user.fairplay_cleared_at) q = q.where('g.completed_at', '>', user.fairplay_cleared_at);
  const rows = await q;
  const games = rows.map((r: any) => ({
    suspicion: r.suspicion, judged: r.analysed_moves, nearBest: r.near_best_moves, lossSum: parseFloat(r.loss_sum),
    blurMoves: r.blur_moves, totalMoves: r.total_moves, times: Array.isArray(r.think_times) ? r.think_times : [],
  }));
  // judge against the rating they actually had in those games (cheating also inflates the current ELO)
  const rating = rows.length ? Math.round(rows.reduce((a: number, r: any) => a + r.rating, 0) / rows.length) : user.elo;
  const s = playerStatus(games, rating);
  await db('users').where({ id: userId }).update({
    fairplay_status: s.status, fairplay_score: s.score, fairplay_flagged_games: s.flaggedGames,
    fairplay_reasons: JSON.stringify(s.reasons), fairplay_updated_at: new Date(),
  });
  if (s.status === 'review' && user.fairplay_status !== 'review' && !user.banned_at) {
    await db('fairplay_actions').insert({ user_id: userId, action: 'auto_review', details: JSON.stringify(s) });
    console.warn(`Fair play: user ${userId} moved to REVIEW (score ${s.score}, ${s.flaggedGames} flagged games). Withdrawals held.`);
  }
  return s;
}

// ---------------------------------------------------------------- withdrawals
export async function withdrawalCheck(userId: string): Promise<{ ok: boolean; reason?: string }> {
  const user = await db('users').where({ id: userId })
    .select('fairplay_status', 'banned_at', 'games_played', 'created_at').first();
  if (!user) return { ok: false, reason: 'User not found' };
  if (user.banned_at) return { ok: false, reason: 'Account suspended' };
  if ((user.fairplay_status as FairplayStatus) === 'review') {
    return { ok: false, reason: 'Your recent games are under a fair-play review. Withdrawals are paused until it is finished.' };
  }
  if (user.games_played < MIN_GAMES_BEFORE_WITHDRAW) {
    return { ok: false, reason: `Play at least ${MIN_GAMES_BEFORE_WITHDRAW} games before your first withdrawal.` };
  }
  const ageH = (Date.now() - new Date(user.created_at).getTime()) / 3.6e6;
  if (ageH < NEW_ACCOUNT_HOLD_HOURS) {
    return { ok: false, reason: `New accounts can withdraw after ${NEW_ACCOUNT_HOLD_HOURS} hours.` };
  }
  const pending = await db('games')
    .where(function () { this.where('player_white', userId).orWhere('player_black', userId); })
    .where({ status: 'completed', analysis_status: 'pending' })
    .count('* as c').first();
  if (parseInt((pending as any)?.c || '0', 10) > 0) {
    return { ok: false, reason: 'Your latest games are still being checked. Try again in a few minutes.' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------- admin actions
/** Confirmed cheater: ban, refund every opponent they beat in paid games, take that money back from them. */
export async function confirmCheater(userId: string, days = 30, notes = '') {
  const since = new Date(Date.now() - days * 86400000);
  return db.transaction(async (trx) => {
    const user = await trx('users').where({ id: userId }).forUpdate().first();
    if (!user) throw new Error('User not found');
    const won = await trx('games')
      .where({ winner: userId, status: 'completed' })
      .where('bet_amount', '>', 0)
      .where('completed_at', '>=', since)
      .select('id', 'player_white', 'player_black', 'bet_amount');
    let refunded = 0;
    const victims: Record<string, number> = {};
    for (const g of won) {
      const loser = g.player_white === userId ? g.player_black : g.player_white;
      const amt = parseFloat(g.bet_amount);
      await trx('users').where({ id: loser }).increment('usdc_balance', amt);
      await trx('balance_ledger').insert({ user_id: loser, amount: amt, type: 'fairplay_refund', game_id: g.id });
      victims[loser] = (victims[loser] || 0) + amt;
      refunded += amt;
    }
    const balance = parseFloat(user.usdc_balance);
    const clawed = Math.min(balance, refunded);
    if (clawed > 0) {
      await trx('users').where({ id: userId }).decrement('usdc_balance', clawed);
      await trx('balance_ledger').insert({ user_id: userId, amount: -clawed, type: 'clawback' });
    }
    await trx('users').where({ id: userId }).update({
      banned_at: new Date(), ban_reason: 'Fair play violation (engine use)', fairplay_status: 'review',
    });
    await trx('reports').where({ reported_id: userId, status: 'open' }).update({ status: 'resolved', admin_notes: 'Confirmed by fair-play review' });
    const summary = {
      days, gamesRefunded: won.length, refunded: +refunded.toFixed(6), clawedBack: +clawed.toFixed(6),
      platformCovered: +(refunded - clawed).toFixed(6), victims: Object.keys(victims).length, notes,
    };
    await trx('fairplay_actions').insert({ user_id: userId, action: 'confirmed_cheater', details: JSON.stringify(summary) });
    return summary;
  });
}

/** Reviewed and fine: back to clean; older games no longer count against them. */
export async function clearPlayer(userId: string, notes = '') {
  await db('users').where({ id: userId }).update({
    fairplay_status: 'clean', fairplay_score: 0, fairplay_flagged_games: 0, fairplay_cleared_at: new Date(),
  });
  await db('fairplay_actions').insert({ user_id: userId, action: 'cleared', details: JSON.stringify({ notes }) });
}
