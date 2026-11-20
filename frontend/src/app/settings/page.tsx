'use client';

import { useEffect, useRef, useState } from 'react';
import { usePrivy, useLinkAccount } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Icon, type IconName } from '@/components/Icons';
import { PIECE_THEMES, DEFAULT_PIECE_THEME, type PieceTheme } from '@/lib/pieceThemes';
import { BOARD_THEMES } from '@/lib/boardThemes';
import Link from 'next/link';
import { REAL_MONEY } from '@/lib/site';

const NOTIF_PREFS = [
  { key: 'challenge_received', label: 'Incoming challenges', desc: 'When a player sends you a challenge' },
  { key: 'friend_request',     label: 'Friend requests',     desc: 'When someone adds you as a friend' },
  { key: 'friend_accepted',    label: 'Friend accepted',     desc: 'When someone accepts your request' },
  { key: 'streak_bonus',       label: 'Win streak bonuses',  desc: 'When you earn a streak bonus' },
  { key: 'weekly_summary',     label: 'Weekly summary',      desc: "Monday recap of your week" },
];

// Same order and colors as the game page (stored by index in checkmate_board_theme)

const PIECE_PREVIEW: Partial<Record<PieceTheme, { glyph: string; img?: string; style?: React.CSSProperties }>> = {
  chessnut: { glyph: 'N', img: '/pieces/chessnut/wN.svg' },
  classic: { glyph: '♞' },
  unicode: { glyph: '♛' },
  minimal: { glyph: 'Q', style: { fontWeight: 800, fontFamily: 'system-ui, sans-serif', fontSize: '1.1rem' } },
  neon: { glyph: '♝' },
};

// The default set (chessnut) leads the list even if the shared list does not include it yet
const PIECE_OPTIONS: { key: PieceTheme; label: string }[] = PIECE_THEMES.some((t) => t.key === DEFAULT_PIECE_THEME)
  ? PIECE_THEMES
  : [{ key: DEFAULT_PIECE_THEME, label: 'Standard' }, ...PIECE_THEMES];

