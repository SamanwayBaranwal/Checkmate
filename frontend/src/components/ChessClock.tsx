'use client';

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (ms < 10000) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Running clock = light surface with dark digits (easy to read at a glance), idle = dim.
export default function ChessClock({ ms, active }: { ms: number; active: boolean; label?: string }) {
  const low = ms < 20000;
  return (
    <div
      className={`min-w-[88px] h-10 px-3 rounded-[10px] flex items-center justify-end text-[22px] font-semibold num leading-none transition-colors ${
        active ? (low ? 'bg-negative text-white' : 'bg-ink text-canvas') : 'bg-surface-2 text-muted'
      }`}
    >
      {fmt(ms)}
    </div>
  );
}
