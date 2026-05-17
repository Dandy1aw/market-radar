import { Card } from '@/components/ui/Card';
import type { DcaSuggestion as DcaSuggestionType } from '@/types';

interface Props { dca: DcaSuggestionType; }

export function DcaSuggestion({ dca }: Props) {
  return (
    <Card>
      <h2 className="text-base font-bold text-[var(--text)] mb-4 tracking-tight">定投建议</h2>
      <div className="flex flex-wrap gap-3 mb-4">
        {dca.base.map(item => (
          <div key={item.symbol} className="flex items-center gap-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-4 py-2.5">
            <span className="text-sm font-mono text-indigo-300">{item.symbol}</span>
            <span className="text-base font-bold text-[var(--text)]">¥{item.amount.toLocaleString()}</span>
          </div>
        ))}
        <div className={`flex items-center gap-2 rounded-lg px-4 py-2.5 border ${
          dca.enhanced_triggered
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            : 'bg-[var(--bg)] border-[var(--border)] text-[var(--muted)]'
        }`}>
          <span className="text-sm font-medium">增强加仓：{dca.enhanced_triggered ? '已触发' : '未触发'}</span>
        </div>
      </div>
      <p className="text-sm text-[var(--muted)] leading-relaxed">{dca.reason}</p>
    </Card>
  );
}
