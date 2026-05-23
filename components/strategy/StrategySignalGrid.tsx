import type { StrategySignal, StrategyTone } from '@/lib/strategy-signals';

interface StrategySignalGridProps {
  signals: StrategySignal[];
}

const toneStyles: Record<StrategyTone, string> = {
  positive: 'border-green-400/20 bg-green-400/5 text-green-400',
  warning: 'border-amber-400/20 bg-amber-400/5 text-amber-400',
  negative: 'border-red-400/20 bg-red-400/5 text-red-400',
  neutral: 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)]',
};

export function StrategySignalGrid({ signals }: StrategySignalGridProps) {
  if (signals.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {signals.map(signal => (
        <div
          key={signal.title}
          className={`rounded-lg border p-3 ${toneStyles[signal.tone]}`}
        >
          <p className="mb-1 text-xs font-medium text-[var(--muted)]">
            {signal.title}
          </p>
          <p className="text-sm font-semibold">{signal.value}</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
            {signal.detail}
          </p>
        </div>
      ))}
    </div>
  );
}
