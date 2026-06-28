import { db } from '../db/client';
import { calculateEloChange } from './elo';

const PLATFORM_FEE_BPS = parseInt(process.env.PLATFORM_FEE_BPS || '250', 10);

export async function reserveBet(userId: string, betAmount: number): Promise<boolean> {
  const result = await db('users')
    .where({ id: userId })
    .where('usdc_balance', '>=', betAmount)
    .decrement('usdc_balance', betAmount);
  return result > 0;
}

export async function refundBet(userId: string, betAmount: number): Promise<void> {
  await db.transaction(async (trx) => {
    await trx('users').where({ id: userId }).increment('usdc_balance', betAmount);
    await trx('balance_ledger').insert({
      user_id: userId,
      amount: betAmount,
      type: 'refund',
    });
  });
}

export async function settleGame(
  gameId: string,
  winnerId: string,
  loserId: string,
  winnerColor: 'white' | 'black',
  betAmount: number,
  result: string,
  pgn: string,
  whiteId: string,
  blackId: string,
  whiteEloBefore: number,
  blackEloBefore: number
): Promise<{ eloChange: number; payout: number; streakBonus: number; streak: number }> {
  const totalPot = betAmount * 2;
  const fee = Math.floor((totalPot * PLATFORM_FEE_BPS) / 10000 * 1e6) / 1e6;
  const payout = totalPot - fee;

  const outcome = result === 'draw' ? 'draw' : winnerColor;
  const { newWhiteElo, newBlackElo, eloChange } = calculateEloChange(whiteEloBefore, blackEloBefore, outcome as any);

  await db.transaction(async (trx) => {
    // Credit winner
    await trx('users').where({ id: winnerId }).increment('usdc_balance', payout);
    await trx('balance_ledger').insert({ user_id: winnerId, amount: payout, type: 'win', game_id: gameId });

    // Log loser ledger entry (balance already deducted at game start)
    await trx('balance_ledger').insert({ user_id: loserId, amount: -betAmount, type: 'loss', game_id: gameId });

    // Update ELO
    await trx('users').where({ id: whiteId }).update({ elo: newWhiteElo }).increment('games_played', 1);
    await trx('users').where({ id: blackId }).update({ elo: newBlackElo }).increment('games_played', 1);
    if (result !== 'draw') {
      await trx('users').where({ id: winnerId }).increment('games_won', 1);
    }

    // Finalize game record
    await trx('games').where({ id: gameId }).update({
      status: 'completed',
      winner: result === 'draw' ? null : winnerId,
      result,
      pgn,
      elo_change: eloChange,
      completed_at: new Date(),
    });
  });

  // Win streak bonus: 5+ consecutive wins → 10% of payout, max $5
  const recentGames = await db('games')
    .where(function () {
      this.where('player_white', winnerId).orWhere('player_black', winnerId);
    })
    .where('status', 'completed')
    .orderBy('completed_at', 'desc')
    .limit(15)
    .select('winner');

  let streak = 0;
  for (const g of recentGames) {
    if (g.winner === winnerId) streak++;
    else break;
  }

  let streakBonus = 0;
  if (streak >= 5) {
    streakBonus = parseFloat(Math.min(payout * 0.10, 5.00).toFixed(6));
    await db.transaction(async (trx) => {
      await trx('users').where({ id: winnerId }).increment('usdc_balance', streakBonus);
      await trx('balance_ledger').insert({ user_id: winnerId, amount: streakBonus, type: 'bonus', game_id: gameId });
    });
  }

  return { eloChange, payout, streakBonus, streak };
}

export async function getUserBalance(userId: string): Promise<number> {
  const user = await db('users').where({ id: userId }).select('usdc_balance').first();
  return parseFloat(user?.usdc_balance ?? '0');
}
