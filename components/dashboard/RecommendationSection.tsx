import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { RecommendationCard } from '@/types';

function RecCard({ item }: { item: RecommendationCard }) {
  return (
    <Card hover className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-mono text-[var(--muted)]">{item.symbol}</span>
          <p className="text-base font-semibold text-[var(--text)]">{item.name}</p>
        </div>
        <Badge variant="neutral" label={`${item.score}分`} />
      </div>
      <p className="text-sm text-[var(--muted)] leading-relaxed">{item.reason}</p>
      <p className="text-sm text-[var(--muted)] leading-relaxed">
        <span className="text-red-400/80 font-medium">风险：</span>{item.risk}
      </p>
      <p className="text-sm text-indigo-400 font-medium">{item.action_suggestion}</p>
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
      <h2 className="text-base font-bold text-[var(--text)] mb-3 flex items-center gap-2">
        <span>{emoji}</span>{title}
        <Badge variant={variant} label={String(items.length)} className="ml-0.5" />
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map(item => <RecCard key={`${item.symbol}-${item.recommendation_type}`} item={item} />)}
      </div>
    </section>
  );
}
