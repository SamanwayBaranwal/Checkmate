// ELO brand: "Knight's Move". The mark is the knight's L path on board squares (three up, one across),
// with the landing square marked. In the wordmark the same L is the L of ELO.
const BRAND = '#5DB43C';
const TILE = BRAND;
const MARK = '#FFFFFF';
const LAND = '#181715';

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 104 104" fill="none" aria-hidden="true">
      <rect width="104" height="104" rx="26" fill={TILE} />
      <rect x="24" y="16" width="22" height="22" rx="5" fill={MARK} />
      <rect x="24" y="41" width="22" height="22" rx="5" fill={MARK} fillOpacity=".72" />
      <rect x="24" y="66" width="22" height="22" rx="5" fill={MARK} fillOpacity=".72" />
      <rect x="49" y="66" width="22" height="22" rx="5" fill={LAND} />
      <circle cx="60" cy="77" r="4.5" fill={BRAND} />
    </svg>
  );
}

export function Wordmark({ height = 22, color = 'currentColor' }: { height?: number; color?: string }) {
  return (
    <svg height={height} viewBox="0 12 250 76" fill="none" aria-label="ELO" role="img" style={{ fontFamily: 'var(--font-sans)' }}>
      <text x="0" y="84" fontWeight="900" fontSize="96" fill={color}>E</text>
      <g transform="translate(68 16)">
        <rect x="0" y="0" width="22" height="21.3" rx="3.5" fill={color} />
        <rect x="0" y="23.3" width="22" height="21.3" rx="3.5" fill={color} />
        <rect x="0" y="46.6" width="22" height="21.4" rx="3.5" fill={color} />
        <rect x="24" y="46.6" width="22" height="21.4" rx="3.5" fill={BRAND} />
      </g>
      <text x="122" y="84" fontWeight="900" fontSize="96" fill={color}>O</text>
    </svg>
  );
}

export function Logo({ size = 30, showWord = true }: { size?: number; showWord?: boolean }) {
  return (
    <span className="flex items-center gap-2.5 text-ink">
      <LogoMark size={size} />
      {showWord && <Wordmark height={Math.round(size * 0.62)} />}
    </span>
  );
}
