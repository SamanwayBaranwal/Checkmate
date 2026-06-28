import { Server, Socket } from 'socket.io';
import { redis } from '../db/redis';
import { db } from '../db/client';
import { applyMove } from '../services/chess';
import { settleGame, refundBet, reserveBet } from '../services/balance';
import { Chess } from 'chess.js';
import { onTournamentGameOver } from './tournament';

interface ClockState {
  white: number;
  black: number;
  lastMoveAt: number;
}

interface GamePlayer {
  userId: string;
  color: 'white' | 'black';
  socketId: string;
}

// gameId → players map for quick lookup
const gamePlayerMap = new Map<string, { white: GamePlayer; black: GamePlayer }>();
const pgnMap = new Map<string, string>(); // gameId → ongoing PGN

export function registerGamePlayer(gameId: string, white: GamePlayer, black: GamePlayer) {
  gamePlayerMap.set(gameId, { white, black });
  pgnMap.set(gameId, '');
}

function tickClock(clocks: ClockState, turn: 'white' | 'black'): ClockState {
  const now = Date.now();
  const elapsed = now - clocks.lastMoveAt;
  return {
    ...clocks,
    [turn]: Math.max(0, clocks[turn] - elapsed),
    lastMoveAt: now,
  };
}

export function setupGameRoom(io: Server, socket: Socket) {
  // Client sends this when the game page loads — catches up missed match_found
  socket.on('rejoin_game', async ({ gameId }: { gameId: string }) => {
    const userData = (socket as any).userId
      ? { userId: (socket as any).userId }
      : null;
    if (!userData) return;

    const game = await db('games').where({ id: gameId, status: 'active' }).first();
    if (!game) { socket.emit('error', { message: 'Game not found' }); return; }

    const isWhite = game.player_white === userData.userId;
    const isBlack = game.player_black === userData.userId;
    if (!isWhite && !isBlack) return;

    const color = isWhite ? 'white' : 'black';
    socket.join(gameId);

    // Re-register in gamePlayerMap
    const players = gamePlayerMap.get(gameId);
    if (players) {
      players[color].socketId = socket.id;
    } else {
      // Rebuild the map entry
      const whitePlayer: GamePlayer = { userId: game.player_white, color: 'white', socketId: isWhite ? socket.id : '' };
      const blackPlayer: GamePlayer = { userId: game.player_black, color: 'black', socketId: isBlack ? socket.id : '' };
      gamePlayerMap.set(gameId, { white: whitePlayer, black: blackPlayer });
      pgnMap.set(gameId, '');
    }

    const [fen, turn, clocksRaw] = await Promise.all([
      redis.get(`game:${gameId}:fen`),
      redis.get(`game:${gameId}:turn`),
      redis.get(`game:${gameId}:clocks`),
    ]);

    const opponent = await db('users')
      .where({ id: isWhite ? game.player_black : game.player_white })
      .select('wallet', 'username', 'elo')
      .first();

    socket.emit('game_state', {
      gameId,
      color,
      fen: fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      turn: turn || 'white',
      clocks: clocksRaw ? JSON.parse(clocksRaw) : { white: 300000, black: 300000 },
      betAmount: parseFloat(game.bet_amount),
      opponent: {
        username: opponent?.username || opponent?.wallet?.slice(0, 8) || 'Opponent',
        elo: opponent?.elo || 1200,
      },
    });
  });

  socket.on('move', async ({ gameId, from, to, promotion }: {
    gameId: string;
    from: string;
    to: string;
    promotion?: string;
  }) => {
    const game = await db('games').where({ id: gameId, status: 'active' }).first();
    if (!game) { socket.emit('move_error', { reason: 'Game not found' }); return; }

    const [fen, turnRaw, clocksRaw] = await Promise.all([
      redis.get(`game:${gameId}:fen`),
      redis.get(`game:${gameId}:turn`),
      redis.get(`game:${gameId}:clocks`),
    ]);

    if (!fen || !turnRaw || !clocksRaw) { socket.emit('move_error', { reason: 'Game state missing' }); return; }

    const turn = turnRaw as 'white' | 'black';
    const players = gamePlayerMap.get(gameId);

    // Verify it's this player's turn
    const movingPlayer = players?.[turn];
    if (!movingPlayer || movingPlayer.socketId !== socket.id) {
      socket.emit('move_error', { reason: 'Not your turn' });
      return;
    }

    // Check timeout before applying move
    const clocks: ClockState = JSON.parse(clocksRaw);
    const updatedClocks = tickClock(clocks, turn);

    if (updatedClocks[turn] <= 0) {
      await handleGameEnd(io, gameId, game, turn === 'white' ? 'black' : 'white', 'timeout');
      return;
    }

    const result = applyMove(fen, from, to, promotion);
    if (!result.valid) {
      socket.emit('move_error', { reason: result.error || 'Illegal move' });
      return;
    }

    const nextTurn: 'white' | 'black' = turn === 'white' ? 'black' : 'white';

    // Update PGN
    const chess = new Chess(fen);
    chess.move({ from, to, promotion: promotion as any });
    const currentPgn = pgnMap.get(gameId) || '';
    pgnMap.set(gameId, chess.pgn());

    await Promise.all([
      redis.set(`game:${gameId}:fen`, result.fen!),
      redis.set(`game:${gameId}:turn`, result.isGameOver ? 'over' : nextTurn),
      redis.set(`game:${gameId}:clocks`, JSON.stringify(updatedClocks)),
    ]);

    io.to(gameId).emit('move_made', {
      fen: result.fen,
      from,
      to,
      san: result.san,
      turn: nextTurn,
      clocks: { white: updatedClocks.white, black: updatedClocks.black },
    });

    if (result.isGameOver) {
      const winnerColor = result.winner === 'draw' ? null : result.winner!;
      await handleGameEnd(io, gameId, game, winnerColor as 'white' | 'black' | null, result.result!);
    }
  });

  socket.on('resign', async ({ gameId }: { gameId: string }) => {
    const game = await db('games').where({ id: gameId, status: 'active' }).first();
    if (!game) return;

    const players = gamePlayerMap.get(gameId);
    const resigningColor = players?.white.socketId === socket.id ? 'white' : 'black';
    const winnerColor: 'white' | 'black' = resigningColor === 'white' ? 'black' : 'white';

    await handleGameEnd(io, gameId, game, winnerColor, 'resignation');
  });

  socket.on('offer_draw', ({ gameId }: { gameId: string }) => {
    socket.to(gameId).emit('draw_offered');
  });

  socket.on('accept_draw', async ({ gameId }: { gameId: string }) => {
    const game = await db('games').where({ id: gameId, status: 'active' }).first();
    if (!game) return;
    await handleGameEnd(io, gameId, game, null, 'draw');
  });

  socket.on('chat_message', async ({ gameId, text }: { gameId: string; text: string }) => {
    const userId = (socket as any).userId as string | undefined;
    if (!userId || !text || !text.trim()) return;
    const cleaned = text.trim().slice(0, 200);
    const user = await db('users').where({ id: userId }).select('username', 'wallet').first();
    const sender = user?.username || (user?.wallet ? `${user.wallet.slice(0, 6)}...` : 'Player');
    io.to(gameId).emit('chat_message', { userId, sender, text: cleaned, timestamp: Date.now() });
  });

  socket.on('offer_rematch', async ({ gameId }: { gameId: string }) => {
    const userId = (socket as any).userId as string | undefined;
    if (!userId) return;
    // TTL 5 minutes
    await redis.set(`rematch:${gameId}:offeredBy`, `${userId}:${socket.id}`, 'EX', 300);
    // Only notify the opponent (socket.to excludes the sender)
    socket.to(gameId).emit('rematch_offered');
  });

  socket.on('accept_rematch', async ({ gameId }: { gameId: string }) => {
    const userId = (socket as any).userId as string | undefined;
    if (!userId) return;

    const offeredByRaw = await redis.get(`rematch:${gameId}:offeredBy`);
    if (!offeredByRaw) { socket.emit('rematch_error', { reason: 'Rematch offer expired' }); return; }

    const [offeredByUserId, offeredBySocketId] = offeredByRaw.split(':');
    if (offeredByUserId === userId) { socket.emit('rematch_error', { reason: 'Cannot accept your own offer' }); return; }

    const game = await db('games').where({ id: gameId }).first();
    if (!game) return;

    const betAmount = parseFloat(game.bet_amount);

    // Swap colors for rematch
    const offererWasWhite = game.player_white === offeredByUserId;
    const newWhiteId = offererWasWhite ? userId : offeredByUserId;
    const newBlackId = offererWasWhite ? offeredByUserId : userId;

    const [whiteOk, blackOk] = await Promise.all([
      reserveBet(newWhiteId, betAmount),
      reserveBet(newBlackId, betAmount),
    ]);

    if (!whiteOk || !blackOk) {
      // Refund whichever succeeded
      if (whiteOk) await db('users').where({ id: newWhiteId }).increment('usdc_balance', betAmount);
      if (blackOk) await db('users').where({ id: newBlackId }).increment('usdc_balance', betAmount);
      socket.emit('rematch_error', { reason: 'Insufficient balance for rematch' });
      return;
    }

    const [whiteUser, blackUser] = await Promise.all([
      db('users').where({ id: newWhiteId }).select('username', 'wallet', 'elo').first(),
      db('users').where({ id: newBlackId }).select('username', 'wallet', 'elo').first(),
    ]);

    const clocks = { white: 300000, black: 300000, lastMoveAt: Date.now() };
    const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    const [newGameRow] = await db('games').insert({
      player_white: newWhiteId,
      player_black: newBlackId,
      bet_amount: betAmount,
      status: 'active',
      white_elo_before: whiteUser?.elo || 1200,
      black_elo_before: blackUser?.elo || 1200,
    }).returning('id');

    const newGameId = newGameRow.id ?? newGameRow;

    await Promise.all([
      redis.set(`game:${newGameId}:fen`, initialFen),
      redis.set(`game:${newGameId}:turn`, 'white'),
      redis.set(`game:${newGameId}:clocks`, JSON.stringify(clocks)),
      redis.del(`rematch:${gameId}:offeredBy`),
    ]);

    const whiteSocketId = offererWasWhite ? socket.id : offeredBySocketId;
    const blackSocketId = offererWasWhite ? offeredBySocketId : socket.id;

    registerGamePlayer(
      newGameId,
      { userId: newWhiteId, color: 'white', socketId: whiteSocketId },
      { userId: newBlackId, color: 'black', socketId: blackSocketId }
    );

    const whiteSocket = io.sockets.sockets.get(whiteSocketId);
    const blackSocket = io.sockets.sockets.get(blackSocketId);

    whiteSocket?.join(newGameId);
    blackSocket?.join(newGameId);

    const baseData = { gameId: newGameId, fen: initialFen, clocks: { white: 300000, black: 300000 }, betAmount };
    const fmt = (u: any) => ({ username: u?.username || u?.wallet?.slice(0, 8) || 'Opponent', elo: u?.elo || 1200 });

    whiteSocket?.emit('rematch_ready', { ...baseData, color: 'white', opponent: fmt(blackUser) });
    blackSocket?.emit('rematch_ready', { ...baseData, color: 'black', opponent: fmt(whiteUser) });
  });
}

