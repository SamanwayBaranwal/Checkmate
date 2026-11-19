'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Chess } from 'chess.js';
import { api } from '@/lib/api';
import MoveHistory from '@/components/MoveHistory';
import { Icon } from '@/components/Icons';
import { getCustomPieces, DEFAULT_PIECE_THEME, type PieceTheme } from '@/lib/pieceThemes';
import { BOARD_THEMES } from '@/lib/boardThemes';

const Chessboard = dynamic(() => import('react-chessboard').then((m) => m.Chessboard), {
  ssr: false,
  loading: () => <div className="aspect-square w-full rounded-lg bg-surface-2 animate-pulse" />,
});

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// Same themes and order as the game page (stored by index in checkmate_board_theme)

const RESULT_TEXT: Record<string, string> = {
  checkmate: 'by checkmate',
  resignation: 'by resignation',
  timeout: 'on time',
};

function parsePgn(pgn: string): { fens: string[]; moves: string[]; squares: { from: string; to: string }[] } {
  const fens: string[] = [INITIAL_FEN];
  const moves: string[] = [];
  const squares: { from: string; to: string }[] = [];
  if (!pgn?.trim()) return { fens, moves, squares };
  try {
    const chess = new Chess();
    chess.loadPgn(pgn);
    const sanMoves = chess.history();

    const temp = new Chess();
    for (const san of sanMoves) {
      const m = temp.move(san);
      fens.push(temp.fen());
      moves.push(san);
      squares.push({ from: m.from, to: m.to });
    }
  } catch {}
  return { fens, moves, squares };
}

function shortName(u: any) {
  return u?.username || (u?.wallet ? `${u.wallet.slice(0, 6)}…${u.wallet.slice(-4)}` : 'Unknown');
}

function initial(name: string) {
  const n = name?.startsWith('0x') ? name.slice(2) : name;
  return (n || '?')[0]?.toUpperCase();
}

function CtrlButton({ icon, label, onClick, disabled, primary }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} title={label} aria-label={label}
      className={`flex-1 h-11 flex items-center justify-center rounded-[10px] transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        primary ? 'bg-surface-3 text-ink hover:bg-surface-3/80' : 'text-muted enabled:hover:text-ink enabled:hover:bg-surface-2'
      }`}>
      {icon}
    </button>
  );
}

