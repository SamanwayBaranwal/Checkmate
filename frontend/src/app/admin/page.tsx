'use client';

import { useState, useEffect, useCallback } from 'react';
import { Icon } from '@/components/Icons';
import FairPlayTab from './FairPlayTab';
import PayoutsTab, { ConfirmSheet, short, money, timeAgo, PILL_NEGATIVE, PILL_POSITIVE, BTN_POSITIVE } from './PayoutsTab';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function adminFetch(path: string, secret: string, init?: RequestInit) {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': secret,
      ...(init?.headers ?? {}),
    },
  }).then(async (r) => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? 'Request failed');
    return data;
  });
}

type Tab = 'reports' | 'payouts' | 'fairplay' | 'banned' | 'users';
const TABS: Tab[] = ['reports', 'payouts', 'fairplay', 'banned', 'users'];
const TAB_LABEL: Record<Tab, string> = {
  reports: 'Reports', payouts: 'Payouts', fairplay: 'Fair play', banned: 'Banned', users: 'Users',
};

const REASON_LABEL: Record<string, string> = {
  cheating: 'Cheating', harassment: 'Harassment', sandbagging: 'Sandbagging', stalling: 'Stalling', other: 'Other',
};

function Count({ n, tone }: { n: number; tone: 'negative' | 'accent' }) {
  if (!n) return null;
  return (
    <span className={`ml-1.5 inline-flex min-w-[20px] h-5 px-1.5 items-center justify-center rounded-full text-[11px] font-semibold num ${tone === 'negative' ? 'bg-negative/15 text-negative' : 'bg-accent/15 text-accent'}`}>
      {n}
    </span>
  );
}

