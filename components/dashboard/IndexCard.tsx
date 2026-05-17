import { formatPrice, formatPct, getPctColor, getRiskLabel } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { IndicatorCard, RiskLevel } from '@/types';

const riskVariant: Record<RiskLevel, 'positive' | 'warning' | 'negative'> = {
  low: 'positive', medium: 'warning', high: 'negative', extreme: 'negative',
};

interface Props { data: IndicatorCard; }

export function IndexCard({ data }: Props) {
  return (
    <Card hover>
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-xs font-mono text-[var(--muted)]">{data.symbol}</span>
          <p className="text-sm font-medium text-[var(--text)]">{data.name}</p>
        </div>
        {data.risk_level && (
          <Badge variant={riskVariant[data.risk_level]} label={getRiskLabel(data.risk_level)} />
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-xl font-semibold tabular-nums">{formatPrice(data.close)}</span>
        {data.pct_change_1d !== null && (
          <span className={`text-sm font-medium tabular-nums ${getPctColor(data.pct_change_1d)}`}>
            {formatPct(data.pct_change_1d)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
        {data.pct_change_5d !== null && (
          <>
            <span>5日</span>
            <span className={`tabular-nums ${getPctColor(data.pct_change_5d)}`}>{formatPct(data.pct_change_5d)}</span>
          </>
        )}
        {data.pct_change_20d !== null && (
          <>
            <span>20日</span>
            <span className={`tabular-nums ${getPctColor(data.pct_change_20d)}`}>{formatPct(data.pct_change_20d)}</span>
          </>
        )}
        {data.pct_from_ma500 !== null && (
          <>
            <span>距MA500</span>
            <span className={`tabular-nums ${getPctColor(data.pct_from_ma500)}`}>{formatPct(data.pct_from_ma500)}</span>
          </>
        )}
        {data.drawdown_1y !== null && (
          <>
            <span>年内回撤</span>
            <span className="tabular-nums text-red-400">{formatPct(data.drawdown_1y)}</span>
          </>
        )}
      </div>
    </Card>
  );
}
