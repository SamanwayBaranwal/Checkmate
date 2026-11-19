import { Router, Request, Response } from 'express';
import { db } from '../db/client';
import { confirmCheater, clearPlayer, queueGameAnalysis, isEngineReady } from '../services/fairplay/service';

const router = Router();

function requireAdmin(req: Request, res: Response): boolean {
  const secret = process.env.ADMIN_SECRET;
  const provided =
    req.headers['x-admin-secret'] as string | undefined ||
    (req.query.secret as string | undefined);
  if (!secret || provided !== secret) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

// GET /api/admin/reports?status=open
router.get('/reports', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const status = (req.query.status as string) || 'open';

  try {
    const reports = await db('reports as r')
      .join('users as reporter', 'r.reporter_id', 'reporter.id')
      .join('users as reported', 'r.reported_id', 'reported.id')
      .leftJoin('games as g', 'r.game_id', 'g.id')
      .where('r.status', status)
      .select(
        'r.id', 'r.reason', 'r.details', 'r.status', 'r.created_at',
        'r.admin_notes',
        'reporter.id as reporter_id', 'reporter.username as reporter_username', 'reporter.wallet as reporter_wallet',
        'reported.id as reported_id', 'reported.username as reported_username',
        'reported.wallet as reported_wallet', 'reported.elo as reported_elo',
        'reported.banned_at', 'reported.ban_reason',
        'g.id as game_id', 'g.result as game_result'
      )
      .orderBy('r.created_at', 'asc');

    res.json(reports);
  } catch (err) {
    console.error('Admin reports error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// POST /api/admin/reports/:id/resolve  { notes? }
router.post('/reports/:id/resolve', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const { notes } = req.body as { notes?: string };
  try {
    await db('reports').where({ id: req.params.id }).update({
      status: 'resolved',
      admin_notes: notes ?? null,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// POST /api/admin/reports/:id/dismiss
router.post('/reports/:id/dismiss', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const { notes } = req.body as { notes?: string };
  try {
    await db('reports').where({ id: req.params.id }).update({
      status: 'dismissed',
      admin_notes: notes ?? null,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/admin/users?q=username_or_wallet
router.get('/users', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const q = ((req.query.q as string) || '').trim();

  try {
    const users = await db('users')
      .where(function () {
        if (q) {
          this.whereILike('username', `%${q}%`).orWhereILike('wallet', `%${q}%`);
        }
      })
      .select('id', 'username', 'wallet', 'elo', 'games_played', 'usdc_balance', 'banned_at', 'ban_reason', 'created_at')
      .orderBy('created_at', 'desc')
      .limit(50);

    res.json(users.map((u) => ({
      ...u,
      usdc_balance: parseFloat(u.usdc_balance),
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// POST /api/admin/users/:id/ban  { reason }
router.post('/users/:id/ban', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const { reason } = req.body as { reason?: string };
  if (!reason) { res.status(400).json({ error: 'reason required' }); return; }

  try {
    await db('users').where({ id: req.params.id }).update({
      banned_at: new Date(),
      ban_reason: reason,
    });
    // Also resolve all open reports for this user
    await db('reports').where({ reported_id: req.params.id, status: 'open' }).update({
      status: 'resolved',
      admin_notes: `User banned: ${reason}`,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// POST /api/admin/users/:id/unban
router.post('/users/:id/unban', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    await db('users').where({ id: req.params.id }).update({
      banned_at: null,
      ban_reason: null,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/admin/banned — list all currently banned users
router.get('/banned', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const users = await db('users')
      .whereNotNull('banned_at')
      .select('id', 'username', 'wallet', 'elo', 'banned_at', 'ban_reason')
      .orderBy('banned_at', 'desc');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/admin/stats — quick platform overview
router.get('/stats', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const [users, games, openReports, bannedUsers] = await Promise.all([
      db('users').count('* as cnt').first(),
      db('games').where('status', 'completed').count('* as cnt').first(),
      db('reports').where('status', 'open').count('* as cnt').first(),
      db('users').whereNotNull('banned_at').count('* as cnt').first(),
    ]);
    res.json({
      totalUsers: parseInt((users as any)?.cnt ?? '0'),
      totalGames: parseInt((games as any)?.cnt ?? '0'),
      openReports: parseInt((openReports as any)?.cnt ?? '0'),
      bannedUsers: parseInt((bannedUsers as any)?.cnt ?? '0'),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ───────────────────────────── Fair play (anti-cheat) ─────────────────────────────

// GET /api/admin/fairplay?status=review|watch|all  → players to look at, worst first
router.get('/fairplay', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const status = (req.query.status as string) || 'review';
  let q = db('users')
    .select('id', 'username', 'wallet', 'elo', 'games_played', 'usdc_balance', 'banned_at',
      'fairplay_status', 'fairplay_score', 'fairplay_flagged_games', 'fairplay_reasons', 'fairplay_updated_at')
    .orderBy([{ column: 'fairplay_score', order: 'desc' }, { column: 'fairplay_flagged_games', order: 'desc' }])
    .limit(200);
  if (status === 'all') q = q.whereIn('fairplay_status', ['review', 'watch']);
  else q = q.where({ fairplay_status: status });
  if (status !== 'banned') q = q.whereNull('banned_at');
  const players = await q;
  const pending = await db('games').where({ analysis_status: 'pending' }).count('* as c').first();
  res.json({
    engineReady: isEngineReady(),
    pendingAnalysis: parseInt((pending as any)?.c || '0', 10),
    players: players.map((u: any) => ({ ...u, usdc_balance: parseFloat(u.usdc_balance) })),
  });
});

// GET /api/admin/fairplay/:userId → evidence: every analysed game, newest first
router.get('/fairplay/:userId', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const userId = req.params.userId;
  const user = await db('users').where({ id: userId })
    .select('id', 'username', 'wallet', 'elo', 'games_played', 'games_won', 'usdc_balance', 'created_at', 'banned_at',
      'fairplay_status', 'fairplay_score', 'fairplay_flagged_games', 'fairplay_reasons', 'fairplay_cleared_at').first();
  if (!user) { res.status(404).json({ error: 'Not found' }); return; }
  const games = await db('game_analysis as a')
    .join('games as g', 'a.game_id', 'g.id')
    .leftJoin('users as o', function () {
      this.on('o.id', '=', db.raw('CASE WHEN g.player_white = a.user_id THEN g.player_black ELSE g.player_white END'));
    })
    .where('a.user_id', userId)
    .orderBy('g.completed_at', 'desc')
    .limit(50)
    .select('a.*', 'g.result', 'g.winner', 'g.bet_amount', 'g.completed_at',
      'o.id as opponent_id', 'o.username as opponent_username', 'o.wallet as opponent_wallet', 'o.elo as opponent_elo');
  const reports = await db('reports').where({ reported_id: userId }).orderBy('created_at', 'desc').limit(20)
    .select('id', 'reason', 'details', 'status', 'game_id', 'created_at');
  const actions = await db('fairplay_actions').where({ user_id: userId }).orderBy('created_at', 'desc').limit(20);
  res.json({
    user: { ...user, usdc_balance: parseFloat(user.usdc_balance) },
    games: games.map((g: any) => ({
      ...g,
      won: g.winner === userId,
      bet_amount: parseFloat(g.bet_amount),
      acpl: parseFloat(g.acpl), engine_match: parseFloat(g.engine_match), accuracy: parseFloat(g.accuracy),
      blur_rate: parseFloat(g.blur_rate), move_time_cv: g.move_time_cv === null ? null : parseFloat(g.move_time_cv),
    })),
    reports,
    actions,
  });
});

// POST /api/admin/fairplay/:userId/confirm { days?, notes? } → ban, refund victims, claw back winnings
router.post('/fairplay/:userId/confirm', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const { days, notes } = req.body as { days?: number; notes?: string };
  const summary = await confirmCheater(req.params.userId, Math.min(Math.max(days || 30, 1), 365), notes || '');
  res.json({ ok: true, summary });
});

// POST /api/admin/fairplay/:userId/clear { notes? } → reviewed and fine
router.post('/fairplay/:userId/clear', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  await clearPlayer(req.params.userId, (req.body?.notes as string) || '');
  res.json({ ok: true });
});

// POST /api/admin/fairplay/reanalyse/:gameId → run Stockfish on one game again
router.post('/fairplay/reanalyse/:gameId', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  await db('games').where({ id: req.params.gameId }).update({ analysis_status: 'pending' });
  queueGameAnalysis(req.params.gameId);
  res.json({ ok: true });
});

export default router;