export default function AdminPage() {
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>('reports');

  const [stats, setStats] = useState<any>(null);
  const [payoutCount, setPayoutCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [reports, setReports] = useState<any[]>([]);
  const [banned, setBanned] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [banModal, setBanModal] = useState<{ userId: string; username: string } | null>(null);
  const [banReason, setBanReason] = useState('');
  const [notesModal, setNotesModal] = useState<{ reportId: string; action: 'resolve' | 'dismiss' } | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  const loadStats = useCallback(async (s: string) => {
    const [st, payouts, review] = await Promise.all([
      adminFetch('/api/admin/stats', s),
      adminFetch('/api/admin/payouts?status=needs_approval', s).catch(() => []),
      adminFetch('/api/admin/fairplay?status=review', s).catch(() => ({ players: [] })),
    ]);
    setStats(st);
    setPayoutCount(Array.isArray(payouts) ? payouts.length : 0);
    setReviewCount(review?.players?.length ?? 0);
  }, []);

  const loadReports = useCallback(async (s: string) => {
    const data = await adminFetch('/api/admin/reports?status=open', s);
    setReports(data);
  }, []);

  const loadBanned = useCallback(async (s: string) => {
    const data = await adminFetch('/api/admin/banned', s);
    setBanned(data);
  }, []);

  const loadUsers = useCallback(async (s: string, q = '') => {
    const data = await adminFetch(`/api/admin/users?q=${encodeURIComponent(q)}`, s);
    setUsers(data);
  }, []);

  const login = useCallback(async (s: string) => {
    setError('');
    setLoading(true);
    try {
      await adminFetch('/api/admin/stats', s);
      setAuthed(true);
      await Promise.all([loadStats(s), loadReports(s), loadBanned(s)]);
    } catch {
      setError('That secret did not work.');
    } finally {
      setLoading(false);
    }
  }, [loadStats, loadReports, loadBanned]);

  const handleLogin = () => login(secret);

  // dev-only: ?secret=…&tab=… auto-login for local previews. Never active in production builds.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const p = new URLSearchParams(window.location.search);
    const t = p.get('tab') as Tab | null;
    if (t && TABS.includes(t)) setTab(t);
    const s = p.get('secret');
    if (s) { setSecret(s); login(s); }
  }, [login]);

  useEffect(() => {
    if (!authed) return;
    if (tab === 'reports') loadReports(secret);
    else if (tab === 'banned') loadBanned(secret);
    else if (tab === 'users') loadUsers(secret, userQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, authed]);

  const handleResolve = async () => {
    if (!notesModal) return;
    setBusy(true);
    try {
      const path = `/api/admin/reports/${notesModal.reportId}/${notesModal.action}`;
      await adminFetch(path, secret, { method: 'POST', body: JSON.stringify({ notes: adminNotes }) });
      setNotesModal(null);
      setAdminNotes('');
      await Promise.all([loadReports(secret), loadStats(secret)]);
    } finally { setBusy(false); }
  };

  const handleBan = async () => {
    if (!banModal || !banReason.trim()) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/users/${banModal.userId}/ban`, secret, {
        method: 'POST',
        body: JSON.stringify({ reason: banReason }),
      });
      setBanModal(null);
      setBanReason('');
      await Promise.all([loadReports(secret), loadBanned(secret), loadStats(secret)]);
      if (tab === 'users') await loadUsers(secret, userQuery);
    } finally { setBusy(false); }
  };

  const handleUnban = async (userId: string) => {
    await adminFetch(`/api/admin/users/${userId}/unban`, secret, { method: 'POST', body: '{}' });
    await Promise.all([loadBanned(secret), loadStats(secret)]);
    if (tab === 'users') await loadUsers(secret, userQuery);
  };

  const refreshCounts = useCallback(() => { loadStats(secret).catch(() => {}); }, [loadStats, secret]);

  // ─── Login ───
  if (!authed) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-10">
        <div className="card w-full max-w-sm p-6 animate-in">
          <div className="w-11 h-11 rounded-xl bg-surface-2 border border-line/[0.08] flex items-center justify-center text-accent mb-5">
            <Icon name="shield" size={20} />
          </div>
          <h1 className="text-xl font-semibold">Admin</h1>
          <p className="text-sm text-muted mt-1 mb-5">Enter the admin secret to continue.</p>
          <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-3">
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Admin secret"
              autoComplete="current-password"
              autoFocus
              className="input h-12"
            />
            {error && <p className="text-sm text-negative">{error}</p>}
            <button type="submit" disabled={loading || !secret} className="btn-primary w-full h-12 text-[15px]">
              {loading ? 'Checking…' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const openReports = stats?.openReports ?? 0;
  const STAT_TILES: { label: string; value: number | string; tone?: string; go?: Tab }[] = [
    { label: 'Payouts waiting', value: payoutCount, tone: payoutCount > 0 ? 'text-accent' : '', go: 'payouts' },
    { label: 'In review', value: reviewCount, tone: reviewCount > 0 ? 'text-negative' : '', go: 'fairplay' },
    { label: 'Open reports', value: openReports, tone: openReports > 0 ? 'text-negative' : '', go: 'reports' },
    { label: 'Users', value: stats?.totalUsers ?? '—', go: 'users' },
    { label: 'Games played', value: stats?.totalGames ?? '—' },
    { label: 'Banned', value: stats?.bannedUsers ?? '—', go: 'banned' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 pt-5 md:pt-8 pb-10 space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="eyebrow mb-1">Admin</div>
          <h1 className="text-2xl md:text-3xl font-semibold">Control room</h1>
        </div>
        <button onClick={() => { setAuthed(false); setSecret(''); setStats(null); }} className="btn-ghost px-3 py-2 text-sm">
          <Icon name="logout" size={16} /> Lock
        </button>
      </div>

      {/* Stats */}
      <section className="grid grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
        {STAT_TILES.map((s) => {
          const inner = (
            <>
              <div className="text-[11px] md:text-xs text-faint leading-tight">{s.label}</div>
              <div className={`text-xl md:text-2xl font-semibold num mt-1 ${s.tone ?? ''}`}>{s.value}</div>
            </>
          );
          return s.go ? (
            <button key={s.label} onClick={() => setTab(s.go!)} className="card card-hover p-3 md:p-4 text-left min-w-0">{inner}</button>
          ) : (
            <div key={s.label} className="card p-3 md:p-4 min-w-0">{inner}</div>
          );
        })}
      </section>

      {/* Tabs */}
      <div className="overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
        <div className="segmented whitespace-nowrap">
          {TABS.map((t) => (
            <button key={t} data-active={tab === t} onClick={() => setTab(t)} className="inline-flex items-center">
              {TAB_LABEL[t]}
              {t === 'reports' && <Count n={openReports} tone="negative" />}
              {t === 'payouts' && <Count n={payoutCount} tone="accent" />}
              {t === 'fairplay' && <Count n={reviewCount} tone="negative" />}
            </button>
          ))}
        </div>
      </div>

      {tab === 'payouts' && <PayoutsTab secret={secret} adminFetch={adminFetch} onChange={refreshCounts} />}
      {tab === 'fairplay' && <FairPlayTab secret={secret} adminFetch={adminFetch} onChange={refreshCounts} />}

      {/* Reports */}
      {tab === 'reports' && (
        <div className="space-y-3">
          {reports.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-sm font-medium">No open reports</p>
              <p className="text-sm text-muted mt-1">Player reports show up here.</p>
            </div>
          ) : reports.map((r) => {
            const reported = r.reported_username || short(r.reported_wallet);
            return (
              <div key={r.id} className="card p-4 md:p-5 space-y-3 animate-in">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={r.reason === 'cheating' ? PILL_NEGATIVE : r.reason === 'harassment' ? 'pill pill-accent' : 'pill'}>
                    {REASON_LABEL[r.reason] ?? r.reason}
                  </span>
                  <span className="text-xs text-faint">{timeAgo(r.created_at)}</span>
                  {r.banned_at && <span className={`${PILL_NEGATIVE} ml-auto`}>Already banned</span>}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm">
                  <div className="min-w-0">
                    <span className="text-faint">Reported </span>
                    <span className="font-semibold">{reported}</span>
                    <span className="text-faint num"> · {r.reported_elo} ELO</span>
                  </div>
                  <div className="min-w-0 text-muted">
                    <span className="text-faint">by </span>{r.reporter_username || short(r.reporter_wallet)}
                  </div>
                  {r.game_id && (
                    <a href={`/replay/${r.game_id}`} target="_blank" rel="noreferrer" className="text-xs text-muted hover:text-ink inline-flex items-center gap-1 sm:ml-auto">
                      Replay game <Icon name="arrow-up-right" size={12} />
                    </a>
                  )}
                </div>
                {r.details && (
                  <p className="text-sm text-muted bg-surface-2 rounded-lg px-3 py-2.5 max-w-2xl">{r.details}</p>
                )}
                <div className="grid grid-cols-3 gap-2 sm:flex sm:justify-end pt-1">
                  <button
                    onClick={() => { setNotesModal({ reportId: r.id, action: 'dismiss' }); setAdminNotes(''); }}
                    className="btn-ghost h-10"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => { setNotesModal({ reportId: r.id, action: 'resolve' }); setAdminNotes(''); }}
                    className="btn-secondary h-10"
                  >
                    Resolve
                  </button>
                  {!r.banned_at && (
                    <button
                      onClick={() => setBanModal({ userId: r.reported_id, username: reported })}
                      className="btn-danger h-10"
                    >
                      Ban
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Banned */}
      {tab === 'banned' && (
        banned.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-sm font-medium">No banned users</p>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <div className="hidden md:grid grid-cols-[minmax(0,1.2fr)_120px_minmax(0,2fr)_110px] gap-4 px-4 py-3 border-b border-line/[0.08]">
              <span className="eyebrow">User</span><span className="eyebrow">Banned</span><span className="eyebrow">Reason</span><span />
            </div>
            <div className="divide-y divide-line/[0.06]">
              {banned.map((u) => {
                const n = u.username || short(u.wallet);
                return (
                  <div key={u.id} className="flex items-start gap-3 px-4 py-3.5 md:grid md:grid-cols-[minmax(0,1.2fr)_120px_minmax(0,2fr)_110px] md:gap-4 md:items-center">
                    <div className="min-w-0 flex-1 md:flex md:items-center md:gap-3">
                      <span className="avatar w-9 h-9 text-sm hidden md:inline-flex">{n[0]?.toUpperCase()}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{n}</div>
                        <div className="text-xs text-faint num truncate">{u.username ? `${short(u.wallet)} · ` : ''}{u.elo} ELO</div>
                        <div className="md:hidden text-xs text-negative mt-1.5 break-words">{u.ban_reason}</div>
                        <div className="md:hidden text-xs text-faint mt-1">Banned {timeAgo(u.banned_at)}</div>
                      </div>
                    </div>
                    <div className="hidden md:block text-sm text-muted">{timeAgo(u.banned_at)}</div>
                    <div className="hidden md:block text-sm text-negative break-words">{u.ban_reason}</div>
                    <div className="shrink-0 md:text-right">
                      <button onClick={() => handleUnban(u.id)} className={`${BTN_POSITIVE} h-9 py-0 px-3 text-xs`}>Unban</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* Users */}
      {tab === 'users' && (
        <div className="space-y-3">
          <form onSubmit={(e) => { e.preventDefault(); loadUsers(secret, userQuery); }} className="flex gap-2">
            <div className="relative flex-1">
              <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
              <input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Username or wallet"
                className="input h-11 pl-10"
              />
            </div>
            <button type="submit" className="btn-primary h-11 px-5">Search</button>
          </form>

          {users.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-sm font-medium">No results</p>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <div className="hidden md:grid grid-cols-[minmax(0,1fr)_80px_110px_80px_90px_90px] gap-4 px-4 py-3 border-b border-line/[0.08]">
                <span className="eyebrow">User</span>
                <span className="eyebrow text-right">ELO</span>
                <span className="eyebrow text-right">Balance</span>
                <span className="eyebrow text-right">Games</span>
                <span className="eyebrow text-right">Status</span>
                <span />
              </div>
              <div className="divide-y divide-line/[0.06]">
                {users.map((u) => {
                  const n = u.username || short(u.wallet);
                  return (
                    <div key={u.id} className="flex items-center gap-3 px-4 py-3 md:grid md:grid-cols-[minmax(0,1fr)_80px_110px_80px_90px_90px] md:gap-4">
                      <div className="min-w-0 flex-1 flex items-center gap-3">
                        <span className={`avatar w-9 h-9 text-sm ${u.banned_at ? 'opacity-50' : ''}`}>{n[0]?.toUpperCase()}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-sm font-medium truncate ${u.banned_at ? 'text-muted' : ''}`}>{n}</span>
                            {u.banned_at && <span className={`${PILL_NEGATIVE} md:hidden`}>Banned</span>}
                          </div>
                          {u.username && <div className="text-xs text-faint num truncate">{short(u.wallet)}</div>}
                          <div className="md:hidden text-xs text-faint num truncate">
                            {u.elo} ELO · {money(u.usdc_balance)} · {u.games_played} {u.games_played === 1 ? 'game' : 'games'}
                          </div>
                        </div>
                      </div>
                      <div className="hidden md:block text-sm text-right num">{u.elo}</div>
                      <div className="hidden md:block text-sm text-right num">{money(u.usdc_balance)}</div>
                      <div className="hidden md:block text-sm text-right num text-muted">{u.games_played}</div>
                      <div className="hidden md:block text-right">
                        {u.banned_at ? <span className={PILL_NEGATIVE}>Banned</span> : <span className={PILL_POSITIVE}>Active</span>}
                      </div>
                      <div className="shrink-0 md:text-right">
                        {u.banned_at ? (
                          <button onClick={() => handleUnban(u.id)} className={`${BTN_POSITIVE} h-9 py-0 px-3 text-xs`}>Unban</button>
                        ) : (
                          <button onClick={() => setBanModal({ userId: u.id, username: n })} className="btn-secondary h-9 py-0 px-3 text-xs text-negative">Ban</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ban sheet */}
      {banModal && (
        <ConfirmSheet
          title={`Ban ${banModal.username}?`}
          confirmLabel="Ban account"
          busy={busy}
          disabled={!banReason.trim()}
          onCancel={() => setBanModal(null)}
          onConfirm={handleBan}
        >
          <p>This blocks the account from logging in right away and resolves their open reports.</p>
          <textarea
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            placeholder="Reason (required)"
            rows={3}
            autoFocus
            className="input resize-none"
          />
        </ConfirmSheet>
      )}

      {/* Resolve / dismiss sheet */}
      {notesModal && (
        <ConfirmSheet
          title={notesModal.action === 'resolve' ? 'Resolve report' : 'Dismiss report'}
          confirmLabel={notesModal.action === 'resolve' ? 'Resolve' : 'Dismiss'}
          tone="primary"
          busy={busy}
          onCancel={() => setNotesModal(null)}
          onConfirm={handleResolve}
        >
          <p>{notesModal.action === 'resolve' ? 'Mark this report as handled.' : 'Close this report without action.'}</p>
          <textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={3}
            className="input resize-none"
          />
        </ConfirmSheet>
      )}
    </div>
  );
}
