import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db/client';

const router = Router();

const VALID_REASONS = ['cheating', 'harassment', 'sandbagging', 'stalling', 'other'];

router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { reportedId, gameId, reason, details } = req.body as {
    reportedId?: string;
    gameId?: string;
    reason?: string;
    details?: string;
  };

  if (!reportedId || !reason || !VALID_REASONS.includes(reason)) {
    res.status(400).json({ error: 'reportedId and a valid reason are required' });
    return;
  }

  if (reportedId === req.userId!) {
    res.status(400).json({ error: 'Cannot report yourself' });
    return;
  }

  // Spam guard: max 5 reports per user per 24 hours
  const recentResult = await db('reports')
    .where({ reporter_id: req.userId! })
    .where('created_at', '>', db.raw("NOW() - INTERVAL '24 hours'"))
    .count('* as cnt')
    .first();

  if (parseInt((recentResult as any)?.cnt || '0') >= 5) {
    res.status(429).json({ error: 'Report limit reached. Try again tomorrow.' });
    return;
  }

  await db('reports').insert({
    reporter_id: req.userId!,
    reported_id: reportedId,
    game_id: gameId || null,
    reason,
    details: details ? details.slice(0, 500) : null,
  });

  res.json({ ok: true });
});

export default router;
