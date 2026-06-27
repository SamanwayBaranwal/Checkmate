'use client';

import { useEffect, useRef } from 'react';

interface Props {
  moves: string[]; // SAN notation list e.g. ['e4', 'e5', 'Nf3', ...]
}

export default function MoveHistory({ moves }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [moves.length]);

  const pairs: [string, string | undefined][] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push([moves[i], moves[i + 1]]);
  }

  return (
    <div className="card flex-1 overflow-hidden flex flex-col min-h-0">
      <h3 className="font-semibold text-sm text-white/60 uppercase tracking-wide mb-2">Moves</h3>
      <div className="overflow-y-auto flex-1 text-sm font-mono">
        {pairs.length === 0 ? (
          <p className="text-white/30 text-xs">No moves yet</p>
        ) : (
          <table className="w-full">
            <tbody>
              {pairs.map(([white, black], i) => (
                <tr key={i} className="hover:bg-white/5">
                  <td className="text-white/30 pr-2 w-6 text-right select-none">{i + 1}.</td>
                  <td className="pr-3 py-0.5 text-white">{white}</td>
                  <td className="py-0.5 text-white/80">{black ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
