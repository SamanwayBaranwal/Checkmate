import { Router, Request, Response } from 'express';
import { db } from '../db/client';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.get('/leaderboard', async (req: Request, res: Response) => {
  const tab = (req.query.tab as string) || 'elo';
  try {
    if (tab === 'earnings') {
      const result = await db.raw(`
        SELECT u.id, u.wallet, u.username, u.elo, u.games_played, u.games_won,
          COALESCE(SUM(bl.amount), 0) AS total_earnings
        FROM users u
        LEFT JOIN balance_ledger bl ON bl.user_id = u.id AND bl.type = 'win'
        GROUP BY u.id
        ORDER BY total_earnings DESC
        LIMIT 100
      `);
      res.json(result.rows.map((u: any) => ({ ...u, total_earnings: parseFloat(u.total_earnings) })));
      return;
    }

    if (tab === 'weekly') {
      const result = await db.raw(`
        SELECT u.id, u.wallet, u.username, u.elo, u.games_played, u.games_won,
          COALESCE(SUM(bl.amount), 0) AS weekly_earnings
        FROM users u
        LEFT JOIN balance_ledger bl ON bl.user_id = u.id
          AND bl.type = 'win'
          AND bl.created_at >= date_trunc('week', NOW())
        GROUP BY u.id
        HAVING COALESCE(SUM(bl.amount), 0) > 0
        ORDER BY weekly_earnings DESC
        LIMIT 100
      `);
      res.json(result.rows.map((u: any) => ({ ...u, weekly_earnings: parseFloat(u.weekly_earnings) })));
      return;
    }

    // Default: ELO
    const users = await db('users')
      .select('id', 'wallet', 'username', 'elo', 'games_played', 'games_won')
      .orderBy('elo', 'desc')
      .limit(100);
    res.json(users);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = await db('users').where({ id: req.userId }).first();
  if (!user) { res.status(404).json({ error: 'Not found' }); return; }

  const recentGames = await db('games as g')
    .join('users as w', 'g.player_white', 'w.id')
    .join('users as b', 'g.player_black', 'b.id')
    .where(function () {
      this.where('g.player_white', req.userId!).orWhere('g.player_black', req.userId!);
    })
    .where('g.status', 'completed')
    .select('g.id', 'g.result', 'g.bet_amount', 'g.elo_change', 'g.completed_at',
      'g.winner', 'g.player_white', 'g.player_black',
      'w.username as white_username', 'b.username as black_username')
    .orderBy('g.completed_at', 'desc')
    .limit(20);

  // Total earnings
  const earningsResult = await db('balance_ledger')
    .where({ user_id: req.userId, type: 'win' })
    .sum('amount as total');
  const totalEarnings = parseFloat((earningsResult[0] as any)?.total || '0');

  // Current win streak
  const allGames = await db('games')
    .where(function () {
      this.where('player_white', req.userId!).orWhere('player_black', req.userId!);
    })
    .where('status', 'completed')
    .orderBy('completed_at', 'desc')
    .limit(100)
    .select('winner');

  let currentStreak = 0;
  for (const g of allGames) {
    if (g.winner === req.userId) currentStreak++;
    else break;
  }

  let bestStreak = 0;
  let streak = 0;
  for (const g of [...allGames].reverse()) {
    if (g.winner === req.userId) { streak++; bestStreak = Math.max(bestStreak, streak); }
    else streak = 0;
  }

  res.json({
    id: user.id,
    wallet: user.wallet,
    username: user.username,
    elo: user.elo,
    gamesPlayed: user.games_played,
    gamesWon: user.games_won,
    usdcBalance: parseFloat(user.usdc_balance),
    totalEarnings,
    currentStreak,
    bestStreak,
    settings: user.settings || {},
    recentGames: recentGames.map((g) => ({ ...g, bet_amount: parseFloat(g.bet_amount) })),
  });
});

router.patch('/me/username', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { username } = req.body as { username?: string };
  if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    res.status(400).json({ error: 'Username must be 3-20 alphanumeric characters' });
    return;
  }
  try {
    await db('users').where({ id: req.userId }).update({ username });
    res.json({ username });
  } catch {
    res.status(409).json({ error: 'Username already taken' });
  }
});

