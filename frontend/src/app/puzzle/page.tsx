'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { api } from '@/lib/api';

type PuzzleState = 'idle' | 'playing' | 'solved' | 'failed' | 'revealed';

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: 'text-[#46a883] bg-[#46a883]/10 border-[#46a883]/30',
  medium: 'text-[#f0b232] bg-[#f0b232]/10 border-[#f0b232]/30',
  hard: 'text-red-400 bg-red-500/10 border-red-500/30',
};

export default function PuzzlePage() {
  const { authenticated } = usePrivy();

  const [data, setData] = useState<any>(null);
  const [solution, setSolution] = useState<string[]>([]);
  const [moveIndex, setMoveIndex] = useState(0);
  const [fen, setFen] = useState('');
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [puzzleState, setPuzzleState] = useState<PuzzleState>('idle');
  const [feedback, setFeedback] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await api.puzzles.daily();
      setData(d);

      const chess = new Chess(d.puzzle.fen);
      setBoardOrientation(chess.turn() === 'w' ? 'white' : 'black');

      if (d.state.solved) {
        setFen(d.puzzle.fen);
        setPuzzleState('solved');
        setFeedback('Already solved today! Come back tomorrow.');
      } else if (d.state.failed) {
        setFen(d.puzzle.fen);
        setPuzzleState('failed');
        setFeedback('Better luck tomorrow!');
      } else {
        setFen(d.puzzle.fen);
        setPuzzleState('playing');
        setMoveIndex(0);
        setAttemptsLeft(3 - (d.state.attempts ?? 0));
        setFeedback(chess.turn() === 'w' ? 'White to move' : 'Black to move');
      }
    } catch {
      setFeedback('Failed to load puzzle. Are you logged in?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authenticated) load();
    else setLoading(false);
  }, [authenticated, load]);

  const attemptMove = useCallback(async (from: string, to: string) => {
    if (puzzleState !== 'playing') return false;

    const uci = from + to;
    setSelectedSquare(null);

    try {
      const res = await api.puzzles.attempt(moveIndex, uci);

      if (res.correct) {
        // Apply the player's move to the board
        const chess = new Chess(fen);
        chess.move({ from, to });
        const newFen = chess.fen();
        setFen(newFen);

        if (res.done) {
          setPuzzleState('solved');
          setResult(res);
          setFeedback(`Solved! +${res.xpEarned} XP · +$${res.bonusUsdc?.toFixed(2)}`);
        } else {
          // Apply opponent's response move automatically after a short delay
          setMoveIndex(moveIndex + 1);
          setFeedback('Correct! Keep going...');
          // For multi-move puzzles, we'd need the opponent's response from solution
          // Since we don't expose full solution, we advance moveIndex for next player move
        }
      } else {
        if (res.done && res.failed) {
          setPuzzleState('failed');
          setSolution(res.solution ?? []);
          setFeedback(`Out of attempts. The solution has been revealed.`);
        } else {
          setAttemptsLeft(res.attemptsLeft ?? attemptsLeft - 1);
          setFeedback(`Wrong move. ${res.attemptsLeft} attempt${res.attemptsLeft === 1 ? '' : 's'} left.`);
        }
      }
    } catch {
      setFeedback('Error submitting move.');
    }

    return true;
  }, [puzzleState, moveIndex, fen, attemptsLeft]);

  const onPieceDrop = useCallback((sourceSquare: string, targetSquare: string) => {
    attemptMove(sourceSquare, targetSquare);
    return false; // We manage FEN ourselves
  }, [attemptMove]);

  const legalMoveSquares = useMemo<Record<string, React.CSSProperties>>(() => {
    if (!selectedSquare || puzzleState !== 'playing') return {};
    try {
      const chess = new Chess(fen);
      const moves = chess.moves({ square: selectedSquare as any, verbose: true });
      const squares: Record<string, React.CSSProperties> = {
        [selectedSquare]: { backgroundColor: 'rgba(76, 175, 80, 0.4)' },
      };
      for (const m of moves) {
        squares[m.to] = chess.get(m.to as any)
          ? { background: 'radial-gradient(circle, rgba(255,0,0,0.35) 80%, transparent 80%)' }
          : { background: 'radial-gradient(circle, rgba(0,0,0,0.18) 28%, transparent 28%)' };
      }
      return squares;
    } catch {
      return {};
    }
  }, [selectedSquare, fen, puzzleState]);

  const onSquareClick = useCallback((square: string) => {
    if (puzzleState !== 'playing') return;
    try {
      const chess = new Chess(fen);
      const piece = chess.get(square as any);
      const myColor = chess.turn();

      if (piece && piece.color === myColor) {
        setSelectedSquare((prev) => (prev === square ? null : square));
        return;
      }
      if (!selectedSquare) return;

      attemptMove(selectedSquare, square);
    } catch {
      setSelectedSquare(null);
    }
  }, [puzzleState, fen, selectedSquare, attemptMove]);

  const handleReveal = async () => {
    try {
      const res = await api.puzzles.solution();
      setSolution(res.solution);
      setPuzzleState('revealed');
      setFeedback('Solution revealed. Streak reset.');
    } catch {}
  };

  if (!authenticated) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-4">♟</div>
        <h1 className="text-3xl font-bold mb-3">Daily Puzzle</h1>
        <p className="text-white/50">Log in to solve today's puzzle and earn XP.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-20 text-white/40">Loading...</div>;
  }

  const puzzle = data?.puzzle;
  const stats = data?.stats;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Daily Puzzle</h1>
          <p className="text-white/50 text-sm mt-1">One puzzle per day · Resets at midnight UTC</p>
        </div>
        {/* Streak stats */}
        {stats && (
          <div className="flex gap-3">
            <div className="card text-center px-4 py-2">
              <div className="text-xl font-bold text-[#f0b232]">{stats.streak}</div>
              <div className="text-xs text-white/40">Streak</div>
            </div>
            <div className="card text-center px-4 py-2">
              <div className="text-xl font-bold">{stats.totalSolved}</div>
              <div className="text-xs text-white/40">Solved</div>
            </div>
            <div className="card text-center px-4 py-2">
              <div className="text-xl font-bold text-white/60">{stats.longestStreak}</div>
              <div className="text-xs text-white/40">Best streak</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Board */}
        <div>
          <div className="rounded-2xl overflow-hidden border border-white/10" style={{ maxWidth: 560 }}>
            <Chessboard
              position={fen}
              boardOrientation={boardOrientation}
              onPieceDrop={onPieceDrop}
              onSquareClick={onSquareClick}
              customSquareStyles={legalMoveSquares}
              arePiecesDraggable={puzzleState === 'playing'}
              customBoardStyle={{ borderRadius: 0 }}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Puzzle info */}
          {puzzle && (
            <div className="card space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold uppercase tracking-wider border px-2 py-0.5 rounded-full ${DIFFICULTY_COLOR[puzzle.difficulty] ?? ''}`}>
                  {puzzle.difficulty}
                </span>
                <span className="text-xs text-white/40 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                  {puzzle.theme}
                </span>
              </div>
              <p className="text-sm text-white/70">{puzzle.description}</p>
              <div className="text-xs text-white/40">
                {puzzle.solutionLength}-move solution
              </div>
            </div>
          )}

          {/* Feedback */}
          <div className={`card border ${
            puzzleState === 'solved'
              ? 'border-[#46a883]/40 bg-[#46a883]/5'
              : puzzleState === 'failed' || puzzleState === 'revealed'
              ? 'border-red-500/30 bg-red-500/5'
              : 'border-white/10'
          }`}>
            <div className="text-sm font-semibold mb-1">
              {puzzleState === 'solved' && '🎉 Puzzle Solved!'}
              {puzzleState === 'failed' && '😔 Out of attempts'}
              {puzzleState === 'revealed' && '💡 Solution'}
              {puzzleState === 'playing' && '🧩 Your turn'}
              {puzzleState === 'idle' && 'Loading...'}
            </div>
            <p className="text-sm text-white/60">{feedback}</p>

            {puzzleState === 'playing' && (
              <div className="mt-3 flex items-center gap-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className={`w-2 h-2 rounded-full ${i < attemptsLeft ? 'bg-[#46a883]' : 'bg-white/10'}`} />
                ))}
                <span className="text-xs text-white/40 ml-1">{attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} left</span>
              </div>
            )}

            {puzzleState === 'solved' && result && (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/50">XP earned</span>
                  <span className="font-bold text-[#f0b232]">+{result.xpEarned} XP</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/50">Bonus</span>
                  <span className="font-bold text-[#46a883]">+${result.bonusUsdc?.toFixed(2)}</span>
                </div>
                {result.streak > 1 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/50">Streak</span>
                    <span className="font-bold text-[#f0b232]">{result.streak} days 🔥</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Solution display (after failure/reveal) */}
          {solution.length > 0 && (puzzleState === 'failed' || puzzleState === 'revealed') && (
            <div className="card border border-white/10">
              <div className="text-xs font-semibold text-white/40 mb-2 uppercase tracking-wider">Solution</div>
              <div className="flex flex-wrap gap-2">
                {solution.map((move, i) => (
                  <span key={i} className="text-xs font-mono bg-white/5 border border-white/10 px-2 py-1 rounded">
                    {i + 1}. {move}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            {puzzleState === 'playing' && (
              <button
                onClick={handleReveal}
                className="w-full btn-secondary text-sm opacity-60 hover:opacity-100"
              >
                Reveal Solution (resets streak)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
