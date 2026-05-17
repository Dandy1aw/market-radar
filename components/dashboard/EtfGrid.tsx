import { IndexCard } from './IndexCard';
import type { IndicatorCard } from '@/types';

interface Props { etfs: IndicatorCard[]; }

export function EtfGrid({ etfs }: Props) {
  return (
    <section>
      <h2 className="text-base font-bold text-[var(--text)] mb-3">ETF 监控</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {etfs.map(etf => <IndexCard key={etf.symbol} data={etf} />)}
      </div>
    </section>
  );
}
