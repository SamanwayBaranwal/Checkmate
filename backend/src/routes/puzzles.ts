import { Router, Response } from 'express';
import { db } from '../db/client';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { createNotification } from '../services/notifications';

const router = Router();

// Curated tactical puzzles: { fen, solution (sequence of UCI moves), difficulty, theme }
// FEN is position BEFORE the player's first move. Solution[0] is the correct first move.
// All puzzles are from Black's perspective (to move) or White's perspective as indicated by FEN active color.
const PUZZLES = [
  {
    id: 0,
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
    solution: ['f3g5', 'd8e7'],
    difficulty: 'easy',
    theme: 'Fork',
    description: 'Find the knight fork!',
  },
  {
    id: 1,
    fen: '6k1/5ppp/p7/1p6/1P6/P5PP/5PK1/8 w - - 0 1',
    solution: ['g3g4'],
    difficulty: 'easy',
    theme: 'King & Pawn',
    description: 'Gain space on the kingside.',
  },
  {
    id: 2,
    fen: 'r2q1rk1/ppp2ppp/2n1bn2/3pp3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 8',
    solution: ['c4b5', 'c6d4'],
    difficulty: 'medium',
    theme: 'Pin',
    description: 'Pin the knight and win material.',
  },
  {
    id: 3,
    fen: '4r1k1/1p3ppp/p7/3p4/3P4/1P3P2/P4KPP/4R3 b - - 0 1',
    solution: ['e8e1', 'f2e1'],
    difficulty: 'easy',
    theme: 'Back Rank',
    description: 'Exploit the back rank weakness.',
  },
  {
    id: 4,
    fen: 'r1b1k2r/pppp1ppp/2n2n2/2b1p3/2B1P1q1/3P1N2/PPP2PPP/RNBQ1RK1 w kq - 0 7',
    solution: ['f3g5'],
    difficulty: 'medium',
    theme: 'Attack',
    description: 'Find the winning tactical strike.',
  },
  {
    id: 5,
    fen: '8/8/8/3k4/8/3K4/8/R7 w - - 0 1',
    solution: ['a1a5', 'd5e6', 'a5a6'],
    difficulty: 'hard',
    theme: 'Rook Endgame',
    description: 'Restrict the king step by step.',
  },
  {
    id: 6,
    fen: 'r3r1k1/pp3ppp/2p5/8/2B5/2N3Pq/PPP2P1P/R2Q1RK1 b - - 0 1',
    solution: ['h3g2', 'g1h2', 'e8e2'],
    difficulty: 'hard',
    theme: 'Mating Attack',
    description: 'Sacrifice to open the king.',
  },
  {
    id: 7,
    fen: 'r1bq1rk1/ppp1ppbp/2np1np1/8/3PP3/2N1BP2/PPPQ2PP/R3KBNR w KQ - 0 7',
    solution: ['e1c1'],
    difficulty: 'easy',
    theme: 'Development',
    description: 'Castle and connect the rooks.',
  },
  {
    id: 8,
    fen: '2kr3r/ppp2p1p/2nq1np1/3p1b2/3P4/1BN1PN2/PP3PPP/R2QK2R w KQ - 0 11',
    solution: ['d1d3', 'f5e4'],
    difficulty: 'medium',
    theme: 'Center Control',
    description: 'Control the center and activate the queen.',
  },
  {
    id: 9,
    fen: '8/8/4k3/8/8/4K3/4P3/8 w - - 0 1',
    solution: ['e3d4', 'e6f5', 'e2e4'],
    difficulty: 'medium',
    theme: 'Pawn Endgame',
    description: 'Advance the pawn with king support.',
  },
  {
    id: 10,
    fen: '5rk1/1pp2ppp/p1b5/8/8/1P3NP1/P1P2PP1/5RK1 w - - 0 1',
    solution: ['f3e5', 'c6e4', 'e5c6'],
    difficulty: 'medium',
    theme: 'Knight Outpost',
    description: 'Plant your knight on the outpost.',
  },
  {
    id: 11,
    fen: 'r1bqr1k1/pp3ppp/2n2n2/3p4/3P4/2N1PN2/PP3PPP/R1BQK2R w KQ - 0 9',
    solution: ['e1g1'],
    difficulty: 'easy',
    theme: 'Safety',
    description: 'Castle to safety.',
  },
  {
    id: 12,
    fen: '4k3/8/4K3/4R3/8/8/8/8 w - - 0 1',
    solution: ['e5e8'],
    difficulty: 'easy',
    theme: 'Checkmate',
    description: 'Deliver the final blow.',
  },
  {
    id: 13,
    fen: 'r1bq1rk1/1ppp1ppp/p1n2n2/4p3/2B1P3/2NP1N2/PPP2PPP/R1BQR1K1 b - - 0 8',
    solution: ['f6e4', 'c3e4', 'd7d5'],
    difficulty: 'hard',
    theme: 'Sacrifice',
    description: 'Exchange sac for dynamic play.',
  },
  {
    id: 14,
    fen: '3r1rk1/p1p2ppp/1pnqp3/3p4/3P4/2N1PN2/PP3PPP/R2QR1K1 w - - 0 11',
    solution: ['e3d5', 'e6d5', 'e1e8'],
    difficulty: 'hard',
    theme: 'Deflection',
    description: 'Remove the defender.',
  },
] as const;

