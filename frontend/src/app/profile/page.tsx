'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Icon, type IconName } from '@/components/Icons';

const shortAddr = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
const TEXT = '︎'; // force text (not emoji) presentation for chess glyphs

const AVATARS = [
  { key: 'king_w',   icon: '♔', label: 'King' },
  { key: 'queen_w',  icon: '♕', label: 'Queen' },
  { key: 'rook_w',   icon: '♖', label: 'Rook' },
  { key: 'bishop_w', icon: '♗', label: 'Bishop' },
  { key: 'knight_w', icon: '♘', label: 'Knight' },
  { key: 'pawn_w',   icon: '♙', label: 'Pawn' },
  { key: 'king_b',   icon: '♚', label: 'King (dark)' },
  { key: 'queen_b',  icon: '♛', label: 'Queen (dark)' },
  { key: 'rook_b',   icon: '♜', label: 'Rook (dark)' },
  { key: 'bishop_b', icon: '♝', label: 'Bishop (dark)' },
  { key: 'knight_b', icon: '♞', label: 'Knight (dark)' },
  { key: 'pawn_b',   icon: '♟', label: 'Pawn (dark)' },
];

const NOTIF_TYPES = [
  { key: 'challenge_received', label: 'Challenges received' },
  { key: 'friend_request',     label: 'Friend requests' },
  { key: 'friend_accepted',    label: 'Friend request accepted' },
  { key: 'streak_bonus',       label: 'Streak bonuses' },
];

const TC_LABEL: Record<string, string> = { '3+0': 'Bullet · 3 min', '5+0': 'Blitz · 5 min', '10+0': 'Rapid · 10 min' };

function computeBadges(profile: any): { icon: IconName; label: string; desc: string }[] {
  const badges: { icon: IconName; label: string; desc: string }[] = [];
  const winRate = profile.gamesPlayed ? (profile.gamesWon / profile.gamesPlayed) * 100 : 0;
  if (profile.gamesWon >= 1) badges.push({ icon: 'trophy', label: 'First win', desc: 'Won your first game' });
  if (profile.gamesPlayed >= 10) badges.push({ icon: 'bolt', label: 'Veteran', desc: 'Played 10+ games' });
  if (profile.gamesPlayed >= 50) badges.push({ icon: 'gem', label: 'Grinder', desc: 'Played 50+ games' });
  if (profile.currentStreak >= 3) badges.push({ icon: 'fire', label: 'On fire', desc: `${profile.currentStreak} win streak` });
  if (winRate >= 60 && profile.gamesPlayed >= 10) badges.push({ icon: 'target', label: 'Sharp', desc: '60%+ win rate' });
  if (profile.elo >= 1400) badges.push({ icon: 'star', label: 'Rising star', desc: '1400+ rating' });
  if (profile.elo >= 1600) badges.push({ icon: 'crown', label: 'Elite', desc: '1600+ rating' });
  if (profile.totalEarnings >= 10) badges.push({ icon: 'coin', label: 'Earner', desc: '$10+ in winnings' });
  return badges;
}

