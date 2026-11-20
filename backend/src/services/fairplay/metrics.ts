/**
 * Fair-play scoring. Pure functions only, no DB / engine here.
 *
 * Ideas (re-implemented, not copied) from public chess anti-cheat practice (Lichess / Ken Regan):
 *  - near-best move rate: share of real decisions where the played move is the engine's choice or within 10cp of it
 *  - ACPL: average centipawn loss per move, compared with what a player of that rating usually loses
 *  - blur rate: share of moves where the player left the tab/window while thinking
 *  - move-time regularity: engine users often spend about the same time on every move
 *
 * Only "undecided" positions count (after the opening, not already won/lost, more than one legal move):
 * once a game is decided almost any move is fine, so those moves say nothing about engine use.
 *
 * One game is never proof. The player decision pools the last 10 games (typically 50-150 judged moves).
 */

export interface MoveSample {
  ply: number;          // 0-based half-move index
  color: 'white' | 'black';
  cpBefore: number;     // eval before the move, mover's point of view
  cpAfter: number;      // eval after the move, mover's point of view
  matchedBest: boolean; // played move == engine's best move
  legalMoves: number;
  thinkMs?: number;
  blurred?: boolean;
}

/** Raw counts kept per game so player decisions can pool several games. */
export interface GameCounts {
  judged: number;      // undecided, non-forced moves after the opening
  nearBest: number;    // of those: engine move or within NEAR_BEST_CP
  lossSum: number;     // centipawn loss summed over judged moves (each capped)
  blurMoves: number;   // moves (after the first) made after leaving the tab
  totalMoves: number;  // moves after the first
  times: number[];     // server think time per judged move (ms)
}

export interface PlayerGameMetrics extends GameCounts {
  acpl: number;
  nearBestPct: number;
  accuracy: number;
  blurRate: number;
  moveTimeCv: number | null;
  avgMoveMs: number | null;
  suspicion: number;   // 0-100, evidence for THIS game only
  reasons: string[];
}

export const OPENING_PLIES = 10;       // skip the first 5 moves each (book / well-known)
export const UNDECIDED_CP = 350;       // |eval| above this = game already decided
export const NEAR_BEST_CP = 10;
export const LOSS_CAP = 500;
export const MIN_GAME_MOVES = 8;       // per-game evidence needs at least this many judged moves
export const MIN_POOLED_MOVES = 30;    // player decision needs at least this many judged moves in total
export const GAME_FLAG_SCORE = 60;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function winPct(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamp(cp, -1000, 1000))) - 1);
}
export function moveAccuracy(winBefore: number, winAfter: number): number {
  return clamp(103.1668 * Math.exp(-0.04354 * Math.max(0, winBefore - winAfter)) - 3.1669, 0, 100);
}
/** Rough blitz average centipawn loss at a rating. */
export function expectedAcpl(rating: number): number {
  return clamp(150 - rating * 0.055, 15, 95);
}
/** Rough share of near-best moves an honest player of this rating makes in undecided positions. */
export function expectedNearBest(rating: number): number {
  return clamp(30 + rating * 0.016, 40, 78);
}

function stats(times: number[]) {
  if (times.length < 2) return { avg: times[0] ?? null, cv: null as number | null };
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const sd = Math.sqrt(times.reduce((a, t) => a + (t - avg) ** 2, 0) / (times.length - 1));
  return { avg, cv: avg > 0 ? sd / avg : null };
}

/** Evidence score (0-100) from pooled or single-game counts. */
export function evidenceScore(c: GameCounts, rating: number, minMoves: number): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  if (c.judged < minMoves) return { score: 0, reasons: [`only ${c.judged} judgeable moves so far`] };
  const nb = (100 * c.nearBest) / c.judged;
  const acpl = c.lossSum / c.judged;
  const blur = c.totalMoves ? c.blurMoves / c.totalMoves : 0;
  const expNb = expectedNearBest(rating);
  const ratio = acpl / expectedAcpl(rating);
  const { cv } = stats(c.times);
  let score = 0;
  if (nb >= Math.max(85, expNb + 25)) { score += 45; reasons.push(`${nb.toFixed(0)}% near-engine moves (normal for ${rating}: ~${expNb.toFixed(0)}%)`); }
  else if (nb >= Math.max(75, expNb + 15)) { score += 25; reasons.push(`${nb.toFixed(0)}% near-engine moves (normal for ${rating}: ~${expNb.toFixed(0)}%)`); }
  if (ratio < 0.25) { score += 30; reasons.push(`avg loss ${acpl.toFixed(0)}cp per move (normal for ${rating}: ~${expectedAcpl(rating).toFixed(0)})`); }
  else if (ratio < 0.45) { score += 15; reasons.push(`avg loss ${acpl.toFixed(0)}cp per move (normal for ${rating}: ~${expectedAcpl(rating).toFixed(0)})`); }
  if (blur >= 0.5 && nb >= expNb + 10) { score += 25; reasons.push(`left the tab on ${(blur * 100).toFixed(0)}% of moves while playing near-engine moves`); }
  else if (blur >= 0.3) { score += 10; reasons.push(`left the tab on ${(blur * 100).toFixed(0)}% of moves`); }
  if (cv !== null && cv < 0.35 && c.times.length >= minMoves && nb >= expNb + 10) {
    score += 10; reasons.push(`unusually regular move times (variation ${cv.toFixed(2)})`);
  }
  return { score: clamp(score, 0, 100), reasons };
}

