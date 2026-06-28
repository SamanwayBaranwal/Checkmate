import cron from 'node-cron';
import { db } from '../db/client';
import { createNotification } from './notifications';

export function startCronJobs() {
  // Weekly earnings summary — every Monday at 09:00 UTC
  cron.schedule('0 9 * * 1', async () => {
    try {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const users = await db('users')
        .whereNot('privy_user_id', 'like', 'deleted_%')
        .select('id');

      for (const user of users) {
        const rows = await db('balance_ledger')
          .where({ user_id: user.id })
          .where('created_at', '>=', weekAgo)
          .select(
            db.raw(`SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as earned`),
            db.raw(`SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as lost`),
            db.raw(`COUNT(*) as tx_count`)
          )
          .first();

        const earned = parseFloat(rows?.earned ?? '0');
        const lost = parseFloat(rows?.lost ?? '0');
        const txCount = parseInt(rows?.tx_count ?? '0', 10);

        if (txCount === 0) continue;

        const net = earned - lost;
        const netStr = net >= 0 ? `+$${net.toFixed(2)}` : `-$${Math.abs(net).toFixed(2)}`;
        const message = `Weekly summary: ${netStr} net (earned $${earned.toFixed(2)}, wagered $${lost.toFixed(2)})`;

        await createNotification(user.id, 'weekly_summary', message);
      }
    } catch (err) {
      console.error('Weekly summary cron error:', err);
    }
  });
}
