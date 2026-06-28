import { db } from '../db/client';
import { createNotification } from './notifications';

export const MISSIONS = [
  {
    key: 'play_5',
    label: 'Play 5 games',
    description: 'Complete 5 games this week',
    target: 5,
    reward: 0.10,
    icon: '♟',
    unit: 'games',
  },
  {
    key: 'win_3',
    label: 'Win 3 games',
    description: 'Win 3 games this week',
    target: 3,
    reward: 0.25,
    icon: '🏆',
    unit: 'wins',
  },
  {
    key: 'earn_1',
    label: 'Earn $1 in prizes',
    description: 'Win $1 or more in total game prizes this week',
    target: 1.0,
    reward: 0.20,
    icon: '💰',
    unit: '$',
  },
  {
    key: 'play_friend',
    label: 'Play a friend',
    description: 'Complete a game against one of your friends',
    target: 1,
    reward: 0.15,
    icon: '🤝',
    unit: 'game',
  },
] as const;

type MissionKey = typeof MISSIONS[number]['key'];
export type MissionProgressType = 'play' | 'win' | 'earn' | 'friend';

const TYPE_TO_KEYS: Record<MissionProgressType, MissionKey[]> = {
  play: ['play_5'],
  win: ['win_3'],
  earn: ['earn_1'],
  friend: ['play_friend'],
};

export function getWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // days back to Monday
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff)
  );
  return monday.toISOString().split('T')[0];
}

export async function updateMissionProgress(
  userId: string,
  type: MissionProgressType,
  amount: number = 1
): Promise<void> {
  const weekStart = getWeekStart();
  const keys = TYPE_TO_KEYS[type];

  for (const key of keys) {
    const mission = MISSIONS.find((m) => m.key === key)!;

    // Upsert: insert or increment. WHERE clause prevents update if already rewarded.
    await db.raw(
      `INSERT INTO user_weekly_missions (user_id, week_start, mission_key, progress)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, week_start, mission_key)
       DO UPDATE SET progress = LEAST(user_weekly_missions.progress + ?, ?)
       WHERE NOT user_weekly_missions.rewarded`,
      [userId, weekStart, key, amount, amount, mission.target * 2]
    );

    const row = await db('user_weekly_missions')
      .where({ user_id: userId, week_start: weekStart, mission_key: key })
      .first();

    if (row && !row.rewarded && parseFloat(row.progress) >= mission.target) {
      await db('user_weekly_missions').where({ id: row.id }).update({
        completed: true,
        rewarded: true,
      });

      await db.transaction(async (trx) => {
        await trx('users').where({ id: userId }).increment('usdc_balance', mission.reward);
        await trx('balance_ledger').insert({
          user_id: userId,
          amount: mission.reward,
          type: 'bonus',
        });
      });

      await createNotification(
        userId,
        'mission_complete',
        `Mission complete: "${mission.label}" — +$${mission.reward.toFixed(2)} USDC!`,
        { missionKey: key, reward: mission.reward }
      );
    }
  }
}

export async function getUserMissions(userId: string) {
  const weekStart = getWeekStart();

  const rows = await db('user_weekly_missions').where({
    user_id: userId,
    week_start: weekStart,
  });

  const progressMap: Record<string, typeof rows[number]> = {};
  for (const row of rows) {
    progressMap[row.mission_key] = row;
  }

  // Calculate ms until next Monday reset
  const now = new Date();
  const day = now.getUTCDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const nextMonday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday)
  );
  const msUntilReset = nextMonday.getTime() - now.getTime();

  return {
    missions: MISSIONS.map((m) => {
      const row = progressMap[m.key];
      return {
        key: m.key,
        label: m.label,
        description: m.description,
        target: m.target,
        reward: m.reward,
        icon: m.icon,
        unit: m.unit,
        progress: row ? parseFloat(row.progress as string) : 0,
        completed: row?.completed ?? false,
        rewarded: row?.rewarded ?? false,
      };
    }),
    weekStart,
    msUntilReset,
  };
}
