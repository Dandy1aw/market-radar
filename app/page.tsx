import { MarketStatusBanner } from '@/components/dashboard/MarketStatusBanner';
import { IndexCard } from '@/components/dashboard/IndexCard';
import { EtfGrid } from '@/components/dashboard/EtfGrid';
import { RecommendationSection } from '@/components/dashboard/RecommendationSection';
import { DcaSuggestion } from '@/components/dashboard/DcaSuggestion';
import { DailyReportCard } from '@/components/dashboard/DailyReportCard';
import type { DashboardData } from '@/types';

async function getDashboard(): Promise<DashboardData> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/dashboard`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch dashboard');
  return res.json();
}

export default async function DashboardPage() {
  const data = await getDashboard();

  return (
    <div className="space-y-6">
      <MarketStatusBanner status={data.market_status} tradeDate={data.trade_date} />

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)] mb-3">指数</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {data.index_cards.map(card => <IndexCard key={card.symbol} data={card} />)}
        </div>
      </section>

      <EtfGrid etfs={data.etf_cards} />

      <RecommendationSection title="强关注" emoji="🔥" variant="positive" items={data.strong_watch} />
      <RecommendationSection title="回调关注" emoji="📉" variant="warning" items={data.pullback_watch} />
      <RecommendationSection title="风险观察" emoji="⚠️" variant="negative" items={data.risk_watch} />
      <RecommendationSection title="A股板块" emoji="🇨🇳" variant="info" items={data.cn_sectors} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DcaSuggestion dca={data.dca} />
        <DailyReportCard report={data.daily_report} />
      </div>
    </div>
  );
}
