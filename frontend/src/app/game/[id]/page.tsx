'use client';

import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Chess } from 'chess.js';
import { useChessGame } from '@/hooks/useChessGame';
import { useSession } from '@/lib/session';
import ChessClock from '@/components/ChessClock';
import GameOverModal from '@/components/GameOverModal';
import MoveHistory from '@/components/MoveHistory';
import CapturedPieces from '@/components/CapturedPieces';
import { Icon, type IconName } from '@/components/Icons';
import { sounds } from '@/lib/sounds';
import { api } from '@/lib/api';
import { getCustomPieces, type PieceTheme } from '@/lib/pieceThemes';
import { BOARD_THEMES } from '@/lib/boardThemes';
import { PieceAvatar } from '@/components/GameIcons';

const Chessboard = dynamic(() => import('react-chessboard').then((m) => m.Chessboard), {
  ssr: false,
  loading: () => <div className="aspect-square w-full rounded-lg bg-surface-2 animate-pulse" />,
});

const REPORT_REASONS = [
  { value: 'cheating', label: 'Cheating / engine use' },
  { value: 'harassment', label: 'Harassment in chat' },
  { value: 'sandbagging', label: 'Losing on purpose' },
  { value: 'stalling', label: 'Stalling / not moving' },
  { value: 'other', label: 'Other' },
];


const TC_NAME: Record<string, string> = { '3+0': 'Bullet · 3 min', '5+0': 'Blitz · 5 min', '10+0': 'Rapid · 10 min' };