function getPuzzleOfDay(offset = 0): typeof PUZZLES[number] {
  const epoch = new Date('2024-01-01').getTime();
  const dayIndex = Math.floor((Date.now() - epoch) / 86400000) + offset;
  return PUZZLES[dayIndex % PUZZLES.length];
}

function todayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

// GET /api/puzzles/daily
router.get('/daily', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const puzzle = getPuzzleOfDay();
  const today = todayUTC();

  try {
    const [record, stats] = await Promise.all([
      db('user_daily_puzzles').where({ user_id: req.userId, puzzle_date: today }).first(),
      db('user_puzzle_stats').where({ user_id: req.userId }).first(),
    ]);

    res.json({
      puzzle: {
        id: puzzle.id,
        fen: puzzle.fen,
        difficulty: puzzle.difficulty,
        theme: puzzle.theme,
        description: puzzle.description,
        solutionLength: puzzle.solution.length,
      },
      state: {
        solved: record?.solved ?? false,
        failed: record?.failed ?? false,
        attempts: record?.attempts ?? 0,
        xpEarned: record?.xp_earned ?? 0,
      },
      stats: {
        streak: stats?.current_streak ?? 0,
        longestStreak: stats?.longest_streak ?? 0,
        totalSolved: stats?.total_solved ?? 0,
      },
    });
  } catch (err) {
    console.error('Get daily puzzle error:', err);
    res.status(500).json({ error: 'Failed to load puzzle' });
  }
});

