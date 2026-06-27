import { Server, Socket } from 'socket.io';
import { redis } from '../db/redis';
import { db } from '../db/client';

export function setupSpectator(io: Server, socket: Socket) {
  socket.on('spectate', async ({ gameId }: { gameId: string }) => {
    const game = await db('games').where({ id: gameId, status: 'active' }).first();
    if (!game) {
      socket.emit('error', { message: 'Game not found or not active' });
      return;
    }

    socket.join(gameId);
    await redis.sadd(`game:${gameId}:spectators`, socket.id);

    const [fen, turn, clocksRaw] = await Promise.all([
      redis.get(`game:${gameId}:fen`),
      redis.get(`game:${gameId}:turn`),
      redis.get(`game:${gameId}:clocks`),
    ]);

    const spectatorCount = await redis.scard(`game:${gameId}:spectators`);

    socket.emit('spectate_joined', {
      gameId,
      fen,
      turn,
      clocks: clocksRaw ? JSON.parse(clocksRaw) : null,
    });

    io.to(gameId).emit('spectator_count', { count: spectatorCount });

    socket.on('disconnect', async () => {
      await redis.srem(`game:${gameId}:spectators`, socket.id);
      const newCount = await redis.scard(`game:${gameId}:spectators`);
      io.to(gameId).emit('spectator_count', { count: newCount });
    });
  });

  socket.on('leave_spectate', async ({ gameId }: { gameId: string }) => {
    socket.leave(gameId);
    await redis.srem(`game:${gameId}:spectators`, socket.id);
    const count = await redis.scard(`game:${gameId}:spectators`);
    io.to(gameId).emit('spectator_count', { count });
  });
}
