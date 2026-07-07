'use client';

import { useState, useEffect, useCallback } from 'react';

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

const REASON_COLOR: Record<string, string> = {
  cheating: 'text-red-400 bg-red-500/10 border-red-500/30',
  harassment: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  sandbagging: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  stalling: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  other: 'text-white/40 bg-white/5 border-white/10',
};

function shortAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '—';
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function AdminPage() {
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<'reports' | 'banned' | 'users'>('reports');

  const [stats, setStats] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [banned, setBanned] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [banModal, setBanModal] = useState<{ userId: string; username: string } | null>(null);
  const [banReason, setBanReason] = useState('');
  const [notesModal, setNotesModal] = useState<{ reportId: string; action: 'resolve' | 'dismiss' } | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  const loadStats = useCallback(async (s: string) => {
    const data = await adminFetch('/api/admin/stats', s);
    setStats(data);
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

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await adminFetch('/api/admin/stats', secret);
      setAuthed(true);
      await Promise.all([loadStats(secret), loadReports(secret), loadBanned(secret)]);
    } catch {
      setError('Invalid secret');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authed) return;
    if (tab === 'reports') loadReports(secret);
    else if (tab === 'banned') loadBanned(secret);
    else if (tab === 'users') loadUsers(secret, userQuery);
  }, [tab, authed]);

  const handleResolve = async () => {
    if (!notesModal) return;
    const path = `/api/admin/reports/${notesModal.reportId}/${notesModal.action}`;
    await adminFetch(path, secret, { method: 'POST', body: JSON.stringify({ notes: adminNotes }) });
    setNotesModal(null);
    setAdminNotes('');
    await Promise.all([loadReports(secret), loadStats(secret)]);
  };

  const handleBan = async () => {
    if (!banModal || !banReason.trim()) return;
    await adminFetch(`/api/admin/users/${banModal.userId}/ban`, secret, {
      method: 'POST',
      body: JSON.stringify({ reason: banReason }),
    });
    setBanModal(null);
    setBanReason('');
    await Promise.all([loadReports(secret), loadBanned(secret), loadStats(secret)]);
  };

  const handleUnban = async (userId: string) => {
    await adminFetch(`/api/admin/users/${userId}/unban`, secret, { method: 'POST', body: '{}' });
    await Promise.all([loadBanned(secret), loadStats(secret)]);
  };

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto px-4 py-24">
        <div className="card">
          <h1 className="text-2xl font-bold mb-6">Admin Access</h1>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Admin secret"
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white mb-4 focus:outline-none focus:border-[#81b64c]"
          />
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <button onClick={handleLogin} disabled={loading} className="btn-primary w-full">
            {loading ? 'Checking...' : 'Enter'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        {stats && (
          <div className="flex gap-3">
            {[
              { label: 'Users', value: stats.totalUsers },
              { label: 'Games', value: stats.totalGames },
              { label: 'Open Reports', value: stats.openReports, highlight: stats.openReports > 0 },
              { label: 'Banned', value: stats.bannedUsers },
            ].map((s) => (
              <div key={s.label} className={`card text-center px-4 py-2 ${s.highlight ? 'border-red-500/40' : ''}`}>
                <div className={`text-xl font-bold ${s.highlight ? 'text-red-400' : 'text-[#f0b232]'}`}>{s.value}</div>
                <div className="text-xs text-white/40">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['reports', 'banned', 'users'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition capitalize ${tab === t ? 'bg-[#f0b232] text-black' : 'btn-secondary'}`}>
            {t === 'reports' ? `Open Reports${stats?.openReports > 0 ? ` (${stats.openReports})` : ''}` :
             t === 'banned' ? `Banned Users` : 'User Search'}
          </button>
        ))}
      </div>

      {/* Reports tab */}
      {tab === 'reports' && (
        <div className="space-y-3">
          {reports.length === 0 ? (
            <div className="card text-center py-12 text-white/40">No open reports</div>
          ) : reports.map((r) => (
            <div key={r.id} className="card border border-white/10 space-y-3">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold uppercase tracking-wider border px-2 py-0.5 rounded-full ${REASON_COLOR[r.reason] ?? REASON_COLOR.other}`}>
                      {r.reason}
                    </span>
                    <span className="text-xs text-white/40">{timeAgo(r.created_at)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-white/50">Reporter: </span>
                    <span className="font-semibold">{r.reporter_username || shortAddr(r.reporter_wallet)}</span>
                    <span className="text-white/30 mx-2">→</span>
                    <span className="text-white/50">Reported: </span>
                    <span className="font-semibold">{r.reported_username || shortAddr(r.reported_wallet)}</span>
                    <span className="text-white/40 text-xs ml-2">({r.reported_elo} ELO)</span>
                  </div>
                  {r.details && (
                    <p className="text-sm text-white/60 bg-white/5 rounded px-3 py-2 max-w-lg">{r.details}</p>
                  )}
                  {r.banned_at && (
                    <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                      Already banned
                    </span>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap shrink-0">
                  {!r.banned_at && (
                    <button
                      onClick={() => setBanModal({ userId: r.reported_id, username: r.reported_username || shortAddr(r.reported_wallet) })}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition"
                    >
                      Ban User
                    </button>
                  )}
                  <button
                    onClick={() => { setNotesModal({ reportId: r.id, action: 'resolve' }); setAdminNotes(''); }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-[#81b64c]/20 border border-[#81b64c]/30 text-[#81b64c] hover:bg-[#81b64c]/30 transition"
                  >
                    Resolve
                  </button>
                  <button
                    onClick={() => { setNotesModal({ reportId: r.id, action: 'dismiss' }); setAdminNotes(''); }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 transition"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Banned tab */}
      {tab === 'banned' && (
        <div className="card overflow-hidden p-0">
          {banned.length === 0 ? (
            <p className="text-center py-12 text-white/40">No banned users</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-white/40 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Banned</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {banned.map((u) => (
                  <tr key={u.id} className="border-b border-white/5">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{u.username || shortAddr(u.wallet)}</div>
                      <div className="text-xs text-white/40 font-mono">{shortAddr(u.wallet)}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-white/60">{timeAgo(u.banned_at)}</td>
                    <td className="px-4 py-3 text-sm text-red-400">{u.ban_reason}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleUnban(u.id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-[#81b64c]/20 border border-[#81b64c]/30 text-[#81b64c] hover:bg-[#81b64c]/30 transition"
                      >
                        Unban
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* User search tab */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadUsers(secret, userQuery)}
              placeholder="Search by username or wallet…"
              className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#81b64c]"
            />
            <button onClick={() => loadUsers(secret, userQuery)} className="btn-primary text-sm">Search</button>
          </div>
          <div className="card overflow-hidden p-0">
            {users.length === 0 ? (
              <p className="text-center py-12 text-white/40">No results</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 text-xs uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">User</th>
                    <th className="px-4 py-3 text-right">ELO</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                    <th className="px-4 py-3 text-right">Games</th>
                    <th className="px-4 py-3 text-right">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className={`border-b border-white/5 ${u.banned_at ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{u.username || shortAddr(u.wallet)}</div>
                        <div className="text-xs text-white/40 font-mono">{shortAddr(u.wallet)}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-[#f0b232] font-bold">{u.elo}</td>
                      <td className="px-4 py-3 text-right text-[#81b64c]">${u.usdc_balance.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-white/60">{u.games_played}</td>
                      <td className="px-4 py-3 text-right">
                        {u.banned_at ? (
                          <span className="text-xs text-red-400">Banned</span>
                        ) : (
                          <span className="text-xs text-[#81b64c]">Active</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {u.banned_at ? (
                          <button onClick={() => handleUnban(u.id)}
                            className="text-xs px-3 py-1 rounded-lg bg-[#81b64c]/20 border border-[#81b64c]/30 text-[#81b64c] hover:bg-[#81b64c]/30 transition">
                            Unban
                          </button>
                        ) : (
                          <button onClick={() => setBanModal({ userId: u.id, username: u.username || shortAddr(u.wallet) })}
                            className="text-xs px-3 py-1 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition">
                            Ban
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Ban modal */}
      {banModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setBanModal(null)}>
          <div className="card w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4 text-red-400">Ban {banModal.username}?</h2>
            <p className="text-sm text-white/60 mb-4">This will immediately block their account from logging in.</p>
            <textarea
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Ban reason (required)…"
              rows={3}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white mb-4 focus:outline-none focus:border-red-500 resize-none"
            />
            <div className="flex gap-3">
              <button onClick={() => setBanModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleBan} disabled={!banReason.trim()}
                className="flex-1 px-4 py-2 rounded-xl bg-red-500/80 hover:bg-red-500 text-white font-semibold text-sm transition disabled:opacity-40">
                Confirm Ban
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve/dismiss notes modal */}
      {notesModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setNotesModal(null)}>
          <div className="card w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4 capitalize">{notesModal.action} Report</h2>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Admin notes (optional)…"
              rows={3}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white mb-4 focus:outline-none focus:border-[#81b64c] resize-none"
            />
            <div className="flex gap-3">
              <button onClick={() => setNotesModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleResolve} className="btn-primary flex-1">
                Confirm {notesModal.action}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
