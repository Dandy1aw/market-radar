import type { OpportunityCardData } from '@/lib/opportunity/types';
import { OpportunityCard } from './OpportunityCard';

interface OpportunityGroupProps {
  groupKey: string;
  title: string;
  cards: OpportunityCardData[];
}

export function OpportunityGroup({ groupKey, title, cards }: OpportunityGroupProps) {
  return (
    <section aria-labelledby={`${groupKey}-title`} className="space-y-3">
      <div className="flex items-center justify-between">
        <h2
          id={`${groupKey}-title`}
          className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]"
        >
          {title}
        </h2>
        <span className="text-xs text-[var(--muted)]">{cards.length}</span>
      </div>
      {cards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
          暂无匹配标的
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {cards.map(card => (
            <OpportunityCard key={card.symbol} card={card} />
          ))}
        </div>
      )}
    </section>
  );
}
