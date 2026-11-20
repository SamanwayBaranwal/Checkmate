'use client';

import { useEffect, useRef } from 'react';

// variant="strip": one horizontal scrolling line (mobile, under the board)
// variant="list": numbered two-column list (desktop side panel)
export default function MoveHistory({ moves, variant = 'list' }: { moves: string[]; variant?: 'list' | 'strip' }) {
  const end = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (variant === 'strip') strip.current?.scrollTo({ left: strip.current.scrollWidth, behavior: 'smooth' });
    else end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [moves.length, variant]);

  const pairs: [string, string | undefined][] = [];
  for (let i = 0; i < moves.length; i += 2) pairs.push([moves[i], moves[i + 1]]);
  const last = moves.length - 1;

  if (variant === 'strip') {
    return (
      <div ref={strip} className="flex items-center gap-1 overflow-x-auto no-scrollbar h-9 text-sm num whitespace-nowrap">
        {pairs.length === 0 && <span className="text-faint text-xs">No moves yet</span>}
        {pairs.map(([w, b], i) => (
          <span key={i} className="flex items-center gap-1 shrink-0">
            <span className="text-faint text-xs">{i + 1}.</span>
            <span className={`px-1.5 py-0.5 rounded ${i * 2 === last ? 'bg-surface-3 text-ink' : 'text-muted'}`}>{w}</span>
            {b && <span className={`px-1.5 py-0.5 rounded ${i * 2 + 1 === last ? 'bg-surface-3 text-ink' : 'text-muted'}`}>{b}</span>}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-y-auto text-sm num max-h-full">
      {pairs.length === 0 ? (
        <p className="text-faint text-xs px-3 py-3">No moves yet</p>
      ) : pairs.map(([w, b], i) => (
        <div key={i} className={`grid grid-cols-[36px_1fr_1fr] px-3 h-8 items-center ${i % 2 ? 'bg-surface-2/40' : ''}`}>
          <span className="text-faint text-xs">{i + 1}.</span>
          <span className={i * 2 === last ? 'text-ink font-semibold' : 'text-muted'}>{w}</span>
          <span className={i * 2 + 1 === last ? 'text-ink font-semibold' : 'text-muted'}>{b ?? ''}</span>
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}
