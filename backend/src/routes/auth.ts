import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/client';

const router = Router();

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusable chars (O/0, I/1)
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function makeReferralCode(): Promise<string> {
  let code = generateReferralCode();
  // Retry on collision (extremely rare)
  while (await db('users').where({ referral_code: code }).first()) {
    code = generateReferralCode();
  }
  return code;
}

router.post('/verify', async (req: Request, res: Response) => {
  const { privyUserId, wallet, referralCode } = req.body as {
    privyUserId?: string;
    wallet?: string;
    referralCode?: string;
  };

  if (!privyUserId || !wallet) {
    res.status(400).json({ error: 'privyUserId and wallet required' });
    return;
  }

  const walletLower = wallet.toLowerCase();

  try {
    const isNewUser = !(await db('users').where({ privy_user_id: privyUserId }).first());

    // Generate referral code for new user
    const newReferralCode = isNewUser ? await makeReferralCode() : undefined;

    // Look up referrer
    let referredBy: string | undefined;
    if (isNewUser && referralCode) {
      const referrer = await db('users')
        .where({ referral_code: referralCode.toUpperCase() })
        .select('id')
        .first();
      if (referrer && referrer.id !== privyUserId) referredBy = referrer.id;
    }

    await db('users')
      .insert({
        privy_user_id: privyUserId,
        wallet: walletLower,
        ...(newReferralCode ? { referral_code: newReferralCode } : {}),
        ...(referredBy ? { referred_by: referredBy } : {}),
      })
      .onConflict('privy_user_id')
      .merge({ wallet: walletLower });

    const user = await db('users').where({ privy_user_id: privyUserId }).first();

    if (user?.banned_at) {
      res.status(403).json({ error: `Account suspended: ${user.ban_reason ?? 'fair play violation'}` });
      return;
    }

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
