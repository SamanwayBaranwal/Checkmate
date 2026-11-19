'use client';

import { useCallback, useEffect, useState } from 'react';

type Fetcher = (path: string, secret: string, init?: RequestInit) => Promise<any>;

const STATUS_STYLE: Record<string, string> = {
  review: 'text-red-400 bg-red-500/10 border-red-500/30',
  watch: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  clean: 'text-[#46a883] bg-[#46a883]/10 border-[#46a883]/30',
};

const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—');
const pct = (v: number) => `${Math.round(v * 100)}%`;
const sevColor = (s: number) => (s >= 60 ? 'text-red-400' : s >= 35 ? 'text-yellow-400' : 'text-white/60');

export default function FairPlayTab({ secret, adminFetch }: { secret: string; adminFetch: Fetcher }) {
  const [filter, setFilter] = useState<'review' | 'watch' | 'all'>('review');
  const [data, setData] = useState<{ engineReady: boolean | null; pendingAnalysis: number; players: any[] } | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setData(await adminFetch(`/api/admin/fairplay?status=${filter}`, secret));
  }, [filter, secret, adminFetch]);

  useEffect(() => { load().catch((e) => setMsg(e.message)); }, [load]);

  const open = async (userId: string) => {
    setMsg('');
    setDetail(await adminFetch(`/api/admin/fairplay/${userId}`, secret));
  };

  const confirmCheat = async () => {
    if (!detail) return;
    const name = detail.user.username || short(detail.user.wallet);
    if (!window.confirm(`Confirm ${name} as a cheater?\n\nThis BANS the account, refunds every opponent they beat in paid games in the last 30 days, and takes that money back from their balance.`)) return;
    setBusy(true);
    try {
      const r = await adminFetch(`/api/admin/fairplay/${detail.user.id}/confirm`, secret, { method: 'POST', body: JSON.stringify({ days: 30 }) });
      const s = r.summary;
      setMsg(`Banned. Refunded $${s.refunded} to ${s.victims} opponent(s) over ${s.gamesRefunded} game(s); clawed back $${s.clawedBack}${s.platformCovered > 0 ? `, platform covered $${s.platformCovered}` : ''}.`);
      setDetail(null); await load();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  const clear = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/fairplay/${detail.user.id}/clear`, secret, { method: 'POST', body: '{}' });
      setMsg('Player cleared. Older games no longer count against them; withdrawals are open again.');
      setDetail(null); await load();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="card text-sm text-white/60 space-y-1">
        <p>
          Every finished game is checked by <b className="text-white">Stockfish</b>: how often moves are the engine&apos;s
          move or within 10 centipawns of it, centipawn loss vs. the player&apos;s rating, tab-switching while thinking, and how regular the
          move times are. One game is never proof: players move to <b className="text-red-400">Review</b> (withdrawals
          paused) only after several suspicious games.
        </p>
        {data && (
          <p className="text-xs">
            Engine: {data.engineReady === false ? <span className="text-red-400">NOT INSTALLED (set STOCKFISH_PATH)</span>
              : data.engineReady ? <span className="text-[#46a883]">running</span> : 'starts with the first game'}
            {' · '}Games waiting for analysis: {data.pendingAnalysis}
          </p>
        )}
      </div>

      {msg && <div className="card border border-[#f0b232]/40 text-sm">{msg}</div>}

      <div className="flex gap-2">
        {(['review', 'watch', 'all'] as const).map((f) => (
          <button key={f} onClick={() => { setFilter(f); setDetail(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filter === f ? 'bg-[#f0b232] text-black' : 'btn-secondary'}`}>
            {f === 'review' ? 'In review (withdrawals held)' : f === 'watch' ? 'Watch list' : 'All flagged'}
          </button>
        ))}
      </div>

      {!detail && (
        <div className="card overflow-hidden p-0">
          {!data || data.players.length === 0 ? (
            <p className="text-center py-12 text-white/40">Nobody here. Good.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/40 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Player</th><th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Score</th><th className="px-4 py-3">Flagged games (last 10)</th>
                  <th className="px-4 py-3">ELO</th><th className="px-4 py-3">Balance</th><th />
                </tr>
              </thead>
              <tbody>
                {data.players.map((p) => (
                  <tr key={p.id} className="border-b border-white/5">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{p.username || short(p.wallet)}</div>
                      <div className="text-xs text-white/40">{(p.fairplay_reasons || []).join('; ')}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs border px-2 py-0.5 rounded-full uppercase ${STATUS_STYLE[p.fairplay_status]}`}>{p.fairplay_status}</span>
                    </td>
                    <td className={`px-4 py-3 text-center font-bold ${sevColor(p.fairplay_score)}`}>{p.fairplay_score}</td>
                    <td className="px-4 py-3 text-center">{p.fairplay_flagged_games}</td>
                    <td className="px-4 py-3 text-center">{p.elo}</td>
                    <td className="px-4 py-3 text-center">${p.usdc_balance.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => open(p.id)} className="text-xs px-3 py-1.5 rounded-lg btn-secondary">Evidence</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {detail && (
        <div className="space-y-3">
          <div className="card flex items-start justify-between flex-wrap gap-3">
            <div>
              <button onClick={() => setDetail(null)} className="text-xs text-white/40 mb-2">← back</button>
              <div className="text-lg font-bold">{detail.user.username || short(detail.user.wallet)}</div>
              <div className="text-xs text-white/50">
                ELO {detail.user.elo} · {detail.user.games_played} games · balance ${detail.user.usdc_balance.toFixed(2)} ·
                status <span className="uppercase">{detail.user.fairplay_status}</span> · score {detail.user.fairplay_score}
                {detail.user.banned_at && <span className="text-red-400"> · BANNED</span>}
              </div>
              {(detail.user.fairplay_reasons || []).length > 0 && (
                <div className="text-xs text-red-300 mt-1">Across recent games: {detail.user.fairplay_reasons.join('; ')}</div>
              )}
            </div>
            {!detail.user.banned_at && (
              <div className="flex gap-2">
                <button disabled={busy} onClick={confirmCheat}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400">
                  Confirm cheater (ban + refund victims)
                </button>
                <button disabled={busy} onClick={clear}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[#46a883]/20 border border-[#46a883]/30 text-[#46a883]">
                  Clear (not cheating)
                </button>
              </div>
            )}
          </div>

          <div className="card overflow-x-auto p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 text-white/40 uppercase tracking-wide">
                  <th className="px-3 py-2 text-left">When</th><th className="px-3 py-2">Opponent</th><th className="px-3 py-2">Result</th>
                  <th className="px-3 py-2">Suspicion</th><th className="px-3 py-2">Near-engine moves</th><th className="px-3 py-2">ACPL</th>
                  <th className="px-3 py-2">Accuracy</th><th className="px-3 py-2">Tab switches</th><th className="px-3 py-2">Move-time CV</th>
                  <th className="px-3 py-2 text-left">Why</th><th />
                </tr>
              </thead>
              <tbody>
                {detail.games.map((g: any) => (
                  <tr key={g.game_id} className="border-b border-white/5 align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(g.completed_at).toLocaleString()}</td>
                    <td className="px-3 py-2 text-center">{g.opponent_username || short(g.opponent_wallet)} ({g.opponent_elo})</td>
                    <td className="px-3 py-2 text-center">{g.won ? 'Won' : g.winner ? 'Lost' : 'Draw'} · ${g.bet_amount}</td>
                    <td className={`px-3 py-2 text-center font-bold ${sevColor(g.suspicion)}`}>{g.suspicion}</td>
                    <td className="px-3 py-2 text-center">{g.engine_match}%</td>
                    <td className="px-3 py-2 text-center">{g.acpl}</td>
                    <td className="px-3 py-2 text-center">{g.accuracy}%</td>
                    <td className="px-3 py-2 text-center">{pct(g.blur_rate)}</td>
                    <td className="px-3 py-2 text-center">{g.move_time_cv ?? '—'}</td>
                    <td className="px-3 py-2 text-white/60">{(g.reasons || []).join('; ') || '—'}</td>
                    <td className="px-3 py-2"><a className="underline text-white/50" href={`/replay/${g.game_id}`} target="_blank">replay</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {detail.games.length === 0 && <p className="text-center py-8 text-white/40">No analysed games yet.</p>}
          </div>

          {detail.reports.length > 0 && (
            <div className="card text-xs space-y-1">
              <div className="font-semibold text-white/70">Reports from other players</div>
              {detail.reports.map((r: any) => (
                <div key={r.id} className="text-white/60">{r.reason} · {r.status}{r.details ? ` · “${r.details}”` : ''}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
