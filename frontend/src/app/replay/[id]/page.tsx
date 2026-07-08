'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Chess } from 'chess.js';
import { api } from '@/lib/api';
import Link from 'next/link';

const Chessboard = dynamic(() => import('react-chessboard').then((m) => m.Chessboard), {
  ssr: false,
  loading: () => <div className="aspect-square bg-[#b58863] rounded-lg animate-pulse" />,
});

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function parsePgn(pgn: string): { fens: string[]; moves: string[] } {
  const fens: string[] = [INITIAL_FEN];
  const moves: string[] = [];
  if (!pgn?.trim()) return { fens, moves };
  try {
    const chess = new Chess();
    chess.loadPgn(pgn);
    const sanMoves = chess.history();

    const temp = new Chess();
    for (const san of sanMoves) {
      temp.move(san);
      fens.push(temp.fen());
      moves.push(san);
    }
  } catch {}
  return { fens, moves };
}

function shortName(u: any) {
  return u?.username || u?.wallet?.slice(0, 8) || 'Unknown';
}

export default function ReplayPage() {
  const { id } = useParams<{ id: string }>();
  const [game, setGame] = useState<any>(null);
  const [positions, setPositions] = useState<string[]>([INITIAL_FEN]);
  const [sanMoves, setSanMoves] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.games.get(id).then((g) => {
      setGame(g);
      const { fens, moves } = parsePgn(g.pgn || '');
      setPositions(fens);
      setSanMoves(moves);
      setCursor(0);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  // Auto-play
  useEffect(() => {
    if (!autoPlay) return;
    if (cursor >= positions.length - 1) { setAutoPlay(false); return; }
    const t = setTimeout(() => setCursor((c) => c + 1), 700);
    return () => clearTimeout(t);
  }, [autoPlay, cursor, positions.length]);

  const goTo = useCallback((idx: number) => {
    setAutoPlay(false);
    setCursor(Math.max(0, Math.min(positions.length - 1, idx)));
  }, [positions.length]);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') goTo(cursor - 1);
    if (e.key === 'ArrowRight') goTo(cursor + 1);
  }, [cursor, goTo]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  if (loading) {
    return <div className="text-center py-20 text-white/40">Loading replay...</div>;
  }

  if (!game) {
    return (
      <div className="text-center py-20">
        <p className="text-white/40 mb-4">Game not found</p>
        <Link href="/" className="btn-secondary">Back to Lobby</Link>
      </div>
    );
  }

  const pairs: [string, string | undefined][] = [];
  for (let i = 0; i < sanMoves.length; i += 2) {
    pairs.push([sanMoves[i], sanMoves[i + 1]]);
  }

  const whiteName = shortName({ username: game.white_username, wallet: game.white_wallet });
  const blackName = shortName({ username: game.black_username, wallet: game.black_wallet });
  const resultLabel = game.result === 'draw' ? '½–½'
    : game.winner === game.player_white ? '1–0'
    : game.winner === game.player_black ? '0–1'
    : game.result || 'Unknown';

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {whiteName} <span className="text-white/40 font-normal">vs</span> {blackName}
          </h1>
          <p className="text-sm text-white/50 mt-1">
            {resultLabel} · ${game.bet_amount} · {game.result?.replace('_', ' ')}
          </p>
        </div>
        <Link href="/" className="btn-secondary text-sm">Back</Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Board */}
        <div className="flex-1">
          {/* Black label */}
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold">{blackName}</p>
            <p className="text-xs text-white/50">{game.black_elo_before} ELO · Black</p>
          </div>

          <div className="rounded-xl overflow-hidden shadow-2xl">
            <Chessboard
              id="replay"
              position={positions[cursor]}
              arePiecesDraggable={false}
              customBoardStyle={{ borderRadius: '0' }}
            />
          </div>

          {/* White label */}
          <div className="flex items-center justify-between mt-2">
            <p className="font-semibold">{whiteName}</p>
            <p className="text-xs text-white/50">{game.white_elo_before} ELO · White</p>
          </div>

          {/* Controls */}
          <div className="mt-4 flex items-center justify-center gap-3">
            <button onClick={() => goTo(0)} className="btn-secondary px-3 py-2 text-lg" title="Start">⏮</button>
            <button onClick={() => goTo(cursor - 1)} disabled={cursor === 0} className="btn-secondary px-3 py-2 text-lg" title="Previous (←)">◀</button>
            <button
              onClick={() => setAutoPlay((a) => !a)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${autoPlay ? 'bg-[#f0b232] text-black' : 'btn-secondary'}`}
            >
              {autoPlay ? '⏸ Pause' : '▶ Play'}
            </button>
            <button onClick={() => goTo(cursor + 1)} disabled={cursor === positions.length - 1} className="btn-secondary px-3 py-2 text-lg" title="Next (→)">▶</button>
            <button onClick={() => goTo(positions.length - 1)} className="btn-secondary px-3 py-2 text-lg" title="End">⏭</button>
          </div>

          <p className="text-center text-xs text-white/30 mt-2">
            Move {cursor} of {positions.length - 1} · Use ← → arrow keys
          </p>
        </div>

        {/* Move list */}
        <div className="lg:w-56">
          <div className="card h-full overflow-y-auto" style={{ maxHeight: '520px' }}>
            <h3 className="font-semibold text-sm text-white/60 uppercase tracking-wide mb-2">Moves</h3>
            <table className="w-full text-sm font-mono">
              <tbody>
                {pairs.map(([white, black], i) => {
                  const whiteIdx = i * 2 + 1;
                  const blackIdx = i * 2 + 2;
                  return (
                    <tr key={i}>
                      <td className="text-white/30 pr-2 w-6 text-right select-none">{i + 1}.</td>
                      <td
                        onClick={() => goTo(whiteIdx)}
                        className={`pr-3 py-0.5 cursor-pointer rounded px-1 ${cursor === whiteIdx ? 'bg-[#57b06a]/20 text-[#57b06a]' : 'hover:bg-white/5'}`}
                      >
                        {white}
                      </td>
                      <td
                        onClick={() => black ? goTo(blackIdx) : undefined}
                        className={`py-0.5 cursor-pointer rounded px-1 ${cursor === blackIdx ? 'bg-[#57b06a]/20 text-[#57b06a]' : 'hover:bg-white/5'} ${!black ? 'pointer-events-none' : ''}`}
                      >
                        {black ?? ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sanMoves.length === 0 && (
              <p className="text-white/30 text-xs mt-2">No moves recorded</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
