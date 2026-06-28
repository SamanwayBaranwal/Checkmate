const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('checkmate_token');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as T;
}

export const api = {
  auth: {
    verify: (privyUserId: string, wallet: string, referralCode?: string) =>
      request<{ token: string; user: any }>('/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ privyUserId, wallet, ...(referralCode ? { referralCode } : {}) }),
      }),
  },
  wallet: {
    balance: () => request<{ balance: number }>('/api/wallet/balance'),
    depositAddress: () => request<{ address: string; network: string; token: string; note: string }>('/api/wallet/deposit-address'),
    transactions: () => request<any[]>('/api/wallet/transactions'),
    withdraw: (amount: number, toAddress: string) =>
      request<{ txHash: string }>('/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount, toAddress }),
      }),
    earningsChart: () =>
      request<{ day: string; income: number; expenses: number }[]>('/api/wallet/earnings-chart'),
  },
  games: {
    active: () => request<any[]>('/api/games/active'),
    get: (id: string) => request<any>(`/api/games/${id}`),
  },
  users: {
    me: () => request<any>('/api/users/me'),
    profile: (id: string) => request<any>(`/api/users/${id}`),
    setUsername: (username: string) =>
      request<{ username: string }>('/api/users/me/username', {
        method: 'PATCH',
        body: JSON.stringify({ username }),
      }),
    saveSettings: (settings: Record<string, any>) =>
      request<{ settings: any }>('/api/users/me/settings', {
        method: 'PATCH',
        body: JSON.stringify(settings),
      }),
    search: (q: string) => request<any[]>(`/api/users/search?q=${encodeURIComponent(q)}`),
    dailyBonus: () =>
      request<{ credited: boolean; amount?: number; streak?: number; balance?: number; nextInMinutes?: number }>(
        '/api/users/me/daily-bonus', { method: 'POST' }
      ),
    referral: () =>
      request<{ referralCode: string | null; referralLink: string | null; referredCount: number; referralEarnings: number }>(
        '/api/users/me/referral'
      ),
    leaderboard: (tab?: 'elo' | 'earnings' | 'weekly' | 'referrals') =>
      request<any[]>(`/api/users/leaderboard${tab ? `?tab=${tab}` : ''}`),
    recentOpponents: () =>
      request<any[]>('/api/users/me/recent-opponents'),
    suggested: () =>
      request<any[]>('/api/users/me/suggested'),
    deleteAccount: (confirm: string) =>
      request<{ ok: boolean }>('/api/users/me', { method: 'DELETE', body: JSON.stringify({ confirm }) }),
  },
  friends: {
    list: () => request<{ friends: any[]; incoming: any[]; outgoing: any[] }>('/api/friends'),
    request: (targetId: string) =>
      request<{ ok: boolean }>('/api/friends/request', { method: 'POST', body: JSON.stringify({ targetId }) }),
    accept: (requesterId: string) =>
      request<{ ok: boolean }>('/api/friends/accept', { method: 'POST', body: JSON.stringify({ requesterId }) }),
    remove: (targetId: string) =>
      request<{ ok: boolean }>(`/api/friends/${targetId}`, { method: 'DELETE' }),
    leaderboard: () => request<any[]>('/api/friends/leaderboard'),
  },
  tournaments: {
    list: () => request<any[]>('/api/tournaments'),
    get: (id: string) => request<any>(`/api/tournaments/${id}`),
    create: (data: { name: string; entryFee: number; maxPlayers: number }) =>
      request<any>('/api/tournaments', { method: 'POST', body: JSON.stringify(data) }),
    join: (id: string) =>
      request<{ ok: boolean }>(`/api/tournaments/${id}/join`, { method: 'POST' }),
  },
  notifications: {
    list: () => request<any[]>('/api/notifications'),
    readAll: () => request<{ ok: boolean }>('/api/notifications/read-all', { method: 'POST' }),
    read: (id: string) => request<{ ok: boolean }>(`/api/notifications/${id}/read`, { method: 'POST' }),
  },
  missions: {
    list: () =>
      request<{
        missions: any[];
        weekStart: string;
        msUntilReset: number;
      }>('/api/missions'),
  },
  reports: {
    submit: (data: { reportedId: string; gameId?: string; reason: string; details?: string }) =>
      request<{ ok: boolean }>('/api/reports', { method: 'POST', body: JSON.stringify(data) }),
  },
  dev: {
    addBalance: () =>
      request<{ message: string; balance: number }>('/api/dev/add-balance', { method: 'POST' }),
  },
};
