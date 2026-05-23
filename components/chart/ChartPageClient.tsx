'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { StrategySignalGrid } from '@/components/strategy/StrategySignalGrid';
import { Badge } from '@/components/ui/Badge';
import { deriveIndicatorSignals } from '@/lib/strategy-signals';
import { formatPct, formatPrice, getPctColor, getRiskLabel } from '@/lib/utils';
import type {
  ChartApiResponse,
  IndicatorCard,
  MarketNews,
  RiskLevel,
} from '@/types';
import { KLineChart } from './KLineChart';
import { NewsSection } from './NewsSection';
import { RangeSelector, type ChartRange } from './RangeSelector';

interface ChartPageClientProps {
  symbol: string;
  indicator: IndicatorCard;
  news: MarketNews[];
}

const riskVariant: Record<RiskLevel, 'positive' | 'warning' | 'negative'> = {
  low: 'positive',
  medium: 'warning',
  high: 'negative',
  extreme: 'negative',
};

export function ChartPageClient({
  symbol,
  indicator,
  news,
}: ChartPageClientProps) {
  const router = useRouter();
  const [range, setRange] = useState<ChartRange>('3m');
  const [retryCount, setRetryCount] = useState(0);
  const [chartData, setChartData] = useState<ChartApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch(`/api/chart/${symbol}?range=${range}`, { cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ChartApiResponse>;
      })
      .then(data => {
        if (active) setChartData(data);
      })
      .catch(err => {
        if (active) setError((err as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [symbol, range, retryCount]);

  function handleRangeChange(nextRange: ChartRange) {
    if (nextRange === range) return;
    setLoading(true);
    setError(null);
    setRange(nextRange);
  }

  function handleRetry() {
    setLoading(true);
    setError(null);
    setRetryCount(count => count + 1);
  }

  const stats = [
    { label: '5日涨跌', value: indicator.pct_change_5d },
    { label: '20日涨跌', value: indicator.pct_change_20d },
    { label: '距 MA500', value: indicator.pct_from_ma500 },
    { label: '年内回撤', value: indicator.drawdown_1y },
  ];
  const strategySignals = deriveIndicatorSignals(indicator);

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="返回"
          className="mt-2 inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-[var(--border)] text-[var(--muted)] transition-colors hover:bg-[var(--bg-card-hover)] hover:text-[var(--text)]"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <span className="font-mono text-sm text-[var(--muted)]">
                {symbol}
              </span>
              <h1 className="text-lg font-semibold text-[var(--text)]">
                {indicator.name}
              </h1>
            </div>
            {indicator.risk_level && (
              <Badge
                variant={riskVariant[indicator.risk_level]}
                label={getRiskLabel(indicator.risk_level)}
              />
            )}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight tabular-nums">
              {formatPrice(indicator.close)}
            </span>
            {indicator.pct_change_1d !== null && (
              <span
                className={`text-base font-semibold tabular-nums ${getPctColor(indicator.pct_change_1d)}`}
              >
                {formatPct(indicator.pct_change_1d)}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="flex items-center justify-between gap-3">
        <RangeSelector value={range} onChange={handleRangeChange} />
      </div>

      {error ? (
        <div className="flex h-[500px] flex-col items-center justify-center gap-3 rounded-lg border border-[var(--border)] text-sm text-[var(--muted)]">
          <span>加载失败：{error}</span>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--bg-card-hover)]"
          >
            <RotateCcw size={14} aria-hidden="true" />
            重试
          </button>
        </div>
      ) : (
        <KLineChart data={chartData} loading={loading} />
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(({ label, value }) =>
          value !== null ? (
            <div
              key={label}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3"
            >
              <p className="mb-1 text-xs text-[var(--muted)]">{label}</p>
              <p
                className={`text-sm font-semibold tabular-nums ${getPctColor(value)}`}
              >
                {formatPct(value)}
              </p>
            </div>
          ) : null,
        )}
      </section>

      <section aria-labelledby="strategy-signals-title">
        <h2
          id="strategy-signals-title"
          className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]"
        >
          策略信号
        </h2>
        <StrategySignalGrid signals={strategySignals} />
      </section>

      <NewsSection news={news} />
    </div>
  );
}
