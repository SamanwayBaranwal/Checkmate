'use client';

import { useCallback, useEffect, useState } from 'react';
import { REAL_MONEY } from '@/lib/site';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Icon } from '@/components/Icons';

interface ChartPoint { day: string; income: number; expenses: number; }
type Referral = { referralCode: string | null; referralLink: string | null; referredCount: number; referralEarnings: number };

const money = (v: number) => `$${(Number(v) || 0).toFixed(2)}`;
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}$${Math.abs(v).toFixed(2)}`;

function EarningsChart({ rawData }: { rawData: ChartPoint[] }) {
  const days: { date: string; net: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const found = rawData.find((r) => r.day === dateStr);
    days.push({ date: dateStr, net: found ? Number(found.income) - Number(found.expenses) : 0 });
  }

  const maxAbs = Math.max(0.001, ...days.map((d) => Math.abs(d.net)));
  const W = 300;
  const H = 96;
  const mid = H / 2;
  const slot = W / days.length;
  const barW = slot * 0.62;
  const totalNet = days.reduce((s, d) => s + d.net, 0);
  const label = (s?: string) => (s ? new Date(s + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="eyebrow">Net, last 30 days</div>
          <div className={`text-2xl font-semibold num mt-1 ${totalNet > 0 ? 'text-positive' : totalNet < 0 ? 'text-negative' : 'text-ink'}`}>
            {signed(totalNet)}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-faint">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-positive" />Won</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-negative" />Lost</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24" preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" y1={mid} x2={W} y2={mid} className="stroke-line/10" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {days.map((d, i) => {
          const x = i * slot + (slot - barW) / 2;
          if (d.net === 0) return <rect key={d.date} x={x} y={mid - 1} width={barW} height={2} rx="1" className="fill-surface-3" />;
          const h = Math.max(3, (Math.abs(d.net) / maxAbs) * (mid - 4));
          return (
            <rect key={d.date} x={x} y={d.net > 0 ? mid - h : mid} width={barW} height={h} rx="1.5"
              className={d.net > 0 ? 'fill-positive' : 'fill-negative'} />
          );
        })}
      </svg>
      <div className="flex justify-between text-[11px] text-faint mt-2 num">
        <span>{label(days[0]?.date)}</span>
        <span>{label(days[15]?.date)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

const TX_TYPE_LABELS: Record<string, string> = {
  deposit: 'Credits added',
  win: 'Game won',
  loss: 'Game lost',
  withdrawal: 'Withdrawal',
  refund: 'Refund',
  fee: 'Fee',
  bonus: 'Bonus',
  daily_bonus: 'Daily bonus',
  first_deposit_bonus: 'First deposit bonus',
  referral: 'Referral earning',
  fairplay_refund: 'Fair-play refund',
  clawback: 'Fair-play correction',
};
const txLabel = (t: string) => TX_TYPE_LABELS[t] || (t ? t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' ') : 'Transaction');

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function WalletPage() {
  const { ready, authenticated, token, balance, setBalance, login } = useSession();
  const [bonusBalance, setBonusBalance] = useState(0);
  const [locked, setLocked] = useState(0);
  const [withdrawable, setWithdrawable] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [referral, setReferral] = useState<Referral | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [starterStatus, setStarterStatus] = useState<'idle' | 'claiming' | 'claimed' | 'already'>('idle');
  const [starterMsg, setStarterMsg] = useState('');
  const [topupStatus, setTopupStatus] = useState<'idle' | 'claiming' | 'claimed' | 'error'>('idle');
  const [topupMsg, setTopupMsg] = useState('');

  const loadData = useCallback(async () => {
    const [b, txs, ref, chart] = await Promise.all([
      api.wallet.balance().catch(() => null),
      api.wallet.transactions().catch(() => [] as any[]),
      api.users.referral().catch(() => null),
      api.wallet.earningsChart().catch(() => [] as ChartPoint[]),
    ]);
    if (b) {
      const bb = b as any;
      setBalance(bb.balance);
      setBonusBalance(bb.bonusBalance ?? 0);
      setLocked(bb.locked ?? 0);
      setWithdrawable(typeof bb.withdrawable === 'number' ? bb.withdrawable : null);
    }
    setTransactions(txs);
    setReferral(ref);
    setChartData(chart);
    setLoaded(true);
  }, [setBalance]);

  useEffect(() => {
    if (!token) return;
    loadData().catch(() => {});
  }, [token, loadData]);

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
      setTopupMsg(msg || 'Cannot top up right now');
      setTopupStatus('error');
    }
  };

  const copyReferralLink = () => {
    if (referral?.referralLink) {
      navigator.clipboard.writeText(referral.referralLink).catch(() => {});
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    }
  };

  if (!ready) return <div className="min-h-[60vh]" />;
  if (!authenticated) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-8 pt-16 flex justify-center">
        <div className="card w-full max-w-sm text-center p-6">
          <div className="avatar w-12 h-12 mx-auto text-accent"><Icon name="wallet" size={20} /></div>
          <h1 className="text-lg font-semibold mt-4">Sign in to see your wallet</h1>
          <p className="text-sm text-muted mt-1">Your balance, free credits and history live here.</p>
          <button onClick={login} className="btn-primary w-full h-12 mt-5">Sign in</button>
        </div>
      </div>
    );
  }

  const shownWithdrawable = withdrawable ?? Math.max(0, balance - locked);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 pt-5 md:pt-8 pb-10 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold">Wallet</h1>
        <p className="text-sm text-muted mt-1">Free game credits. No payment needed.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 [&>*]:min-w-0">
        {/* Balance */}
        <section className="card p-5 md:p-6 flex flex-col">
          <div className="eyebrow">Balance</div>
          <div className="text-4xl md:text-[44px] leading-none font-semibold num mt-3">{money(balance)}</div>
          {bonusBalance > 0 && (
            <p className="text-xs text-muted mt-2.5 num">Includes <span className="text-ink">{money(bonusBalance)}</span> in lifetime bonuses</p>
          )}
          {REAL_MONEY ? (
          <div className="mt-5 pt-4 border-t border-line/[0.06] space-y-3 md:mt-auto">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted flex items-center gap-2"><Icon name="check" size={15} className="text-positive" />Withdrawable</span>
              <span className="text-sm font-semibold num">{money(shownWithdrawable)}</span>
            </div>
            <div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted flex items-center gap-2"><Icon name="lock" size={15} className="text-faint" />Locked</span>
                <span className="text-sm font-semibold num">{money(locked)}</span>
              </div>
              <p className="text-xs text-faint mt-1 pl-[23px]">Winnings unlock after the fair-play check (about 48h).</p>
            </div>
          </div>
          ) : (
            <p className="mt-5 pt-4 border-t border-line/[0.06] md:mt-auto text-sm text-muted">
              Free credits for rated games. They have no cash value and can&apos;t be withdrawn.
            </p>
          )}
        </section>

        {/* Free credits */}
        <section className="card p-0 overflow-hidden flex flex-col">
          <div className="px-5 pt-5 pb-3">
            <h2 className="text-base font-semibold flex items-center gap-2"><Icon name="gift" size={17} className="text-accent" />Free credits</h2>
            <p className="text-sm text-muted mt-1">Claim credits to start playing.</p>
          </div>
          <div className="divide-y divide-line/[0.06] border-t border-line/[0.06]">
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">Starter pack <span className="num text-accent ml-1">$10</span></div>
                <div className="text-xs text-faint mt-0.5">Once per account</div>
              </div>
              {starterStatus === 'idle' && <button onClick={claimStarter} className="btn-primary h-11 px-5 shrink-0">Claim $10</button>}
              {starterStatus === 'claiming' && <button disabled className="btn-primary h-11 px-5 shrink-0">Claiming…</button>}
              {starterStatus === 'claimed' && (
                <span className="text-sm text-positive font-medium flex items-center gap-1.5 shrink-0 max-w-[50%] text-right"><Icon name="check" size={15} />{starterMsg || 'Claimed'}</span>
              )}
              {starterStatus === 'already' && <span className="pill shrink-0">Already claimed</span>}
            </div>
            <div className="px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">Top-up <span className="num text-accent ml-1">$5</span></div>
                  <div className="text-xs text-faint mt-0.5">Daily, when your balance is under $1</div>
                </div>
                {(topupStatus === 'idle' || topupStatus === 'error') && (
                  <button onClick={claimTopup} disabled={balance >= 1} className="btn-secondary h-11 px-5 shrink-0">
                    {balance >= 1 ? 'Not needed' : 'Get $5'}
                  </button>
                )}
                {topupStatus === 'claiming' && <button disabled className="btn-secondary h-11 px-5 shrink-0">Claiming…</button>}
                {topupStatus === 'claimed' && (
                  <span className="text-sm text-positive font-medium flex items-center gap-1.5 shrink-0 max-w-[50%] text-right"><Icon name="check" size={15} />{topupMsg || 'Added'}</span>
                )}
              </div>
              {topupStatus === 'error' && <p className="text-xs text-negative mt-2">{topupMsg}</p>}
            </div>
          </div>
          <p className="text-xs text-faint px-5 py-3.5 border-t border-line/[0.06] md:mt-auto">
            Win games, log in daily and build win streaks to earn more.
          </p>
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 [&>*]:min-w-0">
        {/* Earnings chart */}
        <section className="card p-5">
          <EarningsChart rawData={chartData} />
        </section>

        {/* Referral */}
        {referral && (
          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Invite friends</h2>
              {referral.referralCode && <span className="pill num text-ink">Code {referral.referralCode}</span>}
            </div>
            <p className="text-sm text-muted mt-1">You both benefit when they join and play.</p>
            {referral.referralLink ? (
              <>
                <div className="flex items-center gap-2 mt-4">
                  <div className="input flex-1 min-w-0 truncate text-muted select-all">{referral.referralLink}</div>
                  <button onClick={copyReferralLink} className="btn-secondary h-11 px-4 shrink-0">
                    <Icon name={copiedRef ? 'check' : 'copy'} size={15} />{copiedRef ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {[
                    { label: 'Friends invited', value: String(referral.referredCount) },
                    { label: 'Earned from invites', value: money(referral.referralEarnings) },
                  ].map((s) => (
                    <div key={s.label} className="rounded-[10px] bg-surface-2 px-3 py-2.5 min-w-0">
                      <div className="text-xs text-faint">{s.label}</div>
                      <div className="text-sm font-semibold num mt-0.5 truncate">{s.value}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-faint mt-4">Generating your referral code…</p>
            )}
          </section>
        )}
      </div>

      {/* Transaction history */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">History</h2>
          {transactions.length > 0 && <span className="text-xs text-faint num">{transactions.length} transactions</span>}
        </div>
        {!loaded ? (
          <div className="card p-0 divide-y divide-line/[0.06] overflow-hidden">
            {[0, 1, 2].map((i) => (
              <div key={i} className="px-4 py-3.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-surface-2 animate-pulse" />
                <div className="flex-1 space-y-1.5"><div className="h-3 w-28 rounded bg-surface-2 animate-pulse" /><div className="h-2.5 w-20 rounded bg-surface-2 animate-pulse" /></div>
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-sm font-medium">No transactions yet</p>
            <p className="text-sm text-muted mt-1">Claim your free credits to get started.</p>
          </div>
        ) : (
          <div className="card p-0 divide-y divide-line/[0.06] overflow-hidden">
            {transactions.map((tx) => {
              const amt = Number(tx.amount) || 0;
              const pos = amt > 0;
              const inner = (
                <>
                  <span className={`avatar w-9 h-9 ${pos ? 'text-positive' : amt < 0 ? 'text-negative' : 'text-muted'}`}>
                    <Icon name={tx.game_id ? 'games' : pos ? 'plus' : 'arrow-up-right'} size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{txLabel(tx.type)}</div>
                    <div className="text-xs text-faint mt-0.5">{formatDate(tx.created_at)}</div>
                  </div>
                  <span className={`text-sm font-semibold num ${pos ? 'text-positive' : amt < 0 ? 'text-negative' : 'text-muted'}`}>
                    {signed(amt)}
                  </span>
                  {tx.game_id && <Icon name="chevron-right" size={16} className="text-faint -mr-1" />}
                </>
              );
              return tx.game_id ? (
                <Link key={tx.id} href={`/replay/${tx.game_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors" aria-label={`${txLabel(tx.type)}, view replay`}>
                  {inner}
                </Link>
              ) : (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3">{inner}</div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
