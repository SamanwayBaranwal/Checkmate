import { Router, Response } from 'express';
import { withdrawalCheck } from '../services/fairplay/service';
import { lockedAmount, recordWithdrawAddress } from '../services/fairplay/trust';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db/client';
import { createWalletClient, http, parseUnits, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { REAL_MONEY, FREE_PLAY_MESSAGE } from '../config';

const router = Router();

const USDC_ADDRESS = (process.env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') as `0x${string}`;
const PLATFORM_WALLET = (process.env.PLATFORM_WALLET_ADDRESS || '0x0') as `0x${string}`;

const usdcAbi = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
]);

router.get('/balance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const [user, bonusRow] = await Promise.all([
    db('users').where({ id: req.userId }).select('usdc_balance').first(),
    db('balance_ledger')
      .where({ user_id: req.userId })
      .whereIn('type', ['bonus', 'referral', 'daily_bonus', 'first_deposit_bonus'])
      .where('amount', '>', 0)
      .sum('amount as total')
      .first(),
  ]);
  const balance = parseFloat(user?.usdc_balance ?? '0');
  const locked = await lockedAmount(req.userId!);
  res.json({
    balance,
    bonusBalance: parseFloat(bonusRow?.total ?? '0'),
    locked,                                     // winnings waiting for the fair-play check
    withdrawable: Math.max(0, balance - locked),
  });
});

router.get('/deposit-address', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  if (!REAL_MONEY) return res.status(403).json({ error: FREE_PLAY_MESSAGE });
  res.json({
    address: PLATFORM_WALLET,
    network: 'Base',
    token: 'USDC',
    note: 'Send USDC on Base network only. Your balance will be credited within ~30 seconds.',
  });
});

router.get('/transactions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const rows = await db('balance_ledger')
    .where({ user_id: req.userId })
    .orderBy('created_at', 'desc')
    .limit(50)
    .select('id', 'amount', 'type', 'game_id', 'tx_hash', 'created_at');
  res.json(rows.map((r: any) => ({ ...r, amount: parseFloat(r.amount) })));
});

router.post('/withdraw', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!REAL_MONEY) return res.status(403).json({ error: FREE_PLAY_MESSAGE });
  const { amount, toAddress } = req.body as { amount?: number; toAddress?: string };

  // amount must be a real number with at most 6 decimals (USDC precision); strings / NaN / 1e308 rejected
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000 ||
      Math.round(amount * 1e6) / 1e6 !== amount || typeof toAddress !== 'string') {
    res.status(400).json({ error: 'amount and toAddress required' });
    return;
  }

  // Fair play: no withdrawals while under review, for new accounts, or before recent games are checked
  if (!/^0x[0-9a-fA-F]{40}$/.test(toAddress)) {
    res.status(400).json({ error: 'Invalid address' });
    return;
  }
  await recordWithdrawAddress(req.userId!, toAddress);
  const fp = await withdrawalCheck(req.userId!, amount);
  if (!fp.ok) {
    res.status(403).json({ error: fp.reason });
    return;
  }

  if (!process.env.PLATFORM_WALLET_PRIVATE_KEY) {
    res.status(503).json({ error: 'Withdrawals temporarily unavailable' });
    return;
  }

  // 1) Debit atomically: row lock + re-check of locked winnings inside the transaction, so two parallel
  //    withdrawals cannot both pass the "withdrawable" check and drain locked winnings.
  let ledgerId: string | null = null;
  const debitError = await db.transaction(async (trx) => {
    const u = await trx('users').where({ id: req.userId }).forUpdate().first('usdc_balance');
    const locked = await lockedAmount(req.userId!, trx);
    if (!u || parseFloat(u.usdc_balance) - locked + 1e-9 < amount) return 'Insufficient withdrawable balance';
    await trx('users').where({ id: req.userId }).decrement('usdc_balance', amount);
    const [row] = await trx('balance_ledger').insert({
      user_id: req.userId,
      amount: -amount,
      type: 'withdrawal',
      tx_hash: 'pending',
    }).returning('id');
    ledgerId = row.id ?? row;
    return null;
  });
  if (debitError) {
    res.status(400).json({ error: debitError });
    return;
  }

  // 2) Send on-chain. If sending fails the debit is reversed (before: the balance was gone with no ledger row).
  let txHash: string;
  try {
    const account = privateKeyToAccount(process.env.PLATFORM_WALLET_PRIVATE_KEY as `0x${string}`);
    const walletClient = createWalletClient({ account, chain: base, transport: http(process.env.BASE_RPC_URL) });
    txHash = await walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: usdcAbi,
      functionName: 'transfer',
      args: [toAddress as `0x${string}`, parseUnits(amount.toString(), 6)],
    });
  } catch (err) {
    console.error('Withdrawal send failed, refunding:', err);
    await db.transaction(async (trx) => {
      await trx('users').where({ id: req.userId }).increment('usdc_balance', amount);
      await trx('balance_ledger').where({ id: ledgerId }).update({ tx_hash: 'failed' });
      await trx('balance_ledger').insert({ user_id: req.userId, amount, type: 'refund', tx_hash: `withdraw_failed_${ledgerId}` });
    });
    res.status(502).json({ error: 'Withdrawal failed, your balance was not charged' });
    return;
  }

  await db('balance_ledger').where({ id: ledgerId }).update({ tx_hash: txHash });
  res.json({ txHash, amount, toAddress });
});

router.get('/earnings-chart', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const result = await db.raw(`
    SELECT
      DATE(created_at AT TIME ZONE 'UTC') AS day,
      SUM(CASE WHEN type IN ('win', 'bonus', 'referral') THEN amount ELSE 0 END) AS income,
      SUM(CASE WHEN type IN ('loss', 'fee') THEN ABS(amount) ELSE 0 END)          AS expenses
    FROM balance_ledger
    WHERE user_id = ?
      AND created_at >= NOW() - INTERVAL '30 days'
      AND type NOT IN ('deposit', 'withdrawal')
    GROUP BY day
    ORDER BY day ASC
  `, [req.userId!]);

  res.json(
    result.rows.map((r: any) => ({
      day: r.day.toISOString().split('T')[0],
      income: parseFloat(r.income),
      expenses: parseFloat(r.expenses),
    }))
  );
});

export default router;
