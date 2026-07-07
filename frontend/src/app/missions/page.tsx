'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

function msToCountdown(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
      <div
        className="h-full bg-[#81b64c] rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function formatProgress(value: number, target: number, unit: string) {
  if (unit === '$') {
    return `$${value.toFixed(2)} / $${target.toFixed(2)}`;
  }
  return `${Math.min(Math.floor(value), target)} / ${target} ${unit}`;
}

export default function MissionsPage() {
  const { authenticated, ready } = usePrivy();
  const router = useRouter();
  const [missions, setMissions] = useState<any[]>([]);
  const [msUntilReset, setMsUntilReset] = useState(0);
  const [weekStart, setWeekStart] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ready && !authenticated) { router.push('/'); return; }
  }, [ready, authenticated, router]);

  useEffect(() => {
    if (!authenticated) return;
    api.missions.list().then((data) => {
      setMissions(data.missions);
      setMsUntilReset(data.msUntilReset);
      setWeekStart(data.weekStart);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [authenticated]);

  // Live countdown tick
  useEffect(() => {
    if (!msUntilReset) return;
    const interval = setInterval(() => setMsUntilReset((ms) => Math.max(0, ms - 1000)), 1000);
    return () => clearInterval(interval);
  }, [msUntilReset]);

  const completedCount = missions.filter((m) => m.completed).length;
  const totalReward = missions.reduce((sum, m) => sum + m.reward, 0);
  const earnedReward = missions.filter((m) => m.rewarded).reduce((sum, m) => sum + m.reward, 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Weekly Missions</h1>
          <p className="text-white/50 text-sm mt-1">
            Complete missions to earn bonus USDC — resets every Monday.
          </p>
        </div>
        {msUntilReset > 0 && (
          <div className="text-right shrink-0">
            <div className="text-xs text-white/40 mb-0.5">Resets in</div>
            <div className="text-[#f0b232] font-bold text-lg tabular-nums">
              {msToCountdown(msUntilReset)}
            </div>
          </div>
        )}
      </div>

      {/* Progress summary */}
      {!loading && missions.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-white/60">
              {completedCount} / {missions.length} missions complete
            </span>
            <span className="text-sm font-bold text-[#81b64c]">
              ${earnedReward.toFixed(2)} / ${totalReward.toFixed(2)} earned
            </span>
          </div>
          <ProgressBar value={completedCount} max={missions.length} />
        </div>
      )}

      {/* Mission cards */}
      {loading ? (
        <div className="text-center py-12 text-white/40">Loading missions...</div>
      ) : (
        <div className="space-y-3">
          {missions.map((m) => (
            <div
              key={m.key}
              className={`card border transition-all ${
                m.completed
                  ? 'border-[#81b64c]/40 bg-[#81b64c]/5'
                  : 'border-white/10'
              }`}
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl shrink-0">{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{m.label}</span>
                      {m.completed && (
                        <span className="text-xs bg-[#81b64c]/20 text-[#81b64c] px-2 py-0.5 rounded-full font-semibold">
                          Complete ✓
                        </span>
                      )}
                    </div>
                    <div className={`text-sm font-bold shrink-0 ${m.rewarded ? 'text-[#81b64c]' : 'text-[#f0b232]'}`}>
                      +${m.reward.toFixed(2)}
                    </div>
                  </div>
                  <p className="text-xs text-white/50 mb-3">{m.description}</p>
                  {!m.completed && (
                    <>
                      <ProgressBar value={m.progress} max={m.target} />
                      <div className="text-xs text-white/40 mt-1.5">
                        {formatProgress(m.progress, m.target, m.unit)}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer note */}
      <p className="text-center text-xs text-white/30">
        Week of {weekStart} · Rewards credited instantly on completion
      </p>
    </div>
  );
}
