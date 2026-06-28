'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';

function shortAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';
}

const AVATARS = [
  { key: 'king_w',   icon: '♔', label: 'King' },
  { key: 'queen_w',  icon: '♕', label: 'Queen' },
  { key: 'rook_w',   icon: '♖', label: 'Rook' },
  { key: 'bishop_w', icon: '♗', label: 'Bishop' },
  { key: 'knight_w', icon: '♘', label: 'Knight' },
  { key: 'pawn_w',   icon: '♙', label: 'Pawn' },
  { key: 'king_b',   icon: '♚', label: 'King (Dark)' },
  { key: 'queen_b',  icon: '♛', label: 'Queen (Dark)' },
  { key: 'rook_b',   icon: '♜', label: 'Rook (Dark)' },
  { key: 'bishop_b', icon: '♝', label: 'Bishop (Dark)' },
  { key: 'knight_b', icon: '♞', label: 'Knight (Dark)' },
  { key: 'pawn_b',   icon: '♟', label: 'Pawn (Dark)' },
];

const NOTIF_TYPES = [
  { key: 'mission_complete', label: 'Mission completed' },
  { key: 'friend_request',   label: 'Friend requests' },
  { key: 'challenge_received', label: 'Challenges received' },
  { key: 'friend_joined',    label: 'Friend joined Checkmate' },
  { key: 'streak_bonus',     label: 'Streak bonuses' },
  { key: 'tournament_start', label: 'Tournament starting' },
];

function computeBadges(profile: any): { icon: string; label: string; desc: string }[] {
  const badges = [];
  const winRate = profile.gamesPlayed ? (profile.gamesWon / profile.gamesPlayed) * 100 : 0;
  if (profile.gamesWon >= 1) badges.push({ icon: '🏆', label: 'First Win', desc: 'Won your first game' });
  if (profile.gamesPlayed >= 10) badges.push({ icon: '⚡', label: 'Veteran', desc: 'Played 10+ games' });
  if (profile.gamesPlayed >= 50) badges.push({ icon: '💎', label: 'Grinder', desc: 'Played 50+ games' });
  if (profile.currentStreak >= 3) badges.push({ icon: '🔥', label: 'On Fire', desc: `${profile.currentStreak} win streak` });
  if (winRate >= 60 && profile.gamesPlayed >= 10) badges.push({ icon: '🎯', label: 'Sharp', desc: '60%+ win rate' });
  if (profile.elo >= 1400) badges.push({ icon: '🌙', label: 'Rising Star', desc: '1400+ ELO' });
  if (profile.elo >= 1600) badges.push({ icon: '👑', label: 'Elite', desc: '1600+ ELO' });
  if (profile.totalEarnings >= 10) badges.push({ icon: '💰', label: 'Earner', desc: '$10+ in winnings' });
  return badges;
}

