'use client';

import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';

interface IncomingChallenge {
  challengeId: string;
  from: { userId: string; username: string; elo: number };
  betAmount: number;
}

const NOTIF_ICONS: Record<string, string> = {
  mission_complete: '🎯',
  streak_bonus: '🔥',
  friend_request: '👋',
  friend_accepted: '🤝',
  referral_earned: '💸',
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Navbar() {
  const { ready, authenticated, login, logout } = usePrivy();
  const router = useRouter();
  const pathname = usePathname();
  const [balance, setBalance] = useState<number | null>(null);
  const [incomingChallenge, setIncomingChallenge] = useState<IncomingChallenge | null>(null);
  const [declinedNotice, setDeclinedNotice] = useState('');

  // Notifications
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const loadNotifications = useCallback(async () => {
    if (!authenticated) return;
    try {
      const data = await api.notifications.list();
      setNotifications(data);
    } catch {}
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) { setBalance(null); setNotifications([]); return; }
    api.wallet.balance().then((r) => setBalance(r.balance)).catch(() => {});
    loadNotifications();
  }, [authenticated, loadNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Socket listeners for challenges + notifications
  useEffect(() => {
    if (!authenticated) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('checkmate_token') ?? undefined : undefined;
    if (!token) return;

    const socket = getSocket(token);

    const onChallengeReceived = (data: IncomingChallenge) => {
      setIncomingChallenge(data);
    };

    const onMatchFound = (data: { gameId: string }) => {
      if (!pathname.startsWith('/game/')) {
        router.push(`/game/${data.gameId}`);
      }
    };

    const onChallengeDeclined = () => {
      setDeclinedNotice('Challenge was declined');
      setTimeout(() => setDeclinedNotice(''), 3000);
    };

    const onNotification = (notif: any) => {
      setNotifications((prev) => [notif, ...prev].slice(0, 30));
    };

    socket.on('challenge_received', onChallengeReceived);
    socket.on('match_found', onMatchFound);
    socket.on('challenge_declined', onChallengeDeclined);
    socket.on('notification', onNotification);

    return () => {
      socket.off('challenge_received', onChallengeReceived);
      socket.off('match_found', onMatchFound);
      socket.off('challenge_declined', onChallengeDeclined);
      socket.off('notification', onNotification);
    };
  }, [authenticated, pathname, router]);

  const acceptChallenge = () => {
    if (!incomingChallenge) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('checkmate_token') ?? undefined : undefined;
    const socket = getSocket(token);
    socket.emit('accept_challenge', { challengeId: incomingChallenge.challengeId });
    setIncomingChallenge(null);
  };

  const declineChallenge = () => {
    if (!incomingChallenge) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('checkmate_token') ?? undefined : undefined;
    const socket = getSocket(token);
    socket.emit('decline_challenge', { challengeId: incomingChallenge.challengeId });
    setIncomingChallenge(null);
  };

  const markAllRead = async () => {
    await api.notifications.readAll().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = async (id: string) => {
    await api.notifications.read(id).catch(() => {});
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };


  return (
    <>
      <nav
        className="border-b border-white/[0.06] px-4 py-2.5 flex items-center justify-between sticky top-0 z-30 md:pl-64"
        style={{ background: 'rgba(11, 13, 12, 0.8)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)' }}
      >
        <div className="flex items-center gap-5">
          {/* Logo — mobile only (desktop has the sidebar) */}
          <Link href="/" className="flex items-center gap-2 shrink-0 md:hidden">
            <span className="w-8 h-8 rounded-lg bg-[#57b06a] flex items-center justify-center text-[#0b0d0c] text-lg font-black leading-none">♟</span>
            <span className="text-lg font-extrabold tracking-tight text-white">ELO</span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {authenticated && balance !== null && (
            <span className="text-sm text-[#57b06a] font-bold bg-[#57b06a]/10 border border-[#57b06a]/20 px-2.5 py-1 rounded-md hidden sm:inline">
              ${balance.toFixed(2)}
            </span>
          )}

          {/* Notification bell */}
          {authenticated && (
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen((o) => !o)}
                className="relative p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Notifications"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-10 w-80 bg-[#262421] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[200]">
                  <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                    <span className="font-bold text-sm">Notifications</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-white/40 hover:text-white transition-colors">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-center text-white/40 text-sm py-6">No notifications yet</p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => markRead(n.id)}
                          className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors flex gap-3 ${
                            !n.read ? 'bg-white/5' : ''
                          }`}
                        >
                          <span className="text-lg shrink-0 mt-0.5">{NOTIF_ICONS[n.type] ?? '🔔'}</span>
                          <div className="min-w-0">
                            <p className="text-sm text-white/90 leading-snug">{n.message}</p>
                            <p className="text-xs text-white/30 mt-0.5">{timeAgo(n.created_at)}</p>
                          </div>
                          {!n.read && (
                            <div className="w-2 h-2 bg-[#57b06a] rounded-full shrink-0 mt-1.5 ml-auto" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {ready && !authenticated && (
            <button onClick={login} className="btn-primary text-sm">
              Sign in
            </button>
          )}
          {authenticated && (
            <button onClick={logout} className="btn-secondary text-sm hidden md:inline-flex">
              Sign out
            </button>
          )}
        </div>
      </nav>

      {/* Incoming challenge notification */}
      {incomingChallenge && (
        <div className="fixed bottom-6 right-6 z-[100] card border border-[#f0b232]/40 shadow-2xl w-72">
          <p className="font-bold text-sm mb-1">⚔️ Challenge received!</p>
          <p className="text-sm text-white/70 mb-3">
            <span className="text-white font-semibold">{incomingChallenge.from.username}</span>{' '}
            ({incomingChallenge.from.elo} ELO) challenges you to a{' '}
            <span className="text-[#f0b232] font-semibold">${incomingChallenge.betAmount}</span> game
          </p>
          <div className="flex gap-2">
            <button onClick={acceptChallenge} className="btn-primary flex-1 text-sm py-1.5">Accept</button>
            <button onClick={declineChallenge} className="btn-secondary flex-1 text-sm py-1.5">Decline</button>
          </div>
        </div>
      )}

      {/* Challenge declined notice */}
      {declinedNotice && (
        <div className="fixed bottom-6 right-6 z-[100] card border border-red-500/30 text-red-400 text-sm w-64">
          {declinedNotice}
        </div>
      )}
    </>
  );
}
