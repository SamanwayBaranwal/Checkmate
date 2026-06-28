import { Router, Response } from 'express';
import { db } from '../db/client';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { isOnline } from '../services/onlineUsers';

const router = Router();

router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const myId = req.userId!;

  // Accepted friends (either direction)
  const accepted = await db('friends as f')
    .where(function () {
      this.where({ user_id: myId, status: 'accepted' }).orWhere({ friend_id: myId, status: 'accepted' });
    })
    .join('users as u', function () {
      this.on('u.id', '=', db.raw('CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END', [myId]));
    })
    .select('f.id as friendshipId', 'u.id', 'u.username', 'u.wallet', 'u.elo', 'u.games_played', 'u.games_won');

  // Pending incoming (someone sent me a request)
  const incoming = await db('friends as f')
    .where({ friend_id: myId, status: 'pending' })
    .join('users as u', 'u.id', 'f.user_id')
    .select('f.id as friendshipId', 'u.id', 'u.username', 'u.wallet', 'u.elo');

  // Pending outgoing (I sent them a request)
  const outgoing = await db('friends as f')
    .where({ user_id: myId, status: 'pending' })
    .join('users as u', 'u.id', 'f.friend_id')
    .select('f.id as friendshipId', 'u.id', 'u.username', 'u.wallet', 'u.elo');

  res.json({
    friends: accepted.map((f) => ({ ...f, isOnline: isOnline(f.id) })),
    incoming: incoming.map((f) => ({ ...f, isOnline: isOnline(f.id) })),
    outgoing,
  });
});

router.post('/request', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const myId = req.userId!;
  const { targetId } = req.body as { targetId?: string };
  if (!targetId || targetId === myId) { res.status(400).json({ error: 'Invalid target' }); return; }

  const target = await db('users').where({ id: targetId }).first();
  if (!target) { res.status(404).json({ error: 'User not found' }); return; }

  // Check if friendship already exists (either direction)
  const existing = await db('friends').where(function () {
    this.where({ user_id: myId, friend_id: targetId }).orWhere({ user_id: targetId, friend_id: myId });
  }).first();
  if (existing) { res.status(409).json({ error: 'Friend request already exists' }); return; }

  await db('friends').insert({ user_id: myId, friend_id: targetId, status: 'pending' });
  res.json({ ok: true });
});

router.post('/accept', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const myId = req.userId!;
  const { requesterId } = req.body as { requesterId?: string };
  if (!requesterId) { res.status(400).json({ error: 'requesterId required' }); return; }

  const updated = await db('friends')
    .where({ user_id: requesterId, friend_id: myId, status: 'pending' })
    .update({ status: 'accepted' });

  if (!updated) { res.status(404).json({ error: 'No pending request found' }); return; }
  res.json({ ok: true });
});

router.delete('/:targetId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const myId = req.userId!;
  const { targetId } = req.params;

  await db('friends').where(function () {
    this.where({ user_id: myId, friend_id: targetId }).orWhere({ user_id: targetId, friend_id: myId });
  }).delete();

  res.json({ ok: true });
});

// Friend leaderboard (ELO ranking among accepted friends)
router.get('/leaderboard', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const myId = req.userId!;

  const friendIds = await db('friends')
    .where(function () {
      this.where({ user_id: myId, status: 'accepted' }).orWhere({ friend_id: myId, status: 'accepted' });
    })
    .select(db.raw('CASE WHEN user_id = ? THEN friend_id ELSE user_id END as fid', [myId]));

  const ids = [myId, ...friendIds.map((r: any) => r.fid)];

  const players = await db('users')
    .whereIn('id', ids)
    .select('id', 'wallet', 'username', 'elo', 'games_played', 'games_won')
    .orderBy('elo', 'desc');

  res.json(players.map((p: any) => ({ ...p, isOnline: isOnline(p.id), isMe: p.id === myId })));
});

export default router;