// Inline glyphs for the transport controls (Icons.tsx has no first/last/pause)
const Svg = ({ d, fill }: { d: string; fill?: boolean }) => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor"
    strokeWidth={fill ? 0 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d.split('|').map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const GLYPH = {
  first: <Svg d="M6 5v14|M18 6l-7 6 7 6" />,
  prev: <Svg d="M15 6l-6 6 6 6" />,
  next: <Svg d="M9 6l6 6-6 6" />,
  last: <Svg d="M18 5v14|M6 6l7 6-7 6" />,
  play: <Svg d="M7 4.5l13 7.5-13 7.5z" fill />,
  pause: <Svg d="M6 4h4v16H6z|M14 4h4v16h-4z" fill />,
};

export default function ReplayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [game, setGame] = useState<any>(null);
  const [positions, setPositions] = useState<string[]>([INITIAL_FEN]);
  const [sanMoves, setSanMoves] = useState<string[]>([]);
  const [moveSquares, setMoveSquares] = useState<{ from: string; to: string }[]>([]);
  const [cursor, setCursor] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [loading, setLoading] = useState(true);
  const [flipped, setFlipped] = useState(false);

  const [themeIndex] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const v = parseInt(localStorage.getItem('checkmate_board_theme') ?? '0', 10);
    return Number.isFinite(v) && v >= 0 && v < BOARD_THEMES.length ? v : 0;
  });
  const [pieceTheme] = useState<PieceTheme>(() =>
    typeof window === 'undefined' ? DEFAULT_PIECE_THEME : ((localStorage.getItem('checkmate_piece_theme') as PieceTheme) || DEFAULT_PIECE_THEME));
  const customPieces = useMemo(() => getCustomPieces(pieceTheme), [pieceTheme]);
  const theme = BOARD_THEMES[themeIndex];

  // Board fits the available width (never wider than the phone) and the viewport height
  const boardWrap = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(0);
  useEffect(() => {
    const el = boardWrap.current;
    if (!el) return;
    const compute = () => {
      const w = Math.floor(el.clientWidth);
      const vh = window.innerHeight;
      const lg = window.innerWidth >= 1024;
      // chrome around the board: top bar, page header, two player rows, controls (+ moves strip and bottom nav on mobile)
      const cap = lg ? vh - 64 - 72 - 2 * 52 - 72 - 32 : vh - 56 - 76 - 64 - 2 * 52 - 40 - 60 - 16;
      setBoardSize(Math.max(Math.min(w, 280), Math.min(w, cap, 720)));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    window.addEventListener('resize', compute);
    return () => { ro.disconnect(); window.removeEventListener('resize', compute); };
  }, [loading]);

  useEffect(() => {
    api.games.get(id).then((g) => {
      setGame(g);
      const { fens, moves, squares } = parsePgn(g.pgn || '');
      setPositions(fens);
      setSanMoves(moves);
      setMoveSquares(squares);
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

  const togglePlay = useCallback(() => {
    setAutoPlay((a) => {
      if (!a && cursor >= positions.length - 1) setCursor(0);
      return !a;
    });
  }, [cursor, positions.length]);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') goTo(cursor - 1);
    if (e.key === 'ArrowRight') goTo(cursor + 1);
  }, [cursor, goTo]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const back = () => { if (window.history.length > 1) router.back(); else router.push('/'); };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-surface-3 border-t-accent animate-spin" />
        <p className="text-sm text-muted">Loading replay…</p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="max-w-md mx-auto px-4 pt-16 md:pt-24">
        <div className="card p-6 text-center">
          <span className="mx-auto mb-4 w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center text-muted">
            <Icon name="games" size={22} />
          </span>
          <h1 className="text-lg font-semibold">Game not found</h1>
          <p className="text-sm text-muted mt-1">This replay may have been removed or the link is wrong.</p>
          <Link href="/" className="btn-secondary h-12 w-full mt-5">Back to home</Link>
        </div>
      </div>
    );
  }

  const whiteName = shortName({ username: game.white_username, wallet: game.white_wallet });
  const blackName = shortName({ username: game.black_username, wallet: game.black_wallet });
  const whiteWon = game.result !== 'draw' && game.winner && game.winner === game.player_white;
  const blackWon = game.result !== 'draw' && game.winner && game.winner === game.player_black;
  const scoreLabel = game.result === 'draw' ? '½–½' : whiteWon ? '1–0' : blackWon ? '0–1' : '';
  const outcome = game.result === 'draw' ? 'Draw'
    : whiteWon ? `White won ${RESULT_TEXT[game.result] ?? ''}`.trim()
    : blackWon ? `Black won ${RESULT_TEXT[game.result] ?? ''}`.trim()
    : game.status === 'active' ? 'In progress' : (game.result || 'Unfinished');
  const stake = Number(game.bet_amount) || 0;
  const dateLabel = game.completed_at || game.created_at
    ? new Date(game.completed_at || game.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  const orientation: 'white' | 'black' = flipped ? 'black' : 'white';
  const last = cursor > 0 ? moveSquares[cursor - 1] : null;
  const lastSquares: Record<string, React.CSSProperties> = last
    ? { [last.from]: { backgroundColor: 'rgba(212,175,105,0.32)' }, [last.to]: { backgroundColor: 'rgba(212,175,105,0.42)' } } : {};
  const total = positions.length - 1;
  const atStart = cursor === 0;
  const atEnd = cursor >= total;

  const pairs: [string, string | undefined][] = [];
  for (let i = 0; i < sanMoves.length; i += 2) pairs.push([sanMoves[i], sanMoves[i + 1]]);

  const PlayerRow = ({ side }: { side: 'white' | 'black' }) => {
    const name = side === 'white' ? whiteName : blackName;
    const elo = side === 'white' ? game.white_elo_before : game.black_elo_before;
    const won = side === 'white' ? whiteWon : blackWon;
    const lost = side === 'white' ? blackWon : whiteWon;
    const pid = side === 'white' ? game.player_white : game.player_black;
    return (
      <div className="flex items-center gap-3 h-[52px]">
        <Link href={`/profile/${pid}`} className={`avatar w-9 h-9 text-sm ${side === 'white' ? '!bg-ink !text-canvas' : ''}`}>
          {initial(name)}
        </Link>
        <Link href={`/profile/${pid}`} className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate leading-tight">{name}</div>
          <div className="text-xs text-faint num">{elo} · {side === 'white' ? 'White' : 'Black'}</div>
        </Link>
        {game.result === 'draw' ? (
          <span className="pill num">½</span>
        ) : won ? (
          <span className="pill pill-accent">Won</span>
        ) : lost ? (
          <span className="text-xs text-faint pr-1">Lost</span>
        ) : null}
      </div>
    );
  };

  const Controls = (
    <div className="flex items-center gap-1 p-1 rounded-xl bg-surface border border-line/[0.08]">
      <CtrlButton icon={GLYPH.first} label="First move" onClick={() => goTo(0)} disabled={atStart} />
      <CtrlButton icon={GLYPH.prev} label="Previous move" onClick={() => goTo(cursor - 1)} disabled={atStart} />
      <CtrlButton icon={autoPlay ? GLYPH.pause : GLYPH.play} label={autoPlay ? 'Pause' : 'Play'} onClick={togglePlay} disabled={total === 0} primary />
      <CtrlButton icon={GLYPH.next} label="Next move" onClick={() => goTo(cursor + 1)} disabled={atEnd} />
      <CtrlButton icon={GLYPH.last} label="Last move" onClick={() => goTo(total)} disabled={atEnd} />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 pt-3 md:pt-6">
      {/* Header */}
      <header className="flex items-center gap-2 h-14 md:h-16 -ml-2">
        <button onClick={back} className="btn-ghost w-10 h-10 !p-0 shrink-0" aria-label="Back">
          <Icon name="chevron-left" size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-base md:text-lg font-semibold truncate leading-tight">
            {whiteName} <span className="text-faint font-normal">vs</span> {blackName}
          </h1>
          <div className="text-xs text-faint num truncate mt-0.5">
            Replay{game.time_control ? ` · ${game.time_control}` : ''}{stake > 0 ? ` · $${stake} stake` : ''}{dateLabel ? ` · ${dateLabel}` : ''}
          </div>
        </div>
        <button onClick={() => setFlipped((f) => !f)} className="btn-ghost w-10 h-10 !p-0 shrink-0 -mr-2" aria-label="Flip board" title="Flip board">
          <Icon name="flip" size={18} />
        </button>
      </header>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 items-start">
        {/* Board column */}
        <div ref={boardWrap} className="w-full lg:flex-1 min-w-0 flex justify-center">
          <div style={{ width: boardSize || '100%' }} className="max-w-full">
            <PlayerRow side={orientation === 'white' ? 'black' : 'white'} />
            <div className="rounded-lg overflow-hidden my-1">
              {boardSize > 0 ? (
                <Chessboard
                  id={`replay-${id}`}
                  position={positions[cursor]}
                  boardOrientation={orientation}
                  boardWidth={boardSize}
                  arePiecesDraggable={false}
                  animationDuration={180}
                  customBoardStyle={{ borderRadius: 0 }}
                  customDarkSquareStyle={{ backgroundColor: theme.dark }}
                  customLightSquareStyle={{ backgroundColor: theme.light }}
                  customSquareStyles={lastSquares}
                  customPieces={customPieces}
                />
              ) : (
                <div className="aspect-square w-full bg-surface-2" />
              )}
            </div>
            <PlayerRow side={orientation} />

            {/* Mobile: moves strip */}
            <div className="lg:hidden mt-1 flex items-center gap-3 px-1">
              <div className="flex-1 min-w-0">
                {cursor === 0 && total > 0
                  ? <div className="h-9 flex items-center text-xs text-faint">Start position · press play or step through</div>
                  : <MoveHistory moves={sanMoves.slice(0, cursor)} variant="strip" />}
              </div>
              <span className="text-xs text-faint num shrink-0">{cursor}/{total}</span>
            </div>

            <div className="mt-1">{Controls}</div>

            {/* Mobile: result */}
            <div className="lg:hidden card mt-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="eyebrow">Result</div>
                <div className="text-sm font-semibold mt-1 truncate">{outcome}</div>
              </div>
              <div className="text-right shrink-0">
                {scoreLabel && <div className="text-lg font-semibold num">{scoreLabel}</div>}
                {stake > 0 && <div className="text-xs text-faint num">Pot ${(stake * 2).toFixed(2)}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Desktop side panel */}
        <aside className="hidden lg:flex w-80 shrink-0 flex-col gap-4" style={{ height: boardSize ? boardSize + 2 * 52 + 8 + 4 + 54 : undefined }}>
          <div className="card">
            <div className="eyebrow">Result</div>
            <div className="flex items-end justify-between gap-3 mt-1.5">
              <div className="text-base font-semibold">{outcome}</div>
              {scoreLabel && <div className="text-xl font-semibold num">{scoreLabel}</div>}
            </div>
            {stake > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="rounded-[10px] bg-surface-2 px-3 py-2">
                  <div className="text-xs text-faint">Stake</div>
                  <div className="text-sm font-semibold num">${stake.toFixed(2)}</div>
                </div>
                <div className="rounded-[10px] bg-surface-2 px-3 py-2">
                  <div className="text-xs text-faint">Pot</div>
                  <div className="text-sm font-semibold num">${(stake * 2).toFixed(2)}</div>
                </div>
              </div>
            )}
          </div>
          <div className="card p-0 flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="h-11 px-3 flex items-center justify-between border-b border-line/[0.06]">
              <span className="eyebrow">Moves</span>
              <span className="text-xs text-faint num">{cursor} / {total}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto text-sm num">
              {pairs.length === 0 ? (
                <p className="text-faint text-xs px-3 py-3">No moves recorded</p>
              ) : pairs.map(([w, b], i) => {
                const wi = i * 2 + 1;
                const bi = i * 2 + 2;
                return (
                  <div key={i} className={`grid grid-cols-[36px_1fr_1fr] gap-1 px-2 h-8 items-center ${i % 2 ? 'bg-surface-2/40' : ''}`}>
                    <span className="text-faint text-xs pl-1">{i + 1}.</span>
                    <button onClick={() => goTo(wi)}
                      className={`text-left h-7 px-2 rounded-md transition-colors ${cursor === wi ? 'bg-surface-3 text-ink font-semibold' : 'text-muted hover:text-ink hover:bg-surface-2'}`}>
                      {w}
                    </button>
                    {b ? (
                      <button onClick={() => goTo(bi)}
                        className={`text-left h-7 px-2 rounded-md transition-colors ${cursor === bi ? 'bg-surface-3 text-ink font-semibold' : 'text-muted hover:text-ink hover:bg-surface-2'}`}>
                        {b}
                      </button>
                    ) : <span />}
                  </div>
                );
              })}
            </div>
            <div className="h-9 px-3 flex items-center border-t border-line/[0.06] text-[11px] text-faint">
              Use the arrow keys to step through moves
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
