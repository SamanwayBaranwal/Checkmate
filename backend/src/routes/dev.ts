import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db/client';

const router = Router();

// Only works in development — gives free fake USDC for testing
router.post('/add-balance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Not available in production' });
    return;
  }

  const amount = 100; // Give $100 fake USDC

  await db('users').where({ id: req.userId }).increment('usdc_balance', amount);
  await db('balance_ledger').insert({
    user_id: req.userId,
    amount,
    type: 'deposit',
    tx_hash: `dev_${Date.now()}`,
  });

  const user = await db('users').where({ id: req.userId }).select('usdc_balance').first();
  res.json({ message: `Added $${amount} fake USDC`, balance: parseFloat(user.usdc_balance) });
});

export default router;
