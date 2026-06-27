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
  const isLow = ms < 30000; // under 30s
  return (
    <div
      className={`rounded-lg px-4 py-2 text-center transition-all ${
        active
          ? isLow
            ? 'bg-red-600 text-white'
            : 'bg-[#4caf50] text-white'
          : 'bg-white/10 text-white/60'
      }`}
    >
      <div className="text-xs mb-0.5 font-medium">{label}</div>
      <div className="text-2xl font-mono font-bold">{formatMs(ms)}</div>
    </div>
  );
}
