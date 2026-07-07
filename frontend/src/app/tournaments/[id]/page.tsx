'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import Link from 'next/link';

function shortName(p: any) {
  return p?.username || p?.player1_name || '???';
}

function BracketMatch({ match, round }: { match: any; round: number }) {
  const isActive = match.status === 'active';
  const isDone = match.status === 'completed';
  return (
    <div className={`rounded-xl border-2 p-3 min-w-[160px] transition-all ${
      isActive ? 'border-[#f0b232]/60 bg-[#f0b232]/5' :
      isDone   ? 'border-white/10 bg-white/5' :
                 'border-white/10'
    }`}>
      <div className="text-xs text-white/30 mb-2">Round {round}</div>
      {[
        { id: match.player1, name: match.player1_name, elo: match.player1_elo },
        { id: match.player2, name: match.player2_name, elo: match.player2_elo },
      ].map((p) => {
        const isWinner = match.winner === p.id;
        const isLoser = isDone && match.winner && !isWinner;
        return (
          <div key={p.id}
            className={`flex items-center justify-between px-2 py-1 rounded text-sm mb-1 ${
              isWinner ? 'bg-[#81b64c]/20 text-[#81b64c] font-bold' :
              isLoser  ? 'text-white/30 line-through' :
                         'text-white/80'
            }`}>
            <span>{p.name || '???'}</span>
            {isWinner && <span className="text-xs ml-2">👑</span>}
          </div>
        );
      })}
      {isActive && match.game_id && (
        <Link href={`/game/${match.game_id}`} className="text-xs text-[#f0b232] hover:underline mt-1 block text-center">
          ▶ Watch live
        </Link>
      )}
    </div>
  );
}

