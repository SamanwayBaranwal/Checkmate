// Chess-made icons. Silhouettes are cut from the real piece set (Chessnut, Apache 2.0) with a CSS mask,
// so they are solid, chunky and take any colour, instead of generic thin line icons.

type Piece = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';

export function PieceGlyph({ piece, size = 22, className = '' }: { piece: Piece; size?: number; className?: string }) {
  const url = `url(/pieces/chessnut/b${piece}.svg)`;
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 ${className}`}
      style={{
        width: size, height: size, backgroundColor: 'currentColor',
        WebkitMask: `${url} center / contain no-repeat`, mask: `${url} center / contain no-repeat`,
      }}
    />
  );
}

/** Full-colour piece (white or black set), for tiles and avatars. */
export function PieceImg({ piece, side = 'w', size = 32, className = '' }: { piece: Piece; side?: 'w' | 'b'; size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/pieces/chessnut/${side}${piece}.svg`} alt="" width={size} height={size} draggable={false} className={`select-none ${className}`} />;
}

export function CoinGlyph({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <ellipse cx="12" cy="17" rx="8.5" ry="3.6" fill="currentColor" opacity=".55" />
      <ellipse cx="12" cy="13" rx="8.5" ry="3.6" fill="currentColor" opacity=".8" />
      <ellipse cx="12" cy="9" rx="8.5" ry="3.6" fill="currentColor" />
      <ellipse cx="12" cy="9" rx="4.2" ry="1.5" fill="rgb(var(--c-base))" opacity=".35" />
    </svg>
  );
}

/** Four rounded squares: the board squares from the logo. Used for "More". */
export function SquaresGlyph({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="2.2" fill="currentColor" />
      <rect x="13" y="3" width="8" height="8" rx="2.2" fill="currentColor" opacity=".55" />
      <rect x="3" y="13" width="8" height="8" rx="2.2" fill="currentColor" opacity=".55" />
      <rect x="13" y="13" width="8" height="8" rx="2.2" fill="currentColor" />
    </svg>
  );
}

export function GearGlyph({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="currentColor" fillRule="evenodd"
        d="M10.3 2h3.4l.5 2.6c.6.2 1.2.5 1.7.9l2.5-.9 1.7 2.9-2 1.7c.1.6.1 1.2 0 1.8l2 1.7-1.7 2.9-2.5-.9c-.5.4-1.1.7-1.7.9l-.5 2.6h-3.4l-.5-2.6c-.6-.2-1.2-.5-1.7-.9l-2.5.9-1.7-2.9 2-1.7a6 6 0 0 1 0-1.8l-2-1.7 1.7-2.9 2.5.9c.5-.4 1.1-.7 1.7-.9zM12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"
        transform="translate(0 1)" />
    </svg>
  );
}

// Player avatar: their own piece on their own colour, stable per player (no generic letter circles).
const AVATAR_COLORS = ['#5DB43C', '#E8833A', '#3D8FD6', '#D9534F', '#2EA597', '#C9A227', '#8A63D2', '#D2558F'];
const LIGHT_TILES = new Set<string>();
const AVATAR_PIECES: Piece[] = ['N', 'K', 'Q', 'R', 'B', 'P'];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

export function PieceAvatar({ seed, size = 40, className = '' }: { seed: string; size?: number; className?: string }) {
  const h = hash(seed || 'player');
  const bg = AVATAR_COLORS[h % AVATAR_COLORS.length];
  const piece = AVATAR_PIECES[Math.floor(h / 7) % AVATAR_PIECES.length];
  return (
    <span className={`inline-flex items-center justify-center shrink-0 rounded-[30%] ${className}`}
      style={{ width: size, height: size, background: bg, boxShadow: `inset 0 -${Math.max(2, Math.round(size / 14))}px 0 rgb(0 0 0 / .18)` }}>
      <PieceImg piece={piece} side={LIGHT_TILES.has(bg) ? 'b' : 'w'} size={Math.round(size * 0.78)} />
    </span>
  );
}
