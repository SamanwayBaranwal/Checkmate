export type PieceTheme = 'classic' | 'unicode' | 'minimal' | 'neon';

const PIECES: Record<string, { unicode: string; letter: string; isWhite: boolean }> = {
  wK: { unicode: '♔', letter: 'K', isWhite: true },
  wQ: { unicode: '♕', letter: 'Q', isWhite: true },
  wR: { unicode: '♖', letter: 'R', isWhite: true },
  wB: { unicode: '♗', letter: 'B', isWhite: true },
  wN: { unicode: '♘', letter: 'N', isWhite: true },
  wP: { unicode: '♙', letter: 'P', isWhite: true },
  bK: { unicode: '♚', letter: 'K', isWhite: false },
  bQ: { unicode: '♛', letter: 'Q', isWhite: false },
  bR: { unicode: '♜', letter: 'R', isWhite: false },
  bB: { unicode: '♝', letter: 'B', isWhite: false },
  bN: { unicode: '♞', letter: 'N', isWhite: false },
  bP: { unicode: '♟', letter: 'P', isWhite: false },
};

type PieceFn = (props: { squareWidth: number }) => JSX.Element;

export function getCustomPieces(theme: PieceTheme): Record<string, PieceFn> | undefined {
  if (theme === 'classic') return undefined;

  const result: Record<string, PieceFn> = {};

  for (const [code, { unicode, letter, isWhite }] of Object.entries(PIECES)) {
    if (theme === 'unicode') {
      result[code] = ({ squareWidth }) => (
        <div style={{
          width: squareWidth, height: squareWidth,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: squareWidth * 0.72, lineHeight: 1, userSelect: 'none',
          paddingBottom: squareWidth * 0.04,
        }}>{unicode}</div>
      );
    } else if (theme === 'minimal') {
      result[code] = ({ squareWidth }) => (
        <div style={{
          width: squareWidth, height: squareWidth,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: squareWidth * 0.50, fontWeight: 900,
          fontFamily: 'system-ui, sans-serif',
          color: isWhite ? '#ffffff' : '#1a1a1a',
          textShadow: isWhite
            ? '0 1px 4px rgba(0,0,0,0.9), 0 0 0 1px rgba(0,0,0,0.4)'
            : '0 1px 2px rgba(255,255,255,0.25)',
          userSelect: 'none',
        }}>{letter}</div>
      );
    } else if (theme === 'neon') {
      result[code] = ({ squareWidth }) => (
        <div style={{
          width: squareWidth, height: squareWidth,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: squareWidth * 0.70, lineHeight: 1, userSelect: 'none',
          paddingBottom: squareWidth * 0.04,
          filter: isWhite
            ? 'drop-shadow(0 0 5px #4caf50) drop-shadow(0 0 10px #4caf5060)'
            : 'drop-shadow(0 0 5px #ffd700) drop-shadow(0 0 10px #ffd70060)',
        }}>{unicode}</div>
      );
    }
  }

  return result;
}

export const PIECE_THEMES: { key: PieceTheme; label: string; preview: string }[] = [
  { key: 'classic', label: 'Classic', preview: '🔲' },
  { key: 'unicode', label: 'Unicode', preview: '♛' },
  { key: 'minimal', label: 'Minimal', preview: 'Q' },
  { key: 'neon',    label: 'Neon',    preview: '✦' },
];
