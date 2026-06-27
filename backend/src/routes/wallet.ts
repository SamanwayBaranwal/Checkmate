import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db/client';
import { createWalletClient, http, parseUnits, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const router = Router();

const USDC_ADDRESS = (process.env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') as `0x${string}`;
const PLATFORM_WALLET = (process.env.PLATFORM_WALLET_ADDRESS || '0x0') as `0x${string}`;

const usdcAbi = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
]);

router.get('/balance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = await db('users').where({ id: req.userId }).select('usdc_balance').first();
  res.json({ balance: parseFloat(user?.usdc_balance ?? '0') });
});

router.get('/deposit-address', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
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
  const { amount, toAddress } = req.body as { amount?: number; toAddress?: string };

  if (!amount || amount <= 0 || !toAddress) {
    res.status(400).json({ error: 'amount and toAddress required' });
    return;
  }

  if (!process.env.PLATFORM_WALLET_PRIVATE_KEY) {
    res.status(503).json({ error: 'Withdrawals temporarily unavailable' });
    return;
  }

  try {
    const updated = await db('users')
      .where({ id: req.userId })
      .where('usdc_balance', '>=', amount)
      .decrement('usdc_balance', amount);

    if (!updated) {
      res.status(400).json({ error: 'Insufficient balance' });
      return;
    }

    const account = privateKeyToAccount(process.env.PLATFORM_WALLET_PRIVATE_KEY as `0x${string}`);
    const walletClient = createWalletClient({ account, chain: base, transport: http(process.env.BASE_RPC_URL) });

    const txHash = await walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: usdcAbi,
      functionName: 'transfer',
      args: [toAddress as `0x${string}`, parseUnits(amount.toString(), 6)],
    });

    await db('balance_ledger').insert({
      user_id: req.userId,
      amount: -amount,
      type: 'withdrawal',
      tx_hash: txHash,
    });

    res.json({ txHash, amount, toAddress });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Withdrawal failed' });
  }
});

export default router;
