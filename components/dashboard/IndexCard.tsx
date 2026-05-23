import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { formatPrice, formatPct, getPctColor, getRiskLabel } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { IndicatorCard, RiskLevel } from '@/types';

const riskVariant: Record<RiskLevel, 'positive' | 'warning' | 'negative'> = {
  low: 'positive',
  medium: 'warning',
  high: 'negative',
  extreme: 'negative',
};

interface Props {
  data: IndicatorCard;
}

export function IndexCard({ data }: Props) {
  return (
    <Link
      href={`/chart/${data.symbol}`}
      className="group block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
    >
      <Card hover className="relative h-full">
        <ChevronRight
          size={16}
          aria-hidden="true"
          className="absolute right-3 top-3 text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100"
        />

        <div className="mb-3 flex items-start justify-between gap-3 pr-5">
          <div>
            <span className="font-mono text-sm text-[var(--muted)]">
              {data.symbol}
            </span>
            <p className="text-base font-semibold text-[var(--text)]">
              {data.name}
            </p>
          </div>
          {data.risk_level && (
            <Badge
              variant={riskVariant[data.risk_level]}
              label={getRiskLabel(data.risk_level)}
            />
          )}
        </div>

        <div className="mb-4 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight tabular-nums">
            {formatPrice(data.close)}
          </span>
          {data.pct_change_1d !== null && (
            <span
              className={`text-sm font-semibold tabular-nums ${getPctColor(data.pct_change_1d)}`}
            >
              {formatPct(data.pct_change_1d)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-[var(--muted)]">
          {data.pct_change_5d !== null && (
            <>
              <span>5日</span>
              <span
                className={`font-medium tabular-nums ${getPctColor(data.pct_change_5d)}`}
              >
                {formatPct(data.pct_change_5d)}
              </span>
            </>
          )}
          {data.pct_change_20d !== null && (
            <>
              <span>20日</span>
              <span
                className={`font-medium tabular-nums ${getPctColor(data.pct_change_20d)}`}
              >
                {formatPct(data.pct_change_20d)}
              </span>
            </>
          )}
          {data.pct_from_ma500 !== null && (
            <>
              <span>距MA500</span>
              <span
                className={`font-medium tabular-nums ${getPctColor(data.pct_from_ma500)}`}
              >
                {formatPct(data.pct_from_ma500)}
              </span>
            </>
          )}
          {data.drawdown_1y !== null && (
            <>
              <span>年内回撤</span>
              <span className="font-medium tabular-nums text-red-400">
                {formatPct(data.drawdown_1y)}
              </span>
            </>
          )}
        </div>
      </Card>
    </Link>
  );
}
