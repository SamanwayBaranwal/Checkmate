'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/Icons';
import {
  type Fetcher, short, money, sevColor, StatusPill, ConfirmSheet, Toast, PILL_NEGATIVE, BTN_POSITIVE,
} from './PayoutsTab';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const SIGNAL_LABEL: Record<string, string> = {
  device: 'Same device',
  fingerprint: 'Same browser',
  ip: 'Same network',
  withdraw_address: 'Same payout address',
};

const FILTERS = [
  { value: 'review', label: 'In review' },
  { value: 'watch', label: 'Watch list' },
  { value: 'all', label: 'All flagged' },
] as const;
type Filter = (typeof FILTERS)[number]['value'];

type LinkedAccount = {
  id: string; username: string | null; wallet: string; banned: boolean; fairplayStatus: string | null;
  shared: ('device' | 'fingerprint' | 'ip' | 'withdraw_address')[];
};

function Stat({ label, value, tone = '' }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2.5 min-w-0">
      <div className="text-[11px] text-faint truncate">{label}</div>
      <div className={`text-base font-semibold num mt-0.5 truncate ${tone}`}>{value}</div>
    </div>
  );
}

export default function FairPlayTab({ secret, adminFetch, onChange }: { secret: string; adminFetch: Fetcher; onChange?: () => void }) {
  const [filter, setFilter] = useState<Filter>(() => {
    // dev-only: ?filter=watch|all picks the list (for local screenshots)
    if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
      const f = new URLSearchParams(window.location.search).get('filter');
      if (f === 'watch' || f === 'all') return f;
    }
    return 'review';
  });
  const [data, setData] = useState<{ engineReady: boolean | null; pendingAnalysis: number; players: any[] } | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState<'cheat' | 'clear' | null>(null);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setData(await adminFetch(`/api/admin/fairplay?status=${filter}`, secret));
  }, [filter, secret, adminFetch]);

  useEffect(() => { load().catch((e) => setMsg(e.message)); }, [load]);

  const open = useCallback(async (userId: string) => {
    setMsg('');
    try {
      setDetail(await adminFetch(`/api/admin/fairplay/${userId}`, secret));
      if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
    } catch (e: any) { setMsg(e.message); }
  }, [adminFetch, secret]);

  // dev-only: ?fp=<userId> opens that player's evidence directly (for local screenshots)
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const id = new URLSearchParams(window.location.search).get('fp');
    if (id) open(id);
  }, [open]);

  const confirmCheat = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const r = await adminFetch(`/api/admin/fairplay/${detail.user.id}/confirm`, secret, { method: 'POST', body: JSON.stringify({ days: 30 }) });
      const s = r.summary;
      setMsg(`Banned. Refunded $${s.refunded} to ${s.victims} opponent(s) over ${s.gamesRefunded} game(s); clawed back $${s.clawedBack}${s.platformCovered > 0 ? `, platform covered $${s.platformCovered}` : ''}.`);
      setConfirm(null); setDetail(null); onChange?.(); await load();
    } catch (e: any) { setMsg(e.message); setConfirm(null); } finally { setBusy(false); }
  };

  const clear = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/fairplay/${detail.user.id}/clear`, secret, { method: 'POST', body: '{}' });
      setToast('Player cleared. Older games no longer count against them; withdrawals are open again.');
      setTimeout(() => setToast(''), 3500);
      setConfirm(null); setDetail(null); onChange?.(); await load();
    } catch (e: any) { setMsg(e.message); setConfirm(null); } finally { setBusy(false); }
  };

  const u = detail?.user;
  const name = u ? u.username || short(u.wallet) : '';
  const linked: LinkedAccount[] = detail?.linkedAccounts ?? [];

  return (
    <div className="space-y-4">
      {msg && (
        <div className="card border-accent/30 text-sm flex items-start gap-3">
          <Icon name="shield" size={16} className="text-accent shrink-0 mt-0.5" />
          <p className="flex-1">{msg}</p>
          <button onClick={() => setMsg('')} className="btn-ghost p-1 -m-1" aria-label="Dismiss"><Icon name="x" size={14} /></button>
        </div>
      )}

      {!detail && (
        <>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
              <div className="segmented whitespace-nowrap">
                {FILTERS.map((f) => (
                  <button key={f.value} data-active={filter === f.value} onClick={() => setFilter(f.value)}>{f.label}</button>
                ))}
              </div>
            </div>
            {data && (
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className={`w-1.5 h-1.5 rounded-full ${data.engineReady === false ? 'bg-negative' : data.engineReady ? 'bg-positive' : 'bg-faint'}`} />
                {data.engineReady === false ? <span className="text-negative">Engine not installed (set STOCKFISH_PATH)</span>
                  : data.engineReady ? 'Engine running' : 'Engine starts with the first game'}
                <span className="text-faint">·</span>
                <span className="num">{data.pendingAnalysis} waiting for analysis</span>
              </div>
            )}
          </div>

          <p className="text-sm text-muted max-w-3xl">
            {filter === 'review'
              ? 'Withdrawals are paused for these players. '
              : filter === 'watch' ? 'Some suspicious games, not enough to pause withdrawals. ' : ''}
            Stockfish checks every finished game: engine-move match, centipawn loss for their rating, tab switching while
            thinking, and move-time regularity. One game is never proof.
          </p>

          {!data ? (
            <div className="card text-center py-12 text-sm text-faint">Loading…</div>
          ) : data.players.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-sm font-medium">Nobody here</p>
              <p className="text-sm text-muted mt-1">No players match this filter right now.</p>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden divide-y divide-line/[0.06]">
              {data.players.map((p) => (
                <button key={p.id} onClick={() => open(p.id)}
                  className="w-full text-left flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2 transition-colors">
                  <div className="w-11 shrink-0 text-center">
                    <div className={`text-xl font-semibold num leading-none ${sevColor(p.fairplay_score)}`}>{p.fairplay_score}</div>
                    <div className="text-[10px] text-faint mt-1">score</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{p.username || short(p.wallet)}</span>
                      <StatusPill status={p.fairplay_status} />
                    </div>
                    <div className="text-xs text-faint num mt-1">
                      {p.fairplay_flagged_games} of last 10 flagged · {p.elo} ELO · {money(p.usdc_balance)}
                    </div>
                    {(p.fairplay_reasons || []).length > 0 && (
                      <div className="text-xs text-muted mt-1 line-clamp-2">{p.fairplay_reasons.join('; ')}</div>
                    )}
                  </div>
                  <span className="hidden sm:inline text-xs text-muted">Evidence</span>
                  <Icon name="chevron-right" size={16} className="text-faint shrink-0" />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {detail && u && (
        <div className="space-y-4 animate-in">
          <button onClick={() => setDetail(null)} className="btn-ghost -ml-3 px-3 py-1.5">
            <Icon name="chevron-left" size={16} /> All players
          </button>

          {/* Player header */}
          <section className="card p-4 md:p-5 space-y-4">
            <div className="flex items-start gap-3">
              <span className="avatar w-11 h-11 text-base">{name[0]?.toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-semibold truncate">{name}</h2>
                  <StatusPill status={u.fairplay_status} />
                  {u.banned_at && <span className={PILL_NEGATIVE}>Banned</span>}
                </div>
                <div className="text-xs text-faint num mt-0.5">
                  {u.username ? `${short(u.wallet)} · ` : ''}{u.elo} ELO · {u.games_played} {u.games_played === 1 ? 'game' : 'games'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label="Score" value={u.fairplay_score} tone={sevColor(u.fairplay_score)} />
              <Stat label="Locked winnings" value={money(detail.locked)} tone={Number(detail.locked) > 0 ? 'text-accent' : ''} />
              <Stat label="Balance" value={money(u.usdc_balance)} />
              <Stat label="Flagged (last 10)" value={u.fairplay_flagged_games ?? 0} />
            </div>

            {(u.fairplay_reasons || []).length > 0 && (
              <div className="rounded-lg bg-negative/[0.06] border border-negative/20 px-3 py-2.5 text-sm">
                <div className="eyebrow !text-negative mb-1">Across recent games</div>
                <p className="text-ink/90">{u.fairplay_reasons.join('; ')}</p>
              </div>
            )}

            {!u.banned_at && (
              <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                <button disabled={busy} onClick={() => setConfirm('clear')} className={`${BTN_POSITIVE} h-11`}>
                  <Icon name="check" size={16} /> Clear
                </button>
                <button disabled={busy} onClick={() => setConfirm('cheat')} className="btn-danger h-11">
                  Confirm cheater
                </button>
              </div>
            )}
          </section>

          {/* Linked accounts */}
          <section className="card p-0 overflow-hidden">
            <div className="px-4 h-11 flex items-center justify-between border-b border-line/[0.06]">
              <span className="eyebrow">Linked accounts</span>
              <span className="text-xs text-faint num">{linked.length}</span>
            </div>
            {linked.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted">No other account shares a device, browser, network or payout address.</p>
            ) : (
              <div className="divide-y divide-line/[0.06]">
                {linked.map((a) => {
                  const an = a.username || short(a.wallet);
                  return (
                    <button key={a.id} onClick={() => open(a.id)}
                      className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors">
                      <span className="avatar w-9 h-9 text-sm">{an[0]?.toUpperCase()}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium truncate">{an}</span>
                          {a.username && <span className="text-xs text-faint num hidden sm:inline">{short(a.wallet)}</span>}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {a.banned && <span className={PILL_NEGATIVE}>Banned</span>}
                          {a.fairplayStatus && a.fairplayStatus !== 'clean' && <StatusPill status={a.fairplayStatus} />}
                          {a.shared.map((s) => <span key={s} className="pill">{SIGNAL_LABEL[s] ?? s}</span>)}
                        </div>
                      </div>
                      <Icon name="chevron-right" size={16} className="text-faint shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Games: cards on mobile, table on desktop */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">Analysed games</h3>
              <span className="text-xs text-faint num">{detail.games.length}</span>
            </div>

            {detail.games.length === 0 ? (
              <div className="card text-center py-10 text-sm text-muted">No analysed games yet.</div>
            ) : (
              <>
                <div className="md:hidden space-y-2">
                  {detail.games.map((g: any) => (
                    <div key={g.game_id} className="card space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-11 shrink-0 text-center">
                          <div className={`text-xl font-semibold num leading-none ${sevColor(g.suspicion)}`}>{g.suspicion}</div>
                          <div className="text-[10px] text-faint mt-1">suspicion</div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">
                            vs {g.opponent_username || short(g.opponent_wallet)} <span className="text-faint num">({g.opponent_elo})</span>
                          </div>
                          <div className="text-xs text-muted num mt-0.5">
                            <span className={g.won ? 'text-positive' : g.winner ? 'text-negative' : ''}>{g.won ? 'Won' : g.winner ? 'Lost' : 'Draw'}</span>
                            {' · '}{money(g.bet_amount)} · {when(g.completed_at)}
                          </div>
                        </div>
                        <a href={`/replay/${g.game_id}`} target="_blank" rel="noreferrer" className="btn-secondary h-8 py-0 px-2.5 text-xs shrink-0">
                          Replay
                        </a>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Stat label="Near-engine" value={`${g.engine_match}%`} />
                        <Stat label="ACPL" value={g.acpl} />
                        <Stat label="Accuracy" value={`${g.accuracy}%`} />
                        <Stat label="Tab switches" value={pct(g.blur_rate)} tone={g.blur_rate >= 0.5 ? 'text-negative' : ''} />
                        <Stat label="Move-time CV" value={g.move_time_cv ?? '—'} />
                      </div>
                      {(g.reasons || []).length > 0 && <p className="text-xs text-muted">{g.reasons.join('; ')}</p>}
                    </div>
                  ))}
                </div>

                <div className="hidden md:block card p-0 overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead>
                      <tr className="border-b border-line/[0.08] text-left">
                        {['When', 'Opponent', 'Result', 'Suspicion', 'Near-engine', 'ACPL', 'Accuracy', 'Tab-outs', 'Time CV', ''].map((h, i) => (
                          <th key={i} className="eyebrow font-semibold px-2.5 py-3 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.games.map((g: any) => (
                        <Fragment key={g.game_id}>
                        <tr className="border-t border-line/[0.06]">
                          <td className="px-2.5 py-3 whitespace-nowrap text-muted num">{when(g.completed_at)}</td>
                          <td className="px-2.5 py-3 whitespace-nowrap">{g.opponent_username || short(g.opponent_wallet)} <span className="text-faint num">({g.opponent_elo})</span></td>
                          <td className="px-2.5 py-3 whitespace-nowrap num">
                            <span className={g.won ? 'text-positive' : g.winner ? 'text-negative' : 'text-muted'}>{g.won ? 'Won' : g.winner ? 'Lost' : 'Draw'}</span>
                            <span className="text-faint"> · {money(g.bet_amount)}</span>
                          </td>
                          <td className={`px-2.5 py-3 font-semibold num ${sevColor(g.suspicion)}`}>{g.suspicion}</td>
                          <td className="px-2.5 py-3 num">{g.engine_match}%</td>
                          <td className="px-2.5 py-3 num">{g.acpl}</td>
                          <td className="px-2.5 py-3 num">{g.accuracy}%</td>
                          <td className={`px-2.5 py-3 num ${g.blur_rate >= 0.5 ? 'text-negative' : ''}`}>{pct(g.blur_rate)}</td>
                          <td className="px-2.5 py-3 num">{g.move_time_cv ?? '—'}</td>
                          <td className="px-2.5 py-3 text-right">
                            <a href={`/replay/${g.game_id}`} target="_blank" rel="noreferrer" className="text-xs text-muted hover:text-ink inline-flex items-center gap-1">
                              Replay <Icon name="arrow-up-right" size={12} />
                            </a>
                          </td>
                        </tr>
                        {(g.reasons || []).length > 0 && (
                          <tr>
                            <td colSpan={10} className="px-2.5 pb-3 -mt-1 text-xs text-muted">{g.reasons.join('; ')}</td>
                          </tr>
                        )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          {detail.reports.length > 0 && (
            <section className="card p-0 overflow-hidden">
              <div className="px-4 h-11 flex items-center border-b border-line/[0.06]">
                <span className="eyebrow">Reports from other players</span>
              </div>
              <div className="divide-y divide-line/[0.06]">
                {detail.reports.map((r: any) => (
                  <div key={r.id} className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={r.reason === 'cheating' ? PILL_NEGATIVE : 'pill'}>{r.reason}</span>
                      <span className="text-xs text-faint capitalize">{r.status}</span>
                    </div>
                    {r.details && <p className="text-muted mt-1.5">&ldquo;{r.details}&rdquo;</p>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {confirm === 'cheat' && detail && (
        <ConfirmSheet title={`Confirm ${name} as a cheater?`} confirmLabel="Ban and refund" busy={busy}
          onCancel={() => setConfirm(null)} onConfirm={confirmCheat}>
          <p>This <span className="text-ink font-medium">bans the account</span>, refunds every opponent they beat in paid games in the last 30 days, and takes that money back from their balance.</p>
          {Number(detail.locked) > 0 && <p className="num">{money(detail.locked)} of locked winnings will not be paid out.</p>}
        </ConfirmSheet>
      )}
      {confirm === 'clear' && detail && (
        <ConfirmSheet title={`Clear ${name}?`} confirmLabel="Clear player" tone="positive" busy={busy}
          onCancel={() => setConfirm(null)} onConfirm={clear}>
          <p>You reviewed the evidence and they are not cheating. Older games stop counting against them and withdrawals open again.</p>
        </ConfirmSheet>
      )}

      <Toast text={toast} />
    </div>
  );
}
