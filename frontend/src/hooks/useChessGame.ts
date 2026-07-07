'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { getSocket } from '@/lib/socket';

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
  winner?: string | null;
  eloChange?: number;
  newBalance?: number;
  streakBonus?: number;
  streak?: number;
  drawOffered?: boolean;
  spectatorCount: number;
  moves: string[];
  lastMove?: { from: string; to: string };
  chatMessages: ChatMessage[];
}

export function useChessGame(gameId: string, token?: string) {
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState('');
  const [rematchState, setRematchState] = useState<'idle' | 'offered' | 'incoming'>('idle');
  const [rematchGameId, setRematchGameId] = useState<string | null>(null);
  const tickRef = useRef<NodeJS.Timeout | null>(null);
  // Snapshot of confirmed state to revert to if an optimistic move is rejected
  const confirmedRef = useRef<{ fen: string; turn: 'white' | 'black'; clocks: ClockState; moves: string[] } | null>(null);

  // Live clock tick
  useEffect(() => {
    if (!state || state.status !== 'playing') return;

    tickRef.current = setInterval(() => {
      setState((prev) => {
        if (!prev || prev.status !== 'playing') return prev;
        const turn = prev.turn;
        const newClocks = { ...prev.clocks, [turn]: Math.max(0, prev.clocks[turn] - 100) };
        return { ...prev, clocks: newClocks };
      });
    }, 100);

    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [state?.status, state?.turn]);

  useEffect(() => {
    const socket = getSocket(token);

    const resync = () => {
      if (token) {
        socket.emit('rejoin_game', { gameId });
      } else {
        socket.emit('spectate', { gameId });
      }
    };

    resync();
    // Re-sync on every (re)connect — socket.id changes on reconnect, so the
    // server needs us to re-register or our moves would be rejected.
    socket.on('connect', resync);

    socket.on('game_state', (data: any) => {
      if (data.gameId !== gameId) return;
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
        chatMessages: [],
      });
    });

    socket.on('match_found', (data: any) => {
      if (data.gameId !== gameId) return;
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
    });

    socket.on('spectate_joined', (data: any) => {
      if (data.gameId !== gameId) return;
      setState((prev) => ({
        ...(prev ?? {}),
        gameId,
        fen: data.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        turn: data.turn || 'white',
        color: 'white',
        clocks: data.clocks || { white: 300000, black: 300000 },
        opponent: { username: 'Spectating', elo: 0 },
        betAmount: 0,
        status: 'spectating',
        spectatorCount: 0,
        drawOffered: false,
        moves: [],
        chatMessages: [],
      } as GameState));
    });

    socket.on('move_made', (data: any) => {
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
    });

    socket.on('game_over', (data: any) => {
      if (tickRef.current) clearInterval(tickRef.current);
      setState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: 'over',
          result: data.result,
          winner: data.winner,
          eloChange: data.eloChange,
          newBalance: data.newBalance,
          streakBonus: data.streakBonus,
          streak: data.streak,
        };
      });
    });

    socket.on('draw_offered', () => {
      setState((prev) => prev ? { ...prev, drawOffered: true } : prev);
    });

    socket.on('spectator_count', ({ count }: { count: number }) => {
      setState((prev) => prev ? { ...prev, spectatorCount: count } : prev);
    });

    socket.on('move_error', ({ reason }: { reason: string }) => {
      // Revert optimistic move if the server rejected it
      if (confirmedRef.current) {
        const snap = confirmedRef.current;
        setState((prev) => prev ? { ...prev, fen: snap.fen, turn: snap.turn, clocks: snap.clocks, moves: snap.moves } : prev);
      }
      setError(reason);
      setTimeout(() => setError(''), 3000);
    });

    socket.on('rematch_offered', () => {
      setRematchState('incoming');
    });

    socket.on('rematch_ready', (data: any) => {
      setRematchGameId(data.gameId);
    });

    socket.on('chat_message', (msg: ChatMessage) => {
      setState((prev) => prev ? { ...prev, chatMessages: [...prev.chatMessages, msg] } : prev);
    });

    return () => {
      socket.off('connect', resync);
      socket.off('game_state');
      socket.off('match_found');
      socket.off('spectate_joined');
      socket.off('move_made');
      socket.off('game_over');
      socket.off('draw_offered');
      socket.off('spectator_count');
      socket.off('move_error');
      socket.off('rematch_offered');
      socket.off('rematch_ready');
      socket.off('chat_message');
    };
  }, [gameId, token]);

  const makeMove = useCallback((from: string, to: string, promotion?: string) => {
    const socket = getSocket(token);
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
        return { ...prev, fen: chess.fen(), turn: nextTurn, moves: [...prev.moves, mv.san], lastMove: { from, to } };
      } catch {
        return prev;
      }
    });
    socket.emit('move', { gameId, from, to, promotion });
  }, [gameId, token]);

  const resign = useCallback(() => {
    const socket = getSocket(token);
    socket.emit('resign', { gameId });
  }, [gameId, token]);

  const offerDraw = useCallback(() => {
    const socket = getSocket(token);
    socket.emit('offer_draw', { gameId });
  }, [gameId, token]);

  const acceptDraw = useCallback(() => {
    const socket = getSocket(token);
    socket.emit('accept_draw', { gameId });
  }, [gameId, token]);

  const offerRematch = useCallback(() => {
    const socket = getSocket(token);
    socket.emit('offer_rematch', { gameId });
    setRematchState('offered');
  }, [gameId, token]);

  const acceptRematch = useCallback(() => {
    const socket = getSocket(token);
    socket.emit('accept_rematch', { gameId });
  }, [gameId, token]);

  const sendChat = useCallback((text: string) => {
    if (!text.trim()) return;
    const socket = getSocket(token);
    socket.emit('chat_message', { gameId, text });
  }, [gameId, token]);

  return { state, error, makeMove, resign, offerDraw, acceptDraw, offerRematch, acceptRematch, rematchState, rematchGameId, sendChat };
}
