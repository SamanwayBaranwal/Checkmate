'use client';

import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useState, useCallback, useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useChessGame } from '@/hooks/useChessGame';
import ChessClock from '@/components/ChessClock';
import GameOverModal from '@/components/GameOverModal';
import MoveHistory from '@/components/MoveHistory';
import { sounds } from '@/lib/sounds';
import { api } from '@/lib/api';

const Chessboard = dynamic(() => import('react-chessboard').then((m) => m.Chessboard), {
  ssr: false,
  loading: () => <div className="aspect-square bg-[#b58863] rounded-lg animate-pulse" />,
});

const REPORT_REASONS = [
  { value: 'cheating', label: 'Cheating / engine use' },
  { value: 'harassment', label: 'Harassment in chat' },
  { value: 'sandbagging', label: 'Sandbagging (losing on purpose)' },
  { value: 'stalling', label: 'Stalling / not moving' },
  { value: 'other', label: 'Other' },
];

const BOARD_THEMES = [
  { name: 'Classic',   light: '#f0d9b5', dark: '#b58863' },
  { name: 'Ocean',     light: '#dee3e6', dark: '#8ca2ad' },
  { name: 'Forest',    light: '#ffffdd', dark: '#86a666' },
  { name: 'Night',     light: '#e8e9b7', dark: '#4a7fa5' },
  { name: 'Rose',      light: '#f9d9d9', dark: '#c07878' },
];

