'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const ENTRY_FEES = [1, 5, 10, 25] as const;
const MAX_PLAYERS = [4, 8, 16] as const;

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-[#46a883]/20 text-[#46a883] border-[#46a883]/30',
    active: 'bg-[#f0b232]/20 text-[#f0b232] border-[#f0b232]/30',
    completed: 'bg-white/10 text-white/40 border-white/10',
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${styles[status] ?? styles.completed}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function SeasonalBanner({ t }: { t: any }) {
  return (
    <Link href={`/tournaments/${t.id}`}>
      <div className="relative overflow-hidden rounded-2xl border border-[#f0b232]/40 bg-gradient-to-br from-[#302e2b] via-[#262421] to-[#302e2b] p-5 cursor-pointer hover:border-[#f0b232]/70 transition-all group">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_#f0b232,_transparent)]" />
        <div className="flex items-start justify-between relative">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-widest text-[#f0b232] bg-[#f0b232]/10 border border-[#f0b232]/30 px-2 py-0.5 rounded-full">
                🏆 Seasonal — {t.season_name}
              </span>
              <StatusBadge status={t.status} />
            </div>
            <h3 className="text-xl font-bold mt-2">{t.name}</h3>
            <p className="text-sm text-white/50 mt-1">
              {t.player_count}/{t.max_players} players · {t.total_rounds} rounds
            </p>
          </div>
          <div className="text-right shrink-0 ml-4">
            <div className="text-3xl font-bold text-[#f0b232]">${parseFloat(t.prize_pool).toFixed(0)}</div>
            <div className="text-xs text-white/50">Prize pool</div>
            {parseFloat(t.season_bonus) > 0 && (
              <div className="text-xs text-[#f0b232]/70 mt-0.5">+${parseFloat(t.season_bonus).toFixed(0)} platform bonus</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 mt-4 text-sm relative">
          <span className="text-white/60">Entry: <span className="text-white font-semibold">${t.entry_fee}</span></span>
          <span className="text-[#46a883] font-semibold group-hover:underline">Join now →</span>
        </div>
      </div>
    </Link>
  );
}

export default function TournamentsPage() {
  const { authenticated } = usePrivy();
  const router = useRouter();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [entryFee, setEntryFee] = useState<number>(5);
  const [maxPlayers, setMaxPlayers] = useState<number>(8);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const load = () => {
    api.tournaments.list()
      .then(setTournaments)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) { setCreateError('Enter a tournament name'); return; }
    setCreating(true);
    setCreateError('');
    try {
      const t = await api.tournaments.create({ name: name.trim(), entryFee, maxPlayers });
      router.push(`/tournaments/${t.id}`);
    } catch (err: any) {
      let msg = 'Failed to create';
      try { const p = JSON.parse(err?.message || ''); if (p.error) msg = p.error; } catch {}
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Tournaments</h1>
          <p className="text-white/50 text-sm mt-1">Single-elimination. Winner takes the pot.</p>
        </div>
        {authenticated && (
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            + Create
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-white/40">Loading...</div>
      ) : tournaments.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">🏆</div>
          <p className="text-white/50 mb-4">No tournaments yet. Be the first to create one!</p>
          {authenticated && (
            <button onClick={() => setShowCreate(true)} className="btn-primary">Create Tournament</button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Seasonal tournaments — featured */}
          {tournaments.filter((t) => t.is_seasonal).length > 0 && (
            <div className="space-y-3">
              {tournaments.filter((t) => t.is_seasonal).map((t) => (
                <SeasonalBanner key={t.id} t={t} />
              ))}
            </div>
          )}

          {/* Regular tournaments */}
          {tournaments.filter((t) => !t.is_seasonal).length > 0 && (
            <div className="space-y-3">
              {tournaments.filter((t) => t.is_seasonal).length > 0 && (
                <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider">Community Tournaments</h2>
              )}
              {tournaments.filter((t) => !t.is_seasonal).map((t) => (
                <Link key={t.id} href={`/tournaments/${t.id}`}>
                  <div className="card hover:border-white/20 border border-white/10 cursor-pointer transition-all hover:bg-white/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <StatusBadge status={t.status} />
                        <div>
                          <p className="font-bold">{t.name}</p>
                          <p className="text-xs text-white/50 mt-0.5">by {t.creator_name || 'Unknown'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 sm:gap-6 text-sm">
                        <div className="text-center">
                          <div className="font-bold text-[#f0b232]">${t.entry_fee}</div>
                          <div className="text-xs text-white/40">Entry</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-[#46a883]">${parseFloat(t.prize_pool).toFixed(2)}</div>
                          <div className="text-xs text-white/40">Prize pool</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold">{t.player_count}/{t.max_players}</div>
                          <div className="text-xs text-white/40">Players</div>
                        </div>
                        <div className="text-center hidden sm:block">
                          <div className="font-bold">{t.total_rounds}</div>
                          <div className="text-xs text-white/40">Rounds</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="card w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-5">Create Tournament</h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Tournament Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Saturday Blitz"
                  maxLength={40}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#46a883]"
                />
              </div>

              <div>
                <label className="text-xs text-white/50 mb-2 block">Entry Fee</label>
                <div className="grid grid-cols-4 gap-2">
                  {ENTRY_FEES.map((f) => (
                    <button key={f} onClick={() => setEntryFee(f)}
                      className={`rounded-xl p-3 border-2 text-center transition-all ${entryFee === f ? 'border-[#46a883] bg-[#46a883]/20' : 'border-white/10 hover:border-white/30'}`}>
                      <div className="font-bold">${f}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-2 block">Max Players</label>
                <div className="grid grid-cols-3 gap-2">
                  {MAX_PLAYERS.map((n) => (
                    <button key={n} onClick={() => setMaxPlayers(n)}
                      className={`rounded-xl p-3 border-2 text-center transition-all ${maxPlayers === n ? 'border-[#46a883] bg-[#46a883]/20' : 'border-white/10 hover:border-white/30'}`}>
                      <div className="font-bold">{n}</div>
                      <div className="text-xs text-white/50">{Math.log2(n)} rounds</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white/5 rounded-lg p-3 text-sm">
                <div className="flex justify-between text-white/60">
                  <span>Prize pool (full)</span>
                  <span className="text-[#f0b232] font-bold">${(entryFee * maxPlayers).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-white/60 mt-1">
                  <span>Winner takes</span>
                  <span className="text-[#46a883] font-bold">${(entryFee * maxPlayers * 0.975).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {createError && <p className="text-red-400 text-sm mt-3">{createError}</p>}

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleCreate} disabled={creating} className="btn-primary flex-1 disabled:opacity-50">
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
