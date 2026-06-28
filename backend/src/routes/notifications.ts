import { Router, Response } from 'express';
import { db } from '../db/client';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const notifications = await db('notifications')
    .where({ user_id: req.userId! })
    .orderBy('created_at', 'desc')
    .limit(30);
  res.json(notifications);
});

router.post('/read-all', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  await db('notifications').where({ user_id: req.userId!, read: false }).update({ read: true });
  res.json({ ok: true });
});

router.post('/:id/read', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  await db('notifications')
    .where({ id: req.params.id, user_id: req.userId! })
    .update({ read: true });
  res.json({ ok: true });
});

export default router;
