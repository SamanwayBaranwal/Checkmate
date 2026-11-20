'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { getSocket } from '@/lib/socket';
import { api } from '@/lib/api';

export interface ClockState {
  white: number;
  black: number;
}

export interface ChatMessage {
  userId: string;
  sender: string;
  text: string;
  timestamp: number;
}

export interface GameState {
  gameId: string;
  fen: string;
  turn: 'white' | 'black';
  color: 'white' | 'black';
  clocks: ClockState;
  opponent: { username: string; elo: number };
  betAmount: number;
  status: 'playing' | 'over' | 'spectating';
  result?: string;
  /** Why a draw happened (stalemate, repetition, ...); the server sends result 'draw' plus this */
  reason?: string;
  winner?: string | null;
  /** Watching someone else's game (stays true after the game ends) */
  spectator?: boolean;
  /** Player names for spectators (from the REST game record) */
  players?: { white: { name: string; elo: number }; black: { name: string; elo: number } };
  eloChange?: number;
  newBalance?: number;
  streakBonus?: number;
  streak?: number;
  drawOffered?: boolean;
  /** Changes on every new offer, so an offer after a declined one shows again */
  drawOfferAt?: number;
  spectatorCount: number;
  timeControl?: string;
  moves: string[];
  lastMove?: { from: string; to: string };
  chatMessages: ChatMessage[];
}

/**
 * token: the backend token, undefined when signed out, or null while the session is still loading
 * (so we don't open an anonymous socket first and then replace it).
 */
