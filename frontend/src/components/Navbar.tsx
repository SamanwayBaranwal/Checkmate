'use client';

import Link from 'next/link';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useSession } from '@/lib/session';
import { Icon, type IconName } from '@/components/Icons';
import { Logo } from './Logo';

interface IncomingChallenge {
  challengeId: string;
  from: { userId: string; username: string; elo: number };
  betAmount: number;
}

const NOTIF_ICONS: Record<string, IconName> = {
  streak_bonus: 'fire',
  friend_request: 'users',
  friend_accepted: 'users',
  referral_earned: 'coin',
  challenge_received: 'pawn',
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function Navbar() {
  const { ready, authenticated, token, balance, login, bonus, dismissBonus } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [incoming, setIncoming] = useState<IncomingChallenge | null>(null);
  const [toast, setToast] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;
  const inGame = pathname.startsWith('/game/');

  const load = useCallback(async () => {
    if (!authenticated) return;
    try { setNotifications(await api.notifications.list()); } catch {}
  }, [authenticated]);

  useEffect(() => { if (authenticated) load(); else setNotifications([]); }, [authenticated, load]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Live: incoming challenges, match found, notifications
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    const onChallenge = (d: IncomingChallenge) => setIncoming(d);
    const onMatch = (d: { gameId: string }) => { if (!window.location.pathname.startsWith('/game/')) router.push(`/game/${d.gameId}`); };
    const onDeclined = () => { setToast('Challenge declined'); setTimeout(() => setToast(''), 3000); };
    const onNotif = (n: any) => setNotifications((p) => [n, ...p].slice(0, 30));
    socket.on('challenge_received', onChallenge);
    socket.on('match_found', onMatch);
    socket.on('challenge_declined', onDeclined);
    socket.on('notification', onNotif);
    return () => {
      socket.off('challenge_received', onChallenge);
      socket.off('match_found', onMatch);
      socket.off('challenge_declined', onDeclined);
      socket.off('notification', onNotif);
    };
  }, [token, router]);

  const respond = (accept: boolean) => {
    if (!incoming) return;
    getSocket(token).emit(accept ? 'accept_challenge' : 'decline_challenge', { challengeId: incoming.challengeId });
    setIncoming(null);
  };

  const markAll = async () => { await api.notifications.readAll().catch(() => {}); setNotifications((p) => p.map((n) => ({ ...n, read: true }))); };
  const markOne = async (id: string) => { await api.notifications.read(id).catch(() => {}); setNotifications((p) => p.map((n) => (n.id === id ? { ...n, read: true } : n))); };

  return (
    <>
      {!inGame && (
        <header className="sticky top-0 z-30 h-14 md:h-16 bg-canvas/90 backdrop-blur border-b border-line/[0.08] md:pl-60 pt-safe">
          <div className="h-full max-w-5xl mx-auto px-4 md:px-8 flex items-center justify-between">
            <Link href="/" className="md:hidden" aria-label="Home"><Logo size={28} /></Link>
            <div className="hidden md:block" />

            <div className="flex items-center gap-2">
              {authenticated && (
                <Link href="/wallet" className="h-9 px-3 rounded-[10px] bg-surface border border-line/[0.08] flex items-center gap-2 hover:bg-surface-2 transition-colors">
                  <Icon name="wallet" size={15} className="text-faint" />
                  <span className="text-sm font-semibold num">${balance.toFixed(2)}</span>
                </Link>
              )}

              {authenticated && (
                <div className="relative" ref={ref}>
                  <button onClick={() => setOpen((o) => !o)} aria-label="Notifications"
                    className="relative w-9 h-9 rounded-[10px] flex items-center justify-center text-muted hover:text-ink hover:bg-surface transition-colors">
                    <Icon name="bell" size={18} />
                    {unread > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent ring-2 ring-canvas" />}
                  </button>
                  {open && (
                    <div className="absolute right-0 top-11 w-[min(340px,calc(100vw-32px))] card p-0 shadow-pop overflow-hidden z-[200] animate-in">
                      <div className="h-11 px-4 flex items-center justify-between border-b border-line/[0.08]">
                        <span className="text-sm font-semibold">Notifications</span>
                        {unread > 0 && <button onClick={markAll} className="text-xs text-muted hover:text-ink">Mark all read</button>}
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <p className="text-center text-faint text-sm py-10">You&apos;re all caught up</p>
                        ) : notifications.map((n) => (
                          <button key={n.id} onClick={() => markOne(n.id)}
                            className="w-full text-left px-4 py-3 flex gap-3 hover:bg-surface-2 border-b border-line/[0.05] last:border-0">
                            <span className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-muted shrink-0">
                              <Icon name={NOTIF_ICONS[n.type] ?? 'bell'} size={15} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={`block text-sm leading-snug ${n.read ? 'text-muted' : 'text-ink'}`}>{n.message}</span>
                              <span className="block text-xs text-faint mt-0.5">{timeAgo(n.created_at)}</span>
                            </span>
                            {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {ready && !authenticated && <button onClick={login} className="btn-primary h-9 py-0">Sign in</button>}
            </div>
          </div>
        </header>
      )}

      {/* Incoming challenge */}
      {incoming && (
        <div className="fixed z-[100] left-4 right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] md:left-auto md:right-6 md:bottom-6 md:w-80 card shadow-pop animate-in">
          <div className="flex items-center gap-3 mb-3">
            <span className="avatar w-10 h-10">{(incoming.from.username || '?')[0]?.toUpperCase()}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{incoming.from.username} challenges you</p>
              <p className="text-xs text-muted num">{incoming.from.elo} rating · ${incoming.betAmount} stake</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => respond(false)} className="btn-secondary">Decline</button>
            <button onClick={() => respond(true)} className="btn-primary">Accept</button>
          </div>
        </div>
      )}

      {/* Daily bonus + small toasts */}
      {bonus && (
        <div className="fixed z-[100] top-[72px] left-1/2 -translate-x-1/2 card py-3 px-4 shadow-pop flex items-center gap-3 animate-in">
          <span className="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center"><Icon name="gift" size={16} /></span>
          <div>
            <p className="text-sm font-semibold">Daily bonus <span className="text-positive num">+${bonus.amount.toFixed(2)}</span></p>
            <p className="text-xs text-muted">Day {bonus.streak} streak</p>
          </div>
          <button onClick={dismissBonus} className="btn-ghost p-1.5 ml-1" aria-label="Dismiss"><Icon name="x" size={14} /></button>
        </div>
      )}
      {toast && (
        <div className="fixed z-[100] top-[72px] left-1/2 -translate-x-1/2 card py-2.5 px-4 text-sm shadow-pop animate-in">{toast}</div>
      )}
    </>
  );
}
