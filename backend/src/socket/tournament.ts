import { Server, Socket } from 'socket.io';
import { db } from '../db/client';
import { reserveBet } from '../services/balance';
import { redis } from '../db/redis';
import { registerGamePlayer } from './gameRoom';
import { userSocketMap } from './challenge';

export function setupTournament(io: Server, socket: Socket) {
  // Join tournament lobby room for real-time updates
  socket.on('join_tournament_lobby', ({ tournamentId }: { tournamentId: string }) => {
    socket.join(`tournament:${tournamentId}`);
  });

  socket.on('leave_tournament_lobby', ({ tournamentId }: { tournamentId: string }) => {
    socket.leave(`tournament:${tournamentId}`);
  });

  // Creator starts the tournament
  socket.on('start_tournament', async ({ tournamentId }: { tournamentId: string }) => {
    const userId = (socket as any).userId as string | undefined;
    if (!userId) return;

    try {
      const tournament = await db('tournaments')
        .where({ id: tournamentId, status: 'open', created_by: userId })
        .first();

      if (!tournament) {
        socket.emit('tournament_error', { reason: 'Not found or you are not the creator' });
        return;
      }

      const players = await db('tournament_players as tp')
        .join('users as u', 'tp.user_id', 'u.id')
        .where('tp.tournament_id', tournamentId)
        .select('tp.user_id', 'u.username', 'u.elo');

      if (players.length < 4) {
        socket.emit('tournament_error', { reason: 'Need at least 4 players to start' });
        return;
      }

      // Pad to next power of 2 with byes if needed (by seeding nulls)
      const targetSize = [4, 8, 16].find((n) => n >= players.length) ?? 16;
      const totalRounds = Math.log2(targetSize);

      // Seed by ELO descending
      const seeded = [...players].sort((a, b) => b.elo - a.elo);

      await db.transaction(async (trx) => {
        // Assign seeds
        for (let i = 0; i < seeded.length; i++) {
          await trx('tournament_players')
            .where({ tournament_id: tournamentId, user_id: seeded[i].user_id })
            .update({ seed: i + 1 });
        }
        await trx('tournaments').where({ id: tournamentId }).update({
          status: 'active',
          current_round: 1,
          total_rounds: totalRounds,
        });
      });

      // Pair round 1: seed 1 vs seed N, seed 2 vs seed N-1, etc.
      await pairRound(io, tournamentId, 1, seeded.map((p) => p.user_id), tournament.entry_fee);

      io.to(`tournament:${tournamentId}`).emit('tournament_started', { tournamentId, round: 1 });
    } catch (err) {
      console.error('start_tournament error:', err);
      socket.emit('tournament_error', { reason: 'Failed to start tournament' });
    }
  });
}

