'use client';

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

interface Props {
  ms: number;
  active: boolean;
  label: string;
}

export default function ChessClock({ ms, active, label }: Props) {
  const isLow = ms < 30000;   // under 30s
  const isCritical = ms < 10000 && active; // under 10s on your clock
  return (
    <div
      className={`rounded-lg px-4 py-2 text-center transition-all tabular-nums ${
        active
          ? isLow
            ? 'bg-red-600 text-white'
            : 'bg-[#57b06a] text-white shadow-lg'
          : 'bg-white/[0.06] text-white/55'
      } ${isCritical ? 'animate-pulse-dot' : ''}`}
    >
      {label && <div className="text-xs mb-0.5 font-medium opacity-80">{label}</div>}
      <div className="text-2xl font-mono font-bold leading-none">{formatMs(ms)}</div>
    </div>
  );
}