export default function ProfilePage() {
  const { authenticated, ready } = usePrivy();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('');
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});
  const [savingNotif, setSavingNotif] = useState(false);

  useEffect(() => {
    if (ready && !authenticated) { router.push('/'); return; }
    if (!authenticated) return;
    api.users.me().then((p) => {
      setProfile(p);
      setSelectedAvatar(p.settings?.avatar || '');
      setNotifPrefs(p.settings?.notifPrefs ?? {});
    }).catch(() => {});
  }, [authenticated, ready, router]);

  const saveUsername = async () => {
    setSaving(true); setMsg('');
    try {
      await api.users.setUsername(username);
      setMsg('Username saved!');
      setProfile((p: any) => ({ ...p, username }));
    } catch { setMsg('Username taken or invalid (3-20 chars, letters/numbers/_)'); }
    finally { setSaving(false); }
  };

  const saveAvatar = async (key: string) => {
    setSelectedAvatar(key);
    setSavingAvatar(true);
    try {
      await api.users.saveSettings({ avatar: key });
      setProfile((p: any) => ({ ...p, settings: { ...(p.settings || {}), avatar: key } }));
    } finally { setSavingAvatar(false); }
  };

  const toggleNotif = async (key: string, enabled: boolean) => {
    const updated = { ...notifPrefs, [key]: enabled };
    setNotifPrefs(updated);
    setSavingNotif(true);
    try {
      await api.users.saveSettings({ notifPrefs: updated });
      setProfile((p: any) => ({ ...p, settings: { ...(p.settings || {}), notifPrefs: updated } }));
    } finally { setSavingNotif(false); }
  };

  if (!profile) return <div className="text-center py-20 text-white/40">Loading...</div>;

  const winRate = profile.gamesPlayed ? Math.round((profile.gamesWon / profile.gamesPlayed) * 100) : 0;
  const badges = computeBadges(profile);
  const displayName = profile.username || shortAddr(profile.wallet);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#4caf50]/20 border border-[#4caf50]/30 flex items-center justify-center text-3xl select-none">
            {AVATARS.find((a) => a.key === selectedAvatar)?.icon || '♟'}
          </div>
          <div>
            <h1 className="text-3xl font-bold">{profile.username || shortAddr(profile.wallet)}</h1>
            <p className="text-white/40 text-sm">{profile.elo} ELO</p>
          </div>
        </div>
        <Link
          href={`/profile/${profile.id}`}
          className="btn-secondary text-sm"
          target="_blank"
        >
          View Public Profile ↗
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'ELO', value: profile.elo, color: 'text-[#ffd700]' },
          { label: 'Win Rate', value: `${winRate}%`, color: 'text-[#4caf50]' },
          { label: 'Win Streak', value: profile.currentStreak || 0, color: profile.currentStreak >= 3 ? 'text-orange-400' : 'text-white' },
          { label: 'Total Earned', value: `$${(profile.totalEarnings || 0).toFixed(2)}`, color: 'text-[#4caf50]' },
        ].map((s) => (
          <div key={s.label} className="card text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-white/50 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Games Played', value: profile.gamesPlayed },
          { label: 'Games Won', value: profile.gamesWon },
          { label: 'Best Streak', value: profile.bestStreak || 0 },
        ].map((s) => (
          <div key={s.label} className="card text-center py-3">
            <div className="text-xl font-bold">{s.value}</div>
            <div className="text-xs text-white/50 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Time control breakdown */}
      {profile.timeControlStats && profile.timeControlStats.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-bold mb-3">By Time Control</h2>
          <div className="space-y-2">
            {profile.timeControlStats.map((tc: any) => {
              const wr = tc.played ? Math.round((tc.won / tc.played) * 100) : 0;
              const pct = wr;
              const label = tc.timeControl === '3+0' ? '⚡ 3+0 Bullet'
                : tc.timeControl === '5+0' ? '♟ 5+0 Blitz'
                : tc.timeControl === '10+0' ? '🕐 10+0 Rapid'
                : tc.timeControl;
              return (
                <div key={tc.timeControl}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-white/80">{label}</span>
                    <span className="text-white/50 text-xs">{tc.won}W / {tc.played - tc.won}L — <span className="text-[#4caf50] font-semibold">{wr}%</span></span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-[#4caf50] rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Achievement badges */}
      {badges.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-bold mb-3">Achievements</h2>
          <div className="flex flex-wrap gap-3">
            {badges.map((b) => (
              <div
                key={b.label}
                title={b.desc}
                className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2"
              >
                <span className="text-xl">{b.icon}</span>
                <span className="text-sm font-semibold">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Username */}
      <div className="card">
        <h2 className="text-lg font-bold mb-3">
          Username{' '}
          <span className="text-white/40 font-normal text-sm">(current: {displayName})</span>
        </h2>
        <div className="flex gap-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Pick a username..."
            className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#4caf50]"
          />
          <button onClick={saveUsername} disabled={saving || !username} className="btn-primary">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
        {msg && <p className={`text-sm mt-2 ${msg.includes('saved') ? 'text-[#4caf50]' : 'text-red-400'}`}>{msg}</p>}
      </div>

      {/* Avatar selection */}
      <div className="card">
        <h2 className="text-lg font-bold mb-1">Avatar</h2>
        <p className="text-xs text-white/40 mb-3">Pick a chess piece to represent you{savingAvatar ? ' — saving...' : ''}</p>
        <div className="grid grid-cols-6 gap-2">
          {AVATARS.map((a) => (
            <button
              key={a.key}
              onClick={() => saveAvatar(a.key)}
              title={a.label}
              className={`w-full aspect-square rounded-lg flex items-center justify-center text-2xl transition-all border-2 ${
                selectedAvatar === a.key
                  ? 'border-[#4caf50] bg-[#4caf50]/20'
                  : 'border-white/10 hover:border-white/30 bg-white/5'
              }`}
            >
              {a.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Notification preferences */}
      <div className="card">
        <h2 className="text-lg font-bold mb-1">Notifications{savingNotif && <span className="text-xs font-normal text-white/40 ml-2">saving...</span>}</h2>
        <p className="text-xs text-white/40 mb-4">Choose which notifications you receive</p>
        <div className="space-y-3">
          {NOTIF_TYPES.map((n) => {
            const enabled = notifPrefs[n.key] !== false;
            return (
              <div key={n.key} className="flex items-center justify-between">
                <span className="text-sm">{n.label}</span>
                <button
                  onClick={() => toggleNotif(n.key, !enabled)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-[#4caf50]' : 'bg-white/20'}`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Game history */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <h2 className="font-bold">Recent Games</h2>
        </div>
        {!profile.recentGames?.length ? (
          <p className="text-white/40 text-center py-8">No games yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs border-b border-white/5">
                <th className="px-4 py-2 text-left">Result</th>
                <th className="px-4 py-2 text-left">Opponent</th>
                <th className="px-4 py-2 text-right">Bet</th>
                <th className="px-4 py-2 text-right">ELO</th>
                <th className="px-4 py-2 text-right">Replay</th>
              </tr>
            </thead>
            <tbody>
              {profile.recentGames.map((g: any) => {
                const won = g.winner === profile.id;
                const isDraw = !g.winner;
                const isWhite = g.player_white === profile.id;
                const opponentName = isWhite ? g.black_username : g.white_username;
                return (
                  <tr key={g.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-2">
                      <span className={`font-semibold ${isDraw ? 'text-yellow-400' : won ? 'text-[#4caf50]' : 'text-red-400'}`}>
                        {isDraw ? 'Draw' : won ? 'Won' : 'Lost'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-white/70">{opponentName || 'Opponent'}</td>
                    <td className="px-4 py-2 text-right text-[#ffd700]">${g.bet_amount}</td>
                    <td className={`px-4 py-2 text-right ${won ? 'text-[#4caf50]' : isDraw ? 'text-white/50' : 'text-red-400'}`}>
                      {isDraw ? '±0' : won ? `+${g.elo_change}` : `-${g.elo_change}`}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link href={`/replay/${g.id}`} className="text-xs text-white/40 hover:text-white">▶ Watch</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
