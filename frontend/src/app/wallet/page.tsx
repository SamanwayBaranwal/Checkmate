'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ChartPoint { day: string; income: number; expenses: number; }

function EarningsChart({ rawData }: { rawData: ChartPoint[] }) {
  // Build a filled 30-day array
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
        <span className={`text-sm font-bold ${totalNet >= 0 ? 'text-[#4caf50]' : 'text-red-400'}`}>
          {totalNet >= 0 ? '+' : ''}{totalNet.toFixed(2)} net
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 80 }}
        preserveAspectRatio="none"
      >
        {/* Baseline */}
        <line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {days.map((d, i) => {
          const barH = Math.max(2, (Math.abs(d.net) / maxAbs) * (H - 8));
          const x = i * (barW + gap);
          const fill = d.net >= 0 ? '#4caf50' : '#ef4444';
          return (
            <rect
              key={d.date}
              x={x}
              y={H - barH - 1}
              width={barW}
              height={barH}
              fill={fill}
              opacity={d.net === 0 ? 0.15 : 0.75}
              rx="1"
            />
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
  deposit: 'Deposit',
  win: 'Game Win',
  loss: 'Game Loss',
  withdrawal: 'Withdrawal',
  refund: 'Refund',
  fee: 'Fee',
  game_credit: 'Credit',
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
  const [depositInfo, setDepositInfo] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawResult, setWithdrawResult] = useState('');
  const [copied, setCopied] = useState(false);
  const [referral, setReferral] = useState<{ referralCode: string | null; referralLink: string | null; referredCount: number; referralEarnings: number } | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);

  useEffect(() => {
    if (ready && !authenticated) { router.push('/'); return; }
    if (!authenticated) return;

    Promise.all([
      api.wallet.balance(),
      api.wallet.depositAddress(),
      api.wallet.transactions(),
      api.users.referral(),
      api.wallet.earningsChart(),
    ]).then(([b, d, txs, ref, chart]) => {
      setBalance(b.balance);
      setDepositInfo(d);
      setTransactions(txs);
      setReferral(ref);
      setChartData(chart);
    }).catch(() => {});
  }, [authenticated, ready, router]);

  const copyAddress = () => {
    navigator.clipboard.writeText(depositInfo?.address || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyReferralLink = () => {
    if (referral?.referralLink) {
      navigator.clipboard.writeText(referral.referralLink);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0 || !withdrawAddress) return;
    if (amount > balance) { setWithdrawResult('Insufficient balance'); return; }

    setWithdrawing(true);
    setWithdrawResult('');
    try {
      const { txHash } = await api.wallet.withdraw(amount, withdrawAddress);
      setWithdrawResult(`Success! TX: ${txHash}`);
      const [b, txs] = await Promise.all([api.wallet.balance(), api.wallet.transactions()]);
      setBalance(b.balance);
      setTransactions(txs);
      setWithdrawAmount('');
      setWithdrawAddress('');
    } catch {
      setWithdrawResult('Withdrawal failed. Try again.');
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold">Wallet</h1>

      {/* Balance */}
      <div className="card">
        <p className="text-sm text-white/50 mb-1">Available Balance</p>
        <p className="text-4xl font-bold text-[#4caf50]">${balance.toFixed(2)}</p>
        <p className="text-sm text-white/40 mt-1">USDC on Base</p>
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
            Earn 10% of platform fees whenever someone you refer plays a game — forever.
          </p>
          {referral.referralLink ? (
            <>
              <div className="bg-black/30 rounded-lg p-3 flex items-center justify-between gap-3 mb-3">
                <code className="text-xs text-[#ffd700] break-all">{referral.referralLink}</code>
                <button onClick={copyReferralLink} className="btn-secondary text-xs shrink-0">
                  {copiedRef ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-[#ffd700]">{referral.referredCount}</div>
                  <div className="text-xs text-white/50 mt-0.5">Referred</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-[#4caf50]">${referral.referralEarnings.toFixed(2)}</div>
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

      {/* Deposit */}
      <div className="card">
        <h2 className="text-lg font-bold mb-3">Deposit USDC</h2>
        {depositInfo && (
          <>
            <p className="text-sm text-white/60 mb-3">{depositInfo.note}</p>
            <div className="bg-black/30 rounded-lg p-3 flex items-center justify-between gap-3 mb-2">
              <code className="text-xs text-[#4caf50] break-all">{depositInfo.address}</code>
              <button onClick={copyAddress} className="btn-secondary text-xs shrink-0">
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-white/40">Network: {depositInfo.network} · Token: {depositInfo.token}</p>
          </>
        )}
      </div>

      {/* Withdraw */}
      <div className="card">
        <h2 className="text-lg font-bold mb-3">Withdraw USDC</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-white/60 block mb-1">Amount (USDC)</label>
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              max={balance}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#4caf50]"
            />
          </div>
          <div>
            <label className="text-sm text-white/60 block mb-1">Destination wallet (Base)</label>
            <input
              type="text"
              value={withdrawAddress}
              onChange={(e) => setWithdrawAddress(e.target.value)}
              placeholder="0x..."
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-[#4caf50]"
            />
          </div>
          {withdrawResult && (
            <p className={`text-sm ${withdrawResult.startsWith('Success') ? 'text-[#4caf50]' : 'text-red-400'}`}>
              {withdrawResult}
            </p>
          )}
          <button
            onClick={handleWithdraw}
            disabled={withdrawing || !withdrawAmount || !withdrawAddress}
            className="btn-primary w-full"
          >
            {withdrawing ? 'Processing...' : 'Withdraw'}
          </button>
        </div>
      </div>

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
                    <td className={`px-4 py-2 text-right font-semibold ${positive ? 'text-[#4caf50]' : 'text-red-400'}`}>
                      {positive ? '+' : ''}{tx.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {tx.game_id && (
                        <Link href={`/replay/${tx.game_id}`} className="text-xs text-white/40 hover:text-white">
                          Game ▶
                        </Link>
                      )}
                      {tx.tx_hash && (
                        <span className="text-xs text-white/30 font-mono ml-1">
                          {tx.tx_hash.slice(0, 8)}…
                        </span>
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
