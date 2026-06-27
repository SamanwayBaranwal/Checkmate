import { Server, Socket } from 'socket.io';
import { redis } from '../db/redis';
import { db } from '../db/client';
import { reserveBet } from '../services/balance';
import { getInitialFen } from '../services/chess';
import { v4 as uuidv4 } from 'uuid';

const BET_TIERS = [1, 5, 10, 25] as const;
type BetTier = (typeof BET_TIERS)[number];

// socketId → userId mapping managed by the socket layer
const socketToUser = new Map<string, { userId: string; wallet: string; elo: number }>();

export function registerUser(socketId: string, data: { userId: string; wallet: string; elo: number }) {
  socketToUser.set(socketId, data);
}

export function unregisterUser(socketId: string) {
  socketToUser.delete(socketId);
}

export function setupMatchmaking(io: Server, socket: Socket) {
  socket.on('join_queue', async ({ tier }: { tier: BetTier }) => {
    if (!BET_TIERS.includes(tier)) {
      socket.emit('error', { message: 'Invalid bet tier' });
      return;
    }

    const userData = socketToUser.get(socket.id);
    if (!userData) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const { userId } = userData;
    const queueKey = `queue:${tier}`;

    // Check existing queue for a match (FIFO by timestamp)
    const waiting = await redis.zrangebyscore(queueKey, '-inf', '+inf', 'LIMIT', 0, 10);
    const opponent = waiting.find((id) => {
      const data = socketToUser.get(id);
      return data && data.userId !== userId && id !== socket.id;
    });

    if (opponent) {
      await redis.zrem(queueKey, opponent);
      const opponentData = socketToUser.get(opponent)!;

      // Reserve bets from both players
      const [whiteReserved, blackReserved] = await Promise.all([
        reserveBet(userId, tier),
        reserveBet(opponentData.userId, tier),
      ]);

      if (!whiteReserved || !blackReserved) {
        // Refund whoever succeeded and put both back in queue
        if (whiteReserved) await db('users').where({ id: userId }).increment('usdc_balance', tier);
        if (blackReserved) await db('users').where({ id: opponentData.userId }).increment('usdc_balance', tier);
        socket.emit('error', { message: 'Insufficient balance' });
        return;
      }

      // Randomly assign colors
      const [whiteSocketId, blackSocketId] =
        Math.random() < 0.5 ? [socket.id, opponent] : [opponent, socket.id];
      const whiteUser = socketToUser.get(whiteSocketId)!;
      const blackUser = socketToUser.get(blackSocketId)!;

      const gameId = uuidv4();
      const initialFen = getInitialFen();

      // Create game in DB
      await db('games').insert({
        id: gameId,
        player_white: whiteUser.userId,
        player_black: blackUser.userId,
        bet_amount: tier,
        status: 'active',
        white_elo_before: whiteUser.elo,
        black_elo_before: blackUser.elo,
      });

      // Initialize Redis game state
      await redis.set(`game:${gameId}:fen`, initialFen);
      await redis.set(`game:${gameId}:turn`, 'white');
      await redis.set(
        `game:${gameId}:clocks`,
        JSON.stringify({ white: 5 * 60 * 1000, black: 5 * 60 * 1000, lastMoveAt: Date.now() })
      );

      // Join both sockets to the game room
      const whiteSocket = io.sockets.sockets.get(whiteSocketId);
      const blackSocket = io.sockets.sockets.get(blackSocketId);
      whiteSocket?.join(gameId);
      blackSocket?.join(gameId);

      const whitePayload = {
        gameId,
        color: 'white',
        opponent: { username: blackUser.wallet, elo: blackUser.elo },
        betAmount: tier,
        fen: initialFen,
        clocks: { white: 300000, black: 300000 },
      };
      const blackPayload = {
        ...whitePayload,
        color: 'black',
        opponent: { username: whiteUser.wallet, elo: whiteUser.elo },
      };

      io.to(whiteSocketId).emit('match_found', whitePayload);
      io.to(blackSocketId).emit('match_found', blackPayload);
    } else {
      // No match — join queue
      await redis.zadd(queueKey, Date.now(), socket.id);
      socket.emit('queue_joined', { tier, position: 1 });
    }
  });

  socket.on('leave_queue', async () => {
    for (const tier of BET_TIERS) {
      await redis.zrem(`queue:${tier}`, socket.id);
    }
    socket.emit('queue_left');
  });
}
