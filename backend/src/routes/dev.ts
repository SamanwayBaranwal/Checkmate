import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db/client';
import { starterAlreadyClaimedNearby } from '../services/fairplay/trust';

const router = Router();

const STARTER_AMOUNT = 10;
const TOPUP_AMOUNT = 5;

// Check + credit run in ONE transaction that holds a lock, so parallel requests are serialised.
// (Before: 10 parallel claim-starter requests credited $100, 10 parallel top-ups $50.)

// Claim starter credits — once per user ever
router.post('/claim-starter', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const error = await db.transaction(async (trx) => {
    // Global lock (starter claims are rare): also stops two accounts on one device claiming at the same instant
    await trx.raw('SELECT pg_advisory_xact_lock(?)', [740001]);
    const existing = await trx('balance_ledger')
      .where({ user_id: req.userId })
      .where('tx_hash', 'like', 'starter_%')
      .first();
    if (existing) return 'Already claimed';
    if (await starterAlreadyClaimedNearby(req.userId!, trx)) return 'Starter credits were already claimed on this device.';

    await trx('users').where({ id: req.userId }).increment('usdc_balance', STARTER_AMOUNT);
    await trx('balance_ledger').insert({
      user_id: req.userId,
      amount: STARTER_AMOUNT,
      type: 'bonus',
      tx_hash: `starter_${Date.now()}`,
    });
    return null;
  });
  if (error) {
    res.status(400).json({ error });
    return;
  }

  const user = await db('users').where({ id: req.userId }).select('usdc_balance').first();
  res.json({ message: `$${STARTER_AMOUNT} free credits added!`, balance: parseFloat(user.usdc_balance) });
});

// Top-up $5 when balance is low (once per 24h)
router.post('/topup', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const error = await db.transaction(async (trx) => {
    const user = await trx('users').where({ id: req.userId }).forUpdate().select('usdc_balance').first();
    if (!user) return 'User not found';
    if (parseFloat(user.usdc_balance ?? '0') >= 1) return 'Balance is sufficient';

    const recent = await trx('balance_ledger')
      .where({ user_id: req.userId })
      .where('tx_hash', 'like', 'topup_%')
      .where('created_at', '>', new Date(Date.now() - 86400000).toISOString())
      .first();
    if (recent) return 'Top-up already claimed in the last 24 hours';

    await trx('users').where({ id: req.userId }).increment('usdc_balance', TOPUP_AMOUNT);
    await trx('balance_ledger').insert({
      user_id: req.userId,
      amount: TOPUP_AMOUNT,
      type: 'bonus',
      tx_hash: `topup_${Date.now()}`,
    });
    return null;
  });
  if (error) {
    res.status(400).json({ error });
    return;
  }

  const updated = await db('users').where({ id: req.userId }).select('usdc_balance').first();
  res.json({ message: `$${TOPUP_AMOUNT} credits added!`, balance: parseFloat(updated.usdc_balance) });
});

export default router;
