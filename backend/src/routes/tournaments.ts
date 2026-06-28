import { Router, Response } from 'express';
import { db } from '../db/client';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// List open + active tournaments
router.get('/', async (_req, res: Response) => {
  try {
    const tournaments = await db('tournaments as t')
      .join('users as u', 't.created_by', 'u.id')
      .leftJoin(db.raw('(SELECT tournament_id, COUNT(*) as player_count FROM tournament_players GROUP BY tournament_id) pc ON pc.tournament_id = t.id'))
      .where('t.status', 'in', ['open', 'active'])
      .select(
        't.id', 't.name', 't.entry_fee', 't.max_players', 't.status',
        't.current_round', 't.total_rounds', 't.prize_pool', 't.created_at',
        't.is_seasonal', 't.season_name', 't.season_bonus',
        'u.username as creator_name',
        db.raw('COALESCE(pc.player_count, 0) as player_count')
      )
      .orderBy([{ column: 't.is_seasonal', order: 'desc' }, { column: 't.created_at', order: 'desc' }]);
    res.json(tournaments);
  } catch (err) {
    console.error('List tournaments error:', err);
    res.status(500).json({ error: 'Failed to load tournaments' });
  }
});

// Create tournament
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { name, entryFee, maxPlayers } = req.body as {
    name?: string; entryFee?: number; maxPlayers?: number;
  };

  if (!name || typeof name !== 'string' || name.trim().length < 3 || name.trim().length > 40) {
    res.status(400).json({ error: 'Name must be 3-40 characters' });
    return;
  }
  if (![1, 5, 10, 25].includes(entryFee as number)) {
    res.status(400).json({ error: 'Entry fee must be $1, $5, $10, or $25' });
    return;
  }
  if (![4, 8, 16].includes(maxPlayers as number)) {
    res.status(400).json({ error: 'Max players must be 4, 8, or 16' });
    return;
  }

  const totalRounds = Math.log2(maxPlayers as number);

  try {
    const [tournament] = await db('tournaments').insert({
      name: name.trim(),
      entry_fee: entryFee,
      max_players: maxPlayers,
      total_rounds: totalRounds,
      created_by: req.userId,
    }).returning('*');
    res.json(tournament);
  } catch (err) {
    console.error('Create tournament error:', err);
    res.status(500).json({ error: 'Failed to create tournament' });
  }
});

// Get tournament detail + players + bracket
router.get('/:id', async (req, res: Response) => {
  try {
    const tournament = await db('tournaments as t')
      .join('users as u', 't.created_by', 'u.id')
      .where('t.id', req.params.id)
      .select('t.*', 'u.username as creator_name')
      .first();

    if (!tournament) { res.status(404).json({ error: 'Not found' }); return; }

    const players = await db('tournament_players as tp')
      .join('users as u', 'tp.user_id', 'u.id')
      .where('tp.tournament_id', req.params.id)
      .select('tp.user_id', 'tp.seed', 'tp.status', 'u.username', 'u.elo');

    const games = await db('tournament_games as tg')
      .leftJoin('users as u1', 'tg.player1', 'u1.id')
      .leftJoin('users as u2', 'tg.player2', 'u2.id')
      .leftJoin('users as uw', 'tg.winner', 'uw.id')
      .where('tg.tournament_id', req.params.id)
      .select(
        'tg.id', 'tg.game_id', 'tg.round', 'tg.status',
        'tg.player1', 'u1.username as player1_name', 'u1.elo as player1_elo',
        'tg.player2', 'u2.username as player2_name', 'u2.elo as player2_elo',
        'tg.winner', 'uw.username as winner_name'
      )
      .orderBy(['tg.round', 'tg.id']);

    res.json({ ...tournament, players, games });
  } catch (err) {
    console.error('Get tournament error:', err);
    res.status(500).json({ error: 'Failed to load tournament' });
  }
});

// Join tournament
router.post('/:id/join', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tournament = await db('tournaments').where({ id: req.params.id, status: 'open' }).first();
    if (!tournament) { res.status(404).json({ error: 'Tournament not found or not open' }); return; }

    const playerCount = await db('tournament_players')
      .where({ tournament_id: req.params.id })
      .count('id as count')
      .first();

    if (Number(playerCount?.count) >= tournament.max_players) {
      res.status(400).json({ error: 'Tournament is full' });
      return;
    }

    const user = await db('users').where({ id: req.userId }).select('usdc_balance', 'username').first();
    if (!user?.username) { res.status(400).json({ error: 'Set a username before joining tournaments' }); return; }
    if (parseFloat(user.usdc_balance) < parseFloat(tournament.entry_fee)) {
      res.status(400).json({ error: 'Insufficient balance' });
      return;
    }

    await db.transaction(async (trx) => {
      await trx('users').where({ id: req.userId })
        .decrement('usdc_balance', tournament.entry_fee);
      await trx('balance_ledger').insert({
        user_id: req.userId,
        amount: -tournament.entry_fee,
        type: 'loss',
        tx_hash: `tournament_entry_${req.params.id}`,
      });
      await trx('tournament_players').insert({
        tournament_id: req.params.id,
        user_id: req.userId,
      });
      await trx('tournaments').where({ id: req.params.id })
        .increment('prize_pool', tournament.entry_fee);
    });

    res.json({ ok: true });
  } catch (err: any) {
    if (err?.code === '23505') { res.status(400).json({ error: 'Already joined' }); return; }
    console.error('Join tournament error:', err);
    res.status(500).json({ error: 'Failed to join tournament' });
  }
});

// Admin: create a seasonal tournament with a platform bonus added to prize pool
// Gated by ADMIN_SECRET env var for now
router.post('/seasonal', async (req, res: Response) => {
  const { secret, name, entryFee, maxPlayers, seasonName, bonusAmount } = req.body as {
    secret?: string; name?: string; entryFee?: number;
    maxPlayers?: number; seasonName?: string; bonusAmount?: number;
  };

  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || secret !== adminSecret) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  if (!name || !entryFee || !maxPlayers || !seasonName) {
    res.status(400).json({ error: 'name, entryFee, maxPlayers, seasonName required' });
    return;
  }
  if (![1, 5, 10, 25, 50, 100].includes(entryFee)) {
    res.status(400).json({ error: 'Invalid entry fee' });
    return;
  }
  if (![4, 8, 16, 32].includes(maxPlayers)) {
    res.status(400).json({ error: 'Invalid max players' });
    return;
  }

  const totalRounds = Math.log2(maxPlayers);
  const bonus = typeof bonusAmount === 'number' && bonusAmount > 0 ? bonusAmount : 0;

  // Use first admin user or a system user id — for now require a system_user_id in env
  const systemUserId = process.env.SYSTEM_USER_ID;
  if (!systemUserId) {
    res.status(500).json({ error: 'SYSTEM_USER_ID not configured' });
    return;
  }

  try {
    const [tournament] = await db('tournaments').insert({
      name: name.trim(),
      entry_fee: entryFee,
      max_players: maxPlayers,
      total_rounds: totalRounds,
      prize_pool: bonus,
      is_seasonal: true,
      season_name: seasonName.trim(),
      season_bonus: bonus,
      created_by: systemUserId,
      status: 'open',
    }).returning('*');

    res.json(tournament);
  } catch (err) {
    console.error('Create seasonal tournament error:', err);
    res.status(500).json({ error: 'Failed to create seasonal tournament' });
  }
});

export default router;