export default function TournamentPage() {
  const { id } = useParams<{ id: string }>();
  const { authenticated } = usePrivy();
  const router = useRouter();

  const [tournament, setTournament] = useState<any>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.tournaments.get(id)
      .then(setTournament)
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    load();
    setLoading(false);
  }, [load]);

  useEffect(() => {
    if (authenticated) {
      api.users.me().then((u) => setMyId(u.id)).catch(() => {});
    }
  }, [authenticated]);

  // Socket: live updates
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('checkmate_token') ?? undefined : undefined;
    const socket = getSocket(token);
    socket.emit('join_tournament_lobby', { tournamentId: id });

    const onUpdate = () => load();
    const onBracket = () => load();
    const onStarted = () => load();
    const onRoundStart = () => load();
    const onComplete = (data: any) => {
      load();
      if (data.winner?.userId === myId) {
        alert(`🏆 You won the tournament! +$${data.payout.toFixed(2)} credited.`);
      }
    };
    const onMatchFound = (data: any) => {
      if (data.tournamentId === id) {
        router.push(`/game/${data.gameId}`);
      }
    };

    socket.on('tournament_bracket_update', onBracket);
    socket.on('tournament_started', onStarted);
    socket.on('tournament_round_start', onRoundStart);
    socket.on('tournament_complete', onComplete);
    socket.on('match_found', onMatchFound);

    return () => {
      socket.emit('leave_tournament_lobby', { tournamentId: id });
      socket.off('tournament_bracket_update', onBracket);
      socket.off('tournament_started', onStarted);
      socket.off('tournament_round_start', onRoundStart);
      socket.off('tournament_complete', onComplete);
      socket.off('match_found', onMatchFound);
    };
  }, [id, myId, load, router]);

  const handleJoin = async () => {
    setJoining(true);
    setError('');
    try {
      await api.tournaments.join(id);
      load();
    } catch (err: any) {
      let msg = 'Failed to join';
      try { const p = JSON.parse(err?.message || ''); if (p.error) msg = p.error; } catch {}
      setError(msg);
    } finally {
      setJoining(false);
    }
  };

  const handleStart = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('checkmate_token') ?? undefined : undefined;
    const socket = getSocket(token);
    setStarting(true);
    socket.emit('start_tournament', { tournamentId: id });
    socket.once('tournament_error', ({ reason }: { reason: string }) => {
      setError(reason);
      setStarting(false);
    });
    socket.once('tournament_started', () => setStarting(false));
  };

  if (loading || !tournament) {
    return <div className="text-center py-20 text-white/40">Loading...</div>;
  }

  const isOpen = tournament.status === 'open';
  const isActive = tournament.status === 'active';
  const isComplete = tournament.status === 'completed';
  const isCreator = myId === tournament.created_by;
  const hasJoined = tournament.players?.some((p: any) => p.user_id === myId);
  const isFull = tournament.players?.length >= tournament.max_players;

  // Group games by round
  const roundsMap: Record<number, any[]> = {};
  (tournament.games || []).forEach((g: any) => {
    if (!roundsMap[g.round]) roundsMap[g.round] = [];
    roundsMap[g.round].push(g);
  });
  const rounds = Object.keys(roundsMap).map(Number).sort((a, b) => a - b);

  const winnerPlayer = isComplete && tournament.winner_id
    ? tournament.players?.find((p: any) => p.user_id === tournament.winner_id)
    : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            {tournament.is_seasonal && (
              <span className="text-xs font-bold uppercase tracking-widest text-[#f0b232] bg-[#f0b232]/10 border border-[#f0b232]/30 px-2 py-0.5 rounded-full">
                🏆 {tournament.season_name}
              </span>
            )}
            <h1 className="text-3xl font-bold">{tournament.name}</h1>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
              isOpen     ? 'bg-[#81b64c]/20 text-[#81b64c] border-[#81b64c]/30' :
              isActive   ? 'bg-[#f0b232]/20 text-[#f0b232] border-[#f0b232]/30' :
                           'bg-white/10 text-white/40 border-white/10'
            }`}>
              {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
            </span>
          </div>
          <p className="text-white/50 text-sm">Created by {tournament.creator_name || 'Unknown'}</p>
        </div>

        <div className="flex gap-3">
          {isOpen && !hasJoined && authenticated && !isFull && (
            <button onClick={handleJoin} disabled={joining} className="btn-primary disabled:opacity-50">
              {joining ? 'Joining...' : `Join — $${tournament.entry_fee}`}
            </button>
          )}
          {isOpen && isCreator && (
            <button onClick={handleStart} disabled={starting || tournament.players?.length < 4}
              className="btn-secondary disabled:opacity-40"
              title={tournament.players?.length < 4 ? 'Need at least 4 players' : ''}>
              {starting ? 'Starting...' : '▶ Start Tournament'}
            </button>
          )}
          {!authenticated && isOpen && (
            <p className="text-sm text-white/40">Login to join</p>
          )}
        </div>
      </div>

      {error && <div className="card border border-red-500/30 text-red-400 text-sm">{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Entry Fee', value: `$${tournament.entry_fee}`, color: 'text-[#f0b232]' },
          { label: 'Prize Pool', value: `$${parseFloat(tournament.prize_pool).toFixed(2)}`, color: 'text-[#81b64c]' },
          { label: 'Players', value: `${tournament.players?.length ?? 0}/${tournament.max_players}`, color: 'text-white' },
          { label: 'Rounds', value: tournament.total_rounds, color: 'text-white' },
        ].map((s) => (
          <div key={s.label} className="card text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-white/50 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Winner banner */}
      {isComplete && winnerPlayer && (
        <div className="card border border-[#f0b232]/40 text-center py-6">
          <div className="text-5xl mb-3">🏆</div>
          <p className="text-2xl font-bold text-[#f0b232]">{winnerPlayer.username} wins!</p>
          <p className="text-white/50 mt-1">Prize: ${(parseFloat(tournament.prize_pool) * 0.975).toFixed(2)}</p>
        </div>
      )}

      {/* Lobby — player list (shown when open or just started) */}
      {(isOpen || (isActive && tournament.current_round === 1)) && (
        <div className="card">
          <h2 className="font-bold mb-3">
            Players ({tournament.players?.length ?? 0}/{tournament.max_players})
            {isOpen && !isFull && (
              <span className="text-xs text-[#81b64c] ml-2">
                — {tournament.max_players - (tournament.players?.length ?? 0)} spots left
              </span>
            )}
          </h2>
          {tournament.players?.length === 0 ? (
            <p className="text-white/40 text-sm">No players yet. Be the first!</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {tournament.players.map((p: any) => (
                <Link key={p.user_id} href={`/profile/${p.user_id}`}>
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors hover:bg-white/5 ${
                    p.user_id === myId ? 'border-[#81b64c]/40 bg-[#81b64c]/10' : 'border-white/10'
                  }`}>
                    <span className="text-lg">♟</span>
                    <div>
                      <div className="text-sm font-semibold truncate max-w-[80px]">
                        {p.username || '???'}
                        {p.user_id === myId && <span className="text-[#81b64c] text-xs ml-1">(you)</span>}
                      </div>
                      <div className="text-xs text-white/40">{p.elo} ELO</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {isOpen && isCreator && tournament.players?.length >= 4 && (
            <p className="text-xs text-white/40 mt-3">
              Ready to start. You can also wait for more players (up to {tournament.max_players}).
            </p>
          )}
          {isOpen && isCreator && tournament.players?.length < 4 && (
            <p className="text-xs text-white/40 mt-3">Need at least 4 players to start.</p>
          )}
        </div>
      )}

      {/* Bracket */}
      {rounds.length > 0 && (
        <div className="card overflow-x-auto">
          <h2 className="font-bold mb-4">Bracket</h2>
          <div className="flex gap-8 min-w-max pb-2">
            {rounds.map((round) => (
              <div key={round} className="flex flex-col gap-4 justify-around">
                <div className="text-xs text-white/30 text-center mb-2 font-semibold uppercase tracking-wide">
                  {round === tournament.total_rounds ? 'Final' :
                   round === tournament.total_rounds - 1 ? 'Semi-final' :
                   `Round ${round}`}
                </div>
                {roundsMap[round].map((match: any) => (
                  <BracketMatch key={match.id} match={match} round={round} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-center">
        <Link href="/tournaments" className="text-sm text-white/40 hover:text-white">← All Tournaments</Link>
      </div>
    </div>
  );
}
