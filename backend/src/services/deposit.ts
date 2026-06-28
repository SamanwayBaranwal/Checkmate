import { createPublicClient, http, parseAbi, type Log } from 'viem';
import { base } from 'viem/chains';
import { db } from '../db/client';
import { createNotification } from './notifications';

const USDC_ADDRESS = (process.env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') as `0x${string}`;
const PLATFORM_WALLET = (process.env.PLATFORM_WALLET_ADDRESS || '0x0') as `0x${string}`;

const usdcAbi = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL),
});

export function startDepositWatcher() {
  if (!PLATFORM_WALLET || PLATFORM_WALLET === '0x0') {
    console.warn('PLATFORM_WALLET_ADDRESS not set — deposit watcher disabled');
    return;
  }

  let lastCheckedBlock: bigint | undefined;

  async function pollDeposits() {
    try {
      const latestBlock = await client.getBlockNumber();
      const fromBlock = lastCheckedBlock ? lastCheckedBlock + 1n : latestBlock - 100n;

      if (fromBlock > latestBlock) return;

      const logs = await client.getLogs({
        address: USDC_ADDRESS,
        event: {
          type: 'event',
          name: 'Transfer',
          inputs: [
            { type: 'address', name: 'from', indexed: true },
            { type: 'address', name: 'to', indexed: true },
            { type: 'uint256', name: 'value', indexed: false },
          ],
        },
        args: { to: PLATFORM_WALLET },
        fromBlock,
        toBlock: latestBlock,
      });

      lastCheckedBlock = latestBlock;

      for (const log of logs) {
        const { args, transactionHash } = log as any;
        if (!args?.from || !args?.value) continue;

        const fromAddress: string = args.from.toLowerCase();
        const usdcAmount = Number(args.value) / 1e6;

        try {
          const user = await db('users').whereRaw('LOWER(wallet) = ?', [fromAddress]).first();
          if (!user) continue;

          const existing = await db('balance_ledger').where({ tx_hash: transactionHash }).first();
          if (existing) continue;

          await db.transaction(async (trx) => {
            await trx('users').where({ id: user.id }).increment('usdc_balance', usdcAmount);
            await trx('balance_ledger').insert({ user_id: user.id, amount: usdcAmount, type: 'deposit', tx_hash: transactionHash });
          });
          console.log(`Credited ${usdcAmount} USDC to user ${user.id}`);

          // First deposit bonus: 50% match up to $10
          const depositCount = await db('balance_ledger')
            .where({ user_id: user.id, type: 'deposit' })
            .count('* as cnt')
            .first();
          if (parseInt((depositCount as any)?.cnt || '0') === 1) {
            const bonusAmount = parseFloat(Math.min(usdcAmount * 0.50, 10.00).toFixed(6));
            await db.transaction(async (trx) => {
              await trx('users').where({ id: user.id }).increment('usdc_balance', bonusAmount);
              await trx('balance_ledger').insert({
                user_id: user.id,
                amount: bonusAmount,
                type: 'bonus',
                tx_hash: `first_deposit_bonus_${transactionHash}`,
              });
            });
            console.log(`First deposit bonus: +${bonusAmount} USDC to user ${user.id}`);
            createNotification(
              user.id,
              'mission_complete',
              `First deposit bonus! +$${bonusAmount.toFixed(2)} USDC credited to your balance.`,
              { type: 'first_deposit_bonus', amount: bonusAmount }
            );
          }
        } catch (err) {
          console.error('Deposit processing error:', err);
        }
      }
    } catch (err) {
      // silent — retry next interval
    }
  }

  // Poll every 30 seconds
  setInterval(pollDeposits, 30000);
  pollDeposits();
  console.log(`Deposit watcher active (polling) — watching ${PLATFORM_WALLET}`);
}
