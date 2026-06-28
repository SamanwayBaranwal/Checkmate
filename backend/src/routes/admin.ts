import { Router, Request, Response } from 'express';
import { db } from '../db/client';

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

export default router;
