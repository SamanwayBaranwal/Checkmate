'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Icon } from '@/components/Icons';

export type Fetcher = (path: string, secret: string, init?: RequestInit) => Promise<any>;

// ─── Small shared admin UI bits (also used by page.tsx and FairPlayTab.tsx) ───

export const short = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—');
export const money = (v: number | string | null | undefined) => `$${Number(v ?? 0).toFixed(2)}`;
/** Postgres numerics arrive as strings; null stays null. */
export const toNum = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));

export function timeAgo(iso?: string | null) {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function timeUntil(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  if (diff <= 0) return 'Unlocking now';
  if (diff > 365 * 86400) return 'Locked until reviewed';
  if (diff < 3600) return `Unlocks in ${Math.max(1, Math.ceil(diff / 60))}m`;
  if (diff < 86400) return `Unlocks in ${Math.ceil(diff / 3600)}h`;
  return `Unlocks in ${Math.ceil(diff / 86400)}d`;
}

/** Suspicion / score colour: high = negative, medium = accent, low = muted. */
export const sevColor = (s: number | null | undefined) =>
  s == null ? 'text-faint' : s >= 60 ? 'text-negative' : s >= 35 ? 'text-accent' : 'text-ink';

export const PILL_NEGATIVE = 'pill bg-negative/10 border-negative/25 text-negative';
export const PILL_POSITIVE = 'pill bg-positive/10 border-positive/25 text-positive';
export const BTN_POSITIVE = 'btn bg-positive/15 text-positive border border-positive/30 hover:bg-positive/25';

const STATUS: Record<string, { cls: string; label: string }> = {
  clean: { cls: PILL_POSITIVE, label: 'Clean' },
  watch: { cls: 'pill pill-accent', label: 'Watch' },
  review: { cls: PILL_NEGATIVE, label: 'Review' },
};

export function StatusPill({ status }: { status?: string | null }) {
  const s = STATUS[status || 'clean'] ?? { cls: 'pill', label: status };
  return <span className={`${s.cls} shrink-0`}>{s.label}</span>;
}

export function ConfirmSheet({
  title, children, confirmLabel, tone = 'danger', busy, disabled, onConfirm, onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'positive' | 'primary';
  busy?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const btn = tone === 'danger' ? 'btn-danger' : tone === 'positive' ? BTN_POSITIVE : 'btn-primary';
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onCancel} className="btn-ghost p-2 -mr-2 -mt-1" aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <div className="text-sm text-muted space-y-3">{children}</div>
        <div className="grid grid-cols-2 gap-2 mt-6">
          <button onClick={onCancel} className="btn-secondary h-12">Cancel</button>
          <button onClick={onConfirm} disabled={busy || disabled} className={`${btn} h-12`}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Toast({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="fixed z-[100] left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 bottom-[calc(84px+env(safe-area-inset-bottom))] md:bottom-8 card py-2.5 px-4 text-sm shadow-pop animate-in text-center">
      {text}
    </div>
  );
}

// ─── Payouts ───

type Hold = {
  id: string;
  amount: number;
  status: 'needs_approval' | 'held';
  reason: string | null;
  release_at: string;
  created_at: string;
  game_id: string | null;
  user_id: string;
  username: string | null;
  wallet: string;
  elo: number;
  fairplay_status: string;
  fairplay_score: number;
  suspicion: number | string | null;
  engine_match: number | string | null;
  acpl: number | string | null;
  blur_rate: number | string | null;
};

type Filter = 'needs_approval' | 'held';

function Metric({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-2.5 py-2 min-w-0">
      <div className="text-[11px] text-faint truncate">{label}</div>
      <div className={`text-sm font-semibold num mt-0.5 ${tone}`}>{value}</div>
    </div>
  );
}

function PayoutCard({ h, busy, onApprove, onReject }: { h: Hold; busy: boolean; onApprove: () => void; onReject: () => void }) {
  const name = h.username || short(h.wallet);
  const suspicion = toNum(h.suspicion);
  const engine = toNum(h.engine_match);
  const acpl = toNum(h.acpl);
  const blur = toNum(h.blur_rate);
  const analysed = suspicion !== null;

  return (
    <div className="card p-4 md:p-5 flex flex-col gap-4 animate-in">
      <div className="flex items-start gap-3">
        <span className="avatar w-10 h-10 text-sm">{name[0]?.toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{name}</div>
          <div className="text-xs text-faint num truncate">{h.username ? `${short(h.wallet)} · ` : ''}{h.elo} ELO</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-semibold num leading-tight">{money(h.amount)}</div>
          <div className="text-xs text-muted mt-0.5">won {timeAgo(h.created_at)}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={h.fairplay_status} />
        <span className="text-xs text-muted num">Account score {h.fairplay_score ?? 0}</span>
        {h.status === 'held' && (
          <span className="pill num ml-auto"><Icon name="lock" size={12} /> {timeUntil(h.release_at)}</span>
        )}
      </div>
      {h.reason && <p className="text-xs text-muted -mt-2">Held because: {h.reason}</p>}

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="eyebrow">This game</span>
          {h.game_id && (
            <a href={`/replay/${h.game_id}`} target="_blank" rel="noreferrer" className="text-xs text-muted hover:text-ink inline-flex items-center gap-1">
              Replay <Icon name="arrow-up-right" size={12} />
            </a>
          )}
        </div>
        {analysed ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Metric label="Suspicion" value={String(suspicion)} tone={sevColor(suspicion)} />
            <Metric label="Near-engine" value={engine === null ? '—' : `${Math.round(engine)}%`} />
            <Metric label="ACPL" value={acpl === null ? '—' : String(Math.round(acpl * 10) / 10)} />
            <Metric label="Tab switches" value={blur === null ? '—' : `${Math.round(blur * 100)}%`} tone={blur !== null && blur >= 0.5 ? 'text-negative' : ''} />
          </div>
        ) : (
          <p className="text-sm text-faint rounded-lg bg-surface-2 px-3 py-2.5">
            {h.game_id ? 'Not analysed yet.' : 'No game linked to this payout.'}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-auto">
        <button onClick={onReject} disabled={busy} className="btn-danger h-11">Reject</button>
        <button onClick={onApprove} disabled={busy} className={`${BTN_POSITIVE} h-11`}>
          <Icon name="check" size={16} /> Approve
        </button>
      </div>
    </div>
  );
}

export default function PayoutsTab({ secret, adminFetch, onChange }: { secret: string; adminFetch: Fetcher; onChange?: () => void }) {
  const [filter, setFilter] = useState<Filter>(() => {
    if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
      // dev-only: ?filter=held opens the locked list (for local screenshots)
      if (new URLSearchParams(window.location.search).get('filter') === 'held') return 'held';
    }
    return 'needs_approval';
  });
  const [rows, setRows] = useState<Hold[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Hold | null>(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2800); };

  const load = useCallback(async () => {
    setError('');
    try {
      setRows(await adminFetch(`/api/admin/payouts?status=${filter}`, secret));
    } catch (e: any) { setError(e.message); setRows([]); }
  }, [filter, secret, adminFetch]);

  useEffect(() => { setRows(null); load(); }, [load]);

  const act = async (h: Hold, action: 'approve' | 'reject') => {
    setBusyId(h.id);
    try {
      const r = await adminFetch(`/api/admin/payouts/${h.id}/${action}`, secret, { method: 'POST', body: '{}' });
      const name = h.username || short(h.wallet);
      if (r?.ok === false) flash('Already decided. List refreshed.');
      else flash(action === 'approve' ? `Approved ${money(h.amount)} for ${name}` : `Rejected. ${name} moved to fair-play review`);
      setRows((rs) => (rs ? rs.filter((x) => x.id !== h.id) : rs));
      setRejecting(null);
      onChange?.();
      load();
    } catch (e: any) { setError(e.message); } finally { setBusyId(null); }
  };

  const total = (rows ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="segmented whitespace-nowrap">
            <button data-active={filter === 'needs_approval'} onClick={() => setFilter('needs_approval')}>Waiting for approval</button>
            <button data-active={filter === 'held'} onClick={() => setFilter('held')}>Locked (cooling period)</button>
          </div>
        </div>
        {rows && rows.length > 0 && (
          <div className="text-sm text-muted num">
            {rows.length} {rows.length === 1 ? 'payout' : 'payouts'} · <span className="text-ink font-semibold">{money(total)}</span>
          </div>
        )}
      </div>

      <p className="text-sm text-muted max-w-2xl">
        {filter === 'needs_approval'
          ? 'Large or flagged wins. Approve to make the money withdrawable now. Reject keeps it locked and sends the player to fair-play review.'
          : 'Wins in the automatic cooling period. They unlock on their own once the fair-play check is clean. You can approve one early or reject it.'}
      </p>

      {error && <div className="card border-negative/30 text-sm text-negative">{error}</div>}

      {rows === null ? (
        <div className="card text-center py-12 text-sm text-faint">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-sm font-medium">{filter === 'needs_approval' ? 'Nothing waiting for approval' : 'No winnings in the cooling period'}</p>
          <p className="text-sm text-muted mt-1">
            {filter === 'needs_approval' ? 'Big or flagged wins will show up here.' : 'Fresh wins sit here until their check finishes.'}
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-3">
          {rows.map((h) => (
            <PayoutCard key={h.id} h={h} busy={busyId === h.id}
              onApprove={() => act(h, 'approve')} onReject={() => setRejecting(h)} />
          ))}
        </div>
      )}

      {rejecting && (
        <ConfirmSheet
          title={`Reject ${money(rejecting.amount)}?`}
          confirmLabel="Reject payout"
          busy={busyId === rejecting.id}
          onCancel={() => setRejecting(null)}
          onConfirm={() => act(rejecting, 'reject')}
        >
          <p>
            The money stays locked and <span className="text-ink font-medium">{rejecting.username || short(rejecting.wallet)}</span> goes
            to fair-play review. Their withdrawals pause until you confirm or clear them in the Fair play tab.
          </p>
        </ConfirmSheet>
      )}

      <Toast text={toast} />
    </div>
  );
}
