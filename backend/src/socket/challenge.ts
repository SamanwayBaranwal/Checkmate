import { Server, Socket } from 'socket.io';
import { redis } from '../db/redis';
import { db } from '../db/client';
import { reserveBet } from '../services/balance';
import { getInitialFen } from '../services/chess';
import { registerGamePlayer } from './gameRoom';
import { createNotification } from '../services/notifications';
import { v4 as uuidv4 } from 'uuid';
import { stakeError, sameOwnerLikely } from '../services/fairplay/trust';

// A user can have several tabs/devices open: every authenticated socket joins the room `user:<id>` (index.ts).
// Pick one live socket for game registration, preferring the one that started the action.
export function pickUserSocket(io: Server, userId: string, preferred?: string): string | undefined {
  if (preferred && io.sockets.sockets.get(preferred)) return preferred;
  const room = io.sockets.adapter.rooms.get(`user:${userId}`);
  return room ? (room.values().next().value as string | undefined) : undefined;
}

export function setupChallenge(io: Server, socket: Socket) {
  socket.on('challenge_user', async ({ targetId, betAmount }: { targetId: string; betAmount: number }) => {
    const challengerId = (socket as any).userId as string | undefined;
    if (!challengerId) return;
    if (challengerId === targetId) {
      socket.emit('challenge_error', { reason: 'Cannot challenge yourself' });
      return;
    }

    const VALID_BETS = [1, 5, 10, 25];
    if (!VALID_BETS.includes(betAmount)) {
      socket.emit('challenge_error', { reason: 'Invalid bet amount' });
      return;
    }

    const limitErr = await stakeError(challengerId, betAmount);
    if (limitErr) { socket.emit('challenge_error', { reason: limitErr }); return; }
    if (await sameOwnerLikely(challengerId, targetId)) {
      socket.emit('challenge_error', { reason: 'You cannot play paid games against an account on the same device or network.' });
      return;
    }

    if (!pickUserSocket(io, targetId)) {
      socket.emit('challenge_error', { reason: 'Player is not online' });
      return;
    }

    const challenger = await db('users')
      .where({ id: challengerId })
      .select('username', 'wallet', 'elo', 'usdc_balance')
      .first();
    if (!challenger || parseFloat(challenger.usdc_balance) < betAmount) {
      socket.emit('challenge_error', { reason: 'Insufficient balance' });
      return;
    }

    const challengeId = uuidv4();
    await redis.set(
      `challenge:${challengeId}`,
      JSON.stringify({ challengerId, targetId, betAmount, challengerSocketId: socket.id }),
      'EX',
      60
    );

    const senderName = challenger.username || `${challenger.wallet.slice(0, 6)}...`;
    io.to(`user:${targetId}`).emit('challenge_received', { // every open tab sees it
      challengeId,
      from: { userId: challengerId, username: senderName, elo: challenger.elo },
      betAmount,
    });

    // Persist notification so it shows in the bell icon
    createNotification(
      targetId,
      'challenge_received',
      `${senderName} challenged you to a $${betAmount} game`,
      { challengeId, fromId: challengerId, betAmount }
    );

    socket.emit('challenge_sent', { challengeId, targetId });
  });

  socket.on('accept_challenge', async ({ challengeId }: { challengeId: string }) => {
    const accepterId = (socket as any).userId as string | undefined;
    if (!accepterId) return;

    const raw = await redis.get(`challenge:${challengeId}`);
    if (!raw) { socket.emit('challenge_error', { reason: 'Challenge expired' }); return; }

    const { challengerId, targetId, betAmount, challengerSocketId } = JSON.parse(raw);
    if (accepterId !== targetId) { socket.emit('challenge_error', { reason: 'Not your challenge' }); return; }

    // Consume the challenge atomically: accepting from two tabs used to start two paid games
    if ((await redis.del(`challenge:${challengeId}`)) !== 1) {
      socket.emit('challenge_error', { reason: 'Challenge expired' });
      return;
    }

    // The challenger may have closed the tab they challenged from: use another of their tabs, or stop here
    // (before any money moves) instead of starting a paid game they can't see.
    const challengerSock = pickUserSocket(io, challengerId, challengerSocketId);
    if (!challengerSock) { socket.emit('challenge_error', { reason: 'Your opponent is no longer online' }); return; }

    const limitErr = (await stakeError(accepterId, betAmount)) || (await stakeError(challengerId, betAmount));
    if (limitErr) { socket.emit('challenge_error', { reason: limitErr }); return; }

    const [whiteOk, blackOk] = await Promise.all([
      reserveBet(challengerId, betAmount),
      reserveBet(accepterId, betAmount),
    ]);

    if (!whiteOk || !blackOk) {
      if (whiteOk) await db('users').where({ id: challengerId }).increment('usdc_balance', betAmount);
      if (blackOk) await db('users').where({ id: accepterId }).increment('usdc_balance', betAmount);
      socket.emit('challenge_error', { reason: 'Insufficient balance' });
      return;
    }

    const [challenger, accepter] = await Promise.all([
      db('users').where({ id: challengerId }).select('username', 'wallet', 'elo').first(),
      db('users').where({ id: accepterId }).select('username', 'wallet', 'elo').first(),
    ]);

    const [whiteId, blackId] =
      Math.random() < 0.5 ? [challengerId, accepterId] : [accepterId, challengerId];
    const whiteUser = whiteId === challengerId ? challenger : accepter;
    const blackUser = blackId === challengerId ? challenger : accepter;

    const gameId = uuidv4();
    const initialFen = getInitialFen();
    const clocks = { white: 300000, black: 300000, lastMoveAt: Date.now() };

    await db('games').insert({
      id: gameId,
      player_white: whiteId,
      player_black: blackId,
      bet_amount: betAmount,
      status: 'active',
      white_elo_before: whiteUser?.elo || 1200,
      black_elo_before: blackUser?.elo || 1200,
    });

    await Promise.all([
      redis.set(`game:${gameId}:fen`, initialFen),
      redis.set(`game:${gameId}:turn`, 'white'),
      redis.set(`game:${gameId}:clocks`, JSON.stringify(clocks)),
    ]);

    const whiteSocketId = whiteId === challengerId ? challengerSock : socket.id;
    const blackSocketId = blackId === challengerId ? challengerSock : socket.id;

    registerGamePlayer(
      gameId,
      { userId: whiteId, color: 'white', socketId: whiteSocketId },
      { userId: blackId, color: 'black', socketId: blackSocketId }
    );

    const whiteSocket = io.sockets.sockets.get(whiteSocketId);
    const blackSocket = io.sockets.sockets.get(blackSocketId);
    whiteSocket?.join(gameId);
    blackSocket?.join(gameId);

    const fmt = (u: any) => ({ username: u?.username || u?.wallet?.slice(0, 8) || 'Opponent', elo: u?.elo || 1200 });
    const base = { gameId, fen: initialFen, clocks: { white: 300000, black: 300000 }, betAmount };

    whiteSocket?.emit('match_found', { ...base, color: 'white', opponent: fmt(blackUser) });
    blackSocket?.emit('match_found', { ...base, color: 'black', opponent: fmt(whiteUser) });
  });

  socket.on('decline_challenge', async ({ challengeId }: { challengeId: string }) => {
    const raw = await redis.get(`challenge:${challengeId}`);
    if (!raw) return;
    const { challengerId, targetId } = JSON.parse(raw);
    if ((socket as any).userId !== targetId) return; // only the challenged player can decline
    await redis.del(`challenge:${challengeId}`);
    io.to(`user:${challengerId}`).emit('challenge_declined', { challengeId });
  });
}
