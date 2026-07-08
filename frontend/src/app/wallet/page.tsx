'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ChartPoint { day: string; income: number; expenses: number; }

function EarningsChart({ rawData }: { rawData: ChartPoint[] }) {
  const days: { date: string; net: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const found = rawData.find((r) => r.day === dateStr);
    days.push({ date: dateStr, net: found ? found.income - found.expenses : 0 });
  }

  const maxAbs = Math.max(0.001, ...days.map((d) => Math.abs(d.net)));
  const W = 300;
  const H = 80;
  const barW = 8;
  const gap = 2;
  const totalNet = days.reduce((s, d) => s + d.net, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/40">Last 30 days</span>
        <span className={`text-sm font-bold ${totalNet >= 0 ? 'text-[#57b06a]' : 'text-red-400'}`}>
          {totalNet >= 0 ? '+' : ''}{totalNet.toFixed(2)} net
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 80 }} preserveAspectRatio="none">
        <line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {days.map((d, i) => {
          const barH = Math.max(2, (Math.abs(d.net) / maxAbs) * (H - 8));
          const x = i * (barW + gap);
          const fill = d.net >= 0 ? '#57b06a' : '#ef4444';
          return (
            <rect key={d.date} x={x} y={H - barH - 1} width={barW} height={barH} fill={fill}
              opacity={d.net === 0 ? 0.15 : 0.75} rx="1" />
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-white/20 mt-1">
        <span>{days[0]?.date.slice(5)}</span>
        <span>{days[14]?.date.slice(5)}</span>
        <span>{days[29]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

const TX_TYPE_LABELS: Record<string, string> = {
  deposit: 'Credits',
  win: 'Game Win',
  loss: 'Game Loss',
  withdrawal: 'Withdrawal',
  refund: 'Refund',
  fee: 'Fee',
  bonus: 'Bonus',
  referral: 'Referral Earning',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function WalletPage() {
  const { authenticated, ready } = usePrivy();
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [referral, setReferral] = useState<{ referralCode: string | null; referralLink: string | null; referredCount: number; referralEarnings: number } | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);

  const [starterStatus, setStarterStatus] = useState<'idle' | 'claiming' | 'claimed' | 'already'>('idle');
  const [starterMsg, setStarterMsg] = useState('');
  const [topupStatus, setTopupStatus] = useState<'idle' | 'claiming' | 'claimed' | 'error'>('idle');
  const [topupMsg, setTopupMsg] = useState('');

  const loadData = async () => {
    const [b, txs, ref, chart] = await Promise.all([
      api.wallet.balance(),
      api.wallet.transactions(),
      api.users.referral(),
      api.wallet.earningsChart(),
    ]);
    setBalance(b.balance);
    setBonusBalance((b as any).bonusBalance ?? 0);
    setTransactions(txs);
    setReferral(ref);
    setChartData(chart);
  };

  useEffect(() => {
    if (ready && !authenticated) { router.push('/'); return; }
    if (!authenticated) return;
    loadData().catch(() => {});
  }, [authenticated, ready, router]);

  const claimStarter = async () => {
    setStarterStatus('claiming');
    try {
      const r = await api.dev.claimStarter();
      setStarterMsg(r.message);
      setStarterStatus('claimed');
      setBalance(r.balance);
      loadData().catch(() => {});
    } catch (err: any) {
      let msg = '';
      try { msg = JSON.parse(err?.message || '').error; } catch {}
      if (msg === 'Already claimed') {
        setStarterStatus('already');
        setStarterMsg('Already claimed');
      } else {
        setStarterStatus('idle');
      }
    }
  };

  const claimTopup = async () => {
    setTopupStatus('claiming');
    try {
      const r = await api.dev.topup();
      setTopupMsg(r.message);
      setTopupStatus('claimed');
      setBalance(r.balance);
      loadData().catch(() => {});
    } catch (err: any) {
      let msg = '';
      try { msg = JSON.parse(err?.message || '').error; } catch {}
      setTopupMsg(msg || 'Cannot top-up right now');
      setTopupStatus('error');
    }
  };

  const copyReferralLink = () => {
    if (referral?.referralLink) {
      navigator.clipboard.writeText(referral.referralLink);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold">Wallet</h1>

      {/* Balance */}
      <div className="card">
        <p className="text-sm text-white/50 mb-1">Available Balance</p>
        <p className="text-4xl font-bold text-[#57b06a]">${balance.toFixed(2)}</p>
        <p className="text-sm text-white/40 mt-1">Game credits</p>
        {bonusBalance > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs text-white/40">Lifetime bonus earned</span>
            <span className="text-xs font-semibold text-[#f0b232]">+${bonusBalance.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Free Credits */}
      <div className="card border border-[#57b06a]/20">
        <h2 className="text-lg font-bold mb-1">🎁 Free Credits</h2>
        <p className="text-sm text-white/50 mb-4">
          Claim free credits to start playing. No payment needed — just play and have fun!
        </p>

        <div className="grid grid-cols-2 gap-3">
          {/* Starter pack */}
          <div className="bg-white/5 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-[#f0b232] mb-1">$10</div>
            <div className="text-xs text-white/50 mb-3">Starter Pack · Once ever</div>
            {starterStatus === 'idle' && (
              <button onClick={claimStarter} className="btn-primary text-sm w-full">Claim $10</button>
            )}
            {starterStatus === 'claiming' && (
              <button disabled className="btn-primary text-sm w-full opacity-50">Claiming...</button>
            )}
            {(starterStatus === 'claimed') && (
              <p className="text-[#57b06a] text-sm font-semibold">✓ {starterMsg}</p>
            )}
            {starterStatus === 'already' && (
              <p className="text-white/40 text-xs">Already claimed</p>
            )}
          </div>

          {/* Top-up when broke */}
          <div className="bg-white/5 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-[#57b06a] mb-1">$5</div>
            <div className="text-xs text-white/50 mb-3">Low balance top-up · Daily</div>
            {(topupStatus === 'idle' || topupStatus === 'error') && (
              <button
                onClick={claimTopup}
                disabled={balance >= 1}
                className="btn-secondary text-sm w-full disabled:opacity-40"
              >
                {balance >= 1 ? 'Balance OK' : 'Get $5'}
              </button>
            )}
            {topupStatus === 'claiming' && (
              <button disabled className="btn-secondary text-sm w-full opacity-50">Claiming...</button>
            )}
            {topupStatus === 'claimed' && (
              <p className="text-[#57b06a] text-sm font-semibold">✓ {topupMsg}</p>
            )}
            {topupStatus === 'error' && (
              <p className="text-red-400 text-xs mt-1">{topupMsg}</p>
            )}
          </div>
        </div>

        <p className="text-xs text-white/30 mt-3 text-center">
          Win games to earn more · Daily login bonus · Complete missions for extra credits
        </p>
      </div>

      {/* Earnings chart */}
      <div className="card">
        <h2 className="text-lg font-bold mb-3">Earnings (30 days)</h2>
        <EarningsChart rawData={chartData} />
      </div>

      {/* Referral */}
      {referral && (
        <div className="card">
          <h2 className="text-lg font-bold mb-1">Refer &amp; Earn</h2>
          <p className="text-sm text-white/50 mb-4">
            Invite friends to play — you both benefit when they join.
          </p>
          {referral.referralLink ? (
            <>
              <div className="bg-black/30 rounded-lg p-3 flex items-center justify-between gap-3 mb-3">
                <code className="text-xs text-[#f0b232] break-all">{referral.referralLink}</code>
                <button onClick={copyReferralLink} className="btn-secondary text-xs shrink-0">
                  {copiedRef ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-[#f0b232]">{referral.referredCount}</div>
                  <div className="text-xs text-white/50 mt-0.5">Referred</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-[#57b06a]">${referral.referralEarnings.toFixed(2)}</div>
                  <div className="text-xs text-white/50 mt-0.5">Earned</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-white">{referral.referralCode}</div>
                  <div className="text-xs text-white/50 mt-0.5">Your code</div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-white/40">Referral code generating...</p>
          )}
        </div>
      )}

      {/* Transaction history */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <h2 className="font-bold">Transaction History</h2>
        </div>
        {transactions.length === 0 ? (
          <p className="text-white/40 text-center py-8 text-sm">No transactions yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs border-b border-white/5">
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2 text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const positive = tx.amount > 0;
                return (
                  <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-2 text-white/50 text-xs whitespace-nowrap">{formatDate(tx.created_at)}</td>
                    <td className="px-4 py-2 text-white/80">{TX_TYPE_LABELS[tx.type] || tx.type}</td>
                    <td className={`px-4 py-2 text-right font-semibold ${positive ? 'text-[#57b06a]' : 'text-red-400'}`}>
                      {positive ? '+' : ''}{tx.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {tx.game_id && (
                        <Link href={`/replay/${tx.game_id}`} className="text-xs text-white/40 hover:text-white">
                          Game ▶
                        </Link>
                      )}
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