export function countGame(samples: MoveSample[]): GameCounts {
  const judgedS = samples.filter((s) => s.ply >= OPENING_PLIES && s.legalMoves > 1 && Math.abs(s.cpBefore) < UNDECIDED_CP);
  const losses = judgedS.map((s) => clamp(s.cpBefore - s.cpAfter, 0, LOSS_CAP));
  const after = samples.filter((s) => s.ply >= 2);
  return {
    judged: judgedS.length,
    nearBest: judgedS.filter((s, i) => s.matchedBest || losses[i] <= NEAR_BEST_CP).length,
    lossSum: losses.reduce((a, b) => a + b, 0),
    blurMoves: after.filter((s) => s.blurred).length,
    totalMoves: after.length,
    times: judgedS.map((s) => s.thinkMs).filter((t): t is number => typeof t === 'number' && t >= 0),
  };
}

export function scorePlayerGame(samples: MoveSample[], rating: number): PlayerGameMetrics {
  const c = countGame(samples);
  const judgedS = samples.filter((s) => s.ply >= OPENING_PLIES && s.legalMoves > 1 && Math.abs(s.cpBefore) < UNDECIDED_CP);
  const accuracy = judgedS.length ? judgedS.reduce((a, s) => a + moveAccuracy(winPct(s.cpBefore), winPct(s.cpAfter)), 0) / judgedS.length : 0;
  const { avg, cv } = stats(c.times);
  const ev = evidenceScore(c, rating, MIN_GAME_MOVES);
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return {
    ...c,
    acpl: c.judged ? r1(c.lossSum / c.judged) : 0,
    nearBestPct: c.judged ? r1((100 * c.nearBest) / c.judged) : 0,
    accuracy: r1(accuracy),
    blurRate: c.totalMoves ? Math.round((1000 * c.blurMoves) / c.totalMoves) / 1000 : 0,
    moveTimeCv: cv === null ? null : Math.round(cv * 100) / 100,
    avgMoveMs: avg === null ? null : Math.round(avg),
    suspicion: ev.score,
    reasons: ev.reasons,
  };
}

export type FairplayStatus = 'clean' | 'watch' | 'review';

/**
 * Player decision from the last 10 analysed games (newest first), pooled.
 * review = withdrawals held + admin queue; watch = keep an eye on it.
 */
export function playerStatus(games: Array<GameCounts & { suspicion: number }>, rating: number) {
  const recent = games.slice(0, 10);
  const pooled: GameCounts = recent.reduce<GameCounts>((a, g) => ({
    judged: a.judged + g.judged, nearBest: a.nearBest + g.nearBest, lossSum: a.lossSum + g.lossSum,
    blurMoves: a.blurMoves + g.blurMoves, totalMoves: a.totalMoves + g.totalMoves, times: a.times.concat(g.times),
  }), { judged: 0, nearBest: 0, lossSum: 0, blurMoves: 0, totalMoves: 0, times: [] });
  const ev = evidenceScore(pooled, rating, MIN_POOLED_MOVES);
  const flaggedGames = recent.filter((g) => g.suspicion >= GAME_FLAG_SCORE).length;
  let status: FairplayStatus = 'clean';
  if (ev.score >= 60 || flaggedGames >= 3) status = 'review';
  else if (ev.score >= 35 || flaggedGames >= 1) status = 'watch';
  return {
    status, score: ev.score, flaggedGames, reasons: ev.reasons,
    pooledMoves: pooled.judged,
    pooledNearBestPct: pooled.judged ? Math.round((1000 * pooled.nearBest) / pooled.judged) / 10 : 0,
  };
}
