'use client';

// ELO brand mark — dark rounded tile with a white pawn and a green base bar,
// matching the brand kit. Recreated in SVG so it stays crisp and theme-aware.
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="#191c1a" />
      {/* green base bar */}
      <path d="M6 40c0-1 .5-2 2-2h32c1.5 0 2 1 2 2v.5c0 3-2.5 5.5-5.5 5.5H11.5C8.5 46 6 43.5 6 40.5V40Z" fill="#57b06a" />
      {/* pawn */}
      <path
        d="M24 9a4.2 4.2 0 0 0-2.3 7.7c-1.6 1-2.7 2.8-2.7 4.8 0 1.9 1 3.6 2.5 4.6-.6 3-2.2 6.6-4 8.9-.5.6-.1 1.5.7 1.5h11.6c.8 0 1.2-.9.7-1.5-1.8-2.3-3.4-5.9-4-8.9 1.5-1 2.5-2.7 2.5-4.6 0-2-1.1-3.8-2.7-4.8A4.2 4.2 0 0 0 24 9Z"
        fill="#ffffff"
      />
    </svg>
  );
}

export function Logo({ size = 32, showWord = true }: { size?: number; showWord?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} />
      {showWord && (
        <span className="text-xl font-extrabold tracking-tight text-white font-display">ELO</span>
      )}
    </div>
  );
}