const shortAddr = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${checked ? 'bg-accent' : 'bg-surface-3'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full shadow transition-transform ${checked ? 'translate-x-5 bg-accent-ink' : 'bg-muted'}`} />
    </button>
  );
}

function Group({ title, children, note }: { title: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <section>
      <div className="eyebrow px-1 mb-2">{title}</div>
      <div className="card p-0 overflow-hidden divide-y divide-line/[0.06]">{children}</div>
      {note && <p className="text-xs text-faint px-1 mt-2 leading-relaxed">{note}</p>}
    </section>
  );
}

function RowIcon({ name }: { name: IconName }) {
  return (
    <span className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center text-muted shrink-0">
      <Icon name={name} size={16} />
    </span>
  );
}

function ToggleRow({ icon, label, desc, checked, onChange }: { icon?: IconName; label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 px-4 min-h-14 py-2.5">
      {icon && <RowIcon name={icon} />}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-xs text-faint mt-0.5">{desc}</div>}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

export default function SettingsPage() {
  const { ready, authenticated, me, refresh, login, logout } = useSession();
  const { user } = usePrivy();
  const { linkEmail, linkPhone, linkGoogle } = useLinkAccount();
  const router = useRouter();

  const [boardTheme, setBoardTheme] = useState(0);
  const [pieceTheme, setPieceTheme] = useState<PieceTheme>(DEFAULT_PIECE_THEME);
  const [autoQueen, setAutoQueen] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [showEarningsPublicly, setShowEarningsPublicly] = useState(true);
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loading, setLoading] = useState(true);
  const loaded = useRef(false);

  const [currentUsername, setCurrentUsername] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameOpen, setUsernameOpen] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [usernameError, setUsernameError] = useState('');

  const [referral, setReferral] = useState<{ referralCode: string | null; referralLink: string | null; referredCount: number; referralEarnings: number } | null>(null);
  const [copied, setCopied] = useState<'' | 'ref' | 'wallet'>('');

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'deleting' | 'error'>('idle');
  const [deleteError, setDeleteError] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!authenticated) return;

    // Load from localStorage first (instant)
    const storedTheme = localStorage.getItem('checkmate_board_theme');
    if (storedTheme !== null) {
      const v = parseInt(storedTheme, 10);
      if (Number.isFinite(v) && v >= 0 && v < BOARD_THEMES.length) setBoardTheme(v);
    }
    const storedPiece = localStorage.getItem('checkmate_piece_theme') as PieceTheme | null;
    if (storedPiece && PIECE_OPTIONS.some((p) => p.key === storedPiece)) setPieceTheme(storedPiece);
    if (localStorage.getItem('checkmate_auto_queen') === 'false') setAutoQueen(false);
    if (localStorage.getItem('checkmate_sound') === 'off') setSoundOn(false);

    // Then load from backend (authoritative)
    api.users.me().then((u) => {
      const s = u.settings || {};
      if (typeof s.boardTheme === 'number' && s.boardTheme >= 0 && s.boardTheme < BOARD_THEMES.length) setBoardTheme(s.boardTheme);
      if (s.pieceTheme) setPieceTheme(s.pieceTheme as PieceTheme);
      if (typeof s.autoQueen === 'boolean') setAutoQueen(s.autoQueen);
      if (typeof s.showEarningsPublicly === 'boolean') setShowEarningsPublicly(s.showEarningsPublicly);
      if (s.notifPrefs && typeof s.notifPrefs === 'object') setNotifPrefs(s.notifPrefs);
      if (u.username) { setCurrentUsername(u.username); setUsernameInput(u.username); }
    }).catch(() => {}).finally(() => {
      setLoading(false);
      // Let the loaded values settle before auto-save starts listening
      setTimeout(() => { loaded.current = true; }, 0);
    });

    api.users.referral().then(setReferral).catch(() => {});
  }, [authenticated]);

  // Auto-save: every change is written to localStorage (used by the game page) and the backend
  useEffect(() => {
    if (!loaded.current) return;
    localStorage.setItem('checkmate_board_theme', String(boardTheme));
    localStorage.setItem('checkmate_piece_theme', pieceTheme);
    localStorage.setItem('checkmate_auto_queen', String(autoQueen));
    setSaveState('saving');
    const t = setTimeout(async () => {
      try {
        await api.users.saveSettings({ boardTheme, pieceTheme, autoQueen, showEarningsPublicly, notifPrefs });
        setSaveState('saved');
        setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1800);
      } catch {
        setSaveState('error');
      }
    }, 500);
    return () => clearTimeout(t);
  }, [boardTheme, pieceTheme, autoQueen, showEarningsPublicly, notifPrefs]);

  const toggleSound = (v: boolean) => {
    setSoundOn(v);
    localStorage.setItem('checkmate_sound', v ? 'on' : 'off');
  };

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
      refresh().catch(() => {});
      setTimeout(() => { setUsernameStatus('idle'); setUsernameOpen(false); }, 900);
    } catch (err: any) {
      let msg = 'Username already taken or invalid';
      try { const parsed = JSON.parse(err?.message || ''); if (parsed.error) msg = parsed.error; } catch {}
      setUsernameError(msg);
      setUsernameStatus('error');
    }
  };

  const copy = async (text: string, what: 'ref' | 'wallet') => {
    try { await navigator.clipboard.writeText(text); } catch {
      const el = document.createElement('textarea'); el.value = text; document.body.appendChild(el); el.select();
      try { document.execCommand('copy'); } catch {}
      el.remove();
    }
    setCopied(what);
    setTimeout(() => setCopied(''), 1600);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await logout();
    router.push('/');
  };

  const closeDelete = () => { setShowDeleteModal(false); setDeleteConfirm(''); setDeleteStatus('idle'); setDeleteError(''); };

  const handleDelete = async () => {
    setDeleteStatus('deleting');
    setDeleteError('');
    try {
      await api.users.deleteAccount(deleteConfirm);
      await logout();
      router.push('/');
    } catch (err: any) {
      let msg = 'Failed to delete account';
      try { const p = JSON.parse(err?.message || ''); if (p.error) msg = p.error; } catch {}
      setDeleteError(msg);
      setDeleteStatus('error');
    }
  };

  if (!ready) return <div className="min-h-[60vh]" />;

  if (!authenticated) {
    return (
      <div className="max-w-md mx-auto px-4 pt-16 md:pt-24">
        <div className="card p-6 text-center">
          <span className="mx-auto mb-4 w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center text-muted">
            <Icon name="settings" size={22} />
          </span>
          <h1 className="text-lg font-semibold">Sign in to change settings</h1>
          <p className="text-sm text-muted mt-1">Your board, sound and account preferences live here.</p>
          <button onClick={login} className="btn-primary h-12 w-full mt-5">Sign in</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-8 pt-5 md:pt-8 space-y-6">
        <div className="h-8 w-32 rounded-lg bg-surface animate-pulse" />
        {[3, 4, 2].map((n, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-20 rounded bg-surface animate-pulse" />
            <div className="card p-0 divide-y divide-line/[0.06]">
              {Array.from({ length: n }).map((_, j) => <div key={j} className="h-14" />)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const linked = (type: string) => user?.linkedAccounts?.some((a: any) => a.type === type);
  const emailAddr = (user as any)?.email?.address as string | undefined;
  const phoneNum = (user as any)?.phone?.number as string | undefined;
  const googleAddr = (user as any)?.google?.email as string | undefined;
  const wallet = me?.wallet || user?.wallet?.address;
  const displayName = currentUsername || me?.username || '';

  const methods: { type: string; label: string; icon: IconName; linked: boolean; detail?: string; onLink: () => void }[] = [
    { type: 'email', label: 'Email', icon: 'mail', linked: !!linked('email'), detail: emailAddr, onLink: () => linkEmail() },
    { type: 'phone', label: 'Phone', icon: 'phone', linked: !!linked('phone'), detail: phoneNum, onLink: () => linkPhone() },
    { type: 'google_oauth', label: 'Google', icon: 'google', linked: !!linked('google_oauth'), detail: googleAddr, onLink: () => linkGoogle() },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 pt-5 md:pt-8 pb-4 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-semibold">Settings</h1>
        <span className={`text-xs flex items-center gap-1.5 h-6 transition-opacity ${saveState === 'idle' ? 'opacity-0' : 'opacity-100'} ${saveState === 'error' ? 'text-negative' : 'text-faint'}`} aria-live="polite">
          {saveState === 'saved' && <Icon name="check" size={13} className="text-positive" />}
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Could not save' : ''}
        </span>
      </div>

      {/* Profile header */}
      <div className="card flex items-center gap-4">
        <span className="avatar w-14 h-14 text-xl">{(displayName || '?')[0]?.toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold truncate">{displayName || 'No username yet'}</div>
          <div className="text-xs text-faint num mt-0.5">{me?.elo ?? '—'} rating{wallet ? ` · ${shortAddr(wallet)}` : ''}</div>
        </div>
      </div>

      {/* Account */}
      <Group title="Account">
        <button onClick={() => { setUsernameInput(currentUsername); setUsernameStatus('idle'); setUsernameError(''); setUsernameOpen(true); }}
          className="w-full flex items-center gap-3 px-4 h-14 text-left hover:bg-surface-2 transition-colors">
          <RowIcon name="user" />
          <span className="text-sm font-medium flex-1">Username</span>
          <span className="text-sm text-muted truncate max-w-[45%]">{currentUsername || 'Set username'}</span>
          <Icon name="chevron-right" size={16} className="text-faint shrink-0" />
        </button>
        {wallet && (
          <div className="flex items-center gap-3 px-4 h-14">
            <RowIcon name="wallet" />
            <span className="text-sm font-medium flex-1">Wallet</span>
            <span className="text-sm text-muted num">{shortAddr(wallet)}</span>
            <button onClick={() => copy(wallet, 'wallet')} aria-label="Copy wallet address"
              className="w-10 h-10 -mr-2 rounded-lg flex items-center justify-center text-faint hover:text-ink hover:bg-surface-2">
              <Icon name={copied === 'wallet' ? 'check' : 'copy'} size={16} className={copied === 'wallet' ? 'text-positive' : ''} />
            </button>
          </div>
        )}
      </Group>

      {/* Invite */}
      {referral?.referralLink && (
        <Group title="Invite friends" note="You earn a share of the fees from every game your invited friends play.">
          <div className="px-4 py-3.5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 h-11 px-3.5 rounded-[10px] bg-canvas border border-line/[0.08] flex items-center">
                <span className="text-sm text-muted truncate">{referral.referralLink.replace(/^https?:\/\//, '')}</span>
              </div>
              <button onClick={() => copy(referral.referralLink!, 'ref')} className="btn-primary h-11 py-0 px-4 shrink-0">
                <Icon name={copied === 'ref' ? 'check' : 'copy'} size={15} /> {copied === 'ref' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[10px] bg-surface-2 px-3 py-2.5">
                <div className="text-xs text-faint">Friends joined</div>
                <div className="text-base font-semibold num mt-0.5">{referral.referredCount}</div>
              </div>
              <div className="rounded-[10px] bg-surface-2 px-3 py-2.5">
                <div className="text-xs text-faint">Earned</div>
                <div className={`text-base font-semibold num mt-0.5 ${referral.referralEarnings > 0 ? 'text-positive' : ''}`}>${Number(referral.referralEarnings || 0).toFixed(2)}</div>
              </div>
            </div>
          </div>
        </Group>
      )}

      {/* Board */}
      <Group title="Board">
        <div className="px-4 py-4">
          <div className="text-sm font-medium mb-3">Board colors</div>
          <div className="grid grid-cols-5 gap-2">
            {BOARD_THEMES.map((t, i) => {
              const active = i === boardTheme;
              return (
                <button key={t.name} onClick={() => setBoardTheme(i)} aria-pressed={active} aria-label={`${t.name} board`}
                  className="flex flex-col items-center gap-1.5 min-w-0">
                  <span className={`w-full aspect-square rounded-lg overflow-hidden grid grid-cols-2 grid-rows-2 ring-2 ring-offset-2 ring-offset-surface transition-shadow ${active ? 'ring-accent' : 'ring-transparent'}`}>
                    <span style={{ background: t.light }} /><span style={{ background: t.dark }} />
                    <span style={{ background: t.dark }} /><span style={{ background: t.light }} />
                  </span>
                  <span className={`text-[11px] truncate max-w-full ${active ? 'text-ink font-medium' : 'text-faint'}`}>{t.name}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="px-4 py-4">
          <div className="text-sm font-medium mb-3">Piece style</div>
          <div className={`grid gap-2 ${PIECE_OPTIONS.length === 5 ? 'grid-cols-5' : 'grid-cols-4'}`}>
            {PIECE_OPTIONS.map((t) => {
              const active = t.key === pieceTheme;
              const p = PIECE_PREVIEW[t.key];
              return (
                <button key={t.key} onClick={() => setPieceTheme(t.key)} aria-pressed={active}
                  className={`h-16 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-colors ${
                    active ? 'border-accent/60 bg-accent/10' : 'border-line/[0.08] bg-surface-2 hover:bg-surface-3'
                  }`}>
                  {p?.img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.img} alt="" className="w-7 h-7" draggable={false} />
                  ) : (
                    <span className={`text-2xl leading-none select-none ${active ? 'text-ink' : 'text-muted'}`} style={p?.style}>{p?.glyph ?? t.label[0]}</span>
                  )}
                  <span className={`text-[11px] truncate max-w-full px-1 ${active ? 'text-ink font-medium' : 'text-faint'}`}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Group>

      {/* Gameplay */}
      <Group title="Gameplay">
        <ToggleRow icon={soundOn ? 'sound' : 'mute'} label="Sound effects" desc="Moves, captures and clock warnings" checked={soundOn} onChange={toggleSound} />
        <ToggleRow icon="crown" label="Auto-promote to queen" desc="Skip the promotion picker" checked={autoQueen} onChange={setAutoQueen} />
      </Group>

      {/* Privacy */}
      <Group title="Privacy">
        <ToggleRow icon="eye" label="Show earnings on profile" desc="Other players can see your total winnings" checked={showEarningsPublicly} onChange={setShowEarningsPublicly} />
      </Group>

      {/* Notifications */}
      <Group title="Notifications">
        {NOTIF_PREFS.map((pref) => (
          <ToggleRow
            key={pref.key}
            label={pref.label}
            desc={pref.desc}
            checked={notifPrefs[pref.key] !== false}
            onChange={(v) => setNotifPrefs((prev) => ({ ...prev, [pref.key]: v }))}
          />
        ))}
      </Group>

      {/* Linked accounts */}
      <Group title="Sign-in methods" note="Link more than one so you never lose access to your account.">
        {methods.map((m) => (
          <div key={m.type} className="flex items-center gap-3 px-4 h-14">
            <RowIcon name={m.icon} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{m.label}</div>
              {m.linked && m.detail && <div className="text-xs text-faint truncate">{m.detail}</div>}
            </div>
            {m.linked ? (
              <span className="pill pill-accent"><Icon name="check" size={12} /> Linked</span>
            ) : (
              <button onClick={m.onLink} className="btn-secondary h-9 py-0 px-3.5 text-[13px]">Link</button>
            )}
          </div>
        ))}
      </Group>

      {/* Sign out */}
      <div className="space-y-3 pt-2">
        <button onClick={handleSignOut} disabled={signingOut} className="btn-danger w-full h-12">
          <Icon name="logout" size={16} /> {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
        <button onClick={() => setShowDeleteModal(true)} className="w-full h-11 text-xs text-faint hover:text-negative transition-colors">
          Delete account
        </button>
        <div className="flex justify-center gap-5 text-xs text-faint font-medium">
          <Link href="/terms" className="hover:text-ink">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy Policy</Link>
        </div>
      </div>

      {/* Username sheet */}
      {usernameOpen && (
        <div className="overlay" onClick={() => setUsernameOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Username</h2>
                <p className="text-sm text-muted mt-0.5">Shown on the leaderboard and your profile.</p>
              </div>
              <button onClick={() => setUsernameOpen(false)} aria-label="Close" className="btn-ghost w-10 h-10 !p-0 -mr-2 -mt-1">
                <Icon name="x" size={18} />
              </button>
            </div>
            <input
              value={usernameInput}
              onChange={(e) => { setUsernameInput(e.target.value); setUsernameStatus('idle'); setUsernameError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleUsernameChange(); }}
              placeholder="Enter username"
              maxLength={20}
              autoFocus
              autoCapitalize="off"
              autoComplete="off"
              spellCheck={false}
              className="input h-12 mt-5 text-[15px]"
            />
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className={usernameStatus === 'error' ? 'text-negative' : usernameStatus === 'saved' ? 'text-positive' : 'text-faint'}>
                {usernameStatus === 'error' ? usernameError : usernameStatus === 'saved' ? 'Username updated' : '3–20 letters, numbers or underscores'}
              </span>
              <span className="text-faint num">{usernameInput.length}/20</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button onClick={() => setUsernameOpen(false)} className="btn-secondary h-12">Cancel</button>
              <button
                onClick={handleUsernameChange}
                disabled={usernameStatus === 'saving' || !usernameInput.trim() || usernameInput.trim() === currentUsername}
                className="btn-primary h-12"
              >
                {usernameStatus === 'saving' ? 'Saving…' : usernameStatus === 'saved' ? 'Saved' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete sheet */}
      {showDeleteModal && (
        <div className="overlay" onClick={closeDelete}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-negative">Delete account</h3>
            <p className="text-sm text-muted mt-1">
              This cannot be undone. Your game history stays but is anonymized. {REAL_MONEY ? 'Withdraw any remaining balance first.' : 'Any remaining credits are forfeited.'}
            </p>
            <p className="text-xs text-faint mt-4 mb-2">Type <span className="font-mono text-ink">DELETE MY ACCOUNT</span> to confirm</p>
            <input
              value={deleteConfirm}
              onChange={(e) => { setDeleteConfirm(e.target.value); setDeleteStatus('idle'); setDeleteError(''); }}
              placeholder="DELETE MY ACCOUNT"
              autoCapitalize="characters"
              autoComplete="off"
              className="input h-12 font-mono"
            />
            {deleteError && <p className="text-negative text-xs mt-2">{deleteError}</p>}
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button onClick={closeDelete} className="btn-secondary h-12">Cancel</button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirm !== 'DELETE MY ACCOUNT' || deleteStatus === 'deleting'}
                className="btn-danger h-12"
              >
                {deleteStatus === 'deleting' ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
