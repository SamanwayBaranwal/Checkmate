export type PieceTheme = 'chessnut' | 'classic' | 'unicode' | 'minimal' | 'neon';

// Default set: Chessnut by Alexis Luengas, Apache 2.0 (public/pieces/chessnut/NOTICE.txt)
export const DEFAULT_PIECE_THEME: PieceTheme = 'chessnut';

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
  if (theme === 'chessnut') {
    const set: Record<string, PieceFn> = {};
    for (const code of Object.keys(PIECES)) {
      set[code] = ({ squareWidth }) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/pieces/chessnut/${code}.svg`} alt="" draggable={false}
          style={{ width: squareWidth, height: squareWidth, display: 'block', userSelect: 'none' }} />
      );
    }
    return set;
  }

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
            ? 'drop-shadow(0 0 5px #46a883) drop-shadow(0 0 10px #46a88360)'
            : 'drop-shadow(0 0 5px #f0b232) drop-shadow(0 0 10px #f0b23260)',
        }}>{unicode}</div>
      );
    }
  }

  return result;
}

// Shown in settings ('neon' is still rendered for anyone who had it stored, but no longer offered)
export const PIECE_THEMES: { key: PieceTheme; label: string; preview: string }[] = [
  { key: 'chessnut', label: 'Standard', preview: '/pieces/chessnut/wN.svg' },
  { key: 'classic', label: 'Classic', preview: '♞' },
  { key: 'unicode', label: 'Unicode', preview: '♛' },
  { key: 'minimal', label: 'Minimal', preview: 'Q' },
];