router.patch('/me/settings', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const allowed = ['autoQueen', 'showEarningsPublicly', 'boardTheme'];
  const updates: Record<string, any> = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  try {
    await db('users')
      .where({ id: req.userId })
      .update({ settings: db.raw(`settings || ?::jsonb`, [JSON.stringify(updates)]) });
    const user = await db('users').where({ id: req.userId }).select('settings').first();
    res.json({ settings: user?.settings || {} });
  } catch (err) {
    console.error('Settings error:', err);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

router.post('/me/daily-bonus', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const BONUS_AMOUNT = 0.10;
  const COOLDOWN_MS = 20 * 60 * 60 * 1000; // 20 hours (not 24, so timezone drift doesn't block players)
  try {
    const user = await db('users').where({ id: req.userId }).select('last_login_bonus', 'login_streak', 'usdc_balance').first();
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const now = new Date();
    const lastBonus = user.last_login_bonus ? new Date(user.last_login_bonus) : null;
    const msSinceLast = lastBonus ? now.getTime() - lastBonus.getTime() : Infinity;

    if (msSinceLast < COOLDOWN_MS) {
      const nextIn = Math.ceil((COOLDOWN_MS - msSinceLast) / 1000 / 60); // minutes
      res.json({ credited: false, nextInMinutes: nextIn });
      return;
    }

    const isConsecutiveDay = lastBonus && msSinceLast < 48 * 60 * 60 * 1000;
    const newStreak = isConsecutiveDay ? (user.login_streak || 0) + 1 : 1;

    await db.transaction(async (trx) => {
      await trx('users').where({ id: req.userId }).update({
        usdc_balance: db.raw('usdc_balance + ?', [BONUS_AMOUNT]),
        last_login_bonus: now,
        login_streak: newStreak,
      });
      await trx('balance_ledger').insert({
        user_id: req.userId,
        amount: BONUS_AMOUNT,
        type: 'deposit',
        tx_hash: `daily_bonus_${now.getTime()}`,
      });
    });

    const updated = await db('users').where({ id: req.userId }).select('usdc_balance').first();
    res.json({ credited: true, amount: BONUS_AMOUNT, streak: newStreak, balance: parseFloat(updated.usdc_balance) });
  } catch (err) {
    console.error('Daily bonus error:', err);
    res.status(500).json({ error: 'Failed to claim bonus' });
  }
});

router.get('/search', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const q = ((req.query.q as string) || '').trim();
  if (!q || q.length < 2) { res.json([]); return; }
  try {
    const users = await db('users')
      .whereRaw(`LOWER(username) LIKE LOWER(?)`, [`${q}%`])
      .whereNot('id', req.userId!)
      .whereNotNull('username')
      .select('id', 'username', 'elo', 'games_played', 'games_won')
      .limit(10);
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Search failed' });
  }
});

// Public profile — must be last to avoid matching /me, /leaderboard
router.get('/:id', async (req: Request, res: Response) => {
  const user = await db('users')
    .where({ id: req.params.id })
    .select('id', 'wallet', 'username', 'elo', 'games_played', 'games_won', 'created_at', 'settings')
    .first();
  if (!user) { res.status(404).json({ error: 'Not found' }); return; }

  const settings = user.settings || {};
  const showEarnings = settings.showEarningsPublicly !== false;

  let totalEarnings: number | null = null;
  if (showEarnings) {
    const result = await db('balance_ledger')
      .where({ user_id: user.id, type: 'win' })
      .sum('amount as total');
    totalEarnings = parseFloat((result[0] as any)?.total || '0');
  }

  const recentGames = await db('games as g')
    .join('users as w', 'g.player_white', 'w.id')
    .join('users as b', 'g.player_black', 'b.id')
    .where(function () {
      this.where('g.player_white', user.id).orWhere('g.player_black', user.id);
    })
    .where('g.status', 'completed')
    .select('g.id', 'g.result', 'g.bet_amount', 'g.elo_change', 'g.completed_at',
      'g.winner', 'g.player_white', 'g.player_black',
      'w.username as white_username', 'b.username as black_username')
    .orderBy('g.completed_at', 'desc')
    .limit(10);

  res.json({
    id: user.id,
    wallet: user.wallet,
    username: user.username,
    elo: user.elo,
    gamesPlayed: user.games_played,
    gamesWon: user.games_won,
    totalEarnings,
    joinedAt: user.created_at,
    recentGames: recentGames.map((g) => ({ ...g, bet_amount: parseFloat(g.bet_amount) })),
  });
});

export default router;
