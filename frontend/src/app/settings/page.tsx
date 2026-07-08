'use client';

import { useEffect, useState } from 'react';
import { usePrivy, useLinkAccount } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Icon } from '@/components/Icons';
import { PIECE_THEMES, type PieceTheme } from '@/lib/pieceThemes';

const NOTIF_PREFS = [
  { key: 'challenge_received', label: 'Incoming challenges', desc: 'When a player sends you a challenge' },
  { key: 'friend_request',     label: 'Friend requests',     desc: 'When someone adds you as a friend' },
  { key: 'friend_accepted',    label: 'Friend accepted',     desc: 'When someone accepts your friend request' },
  { key: 'streak_bonus',       label: 'Win streak bonuses',  desc: 'When you earn a streak bonus reward' },
  { key: 'weekly_summary',     label: 'Weekly summary',      desc: "Monday recap of your week's results" },
];

const BOARD_THEMES = [
  { name: 'Classic', light: '#f0d9b5', dark: '#b58863' },
  { name: 'Ocean', light: '#dee3e6', dark: '#8ca2ad' },
  { name: 'Forest', light: '#ffffdd', dark: '#86a666' },
  { name: 'Night', light: '#e8e9b7', dark: '#4a7fa5' },
  { name: 'Rose', light: '#f9d9d9', dark: '#c07878' },
];

