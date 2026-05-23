import type { OpportunityApiResponse } from '@/lib/opportunity/types';

interface OpportunitySummaryBarProps {
  data: OpportunityApiResponse;
}

export function OpportunitySummaryBar({ data }: OpportunitySummaryBarProps) {
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
        <p className="text-xs text-[var(--muted)]">活跃机会</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--text)]">
          {data.summary.total}
        </p>
      </div>
      <div className="rounded-xl border border-green-400/20 bg-green-400/5 p-3">
        <p className="text-xs text-[var(--muted)]">强关注</p>
        <p className="mt-1 text-2xl font-semibold text-green-400">
          {data.summary.strong_watch}
        </p>
      </div>
      <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
        <p className="text-xs text-[var(--muted)]">回调候选</p>
        <p className="mt-1 text-2xl font-semibold text-amber-400">
          {data.summary.pullback_candidate}
        </p>
      </div>
      <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-3">
        <p className="text-xs text-[var(--muted)]">风险过高</p>
        <p className="mt-1 text-2xl font-semibold text-red-400">
          {data.summary.risk_high}
        </p>
      </div>
    </section>
  );
}
