import { Chess } from 'chess.js';

export interface MoveResult {
  valid: boolean;
  fen?: string;
  san?: string;
  isGameOver?: boolean;
  result?: 'checkmate' | 'draw' | 'stalemate' | 'insufficient' | 'repetition' | 'fifty';
  winner?: 'white' | 'black' | 'draw';
  error?: string;
}

export function applyMove(
  fen: string,
  from: string,
  to: string,
  promotion?: string
): MoveResult {
  const chess = new Chess(fen);

  try {
    const move = chess.move({ from, to, promotion: promotion as any });
    if (!move) return { valid: false, error: 'Illegal move' };

    let result: MoveResult['result'];
    let winner: MoveResult['winner'];

    if (chess.isGameOver()) {
      if (chess.isCheckmate()) {
        result = 'checkmate';
        winner = chess.turn() === 'w' ? 'black' : 'white'; // the side that just moved wins
      } else if (chess.isDraw()) {
        result = chess.isStalemate()
          ? 'stalemate'
          : chess.isInsufficientMaterial()
          ? 'insufficient'
          : chess.isThreefoldRepetition()
          ? 'repetition'
          : 'fifty';
        winner = 'draw';
      }
    }

    return {
      valid: true,
      fen: chess.fen(),
      san: move.san,
      isGameOver: chess.isGameOver(),
      result,
      winner,
    };
  } catch {
    return { valid: false, error: 'Invalid move' };
  }
}

export function getInitialFen(): string {
  return new Chess().fen();
}
