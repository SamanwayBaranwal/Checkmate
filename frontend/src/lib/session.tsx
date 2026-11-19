'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { api } from '@/lib/api';

/**
 * One session for the whole app (before: only the home page created the backend session, so opening
 * /wallet directly after a refresh could break). Privy handles sign-in; this exchanges the Privy token
 * for our backend token once, and shares token / profile / balance with every page.
 *
 * UI preview (local development only): with NEXT_PUBLIC_UI_PREVIEW=1, opening any page with
 * ?preview_token=<backend token> signs in without Privy so screens can be checked/screenshotted.
 */
const PREVIEW = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_UI_PREVIEW === '1';
const TOKEN_KEY = 'checkmate_token';

type Me = {
  id: string; username: string | null; wallet: string; elo: number;
  gamesPlayed?: number; gamesWon?: number; [k: string]: any;
};

type Session = {
  ready: boolean;
  authenticated: boolean;
  token: string;
  me: Me | null;
  balance: number;
  setBalance: (fn: number | ((b: number) => number)) => void;
  refresh: () => Promise<void>;
  login: () => void;
  logout: () => Promise<void>;
  bonus: { streak: number; amount: number } | null;
  dismissBonus: () => void;
};

const Ctx = createContext<Session | null>(null);

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSession must be used inside <SessionProvider>');
  return s;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const privy = usePrivy();
  const [token, setToken] = useState('');
  const [me, setMe] = useState<Me | null>(null);
  const [balance, setBalance] = useState(0);
  const [ready, setReady] = useState(false);
  const [bonus, setBonus] = useState<{ streak: number; amount: number } | null>(null);
  const started = useRef(false);

  const refresh = useCallback(async () => {
    const [m, b] = await Promise.all([api.users.me().catch(() => null), api.wallet.balance().catch(() => null)]);
    if (m) setMe(m);
    if (b) setBalance(b.balance);
  }, []);

  const startSession = useCallback(async (t: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    await refresh();
    setReady(true);
    try {
      const d = await api.users.dailyBonus();
      if (d.credited && d.amount && d.streak) {
        setBalance((x) => x + d.amount!);
        setBonus({ streak: d.streak!, amount: d.amount! });
        setTimeout(() => setBonus(null), 6000);
      }
    } catch {}
  }, [refresh]);

  // Preview mode (dev only): token from ?preview_token= or localStorage, no Privy
  useEffect(() => {
    if (!PREVIEW || started.current) return;
    const fromUrl = new URLSearchParams(window.location.search).get('preview_token');
    const t = fromUrl || localStorage.getItem(TOKEN_KEY);
    if (t) { started.current = true; startSession(t); }
  }, [startSession]);

  // Normal mode: exchange the Privy access token for our backend session once
  useEffect(() => {
    if (!privy.ready) return;
    if (PREVIEW && started.current) return;
    if (!privy.authenticated) {
      if (!PREVIEW || !localStorage.getItem(TOKEN_KEY)) {
        localStorage.removeItem(TOKEN_KEY);
        setToken(''); setMe(null); setReady(true);
      }
      return;
    }
    if (started.current || !privy.user) return;
    started.current = true;
    (async () => {
      try {
        const accessToken = await privy.getAccessToken();
        const u = privy.user!;
        const wallet = u.wallet?.address || (u.linkedAccounts?.find((a: any) => a.type === 'wallet') as any)?.address;
        if (!accessToken || !wallet) { started.current = false; return; }
        const urlRef = new URLSearchParams(window.location.search).get('ref') ?? undefined;
        if (urlRef) localStorage.setItem('checkmate_ref', urlRef);
        const referralCode = urlRef || localStorage.getItem('checkmate_ref') || undefined;
        const { token: t } = await api.auth.verify(accessToken, wallet, referralCode);
        if (referralCode) localStorage.removeItem('checkmate_ref');
        await startSession(t);
      } catch (err) {
        console.error('Sign-in failed:', err);
        started.current = false;
        setReady(true);
      }
    })();
  }, [privy.ready, privy.authenticated, privy.user, privy, startSession]);

  // Keep the balance fresh while signed in
  useEffect(() => {
    if (!token) return;
    const t = setInterval(() => { api.wallet.balance().then((b) => setBalance(b.balance)).catch(() => {}); }, 15000);
    return () => clearInterval(t);
  }, [token]);

  const logout = useCallback(async () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(''); setMe(null); setBalance(0);
    started.current = false;
    await privy.logout().catch(() => {});
  }, [privy]);

  const value: Session = {
    ready: PREVIEW ? ready || privy.ready : privy.ready && (ready || !privy.authenticated),
    authenticated: !!token,
    token,
    me,
    balance,
    setBalance,
    refresh,
    login: privy.login,
    logout,
    bonus,
    dismissBonus: () => setBonus(null),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