// POST /api/puzzles/daily/attempt — submit a move; returns { correct, done, xpEarned?, solution? }
router.post('/daily/attempt', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { moveIndex, move } = req.body as { moveIndex?: number; move?: string };
  const puzzle = getPuzzleOfDay();
  const today = todayUTC();

  if (typeof moveIndex !== 'number' || !move) {
    res.status(400).json({ error: 'moveIndex and move required' });
    return;
  }

  try {
    let record = await db('user_daily_puzzles').where({ user_id: req.userId, puzzle_date: today }).first();

    if (record?.solved || record?.failed) {
      res.json({
        correct: false,
        done: true,
        alreadyDone: true,
        solution: puzzle.solution,
      });
      return;
    }

    const expectedMove = puzzle.solution[moveIndex];
    const correct = move === expectedMove;
    const isLastMove = correct && moveIndex === puzzle.solution.length - 1;
    const newAttempts = (record?.attempts ?? 0) + 1;
    const maxAttempts = 3;
    const failed = !correct && newAttempts >= maxAttempts;

    if (!record) {
      await db('user_daily_puzzles').insert({
        user_id: req.userId,
        puzzle_date: today,
        puzzle_id: puzzle.id,
        attempts: newAttempts,
        solved: isLastMove,
        failed: failed,
        xp_earned: 0,
      });
    } else {
      await db('user_daily_puzzles').where({ user_id: req.userId, puzzle_date: today }).update({
        attempts: newAttempts,
        solved: isLastMove,
        failed: failed,
      });
    }

    let xpEarned = 0;

    if (isLastMove) {
      // XP: 50 for solving, bonus for solving on first try
      xpEarned = newAttempts === 1 ? 75 : 50;

      await db('user_daily_puzzles').where({ user_id: req.userId, puzzle_date: today }).update({ xp_earned: xpEarned });

      // Update streak + stats
      const stats = await db('user_puzzle_stats').where({ user_id: req.userId }).first();
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const wasYesterday = stats?.last_solved_date === yesterday;
      const newStreak = wasYesterday ? (stats?.current_streak ?? 0) + 1 : 1;
      const longestStreak = Math.max(stats?.longest_streak ?? 0, newStreak);
      const totalSolved = (stats?.total_solved ?? 0) + 1;

      if (!stats) {
        await db('user_puzzle_stats').insert({
          user_id: req.userId,
          current_streak: newStreak,
          longest_streak: longestStreak,
          total_solved: totalSolved,
          last_solved_date: today,
        });
      } else {
        await db('user_puzzle_stats').where({ user_id: req.userId }).update({
          current_streak: newStreak,
          longest_streak: longestStreak,
          total_solved: totalSolved,
          last_solved_date: today,
        });
      }

      // Bonus USDC for solving (small incentive)
      const bonusUsdc = newAttempts === 1 ? 0.05 : 0.02;
      await db.transaction(async (trx) => {
        await trx('users').where({ id: req.userId }).increment('usdc_balance', bonusUsdc);
        await trx('balance_ledger').insert({
          user_id: req.userId,
          amount: bonusUsdc,
          type: 'bonus',
          tx_hash: `puzzle_${today}`,
        });
      });

      const streakMsg = newStreak > 1 ? ` ${newStreak}-day streak!` : '';
      await createNotification(
        req.userId!,
        'streak_bonus',
        `Daily puzzle solved! +${xpEarned} XP · +$${bonusUsdc.toFixed(2)}${streakMsg}`,
        { streak: newStreak, xp: xpEarned }
      );

      res.json({ correct: true, done: true, xpEarned, bonusUsdc, streak: newStreak });
      return;
    }

    if (failed) {
      res.json({ correct: false, done: true, failed: true, solution: puzzle.solution });
      return;
    }

    res.json({ correct, done: false, attemptsLeft: maxAttempts - newAttempts });
  } catch (err) {
    console.error('Puzzle attempt error:', err);
    res.status(500).json({ error: 'Failed to process attempt' });
  }
});

// GET /api/puzzles/daily/solution — reveal solution (marks as failed if not solved)
router.get('/daily/solution', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const puzzle = getPuzzleOfDay();
  const today = todayUTC();

  try {
    const record = await db('user_daily_puzzles').where({ user_id: req.userId, puzzle_date: today }).first();
    if (!record?.solved) {
      if (!record) {
        await db('user_daily_puzzles').insert({
          user_id: req.userId,
          puzzle_date: today,
          puzzle_id: puzzle.id,
          attempts: record?.attempts ?? 0,
          solved: false,
          failed: true,
          xp_earned: 0,
        });
      } else {
        await db('user_daily_puzzles').where({ user_id: req.userId, puzzle_date: today }).update({ failed: true });
      }

      // Reset streak
      await db('user_puzzle_stats').where({ user_id: req.userId }).update({ current_streak: 0 });
    }
    res.json({ solution: puzzle.solution });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get solution' });
  }
});

export default router;
