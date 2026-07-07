import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db/client';

const router = Router();

const STARTER_AMOUNT = 10;
const TOPUP_AMOUNT = 5;

// Claim starter credits — once per user ever
router.post('/claim-starter', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const existing = await db('balance_ledger')
    .where({ user_id: req.userId })
    .where('tx_hash', 'like', 'starter_%')
    .first();

  if (existing) {
    res.status(400).json({ error: 'Already claimed' });
    return;
  }

  await db('users').where({ id: req.userId }).increment('usdc_balance', STARTER_AMOUNT);
  await db('balance_ledger').insert({
    user_id: req.userId,
    amount: STARTER_AMOUNT,
    type: 'bonus',
    tx_hash: `starter_${Date.now()}`,
  });

  const user = await db('users').where({ id: req.userId }).select('usdc_balance').first();
  res.json({ message: `$${STARTER_AMOUNT} free credits added!`, balance: parseFloat(user.usdc_balance) });
});

// Top-up $5 when balance is low (once per 24h)
router.post('/topup', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = await db('users').where({ id: req.userId }).select('usdc_balance').first();
  if (parseFloat(user?.usdc_balance ?? '0') >= 1) {
    res.status(400).json({ error: 'Balance is sufficient' });
    return;
  }

  const recent = await db('balance_ledger')
    .where({ user_id: req.userId })
    .where('tx_hash', 'like', 'topup_%')
    .where('created_at', '>', new Date(Date.now() - 86400000).toISOString())
    .first();

  if (recent) {
    res.status(400).json({ error: 'Top-up already claimed in the last 24 hours' });
    return;
  }

  await db('users').where({ id: req.userId }).increment('usdc_balance', TOPUP_AMOUNT);
  await db('balance_ledger').insert({
    user_id: req.userId,
    amount: TOPUP_AMOUNT,
    type: 'bonus',
    tx_hash: `topup_${Date.now()}`,
  });

  const updated = await db('users').where({ id: req.userId }).select('usdc_balance').first();
  res.json({ message: `$${TOPUP_AMOUNT} credits added!`, balance: parseFloat(updated.usdc_balance) });
});

export default router;