function ToolButton({ icon, label, onClick, active, tone }: { icon: IconName; label: string; onClick: () => void; active?: boolean; tone?: 'danger' }) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className={`flex-1 h-11 flex flex-col items-center justify-center gap-0.5 rounded-[10px] transition-colors ${
        tone === 'danger' ? 'text-negative hover:bg-negative/10' : active ? 'text-ink bg-surface-2' : 'text-muted hover:text-ink hover:bg-surface-2'
      }`}>
      <Icon name={icon} size={18} />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, me } = useSession();
  const { state, error, makeMove, resign, offerDraw, acceptDraw, offerRematch, acceptRematch, rematchState, rematchGameId, sendChat } =
    useChessGame(id, token || undefined);

  useEffect(() => { if (rematchGameId) router.push(`/game/${rematchGameId}`); }, [rematchGameId, router]);

  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  const [preMove, setPreMove] = useState<{ from: string; to: string; promotion?: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [panel, setPanel] = useState<'none' | 'chat' | 'themes' | 'report' | 'resign'>('none');
  const [reportReason, setReportReason] = useState('cheating');
  const [reportDetails, setReportDetails] = useState('');
  const [reportState, setReportState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [drawDismissed, setDrawDismissed] = useState(false);
  const [drawSent, setDrawSent] = useState(false);
  const [themeIndex, setThemeIndex] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const v = parseInt(localStorage.getItem('checkmate_board_theme') ?? '0', 10);
    return Number.isFinite(v) && v >= 0 && v < BOARD_THEMES.length ? v : 0;
  });
  const [autoQueen] = useState(() => typeof window === 'undefined' || localStorage.getItem('checkmate_auto_queen') !== 'false');
  const [pieceTheme] = useState<PieceTheme>(() =>
    typeof window === 'undefined' ? 'chessnut' : ((localStorage.getItem('checkmate_piece_theme') as PieceTheme) || 'chessnut'));
  const customPieces = useMemo(() => getCustomPieces(pieceTheme), [pieceTheme]);
  const [chatInput, setChatInput] = useState('');
  const [unreadChat, setUnreadChat] = useState(0);
  const chatEnd = useRef<HTMLDivElement>(null);
  const prevMoves = useRef(0);
  const prevChat = useRef(0);
  const [flipped, setFlipped] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const soundRef = useRef(true);

  useEffect(() => { if (localStorage.getItem('checkmate_sound') === 'off') { setSoundOn(false); soundRef.current = false; } }, []);
  const toggleSound = () => setSoundOn((p) => { const n = !p; soundRef.current = n; localStorage.setItem('checkmate_sound', n ? 'on' : 'off'); return n; });

  // Board always fits the screen: no scrolling while playing
  const [boardSize, setBoardSize] = useState(360);
  useEffect(() => {
    const compute = () => {
      const vw = window.innerWidth, vh = window.innerHeight;
      if (vw >= 1024) setBoardSize(Math.max(360, Math.min(vh - 56 - 2 * 52 - 64 - 56, vw - 360 - 96, 760)));
      else setBoardSize(Math.max(260, Math.min(vw - 16, vh - 48 - 2 * 52 - 56 - 44 - 24)));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);
  const theme = BOARD_THEMES[themeIndex];

  // Chat: autoscroll + unread badge on mobile
  useEffect(() => {
    const n = state?.chatMessages.length ?? 0;
    if (n > prevChat.current && panel !== 'chat') setUnreadChat((u) => u + (n - prevChat.current));
    prevChat.current = n;
    chatEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [state?.chatMessages.length, panel]);
  useEffect(() => { if (panel === 'chat') setUnreadChat(0); }, [panel]);

  // Sounds
  useEffect(() => {
    if (!state || state.status === 'spectating' || state.moves.length === prevMoves.current) return;
    prevMoves.current = state.moves.length;
    const last = state.moves[state.moves.length - 1];
    if (!last || !soundRef.current) return;
    if (last.includes('#') || last.includes('+')) sounds.check();
    else if (last.toLowerCase().includes('x')) sounds.capture();
    else sounds.move();
  }, [state?.moves.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!state || state.status !== 'over' || !soundRef.current) return;
    if (state.result === 'draw') sounds.draw();
    else if (state.winner === state.color) sounds.win();
    else sounds.lose();
  }, [state?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-move fires when it becomes our turn
  useEffect(() => {
    if (!state || !preMove || state.status !== 'playing') return;
    if (state.turn === state.color) { makeMove(preMove.from, preMove.to, preMove.promotion); setPreMove(null); }
  }, [state?.turn]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!state || state.status !== 'playing') return;
    const mine = state.color === 'white' ? state.clocks.white : state.clocks.black;
    if (mine < 10000 && mine > 0 && state.turn === state.color) sounds.clockLow();
  }, [state?.clocks]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (state?.drawOffered) setDrawDismissed(false); }, [state?.drawOffered]);
  useEffect(() => { setSelected(null); setDrawSent(false); }, [state?.turn]);

  const isPromotion = (pieceType: string | undefined, to: string) =>
    pieceType === 'p' && state && ((state.color === 'white' && to[1] === '8') || (state.color === 'black' && to[1] === '1'));

  const onPieceDrop = useCallback((from: string, to: string, piece: string) => {
    if (!state || state.status !== 'playing') return false;
    const promo = isPromotion(piece[1]?.toLowerCase(), to);
    if (state.turn !== state.color) { setPreMove({ from, to, promotion: promo ? 'q' : undefined }); return true; }
    if (promo) { if (autoQueen) { makeMove(from, to, 'q'); return true; } setPromotion({ from, to }); return false; }
    makeMove(from, to);
    return true;
  }, [state, makeMove, autoQueen]); // eslint-disable-line react-hooks/exhaustive-deps

  const legalSquares = useMemo<Record<string, React.CSSProperties>>(() => {
    if (!selected || !state || state.turn !== state.color || state.status !== 'playing') return {};
    try {
      const chess = new Chess(state.fen);
      const out: Record<string, React.CSSProperties> = { [selected]: { backgroundColor: 'rgba(212,175,105,0.45)' } };
      for (const m of chess.moves({ square: selected as any, verbose: true })) {
        out[m.to] = chess.get(m.to as any)
          ? { background: 'radial-gradient(circle, transparent 58%, rgba(20,20,20,0.28) 60%)' }
          : { background: 'radial-gradient(circle, rgba(20,20,20,0.24) 22%, transparent 23%)' };
      }
      return out;
    } catch { return {}; }
  }, [selected, state?.fen, state?.turn, state?.color, state?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSquareClick = useCallback((square: string) => {
    if (!state || state.status !== 'playing') return;
    try {
      const chess = new Chess(state.fen);
      const piece = chess.get(square as any);
      if (piece && piece.color === (state.color === 'white' ? 'w' : 'b')) { setSelected((p) => (p === square ? null : square)); return; }
      if (!selected) return;
      const promo = isPromotion(chess.get(selected as any)?.type, square);
      if (state.turn !== state.color) { setPreMove({ from: selected, to: square, promotion: promo ? 'q' : undefined }); setSelected(null); return; }
      if (promo) { if (autoQueen) makeMove(selected, square, 'q'); else setPromotion({ from: selected, to: square }); }
      else makeMove(selected, square);
      setSelected(null);
    } catch { setSelected(null); }
  }, [state, selected, makeMove, autoQueen]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitReport = useCallback(async () => {
    if (!state) return;
    setReportState('sending');
    try {
      const game = await api.games.get(id);
      const reportedId = state.color === 'white' ? game.player_black : game.player_white;
      await api.reports.submit({ reportedId, gameId: id, reason: reportReason, details: reportDetails });
      setReportState('done');
      setTimeout(() => { setPanel('none'); setReportState('idle'); }, 1800);
    } catch { setReportState('idle'); }
  }, [state, id, reportReason, reportDetails]);

  const sendChatMsg = () => { if (chatInput.trim()) { sendChat(chatInput.trim()); setChatInput(''); } };

  if (!state) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-surface-3 border-t-accent animate-spin" />
        <p className="text-sm text-muted">Connecting to game…</p>
      </div>
    );
  }

  const playing = state.status === 'playing';
  const spectating = state.status === 'spectating';
  const myTurn = playing && state.turn === state.color;
  const base = state.color === 'black' ? 'black' : 'white';
  const orientation: 'white' | 'black' = flipped ? (base === 'white' ? 'black' : 'white') : base;
  const oppClock = state.color === 'white' ? state.clocks.black : state.clocks.white;
  const myClock = state.color === 'white' ? state.clocks.white : state.clocks.black;
  const preSquares: Record<string, React.CSSProperties> = preMove
    ? { [preMove.from]: { backgroundColor: 'rgba(120,150,220,0.45)' }, [preMove.to]: { backgroundColor: 'rgba(120,150,220,0.55)' } } : {};
  const lastSquares: Record<string, React.CSSProperties> = state.lastMove
    ? { [state.lastMove.from]: { backgroundColor: 'rgba(212,175,105,0.32)' }, [state.lastMove.to]: { backgroundColor: 'rgba(212,175,105,0.42)' } } : {};
  const myName = spectating ? 'Player' : me?.username || 'You';
  const tcName = (state.timeControl && TC_NAME[state.timeControl]) || 'Rated game';

  const PlayerRow = ({ name, sub, side, ms, active }: { name: string; sub: string; side: 'white' | 'black'; ms: number; active: boolean }) => (
    <div className="flex items-center gap-3 h-[52px]">
      <PieceAvatar seed={name} size={36} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate leading-tight">{name}</div>
        <div className="flex items-center gap-2 text-xs text-faint num">
          <span>{sub}</span>
          <CapturedPieces fen={state.fen} side={side} />
        </div>
      </div>
      <ChessClock ms={ms} active={active} />
    </div>
  );

  const ChatBox = (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-[120px]">
        {state.chatMessages.length === 0 ? <p className="text-xs text-faint">Say hi. Be nice.</p> :
          state.chatMessages.map((m, i) => (
            <div key={i} className="text-sm leading-snug"><span className="font-semibold text-muted">{m.sender}</span> <span className="text-ink">{m.text}</span></div>
          ))}
        <div ref={chatEnd} />
      </div>
      <div className="p-2 flex gap-2 border-t border-line/[0.06]">
        <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendChatMsg(); }}
          placeholder="Message" maxLength={200} className="input h-10 py-0" />
        <button onClick={sendChatMsg} className="btn-secondary h-10 px-3" aria-label="Send"><Icon name="arrow-up-right" size={16} /></button>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col">
      {/* Header */}
      <header className="h-12 lg:h-14 px-2 lg:px-6 flex items-center gap-2 border-b border-line/[0.06] pt-safe">
        <Link href="/" className="btn-ghost p-2" aria-label="Back"><Icon name="chevron-left" size={20} /></Link>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{tcName}{state.betAmount > 0 ? ` · $${state.betAmount} stake` : ''}</div>
          <div className="text-xs text-faint num">
            {spectating ? 'Watching' : playing ? (myTurn ? 'Your move' : 'Opponent to move') : 'Game over'}
            {state.spectatorCount > 0 && ` · ${state.spectatorCount} watching`}
          </div>
        </div>
        {state.betAmount > 0 && (
          <div className="text-right pr-2">
            <div className="text-[10px] text-faint uppercase tracking-wide">Pot</div>
            <div className="text-sm font-semibold num">${(state.betAmount * 2).toFixed(2)}</div>
          </div>
        )}
      </header>

      <div className="flex-1 w-full max-w-6xl mx-auto px-2 lg:px-6 py-2 lg:py-6 flex flex-col lg:flex-row gap-4 lg:gap-8 items-center lg:items-start justify-start lg:justify-center">
        {/* Board column */}
        <div style={{ width: boardSize }} className="shrink-0">
          <PlayerRow name={state.opponent.username} sub={`${state.opponent.elo}`} side={state.color === 'white' ? 'black' : 'white'}
            ms={oppClock} active={playing && state.turn !== state.color} />
          <div className="rounded-lg overflow-hidden my-1">
            <Chessboard
              id={id}
              position={state.fen}
              onPieceDrop={onPieceDrop}
              onSquareClick={onSquareClick}
              boardOrientation={orientation}
              boardWidth={boardSize}
              arePiecesDraggable={playing}
              customBoardStyle={{ borderRadius: 0 }}
              customDarkSquareStyle={{ backgroundColor: theme.dark }}
              customLightSquareStyle={{ backgroundColor: theme.light }}
              customSquareStyles={{ ...lastSquares, ...legalSquares, ...preSquares }}
              customPieces={customPieces}
            />
          </div>
          <PlayerRow name={myName} sub={spectating ? '' : state.color === 'white' ? 'White' : 'Black'} side={state.color}
            ms={myClock} active={myTurn} />

          {/* Mobile: moves strip */}
          <div className="lg:hidden mt-1 px-1"><MoveHistory moves={state.moves} variant="strip" /></div>

          {/* Toolbar */}
          <div className="flex items-center gap-1 mt-1 p-1 rounded-xl bg-surface border border-line/[0.08]">
            <ToolButton icon="flip" label="Flip" onClick={() => setFlipped((f) => !f)} />
            <ToolButton icon={soundOn ? 'sound' : 'mute'} label="Sound" onClick={toggleSound} />
            <ToolButton icon="palette" label="Board" onClick={() => setPanel((p) => (p === 'themes' ? 'none' : 'themes'))} active={panel === 'themes'} />
            <span className="lg:hidden flex-1 relative">
              <ToolButton icon="chat" label="Chat" onClick={() => setPanel((p) => (p === 'chat' ? 'none' : 'chat'))} active={panel === 'chat'} />
              {unreadChat > 0 && <span className="absolute top-1.5 right-1/4 w-2 h-2 rounded-full bg-accent" />}
            </span>
            {playing && (
              <>
                <ToolButton icon="handshake" label={drawSent ? 'Offered' : 'Draw'} onClick={() => { offerDraw(); setDrawSent(true); }} />
                <ToolButton icon="flag" label="Resign" tone="danger" onClick={() => setPanel('resign')} />
              </>
            )}
          </div>

          {panel === 'themes' && (
            <div className="mt-2 p-2 rounded-xl bg-surface border border-line/[0.08] flex gap-2 justify-center">
              {BOARD_THEMES.map((t, i) => (
                <button key={t.name} title={t.name} aria-label={t.name}
                  onClick={() => { setThemeIndex(i); localStorage.setItem('checkmate_board_theme', String(i)); }}
                  className={`w-10 h-10 rounded-lg overflow-hidden border-2 ${i === themeIndex ? 'border-accent' : 'border-transparent'}`}
                  style={{ background: `linear-gradient(135deg, ${t.light} 50%, ${t.dark} 50%)` }} />
              ))}
            </div>
          )}

          {state.drawOffered && playing && !drawDismissed && (
            <div className="mt-2 p-3 rounded-xl bg-surface border border-accent/30 flex items-center gap-3">
              <span className="text-sm flex-1">Opponent offers a draw</span>
              <button onClick={() => setDrawDismissed(true)} className="btn-secondary h-9 py-0">Decline</button>
              <button onClick={acceptDraw} className="btn-primary h-9 py-0">Accept</button>
            </div>
          )}

          {preMove && (
            <div className="mt-2 px-3 h-10 rounded-xl bg-surface border border-line/[0.08] flex items-center justify-between text-xs text-muted">
              <span>Pre-move {preMove.from} → {preMove.to}</span>
              <button onClick={() => setPreMove(null)} className="btn-ghost p-1" aria-label="Cancel pre-move"><Icon name="x" size={14} /></button>
            </div>
          )}

          {panel === 'chat' && (
            <div className="lg:hidden mt-2 h-64 rounded-xl bg-surface border border-line/[0.08] overflow-hidden">{ChatBox}</div>
          )}
          {error && <div className="mt-2 p-3 rounded-xl bg-negative/10 border border-negative/25 text-sm text-negative">{error}</div>}
        </div>

        {/* Desktop side panel */}
        <aside className="hidden lg:flex w-80 flex-col gap-4" style={{ height: boardSize + 2 * 52 + 8 }}>
          <div className="card p-0 flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="h-11 px-3 flex items-center border-b border-line/[0.06]"><span className="eyebrow">Moves</span></div>
            <div className="flex-1 min-h-0 overflow-y-auto"><MoveHistory moves={state.moves} /></div>
          </div>
          <div className="card p-0 h-64 flex flex-col overflow-hidden">
            <div className="h-11 px-3 flex items-center border-b border-line/[0.06]"><span className="eyebrow">Chat</span></div>
            <div className="flex-1 min-h-0">{ChatBox}</div>
          </div>
          {!spectating && (
            <button onClick={() => setPanel('report')} className="text-xs text-faint hover:text-negative transition-colors">Report opponent</button>
          )}
        </aside>
      </div>

      {!spectating && (
        <div className="lg:hidden text-center pb-4">
          <button onClick={() => setPanel('report')} className="text-xs text-faint hover:text-negative">Report opponent</button>
        </div>
      )}

      {/* Resign confirm: one mis-tap must never cost a game */}
      {panel === 'resign' && (
        <div className="overlay" onClick={() => setPanel('none')}>
          <div className="sheet text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Resign this game?</h3>
            <p className="text-sm text-muted mt-1">{state.betAmount > 0 ? `You will lose your $${state.betAmount} stake.` : 'The game ends as a loss.'}</p>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button onClick={() => setPanel('none')} className="btn-secondary h-12">Keep playing</button>
              <button onClick={() => { setPanel('none'); resign(); }} className="btn-danger h-12">Resign</button>
            </div>
          </div>
        </div>
      )}

      {panel === 'report' && (
        <div className="overlay" onClick={() => setPanel('none')}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">Report opponent</h3>
            {reportState === 'done' ? (
              <p className="text-sm text-positive py-6 text-center">Thanks. Our fair-play team will review this game.</p>
            ) : (
              <>
                <p className="text-sm text-muted mb-4">Every game is also checked automatically for engine use.</p>
                <div className="space-y-1 mb-3">
                  {REPORT_REASONS.map((r) => (
                    <button key={r.value} onClick={() => setReportReason(r.value)}
                      className={`w-full h-11 px-3 rounded-[10px] text-sm text-left flex items-center justify-between ${reportReason === r.value ? 'bg-surface-3' : 'hover:bg-surface-2'}`}>
                      {r.label}
                      {reportReason === r.value && <Icon name="check" size={16} className="text-accent" />}
                    </button>
                  ))}
                </div>
                <textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} placeholder="Details (optional)"
                  maxLength={500} rows={3} className="input resize-none mb-4" />
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setPanel('none')} className="btn-secondary h-11">Cancel</button>
                  <button onClick={submitReport} disabled={reportState === 'sending'} className="btn-danger h-11">
                    {reportState === 'sending' ? 'Sending…' : 'Submit report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {promotion && (
        <div className="overlay">
          <div className="sheet text-center">
            <p className="text-sm text-muted mb-4">Promote to</p>
            <div className="grid grid-cols-4 gap-2">
              {(['q', 'r', 'b', 'n'] as const).map((p) => (
                <button key={p} onClick={() => { makeMove(promotion.from, promotion.to, p); setPromotion(null); }}
                  className="btn-secondary h-16 text-3xl">{({ q: '♛', r: '♜', b: '♝', n: '♞' })[p]}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {state.status === 'over' && state.result && (
        <GameOverModal
          result={state.result}
          winner={state.winner ?? null}
          playerColor={state.color}
          eloChange={state.eloChange ?? 0}
          betAmount={state.betAmount}
          payout={state.betAmount * 2 * 0.975}
          streakBonus={state.streakBonus}
          streak={state.streak}
          gameId={id}
          onRematch={offerRematch}
          rematchState={rematchState}
          onAcceptRematch={acceptRematch}
        />
      )}
    </div>
  );
}