function ago(iso?: string) {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function RecentGames({ games, userId, showElo }: { games: any[]; userId: string; showElo?: boolean }) {
  return (
    <section>
      <h2 className="text-base font-semibold mb-3">Recent games</h2>
      {!games?.length ? (
        <div className="card text-center py-10">
          <p className="text-sm font-medium">No games yet</p>
          <p className="text-sm text-muted mt-1">Finished games will show up here.</p>
        </div>
      ) : (
        <div className="card p-0 divide-y divide-line/[0.06] overflow-hidden">
          {games.map((g: any) => {
            const won = g.winner === userId;
            const isDraw = !g.winner;
            const isWhite = g.player_white === userId;
            const opp = (isWhite ? g.black_username : g.white_username) || 'Opponent';
            const tone = isDraw ? 'text-muted' : won ? 'text-positive' : 'text-negative';
            return (
              <Link key={g.id} href={`/replay/${g.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors">
                <span className={`w-9 h-9 shrink-0 rounded-[10px] bg-surface-2 flex items-center justify-center text-xs font-semibold ${tone}`}>
                  {isDraw ? 'D' : won ? 'W' : 'L'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    <span className="text-faint font-normal">vs </span>{opp}
                  </div>
                  <div className="text-xs text-faint mt-0.5 num">
                    <span className={`inline-block w-2 h-2 rounded-sm mr-1.5 align-[1px] ${isWhite ? 'bg-ink' : 'bg-surface-3 border border-line/20'}`} />
                    ${g.bet_amount} stake{g.completed_at ? ` · ${ago(g.completed_at)}` : ''}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-sm font-semibold ${tone}`}>{isDraw ? 'Draw' : won ? 'Won' : 'Lost'}</div>
                  {showElo && g.elo_change != null && (
                    <div className="text-xs text-faint num mt-0.5">{isDraw ? '±0' : won ? `+${g.elo_change}` : `−${g.elo_change}`}</div>
                  )}
                </div>
                <Icon name="chevron-right" size={16} className="text-faint -mr-1 shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function ProfilePage() {
  const { ready, authenticated, token, me, login } = useSession();
  const [profile, setProfile] = useState<any>(null);
  const [pub, setPub] = useState<{ fairPlay?: boolean; joinedAt?: string } | null>(null);
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState('');
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});
  const [savingNotif, setSavingNotif] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.users.me().then((p) => {
      setProfile(p);
      setSelectedAvatar(p.settings?.avatar || '');
      setNotifPrefs(p.settings?.notifPrefs ?? {});
      // Joined date + fair-play status come from the public profile
      api.users.profile(p.id).then(setPub).catch(() => {});
    }).catch(() => {});
  }, [token]);

  const saveUsername = async () => {
    setSaving(true); setMsg(null);
    try {
      await api.users.setUsername(username);
      setMsg({ ok: true, text: 'Username saved' });
      setProfile((p: any) => ({ ...p, username }));
      setUsername('');
    } catch { setMsg({ ok: false, text: 'Username taken or invalid (3–20 characters: letters, numbers, _)' }); }
    finally { setSaving(false); }
  };

  const saveAvatar = async (key: string) => {
    setSelectedAvatar(key);
    setSavingAvatar(true);
    try {
      await api.users.saveSettings({ avatar: key });
      setProfile((p: any) => ({ ...p, settings: { ...(p.settings || {}), avatar: key } }));
    } catch {} finally { setSavingAvatar(false); }
  };

  const toggleNotif = async (key: string, enabled: boolean) => {
    const updated = { ...notifPrefs, [key]: enabled };
    setNotifPrefs(updated);
    setSavingNotif(true);
    try {
      await api.users.saveSettings({ notifPrefs: updated });
      setProfile((p: any) => ({ ...p, settings: { ...(p.settings || {}), notifPrefs: updated } }));
    } catch {} finally { setSavingNotif(false); }
  };

  if (!ready) return <div className="min-h-[60vh]" />;
  if (!authenticated) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-8 pt-16 flex justify-center">
        <div className="card w-full max-w-sm text-center p-6">
          <div className="avatar w-12 h-12 mx-auto text-accent"><Icon name="user" size={20} /></div>
          <h1 className="text-lg font-semibold mt-4">Sign in to see your profile</h1>
          <p className="text-sm text-muted mt-1">Your stats, games and achievements live here.</p>
          <button onClick={login} className="btn-primary w-full h-12 mt-5">Sign in</button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-8 pt-5 md:pt-8 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-surface-2 animate-pulse" />
          <div className="space-y-2"><div className="h-5 w-36 rounded bg-surface-2 animate-pulse" /><div className="h-3 w-24 rounded bg-surface-2 animate-pulse" /></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="card h-[74px] animate-pulse" />)}</div>
      </div>
    );
  }

  const winRate = profile.gamesPlayed ? Math.round((profile.gamesWon / profile.gamesPlayed) * 100) : 0;
  const badges = computeBadges(profile);
  const displayName = profile.username || shortAddr(profile.wallet);
  const piece = AVATARS.find((a) => a.key === selectedAvatar);
  const joined = pub?.joinedAt ? new Date(pub.joinedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : null;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 pt-5 md:pt-8 pb-10 space-y-6">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <span className={`avatar w-16 h-16 md:w-[72px] md:h-[72px] ${piece ? 'text-[32px] leading-none' : 'text-2xl'}`}>
            {piece ? piece.icon + TEXT : profile.username ? profile.username[0].toUpperCase() : <Icon name="user" size={26} className="text-muted" />}
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-semibold truncate">{displayName}</h1>
            <p className="text-sm text-muted mt-0.5 num">
              {profile.elo} rating{joined ? ` · Joined ${joined}` : ''}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {pub?.fairPlay && (
                <span className="pill"><Icon name="shield" size={13} className="text-positive" />Fair play verified</span>
              )}
              {profile.username && <span className="pill num">{shortAddr(profile.wallet)}</span>}
            </div>
          </div>
        </div>
        <Link href={`/profile/${profile.id}`} className="btn-secondary h-11 md:shrink-0">
          View public profile <Icon name="arrow-up-right" size={14} />
        </Link>
      </section>

      {/* Stats */}
      <section className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Rating', value: profile.elo },
            { label: 'Win rate', value: profile.gamesPlayed ? `${winRate}%` : '—' },
            { label: 'Games', value: profile.gamesPlayed ?? 0 },
            { label: 'Total won', value: `$${(profile.totalEarnings || 0).toFixed(2)}`, tone: profile.totalEarnings > 0 ? 'text-positive' : '' },
          ].map((s) => (
            <div key={s.label} className="card py-3.5">
              <div className="text-xs text-faint">{s.label}</div>
              <div className={`text-xl font-semibold num mt-1 ${s.tone ?? ''}`}>{s.value}</div>
            </div>
          ))}
        </div>
        <div className="card p-0 grid grid-cols-3 divide-x divide-line/[0.06]">
          {[
            { label: 'Wins', value: profile.gamesWon ?? 0 },
            { label: 'Streak', value: profile.currentStreak || 0 },
            { label: 'Best streak', value: profile.bestStreak || 0 },
          ].map((s) => (
            <div key={s.label} className="px-4 py-3">
              <div className="text-xs text-faint">{s.label}</div>
              <div className="text-base font-semibold num mt-0.5">{s.value}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <RecentGames games={profile.recentGames} userId={profile.id} showElo />

          {profile.timeControlStats && profile.timeControlStats.length > 0 && (
            <section>
              <h2 className="text-base font-semibold mb-3">By time control</h2>
              <div className="card space-y-4">
                {profile.timeControlStats.map((tc: any) => {
                  const wr = tc.played ? Math.round((tc.won / tc.played) * 100) : 0;
                  return (
                    <div key={tc.timeControl}>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-medium">{TC_LABEL[tc.timeControl] || tc.timeControl}</span>
                        <span className="text-xs text-faint num">
                          {tc.won}W · {tc.played - tc.won}L · <span className="text-ink font-semibold">{wr}%</span>
                        </span>
                      </div>
                      <div className="w-full bg-surface-3 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full bg-positive rounded-full transition-all duration-500" style={{ width: `${wr}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6 min-w-0">
          {badges.length > 0 && (
            <section>
              <h2 className="text-base font-semibold mb-3">Achievements</h2>
              <div className="card p-0 divide-y divide-line/[0.06] overflow-hidden">
                {badges.map((b) => (
                  <div key={b.label} className="flex items-center gap-3 px-4 py-3">
                    <span className="avatar w-9 h-9 text-accent"><Icon name={b.icon} size={16} /></span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{b.label}</div>
                      <div className="text-xs text-faint mt-0.5">{b.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Edit profile */}
          <section>
            <h2 className="text-base font-semibold mb-3">Edit profile</h2>
            <div className="card p-0 divide-y divide-line/[0.06]">
              <div className="p-4">
                <label htmlFor="username" className="eyebrow block mb-2">Username</label>
                <div className="flex gap-2">
                  <input
                    id="username"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setMsg(null); }}
                    placeholder={profile.username || 'Pick a username'}
                    className="input h-11 min-w-0"
                    autoCapitalize="off"
                    autoCorrect="off"
                  />
                  <button onClick={saveUsername} disabled={saving || !username} className="btn-primary h-11 px-5 shrink-0">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
                {msg && <p className={`text-xs mt-2 ${msg.ok ? 'text-positive' : 'text-negative'}`}>{msg.text}</p>}
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="eyebrow">Avatar</span>
                  {savingAvatar && <span className="text-xs text-faint">Saving…</span>}
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {AVATARS.map((a) => (
                    <button
                      key={a.key}
                      onClick={() => saveAvatar(a.key)}
                      title={a.label}
                      aria-label={a.label}
                      aria-pressed={selectedAvatar === a.key}
                      className={`aspect-square rounded-[10px] flex items-center justify-center text-[22px] leading-none transition-colors border ${
                        selectedAvatar === a.key
                          ? 'border-accent/60 bg-accent/10 text-ink'
                          : 'border-line/[0.08] bg-surface-2 text-muted hover:text-ink hover:bg-surface-3'
                      }`}
                    >
                      {a.icon + TEXT}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="eyebrow">Notifications</span>
                  {savingNotif && <span className="text-xs text-faint">Saving…</span>}
                </div>
                <div className="divide-y divide-line/[0.06]">
                  {NOTIF_TYPES.map((n) => {
                    const enabled = notifPrefs[n.key] !== false;
                    return (
                      <div key={n.key} className="flex items-center justify-between gap-3 min-h-[48px]">
                        <span className="text-sm">{n.label}</span>
                        <button
                          role="switch"
                          aria-checked={enabled}
                          aria-label={n.label}
                          onClick={() => toggleNotif(n.key, !enabled)}
                          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${enabled ? 'bg-accent' : 'bg-surface-3'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${enabled ? 'translate-x-5 bg-accent-ink' : 'bg-muted'}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