function shortAddr(addr: string) {
  if (!addr) return 'Unknown';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = usePrivy();
  const router = useRouter();
  const token = typeof window !== 'undefined' ? localStorage.getItem('checkmate_token') ?? undefined : undefined;

  const { state, error, makeMove, resign, offerDraw, acceptDraw, offerRematch, acceptRematch, rematchState, rematchGameId, sendChat } = useChessGame(id, token);

  useEffect(() => {
    if (rematchGameId) router.push(`/game/${rematchGameId}`);
  }, [rematchGameId, router]);

  const [promotionDialog, setPromotionDialog] = useState<{ from: string; to: string } | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('cheating');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [themeIndex, setThemeIndex] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const stored = localStorage.getItem('checkmate_board_theme');
    return stored !== null ? parseInt(stored, 10) : 0;
  });
  const [autoQueen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('checkmate_auto_queen') !== 'false';
  });
  const [showThemes, setShowThemes] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const prevMoveCount = useRef(0);

  const theme = BOARD_THEMES[themeIndex];

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state?.chatMessages.length]);

  // Play sounds on move
  useEffect(() => {
    if (!state || state.status === 'spectating') return;
    if (state.moves.length === prevMoveCount.current) return;
    prevMoveCount.current = state.moves.length;

    const lastMove = state.moves[state.moves.length - 1];
    if (!lastMove) return;

    if (lastMove.includes('#') || lastMove.includes('+')) {
      sounds.check();
    } else if (lastMove.toLowerCase().includes('x')) {
      sounds.capture();
    } else {
      sounds.move();
    }
  }, [state?.moves.length]);

  // Play win/lose sound on game over
  useEffect(() => {
    if (!state || state.status !== 'over') return;
    if (state.result === 'draw') { sounds.draw(); return; }
    if (state.winner === state.color) sounds.win();
    else sounds.lose();
  }, [state?.status]);

  // Low clock warning
  useEffect(() => {
    if (!state || state.status !== 'playing') return;
    const myClock = state.color === 'white' ? state.clocks.white : state.clocks.black;
    if (myClock < 10000 && myClock > 0 && state.turn === state.color) {
      sounds.clockLow();
    }
  }, [state?.clocks]);

  const onPieceDrop = useCallback(
    (from: string, to: string, piece: string) => {
      if (!state || state.status !== 'playing' || state.turn !== state.color) return false;
      const isPawnPromotion =
        piece.toLowerCase().includes('p') &&
        ((state.color === 'white' && to[1] === '8') || (state.color === 'black' && to[1] === '1'));
      if (isPawnPromotion) {
        if (autoQueen) { makeMove(from, to, 'q'); return true; }
        setPromotionDialog({ from, to });
        return false;
      }
      makeMove(from, to);
      return true;
    },
    [state, makeMove, autoQueen]
  );

  const submitReport = useCallback(async () => {
    if (!state) return;
    setReportSending(true);
    try {
      const game = await api.games.get(id);
      const reportedId = state.color === 'white' ? game.player_black : game.player_white;
      await api.reports.submit({ reportedId, gameId: id, reason: reportReason, details: reportDetails });
      setReportDone(true);
      setTimeout(() => { setShowReport(false); setReportDone(false); }, 2000);
    } catch {
      setReportSending(false);
    }
  }, [state, id, reportReason, reportDetails]);

  const handleChatSend = useCallback(() => {
    if (!chatInput.trim()) return;
    sendChat(chatInput.trim());
    setChatInput('');
  }, [chatInput, sendChat]);

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">♟</div>
          <p className="text-white/60">Connecting to game...</p>
        </div>
      </div>
    );
  }

  const isMyTurn = state.status === 'playing' && state.turn === state.color;
  const boardOrientation = state.color === 'black' ? 'black' : 'white';
  const opponentClock = state.color === 'white' ? state.clocks.black : state.clocks.white;
  const myClock = state.color === 'white' ? state.clocks.white : state.clocks.black;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex flex-col lg:flex-row gap-6">

        {/* Board area */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold">{state.opponent.username}</p>
              <p className="text-xs text-white/50">{state.opponent.elo} ELO · {state.color === 'white' ? 'Black' : 'White'}</p>
            </div>
            <ChessClock ms={opponentClock} active={state.turn !== state.color && state.status === 'playing'} label="" />
          </div>

          <div className="rounded-xl overflow-hidden shadow-2xl">
            <Chessboard
              id={id}
              position={state.fen}
              onPieceDrop={onPieceDrop}
              boardOrientation={boardOrientation}
              arePiecesDraggable={isMyTurn}
              customBoardStyle={{ borderRadius: '0' }}
              customDarkSquareStyle={{ backgroundColor: theme.dark }}
              customLightSquareStyle={{ backgroundColor: theme.light }}
            />
          </div>

          <div className="flex items-center justify-between mt-3">
            <div>
              <p className="font-semibold">{user?.wallet?.address ? shortAddr(user.wallet.address) : 'You'}</p>
              <p className="text-xs text-white/50">{state.color === 'white' ? 'White' : 'Black'}</p>
            </div>
            <ChessClock ms={myClock} active={isMyTurn} label="" />
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:w-64 flex flex-col gap-3" style={{ minHeight: '520px' }}>

          {/* Game info */}
          <div className="card">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-white/40 text-xs">Pot</div>
                <div className="font-bold text-[#ffd700]">${(state.betAmount * 2).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-white/40 text-xs">Winner gets</div>
                <div className="text-[#4caf50] font-semibold">${(state.betAmount * 2 * 0.975).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-white/40 text-xs">Spectators</div>
                <div>{state.spectatorCount}</div>
              </div>
              <div>
                <div className="text-white/40 text-xs">Turn</div>
                <div className={isMyTurn ? 'text-[#4caf50] font-semibold' : 'text-white/60'}>
                  {state.status === 'spectating' ? 'Spectating' : isMyTurn ? 'Yours' : 'Opponent'}
                </div>
              </div>
            </div>
          </div>

          {/* Move history */}
          <MoveHistory moves={state.moves} />

          {/* Chat */}
          <div className="card p-0 overflow-hidden flex flex-col" style={{ maxHeight: '180px' }}>
            <div className="px-3 py-2 border-b border-white/10 text-xs font-semibold text-white/50">Chat</div>
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 min-h-[80px]">
              {state.chatMessages.length === 0 ? (
                <p className="text-xs text-white/20">No messages yet</p>
              ) : (
                state.chatMessages.map((msg, i) => (
                  <div key={i} className="text-xs">
                    <span className="font-semibold text-[#4caf50]">{msg.sender}: </span>
                    <span className="text-white/80">{msg.text}</span>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="px-2 pb-2 flex gap-1">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleChatSend(); }}
                placeholder="Say something..."
                maxLength={200}
                className="flex-1 bg-black/30 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#4caf50]"
              />
              <button
                onClick={handleChatSend}
                className="px-2 py-1 bg-[#4caf50]/20 hover:bg-[#4caf50]/40 rounded text-xs text-[#4caf50] transition"
              >
                ↵
              </button>
            </div>
          </div>

          {/* Draw offer */}
          {state.drawOffered && state.status === 'playing' && (
            <div className="card border border-[#ffd700]/40">
              <p className="text-sm mb-2">Opponent offered a draw</p>
              <div className="flex gap-2">
                <button onClick={acceptDraw} className="btn-primary flex-1 text-sm py-1.5">Accept</button>
                <button className="btn-secondary flex-1 text-sm py-1.5">Decline</button>
              </div>
            </div>
          )}

          {/* Actions */}
          {state.status === 'playing' && (
            <div className="card space-y-2">
              <button onClick={offerDraw} className="btn-secondary w-full text-sm">Offer Draw</button>
              <button onClick={resign} className="btn-danger w-full text-sm">Resign</button>
            </div>
          )}

          {/* Report opponent */}
          {state.status !== 'spectating' && (
            <button
              onClick={() => setShowReport(true)}
              className="text-xs text-white/25 hover:text-red-400 transition-colors text-center w-full py-1"
            >
              ⚑ Report opponent
            </button>
          )}

          {/* Board theme picker */}
          <div className="card">
            <button
              onClick={() => setShowThemes(!showThemes)}
              className="text-xs text-white/50 hover:text-white w-full text-left"
            >
              🎨 Board theme: {theme.name}
            </button>
            {showThemes && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {BOARD_THEMES.map((t, i) => (
                  <button
                    key={t.name}
                    onClick={() => { setThemeIndex(i); setShowThemes(false); localStorage.setItem('checkmate_board_theme', String(i)); }}
                    title={t.name}
                    className={`w-8 h-8 rounded overflow-hidden border-2 ${i === themeIndex ? 'border-white' : 'border-transparent'}`}
                    style={{ background: `linear-gradient(135deg, ${t.light} 50%, ${t.dark} 50%)` }}
                  />
                ))}
              </div>
            )}
          </div>

          {error && <div className="card border border-red-500/30 text-red-400 text-sm">{error}</div>}
        </div>
      </div>

      {/* Game over */}
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

      {/* Report modal */}
      {showReport && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowReport(false)}>
          <div className="card w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold mb-4">Report Opponent</h3>
            {reportDone ? (
              <p className="text-[#4caf50] text-center py-4">Report submitted. Thank you.</p>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  {REPORT_REASONS.map((r) => (
                    <label key={r.value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="reason"
                        value={r.value}
                        checked={reportReason === r.value}
                        onChange={() => setReportReason(r.value)}
                        className="accent-[#4caf50]"
                      />
                      <span className="text-sm">{r.label}</span>
                    </label>
                  ))}
                </div>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Additional details (optional)"
                  maxLength={500}
                  rows={3}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-[#4caf50] mb-4"
                />
                <div className="flex gap-3">
                  <button onClick={() => setShowReport(false)} className="btn-secondary flex-1">Cancel</button>
                  <button
                    onClick={submitReport}
                    disabled={reportSending}
                    className="btn-danger flex-1"
                  >
                    {reportSending ? 'Sending...' : 'Submit Report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Promotion */}
      {promotionDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="card">
            <p className="text-sm mb-3 text-center">Promote pawn to:</p>
            <div className="flex gap-3">
              {['q', 'r', 'b', 'n'].map((piece) => (
                <button
                  key={piece}
                  onClick={() => { makeMove(promotionDialog.from, promotionDialog.to, piece); setPromotionDialog(null); }}
                  className="btn-secondary text-2xl px-4 py-2"
                >
                  {piece === 'q' ? '♛' : piece === 'r' ? '♜' : piece === 'b' ? '♝' : '♞'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
