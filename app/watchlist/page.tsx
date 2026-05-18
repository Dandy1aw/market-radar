import { getWatchlistRows } from '@/lib/supabase/watchlist';
import { WatchlistClient } from '@/components/watchlist/WatchlistClient';

export const dynamic = 'force-dynamic';

export default async function WatchlistPage() {
  const rows = await getWatchlistRows();
  const initial = rows.map(r => ({
    ...r,
    name: r.name ?? '',
    category: r.category,
    created_at: '',
    updated_at: '',
  }));
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-[var(--text)]">自选股管理</h1>
      <WatchlistClient initial={initial} />
    </div>
  );
}