export async function pairRound(
  io: Server,
  tournamentId: string,
  round: number,
  playerIds: string[],
  entryFee: number
) {
  // Pair adjacent players (1v2, 3v4, etc.)
  const pairs: [string, string][] = [];
  for (let i = 0; i < playerIds.length; i += 2) {
    if (playerIds[i + 1]) {
      pairs.push([playerIds[i], playerIds[i + 1]]);
    }
  }

  for (const [p1Id, p2Id] of pairs) {
    const p1 = await db('users').where({ id: p1Id }).select('elo', 'username').first();
    const p2 = await db('users').where({ id: p2Id }).select('elo', 'username').first();

    // Create game in DB
    const [game] = await db('games').insert({
      player_white: p1Id,
      player_black: p2Id,
      bet_amount: entryFee,
      status: 'active',
      white_elo_before: p1.elo,
      black_elo_before: p2.elo,
    }).returning('*');

    // Set Redis game state
    const clocks = { white: 300000, black: 300000, lastMoveAt: Date.now() };
    await redis.set(`game:${game.id}:fen`, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    await redis.set(`game:${game.id}:turn`, 'white');
    await redis.set(`game:${game.id}:clocks`, JSON.stringify(clocks));

    // Create tournament_game record
    const [tGame] = await db('tournament_games').insert({
      tournament_id: tournamentId,
      game_id: game.id,
      round,
      player1: p1Id,
      player2: p2Id,
      status: 'active',
    }).returning('*');

    // Register in gamePlayerMap (so gameRoom.ts can handle moves)
    const p1SocketId = userSocketMap.get(p1Id);
    const p2SocketId = userSocketMap.get(p2Id);

    if (p1SocketId && p2SocketId) {
      registerGamePlayer(
        game.id,
        { userId: p1Id, color: 'white', socketId: p1SocketId },
        { userId: p2Id, color: 'black', socketId: p2SocketId }
      );
    }

    // Emit match_found to both players
    const matchPayload = (color: 'white' | 'black', opponent: any) => ({
      gameId: game.id,
      color,
      tournamentId,
      round,
      clocks,
      betAmount: entryFee,
      opponent: { username: opponent.username, elo: opponent.elo },
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    });

    if (p1SocketId) io.to(p1SocketId).emit('match_found', matchPayload('white', p2));
    if (p2SocketId) io.to(p2SocketId).emit('match_found', matchPayload('black', p1));

    // Broadcast bracket update to lobby
    io.to(`tournament:${tournamentId}`).emit('tournament_bracket_update', {
      tournamentId, round,
      match: {
        id: tGame.id,
        gameId: game.id,
        player1: p1Id, player1_name: p1.username,
        player2: p2Id, player2_name: p2.username,
        status: 'active',
      },
    });
  }
}

// Called by gameRoom.ts when a tournament game ends
export async function onTournamentGameOver(
  io: Server,
  tournamentId: string,
  gameId: string,
  winnerId: string
) {
  try {
    // Update tournament_game record
    await db('tournament_games')
      .where({ tournament_id: tournamentId, game_id: gameId })
      .update({ winner: winnerId, status: 'completed' });

    // Mark loser eliminated
    const tGame = await db('tournament_games')
      .where({ tournament_id: tournamentId, game_id: gameId })
      .first();

    const loserId = tGame.player1 === winnerId ? tGame.player2 : tGame.player1;
    await db('tournament_players')
      .where({ tournament_id: tournamentId, user_id: loserId })
      .update({ status: 'eliminated' });

    io.to(`tournament:${tournamentId}`).emit('tournament_bracket_update', {
      tournamentId,
      matchUpdate: { gameId, winner: winnerId, status: 'completed' },
    });

    // Check if all games in this round are done
    const tournament = await db('tournaments').where({ id: tournamentId }).first();
    const roundGames = await db('tournament_games')
      .where({ tournament_id: tournamentId, round: tournament.current_round });

    const allDone = roundGames.every((g: any) => g.status === 'completed');
    if (!allDone) return;

    // Gather winners for next round
    const winners = roundGames.map((g: any) => g.winner);

    if (winners.length === 1) {
      // Tournament complete
      await finalizeTournament(io, tournamentId, winners[0]);
    } else {
      // Start next round
      const nextRound = tournament.current_round + 1;
      await db('tournaments').where({ id: tournamentId }).update({ current_round: nextRound });
      await pairRound(io, tournamentId, nextRound, winners, parseFloat(tournament.entry_fee));
      io.to(`tournament:${tournamentId}`).emit('tournament_round_start', {
        tournamentId, round: nextRound,
      });
    }
  } catch (err) {
    console.error('onTournamentGameOver error:', err);
  }
}

async function finalizeTournament(io: Server, tournamentId: string, winnerId: string) {
  const tournament = await db('tournaments').where({ id: tournamentId }).first();
  const payout = parseFloat(tournament.prize_pool) * 0.975;

  await db.transaction(async (trx) => {
    await trx('users').where({ id: winnerId })
      .increment('usdc_balance', payout);
    await trx('balance_ledger').insert({
      user_id: winnerId,
      amount: payout,
      type: 'win',
      tx_hash: `tournament_win_${tournamentId}`,
    });
    await trx('tournament_players')
      .where({ tournament_id: tournamentId, user_id: winnerId })
      .update({ status: 'winner' });
    await trx('tournaments').where({ id: tournamentId }).update({
      status: 'completed',
      winner_id: winnerId,
      completed_at: new Date(),
    });
  });

  const winner = await db('users').where({ id: winnerId }).select('username').first();

  io.to(`tournament:${tournamentId}`).emit('tournament_complete', {
    tournamentId,
    winner: { userId: winnerId, username: winner.username },
    payout,
  });
}
