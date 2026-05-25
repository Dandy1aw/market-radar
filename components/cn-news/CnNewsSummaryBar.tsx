// components/cn-news/CnNewsSummaryBar.tsx
import type { CnNewsApiResponse } from '@/lib/cn-news/types';

interface CnNewsSummaryBarProps {
  data: CnNewsApiResponse;
}

export function CnNewsSummaryBar({ data }: CnNewsSummaryBarProps) {
  const { summary } = data;
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
        <p className="text-xs text-[var(--muted)]">活跃信号</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--text)]">{summary.total}</p>
      </div>
      <div className="rounded-xl border border-green-400/20 bg-green-400/5 p-3">
        <p className="text-xs text-[var(--muted)]">正面信号</p>
        <p className="mt-1 text-2xl font-semibold text-green-400">{summary.positive}</p>
      </div>
      <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-3">
        <p className="text-xs text-[var(--muted)]">负面信号</p>
        <p className="mt-1 text-2xl font-semibold text-red-400">{summary.negative}</p>
      </div>
      <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
        <p className="text-xs text-[var(--muted)]">高可信度</p>
        <p className="mt-1 text-2xl font-semibold text-amber-400">{summary.high_confidence}</p>
      </div>
    </section>
  );
}