function Toggle({ value, onChange, label, desc }: { value: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <div>
        <p className="font-semibold text-sm">{label}</p>
        <p className="text-xs text-white/40 mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-12 h-6 rounded-full transition-colors ${value ? 'bg-[#46a883]' : 'bg-white/20'}`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-0.5'}`}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { authenticated, ready, logout, user } = usePrivy();
  const { linkEmail, linkPhone, linkGoogle } = useLinkAccount();
  const router = useRouter();
  const [boardTheme, setBoardTheme] = useState(0);
  const [pieceTheme, setPieceTheme] = useState<PieceTheme>('classic');
  const [autoQueen, setAutoQueen] = useState(true);
  const [showEarningsPublicly, setShowEarningsPublicly] = useState(true);
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const [currentUsername, setCurrentUsername] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [usernameError, setUsernameError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'deleting' | 'error'>('idle');
  const [deleteError, setDeleteError] = useState('');
  const [tab, setTab] = useState<'account' | 'appearance' | 'notifications' | 'security'>('account');

  useEffect(() => {
    if (ready && !authenticated) { router.push('/'); return; }
    if (!authenticated) return;

    // Load from localStorage first (instant)
    const storedTheme = localStorage.getItem('checkmate_board_theme');
    if (storedTheme !== null) setBoardTheme(parseInt(storedTheme, 10));

    // Then load from backend (authoritative)
    api.users.me().then((u) => {
      const s = u.settings || {};
      if (typeof s.boardTheme === 'number') setBoardTheme(s.boardTheme);
      if (s.pieceTheme) setPieceTheme(s.pieceTheme as PieceTheme);
      if (typeof s.autoQueen === 'boolean') setAutoQueen(s.autoQueen);
      if (typeof s.showEarningsPublicly === 'boolean') setShowEarningsPublicly(s.showEarningsPublicly);
      if (s.notifPrefs && typeof s.notifPrefs === 'object') setNotifPrefs(s.notifPrefs);
      if (u.username) { setCurrentUsername(u.username); setUsernameInput(u.username); }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [authenticated, ready, router]);

  const handleUsernameChange = async () => {
    const trimmed = usernameInput.trim();
    if (!trimmed || trimmed === currentUsername) return;
    setUsernameStatus('saving');
    setUsernameError('');
    try {
      const result = await api.users.setUsername(trimmed);
      setCurrentUsername(result.username);
      setUsernameInput(result.username);
      setUsernameStatus('saved');
      setTimeout(() => setUsernameStatus('idle'), 2500);
    } catch (err: any) {
      let msg = 'Username already taken or invalid';
      try { const parsed = JSON.parse(err?.message || ''); if (parsed.error) msg = parsed.error; } catch {}
      setUsernameError(msg);
      setUsernameStatus('error');
    }
  };

  const handleSave = async () => {
    localStorage.setItem('checkmate_board_theme', String(boardTheme));
    localStorage.setItem('checkmate_piece_theme', pieceTheme);
    localStorage.setItem('checkmate_auto_queen', String(autoQueen));
    try {
      await api.users.saveSettings({ boardTheme, pieceTheme, autoQueen, showEarningsPublicly, notifPrefs });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  };

  const handleDelete = async () => {
    setDeleteStatus('deleting');
    setDeleteError('');
    try {
      await api.users.deleteAccount(deleteConfirm);
      localStorage.removeItem('checkmate_token');
      logout();
      router.push('/');
    } catch (err: any) {
      let msg = 'Failed to delete account';
      try { const p = JSON.parse(err?.message || ''); if (p.error) msg = p.error; } catch {}
      setDeleteError(msg);
      setDeleteStatus('error');
    }
  };

  if (loading) return <div className="text-center py-20 text-white/40">Loading...</div>;

  const TABS = [
    { key: 'account', label: 'Account' },
    { key: 'appearance', label: 'Appearance' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'security', label: 'Security' },
  ] as const;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/[0.06] overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-[#46a883] text-[#46a883]' : 'border-transparent text-white/45 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Username */}
      <div className={`card ${tab === 'account' ? '' : 'hidden'}`}>
        <h2 className="text-lg font-bold mb-4">Username</h2>
        <p className="text-sm text-white/50 mb-3">
          3–20 characters, letters/numbers/underscores only. Your username is shown on the leaderboard and profile.
        </p>
        <div className="flex gap-2">
          <input
            value={usernameInput}
            onChange={(e) => { setUsernameInput(e.target.value); setUsernameStatus('idle'); setUsernameError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleUsernameChange(); }}
            placeholder="Enter username..."
            maxLength={20}
            className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#46a883]"
          />
          <button
            onClick={handleUsernameChange}
            disabled={usernameStatus === 'saving' || !usernameInput.trim() || usernameInput.trim() === currentUsername}
            className="btn-primary text-sm px-4 disabled:opacity-40"
          >
            {usernameStatus === 'saving' ? '...' : usernameStatus === 'saved' ? '✓ Saved' : 'Save'}
          </button>
        </div>
        {usernameStatus === 'error' && <p className="text-red-400 text-xs mt-2">{usernameError}</p>}
        {usernameStatus === 'saved' && <p className="text-[#46a883] text-xs mt-2">Username updated!</p>}
      </div>

      {/* Board theme */}
      <div className={`card ${tab === 'appearance' ? '' : 'hidden'}`}>
        <h2 className="text-lg font-bold mb-4">Board Theme</h2>
        <div className="grid grid-cols-5 gap-3">
          {BOARD_THEMES.map((t, i) => (
            <button
              key={t.name}
              onClick={() => setBoardTheme(i)}
              title={t.name}
              className={`flex flex-col items-center gap-2 p-2 rounded-lg border-2 transition ${
                i === boardTheme ? 'border-[#46a883]' : 'border-transparent hover:border-white/20'
              }`}
            >
              <div
                className="w-12 h-12 rounded-md overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${t.light} 50%, ${t.dark} 50%)` }}
              />
              <span className="text-xs text-white/60">{t.name}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 p-3 rounded-lg text-xs text-white/40 bg-black/20">
          Preview: selected theme will be used in all your games
        </div>
      </div>

      {/* Piece theme */}
      <div className={`card ${tab === 'appearance' ? '' : 'hidden'}`}>
        <h2 className="text-lg font-bold mb-4">Piece Style</h2>
        <div className="grid grid-cols-4 gap-3">
          {PIECE_THEMES.map((t) => (
            <button
              key={t.key}
              onClick={() => setPieceTheme(t.key)}
              className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition ${
                t.key === pieceTheme ? 'border-[#46a883]' : 'border-transparent hover:border-white/20'
              }`}
            >
              <div className={`text-3xl select-none ${t.key === 'neon' ? 'text-[#46a883]' : ''}`}
                style={t.key === 'neon' ? { filter: 'drop-shadow(0 0 5px #46a883)' } : undefined}>
                {t.key === 'minimal' ? (
                  <span style={{ fontWeight: 900, fontFamily: 'system-ui', fontSize: '1.5rem' }}>Q</span>
                ) : (
                  t.key === 'classic' ? '♟' : t.preview
                )}
              </div>
              <span className="text-xs text-white/60">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Game preferences */}
      <div className={`card ${tab === 'appearance' ? '' : 'hidden'}`}>
        <h2 className="text-lg font-bold mb-2">Game Preferences</h2>
        <Toggle
          value={autoQueen}
          onChange={setAutoQueen}
          label="Auto-promote to Queen"
          desc="Automatically promotes pawns to queen without showing a dialog"
        />
        <Toggle
          value={showEarningsPublicly}
          onChange={setShowEarningsPublicly}
          label="Show earnings on public profile"
          desc="Other players can see your total winnings on your profile page"
        />
      </div>

      {/* Notification preferences */}
      <div className={`card ${tab === 'notifications' ? '' : 'hidden'}`}>
        <h2 className="text-lg font-bold mb-2">Notifications</h2>
        {NOTIF_PREFS.map((pref) => (
          <Toggle
            key={pref.key}
            label={pref.label}
            desc={pref.desc}
            value={notifPrefs[pref.key] !== false}
            onChange={(v) => setNotifPrefs((prev) => ({ ...prev, [pref.key]: v }))}
          />
        ))}
      </div>

      {/* Security — linked login methods */}
      <div className={`card ${tab === 'security' ? '' : 'hidden'}`}>
        <h2 className="text-lg font-bold mb-1">Security</h2>
        <p className="text-xs text-white/40 mb-4">
          Link additional login methods so you can always access your account.
        </p>
        <div className="space-y-2">
          {[
            {
              type: 'email',
              label: 'Email',
              icon: 'mail' as const,
              linked: user?.linkedAccounts?.some((a: any) => a.type === 'email'),
              onLink: () => linkEmail(),
            },
            {
              type: 'phone',
              label: 'Phone (SMS)',
              icon: 'phone' as const,
              linked: user?.linkedAccounts?.some((a: any) => a.type === 'phone'),
              onLink: () => linkPhone(),
            },
            {
              type: 'google_oauth',
              label: 'Google',
              icon: 'google' as const,
              linked: user?.linkedAccounts?.some((a: any) => a.type === 'google_oauth'),
              onLink: () => linkGoogle(),
            },
          ].map((method) => (
            <div key={method.type} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-white/60"><Icon name={method.icon} size={18} /></span>
                <div>
                  <p className="text-sm font-semibold">{method.label}</p>
                  <p className="text-xs text-white/40">{method.linked ? 'Linked' : 'Not linked'}</p>
                </div>
              </div>
              {method.linked ? (
                <span className="text-xs text-[#46a883] bg-[#46a883]/10 border border-[#46a883]/30 px-2 py-0.5 rounded-full">✓ Linked</span>
              ) : (
                <button onClick={method.onLink} className="text-xs btn-secondary py-1 px-3">Link</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        className={`btn-primary w-full ${tab === 'appearance' || tab === 'notifications' ? '' : 'hidden'}`}
      >
        {saved ? '✓ Saved!' : 'Save Settings'}
      </button>

      {/* Danger zone */}
      <div className={`card border border-red-500/20 ${tab === 'security' ? '' : 'hidden'}`}>
        <h2 className="text-lg font-bold text-red-400 mb-1">Danger Zone</h2>
        <p className="text-xs text-white/40 mb-4">
          Permanently delete your account. Your game history is anonymized but preserved. Withdraw your balance first.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="btn-danger text-sm"
        >
          Delete Account
        </button>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); setDeleteStatus('idle'); setDeleteError(''); }}>
          <div className="card w-full max-w-sm mx-4 border border-red-500/30" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-red-400 mb-2">Delete Account</h3>
            <p className="text-sm text-white/60 mb-4">
              This cannot be undone. Your stats and game history will remain but your identity will be removed.
              Make sure you have withdrawn any remaining balance.
            </p>
            <p className="text-xs text-white/40 mb-2">Type <span className="font-mono text-white/70">DELETE MY ACCOUNT</span> to confirm:</p>
            <input
              value={deleteConfirm}
              onChange={(e) => { setDeleteConfirm(e.target.value); setDeleteStatus('idle'); setDeleteError(''); }}
              placeholder="DELETE MY ACCOUNT"
              className="w-full bg-black/30 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-400 mb-4 font-mono"
            />
            {deleteError && <p className="text-red-400 text-xs mb-3">{deleteError}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); setDeleteStatus('idle'); setDeleteError(''); }} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirm !== 'DELETE MY ACCOUNT' || deleteStatus === 'deleting'}
                className="btn-danger flex-1 disabled:opacity-40"
              >
                {deleteStatus === 'deleting' ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