export function useChessGame(gameId: string, token?: string | null) {
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState('');
  // 'ended' = finished game, 'missing' = no such game. The page shows a way out instead of spinning forever.
  const [unavailable, setUnavailable] = useState<'ended' | 'missing' | null>(null);
  const isPlayerRef = useRef(false);
  const playersRef = useRef<GameState['players']>(undefined);
  const metaRef = useRef<{ betAmount: number; timeControl?: string }>({ betAmount: 0 });
  const [rematchState, setRematchState] = useState<'idle' | 'offered' | 'incoming'>('idle');
  const [rematchGameId, setRematchGameId] = useState<string | null>(null);
  const tickRef = useRef<NodeJS.Timeout | null>(null);
  // Snapshot of confirmed state to revert to if an optimistic move is rejected
  const confirmedRef = useRef<{ fen: string; turn: 'white' | 'black'; clocks: ClockState; moves: string[] } | null>(null);
  // Fair play: did the player leave this tab/window while it was their turn? Sent with each move.
  const blurredRef = useRef(false);
  const myTurnRef = useRef(false);
  myTurnRef.current = !!state && state.status === 'playing' && state.turn === state.color;

  useEffect(() => {
    const onBlur = () => { if (myTurnRef.current) blurredRef.current = true; };
    const onVisibility = () => { if (document.visibilityState === 'hidden') onBlur(); };
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Live clock tick (players and spectators)
  useEffect(() => {
    if (!state || (state.status !== 'playing' && state.status !== 'spectating')) return;

    tickRef.current = setInterval(() => {
      setState((prev) => {
        if (!prev || (prev.status !== 'playing' && prev.status !== 'spectating')) return prev;
        const turn = prev.turn;
        const newClocks = { ...prev.clocks, [turn]: Math.max(0, prev.clocks[turn] - 100) };
        return { ...prev, clocks: newClocks };
      });
    }, 100);

    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [state?.status, state?.turn]);

  useEffect(() => {
    if (token === null) return; // session still loading
    const socket = getSocket(token);
    isPlayerRef.current = false;
    setUnavailable(null);
    let spectateTimer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;

    // REST: is the game still on? Also gives spectators the player names.
    api.games.get(gameId).then((g) => {
      if (!alive) return;
      const name = (u?: string | null, w?: string) => u || (w ? `${w.slice(0, 6)}…${w.slice(-4)}` : 'Player');
      playersRef.current = {
        white: { name: name(g.white_username, g.white_wallet), elo: g.white_elo_before ?? g.white_elo_current ?? 0 },
        black: { name: name(g.black_username, g.black_wallet), elo: g.black_elo_before ?? g.black_elo_current ?? 0 },
      };
      metaRef.current = { betAmount: Number(g.bet_amount) || 0, timeControl: g.time_control || undefined };
      setState((prev) => (prev && prev.spectator ? { ...prev, players: playersRef.current, ...metaRef.current } : prev));
      if (g.status !== 'active') setUnavailable('ended');
    }).catch((e: any) => {
      if (!alive) return;
      if (String(e?.message || '').includes('not found')) setUnavailable('missing');
    });

    const spectate = () => socket.emit('spectate', { gameId });
    const resync = () => {
      if (token) {
        socket.emit('rejoin_game', { gameId });
        // The server ignores rejoin_game from someone who isn't playing this game, so watch it instead.
        if (spectateTimer) clearTimeout(spectateTimer);
        spectateTimer = setTimeout(() => { if (!isPlayerRef.current) spectate(); }, 1500);
      } else {
        spectate();
      }
    };

    resync();
    // Re-sync on every (re)connect — socket.id changes on reconnect, so the
    // server needs us to re-register or our moves would be rejected.
    socket.on('connect', resync);

    // Named handlers so cleanup removes only ours (a bare socket.off('match_found') would also
    // remove the Navbar's global listeners on this shared socket).
    const onGameState = (data: any) => {
      if (data.gameId !== gameId) return;
      isPlayerRef.current = true;
      setState({
        gameId,
        fen: data.fen,
        turn: data.turn,
        color: data.color,
        clocks: data.clocks,
        opponent: data.opponent,
        betAmount: data.betAmount,
        status: 'playing',
        spectatorCount: 0,
        drawOffered: false,
        moves: data.moves || [],
        timeControl: data.timeControl,
        chatMessages: [],
      });
    };

    const onMatchFound = (data: any) => {
      if (data.gameId !== gameId) return;
      isPlayerRef.current = true;
      setState({
        gameId,
        fen: data.fen,
        turn: 'white',
        color: data.color,
        clocks: data.clocks,
        opponent: data.opponent,
        betAmount: data.betAmount,
        status: 'playing',
        spectatorCount: 0,
        drawOffered: false,
        moves: [],
        chatMessages: [],
      });
    };

    const onSpectateJoined = (data: any) => {
      if (data.gameId !== gameId || isPlayerRef.current) return;
      setState((prev) => ({
        ...(prev ?? {}),
        gameId,
        fen: data.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        turn: data.turn || 'white',
        color: 'white',
        clocks: data.clocks || { white: 300000, black: 300000 },
        opponent: { username: 'Spectating', elo: 0 },
        ...metaRef.current,
        status: 'spectating',
        spectator: true,
        players: playersRef.current,
        spectatorCount: prev?.spectatorCount ?? 0,
        drawOffered: false,
        moves: data.moves || [],
        chatMessages: prev?.chatMessages ?? [],
      } as GameState));
    };

    const onMoveMade = (data: any) => {
      setState((prev) => {
        if (!prev || prev.gameId !== gameId) return prev;
        // Server is authoritative. If we already applied this optimistically
        // (same fen), this is a no-op reconcile; otherwise it's the opponent's move.
        const moves = data.san && prev.fen !== data.fen ? [...prev.moves, data.san] : prev.moves;
        const lastMove = data.from && data.to ? { from: data.from, to: data.to } : prev.lastMove;
        const next = { ...prev, fen: data.fen, turn: data.turn, clocks: data.clocks, moves, lastMove };
        confirmedRef.current = { fen: data.fen, turn: data.turn, clocks: data.clocks, moves };
        return next;
      });
    };

    const onGameOver = (data: any) => {
      if (tickRef.current) clearInterval(tickRef.current);
      setState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: 'over',
          result: data.result,
          reason: data.reason,
          winner: data.winner,
          eloChange: data.eloChange,
          newBalance: data.newBalance,
          streakBonus: data.streakBonus,
          streak: data.streak,
        };
      });
    };

    const onDrawOffered = () => {
      setState((prev) => prev ? { ...prev, drawOffered: true, drawOfferAt: Date.now() } : prev);
    };

    const onSpectatorCount = ({ count }: { count: number }) => {
      setState((prev) => prev ? { ...prev, spectatorCount: count } : prev);
    };

    const onMoveError = ({ reason }: { reason: string }) => {
      // Revert optimistic move if the server rejected it
      if (confirmedRef.current) {
        const snap = confirmedRef.current;
        setState((prev) => prev ? { ...prev, fen: snap.fen, turn: snap.turn, clocks: snap.clocks, moves: snap.moves } : prev);
      }
      setError(reason);
      setTimeout(() => setError(''), 3000);
    };

    const onRematchOffered = () => setRematchState('incoming');
    const onRematchReady = (data: any) => setRematchGameId(data.gameId);
    const onRematchError = ({ reason }: { reason: string }) => {
      setRematchState('idle');
      setError(reason || 'Rematch not available');
      setTimeout(() => setError(''), 4000);
    };

    const onChat = (msg: ChatMessage) => {
      setState((prev) => prev ? { ...prev, chatMessages: [...prev.chatMessages, msg] } : prev);
    };

    socket.on('game_state', onGameState);
    socket.on('match_found', onMatchFound);
    socket.on('spectate_joined', onSpectateJoined);
    socket.on('move_made', onMoveMade);
    socket.on('game_over', onGameOver);
    socket.on('draw_offered', onDrawOffered);
    socket.on('spectator_count', onSpectatorCount);
    socket.on('move_error', onMoveError);
    socket.on('rematch_offered', onRematchOffered);
    socket.on('rematch_ready', onRematchReady);
    socket.on('rematch_error', onRematchError);
    socket.on('chat_message', onChat);

    return () => {
      alive = false;
      if (spectateTimer) clearTimeout(spectateTimer);
      socket.off('connect', resync);
      socket.off('game_state', onGameState);
      socket.off('match_found', onMatchFound);
      socket.off('spectate_joined', onSpectateJoined);
      socket.off('move_made', onMoveMade);
      socket.off('game_over', onGameOver);
      socket.off('draw_offered', onDrawOffered);
      socket.off('spectator_count', onSpectatorCount);
      socket.off('move_error', onMoveError);
      socket.off('rematch_offered', onRematchOffered);
      socket.off('rematch_ready', onRematchReady);
      socket.off('rematch_error', onRematchError);
      socket.off('chat_message', onChat);
    };
  }, [gameId, token]);

  const makeMove = useCallback((from: string, to: string, promotion?: string) => {
    const socket = getSocket(token ?? undefined);
    // Optimistic update: apply the move locally & instantly, before the server round-trip.
    setState((prev) => {
      if (!prev || prev.status !== 'playing' || prev.turn !== prev.color) return prev;
      try {
        const chess = new Chess(prev.fen);
        const mv = chess.move({ from, to, promotion: (promotion as any) || 'q' });
        if (!mv) return prev;
        // Snapshot current confirmed state so we can revert on rejection
        confirmedRef.current = { fen: prev.fen, turn: prev.turn, clocks: prev.clocks, moves: prev.moves };
        const nextTurn: 'white' | 'black' = prev.turn === 'white' ? 'black' : 'white';
        // Moving instead of answering a draw offer declines it
        return { ...prev, fen: chess.fen(), turn: nextTurn, moves: [...prev.moves, mv.san], lastMove: { from, to }, drawOffered: false };
      } catch {
        return prev;
      }
    });
    const blurred = blurredRef.current;
    blurredRef.current = false;
    socket.emit('move', { gameId, from, to, promotion, blurred });
  }, [gameId, token]);

  const resign = useCallback(() => {
    const socket = getSocket(token ?? undefined);
    socket.emit('resign', { gameId });
  }, [gameId, token]);

  const offerDraw = useCallback(() => {
    const socket = getSocket(token ?? undefined);
    socket.emit('offer_draw', { gameId });
  }, [gameId, token]);

  const acceptDraw = useCallback(() => {
    const socket = getSocket(token ?? undefined);
    socket.emit('accept_draw', { gameId });
  }, [gameId, token]);

  const offerRematch = useCallback(() => {
    const socket = getSocket(token ?? undefined);
    socket.emit('offer_rematch', { gameId });
    setRematchState('offered');
  }, [gameId, token]);

  const acceptRematch = useCallback(() => {
    const socket = getSocket(token ?? undefined);
    socket.emit('accept_rematch', { gameId });
  }, [gameId, token]);

  const sendChat = useCallback((text: string) => {
    if (!text.trim()) return;
    const socket = getSocket(token ?? undefined);
    socket.emit('chat_message', { gameId, text });
  }, [gameId, token]);

  return { state, error, unavailable, makeMove, resign, offerDraw, acceptDraw, offerRematch, acceptRematch, rematchState, rematchGameId, sendChat };
}