async function handleGameEnd(
  io: Server,
  gameId: string,
  game: any,
  winnerColor: 'white' | 'black' | null,
  result: string
) {
  const players = gamePlayerMap.get(gameId);
  if (!players) return;

  // Clean up Redis
  await Promise.all([
    redis.del(`game:${gameId}:fen`),
    redis.del(`game:${gameId}:turn`),
    redis.del(`game:${gameId}:clocks`),
    redis.del(`game:${gameId}:spectators`),
  ]);

  const pgn = pgnMap.get(gameId) || '';
  pgnMap.delete(gameId);
  gamePlayerMap.delete(gameId);

  if (result === 'draw') {
    // Refund both players for draws
    await Promise.all([
      refundBet(players.white.userId, parseFloat(game.bet_amount)),
      refundBet(players.black.userId, parseFloat(game.bet_amount)),
    ]);
    await db('games').where({ id: gameId }).update({ status: 'completed', result: 'draw', pgn, completed_at: new Date() });

    io.to(gameId).emit('game_over', { result: 'draw', winner: null, eloChange: 0 });
    return;
  }

  const winnerId = winnerColor === 'white' ? players.white.userId : players.black.userId;
  const loserId = winnerColor === 'white' ? players.black.userId : players.white.userId;

  const { eloChange, payout } = await settleGame(
    gameId,
    winnerId,
    loserId,
    winnerColor!,
    parseFloat(game.bet_amount),
    result,
    pgn,
    players.white.userId,
    players.black.userId,
    game.white_elo_before,
    game.black_elo_before
  );

  const [winnerUser, loserUser] = await Promise.all([
    db('users').where({ id: winnerId }).select('usdc_balance', 'elo').first(),
    db('users').where({ id: loserId }).select('usdc_balance', 'elo').first(),
  ]);

  io.to(gameId).emit('game_over', {
    result,
    winner: winnerColor,
    eloChange,
    payout,
    balances: {
      [winnerId]: parseFloat(winnerUser.usdc_balance),
      [loserId]: parseFloat(loserUser.usdc_balance),
    },
    elos: {
      [winnerId]: winnerUser.elo,
      [loserId]: loserUser.elo,
    },
  });

  // If this game belongs to a tournament, advance the bracket
  const tGame = await db('tournament_games').where({ game_id: gameId }).first();
  if (tGame) {
    await onTournamentGameOver(io, tGame.tournament_id, gameId, winnerId);
  }
}

// Periodic timeout checker (runs every 5s)
export function startTimeoutChecker(io: Server) {
  setInterval(async () => {
    const activeGames = await db('games').where({ status: 'active' }).select('id', 'bet_amount', 'player_white', 'player_black', 'white_elo_before', 'black_elo_before');

    for (const game of activeGames) {
      const [turnRaw, clocksRaw] = await Promise.all([
        redis.get(`game:${game.id}:turn`),
        redis.get(`game:${game.id}:clocks`),
      ]);

      if (!turnRaw || !clocksRaw || turnRaw === 'over') continue;

      const turn = turnRaw as 'white' | 'black';
      const clocks: ClockState = JSON.parse(clocksRaw);
      const now = Date.now();
      const elapsed = now - clocks.lastMoveAt;
      const remaining = clocks[turn] - elapsed;

      if (remaining <= 0) {
        const winnerColor: 'white' | 'black' = turn === 'white' ? 'black' : 'white';
        await handleGameEnd(io, game.id, game, winnerColor, 'timeout');
      }
    }
  }, 5000);
}
