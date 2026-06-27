import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/client';

const router = Router();

// Privy sends us a verified user object from the frontend SDK.
// We accept the wallet address + privy user id directly.
// In production you'd verify the Privy access token server-side using @privy-io/server-auth.
router.post('/verify', async (req: Request, res: Response) => {
  const { privyUserId, wallet } = req.body as { privyUserId?: string; wallet?: string };

  if (!privyUserId || !wallet) {
    res.status(400).json({ error: 'privyUserId and wallet required' });
    return;
  }

  const walletLower = wallet.toLowerCase();

  try {
    // Upsert user — on conflict just update wallet in case it changed
    await db('users')
      .insert({ privy_user_id: privyUserId, wallet: walletLower })
      .onConflict('privy_user_id')
      .merge({ wallet: walletLower });

    const user = await db('users').where({ privy_user_id: privyUserId }).first();

    const token = jwt.sign(
      { userId: user.id, wallet: user.wallet },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        wallet: user.wallet,
        username: user.username,
        elo: user.elo,
        usdcBalance: parseFloat(user.usdc_balance),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
