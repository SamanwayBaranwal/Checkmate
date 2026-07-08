'use client';

// Shows the pieces each side has captured + net material advantage.
// Computed purely from the current FEN (no extra state needed).

const START = { p: 8, n: 2, b: 2, r: 2, q: 1 } as const;
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const GLYPH: Record<string, string> = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' };

function countPieces(fen: string) {
  const board = fen.split(' ')[0];
  const white: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  const black: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  for (const ch of board) {
    const lower = ch.toLowerCase();
    if (lower in START) {
      if (ch === ch.toUpperCase()) white[lower]++;
      else black[lower]++;
    }
  }
  return { white, black };
}

// side = the color whose captured pieces we show (i.e. the opponent's losses)
export default function CapturedPieces({ fen, side }: { fen: string; side: 'white' | 'black' }) {
  const { white, black } = countPieces(fen);

  // Pieces captured BY `side` = the opponent's missing pieces
  const opp = side === 'white' ? black : white;
  const own = side === 'white' ? white : black;

  const captured: string[] = [];
  let myMaterial = 0;
  let oppMaterial = 0;
  (Object.keys(START) as (keyof typeof START)[]).forEach((k) => {
    const takenCount = START[k] - opp[k];
    for (let i = 0; i < takenCount; i++) captured.push(k);
    myMaterial += own[k] * VALUE[k];
    oppMaterial += opp[k] * VALUE[k];
  });

  const advantage = myMaterial - oppMaterial;

  return (
    <div className="flex items-center gap-1.5 h-5">
      <div className="flex items-center -space-x-1">
        {captured.map((p, i) => (
          <span key={i} className="text-base leading-none text-white/70" style={{ textShadow: '0 1px 1px rgba(0,0,0,0.4)' }}>
            {GLYPH[p]}
          </span>
        ))}
      </div>
      {advantage > 0 && (
        <span className="text-xs font-bold text-[#57b06a]">+{advantage}</span>
      )}
    </div>
  );
}
