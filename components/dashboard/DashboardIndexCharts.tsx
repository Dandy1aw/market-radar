'use client';

import { RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { KLineChart } from '@/components/chart/KLineChart';
import type { ChartApiResponse } from '@/types';

const INDEX_CHARTS = [
  { symbol: 'NDX', title: '纳指 K线' },
  { symbol: 'SPX', title: '标普500 K线' },
] as const;

type IndexSymbol = (typeof INDEX_CHARTS)[number]['symbol'];

export function DashboardIndexCharts() {
  const [retryCount, setRetryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [charts, setCharts] = useState<Partial<Record<IndexSymbol, ChartApiResponse>>>(
    {},
  );

  useEffect(() => {
    let active = true;

    Promise.all(
      INDEX_CHARTS.map(async item => {
        const res = await fetch(`/api/chart/${item.symbol}?range=3m`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return [item.symbol, (await res.json()) as ChartApiResponse] as const;
      }),
    )
      .then(entries => {
        if (!active) return;
        setCharts(Object.fromEntries(entries));
        setError(null);
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
  }, [retryCount]);

  function handleRetry() {
    setLoading(true);
    setError(null);
    setRetryCount(count => count + 1);
  }

  if (error) {
    return (
      <section aria-labelledby="index-charts-title">
        <h2
          id="index-charts-title"
          className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]"
        >
          指数 K线
        </h2>
        <div className="flex h-[260px] flex-col items-center justify-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--muted)]">
          <span>K线加载失败：{error}</span>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--bg-card-hover)]"
          >
            <RotateCcw size={14} aria-hidden="true" />
            重试
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="index-charts-title">
      <h2
        id="index-charts-title"
        className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]"
      >
        指数 K线
      </h2>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {INDEX_CHARTS.map(item => (
          <div
            key={item.symbol}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3"
          >
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold text-[var(--text)]">
                {item.title}
              </h3>
              <span className="font-mono text-xs text-[var(--muted)]">
                {item.symbol}
              </span>
            </div>
            <KLineChart
              compact
              data={charts[item.symbol] ?? null}
              height={340}
              loading={loading}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
