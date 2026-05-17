import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { RecommendationCard } from '@/types';

function RecCard({ item }: { item: RecommendationCard }) {
  return (
    <Card hover className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-mono text-[var(--muted)]">{item.symbol}</span>
          <p className="text-sm font-medium text-[var(--text)]">{item.name}</p>
        </div>
        <Badge variant="neutral" label={`${item.score}分`} />
      </div>
      <p className="text-xs text-[var(--muted)] leading-relaxed">{item.reason}</p>
      <p className="text-xs text-[var(--muted)] leading-relaxed">
        <span className="text-red-400/70">风险：</span>{item.risk}
      </p>
      <p className="text-xs text-indigo-400">{item.action_suggestion}</p>
    </Card>
  );
}

interface Props {
  title: string;
  emoji: string;
  items: RecommendationCard[];
  variant: 'positive' | 'warning' | 'negative' | 'info';
}

export function RecommendationSection({ title, emoji, items, variant }: Props) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="text-sm font-semibold text-[var(--muted)] mb-3 uppercase tracking-wider flex items-center gap-1.5">
        <span>{emoji}</span>{title}
        <Badge variant={variant} label={String(items.length)} className="ml-1" />
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map(item => <RecCard key={`${item.symbol}-${item.recommendation_type}`} item={item} />)}
      </div>
    </section>
  );
}
