import { Router, Request, Response } from 'express';
import { db } from '../db/client';
import { redis } from '../db/redis';

const router = Router();

router.get('/active', async (_req: Request, res: Response) => {
  const games = await db('games as g')
    .join('users as w', 'g.player_white', 'w.id')
    .join('users as b', 'g.player_black', 'b.id')
    .where('g.status', 'active')
    .select(
      'g.id',
      'g.bet_amount',
      'g.created_at',
      'g.white_elo_before',
      'g.black_elo_before',
      'w.username as white_username',
      'w.wallet as white_wallet',
      'b.username as black_username',
      'b.wallet as black_wallet'
    )
    .orderBy('g.created_at', 'desc')
    .limit(50);

  // Attach move counts from Redis
  const withMoveCounts = await Promise.all(
    games.map(async (g) => {
      const fen = await redis.get(`game:${g.id}:fen`);
      return { ...g, bet_amount: parseFloat(g.bet_amount), fen };
    })
  );

  res.json(withMoveCounts);
});

router.get('/:id', async (req: Request, res: Response) => {
  const game = await db('games as g')
    .join('users as w', 'g.player_white', 'w.id')
    .join('users as b', 'g.player_black', 'b.id')
    .leftJoin('users as winner', 'g.winner', 'winner.id')
    .where('g.id', req.params.id)
    .select(
      'g.*',
      'w.username as white_username',
      'w.wallet as white_wallet',
      'w.elo as white_elo_current',
      'b.username as black_username',
      'b.wallet as black_wallet',
      'b.elo as black_elo_current',
      'winner.username as winner_username'
    )
    .first();

  if (!game) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }

  res.json({ ...game, bet_amount: parseFloat(game.bet_amount) });
});

export default router;
