// Static board with the real piece set: hero visual on the landing and home screens (no chess engine, no JS).
const START_FEN = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R';

export const BRAND_BOARD = { light: '#E9E4F5', dark: '#8F7CCB' };

export default function BoardPreview({ fen = START_FEN, className = '', light = BRAND_BOARD.light, dark = BRAND_BOARD.dark }:
  { fen?: string; className?: string; light?: string; dark?: string }) {
  const rows = fen.split(' ')[0].split('/');
  const squares: { piece: string | null; light: boolean; key: string }[] = [];
  rows.forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < +ch; i++, f++) squares.push({ piece: null, light: (r + f) % 2 === 0, key: `${r}${f}` });
      } else {
        const code = (ch === ch.toUpperCase() ? 'w' : 'b') + ch.toUpperCase();
        squares.push({ piece: code, light: (r + f) % 2 === 0, key: `${r}${f}` });
        f++;
      }
    }
  });
  return (
    <div className={`grid grid-cols-8 aspect-square w-full rounded-xl overflow-hidden select-none ${className}`}
      style={{ boxShadow: '0 6px 0 rgb(18 17 24)' }}>
      {squares.map((s) => (
        <div key={s.key} style={{ background: s.light ? light : dark }} className="relative">
          {s.piece && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/pieces/chessnut/${s.piece}.svg`} alt="" draggable={false} className="absolute inset-0 w-full h-full" />
          )}
        </div>
      ))}
    </div>
  );
}
