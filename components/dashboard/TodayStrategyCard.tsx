import { StrategySignalGrid } from '@/components/strategy/StrategySignalGrid';
import {
  deriveDashboardStrategy,
  type StrategyTone,
} from '@/lib/strategy-signals';
import type { DashboardData } from '@/types';

interface TodayStrategyCardProps {
  data: DashboardData;
}

const toneStyles: Record<StrategyTone, string> = {
  positive: 'border-green-400/20 bg-green-400/10 text-green-400',
  warning: 'border-amber-400/20 bg-amber-400/10 text-amber-400',
  negative: 'border-red-400/20 bg-red-400/10 text-red-400',
  neutral: 'border-gray-400/20 bg-gray-400/10 text-gray-400',
};

export function TodayStrategyCard({ data }: TodayStrategyCardProps) {
  const summary = deriveDashboardStrategy(data);

  return (
    <section aria-labelledby="today-strategy-title" className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="today-strategy-title"
            className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]"
          >
            {summary.title}
          </h2>
          <p className="mt-2 text-lg font-semibold text-[var(--text)]">
            {summary.label}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">{summary.detail}</p>
        </div>
        <span
          className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${toneStyles[summary.tone]}`}
        >
          {summary.tone === 'negative'
            ? '风险优先'
            : summary.tone === 'warning'
              ? '谨慎执行'
              : summary.tone === 'positive'
                ? '关注机会'
                : '按计划'}
        </span>
      </div>
      <StrategySignalGrid signals={summary.signals} />
    </section>
  );
}
