import { MarketStatusBanner } from '@/components/dashboard/MarketStatusBanner';
import { TodayStrategyCard } from '@/components/dashboard/TodayStrategyCard';
import { IndexCard } from '@/components/dashboard/IndexCard';
import { DashboardIndexCharts } from '@/components/dashboard/DashboardIndexCharts';
import { EtfGrid } from '@/components/dashboard/EtfGrid';
import { RecommendationSection } from '@/components/dashboard/RecommendationSection';
import { DcaSuggestion } from '@/components/dashboard/DcaSuggestion';
import { DailyReportCard } from '@/components/dashboard/DailyReportCard';
import { OpportunityGroup } from '@/components/opportunity/OpportunityGroup';
import { OpportunitySummaryBar } from '@/components/opportunity/OpportunitySummaryBar';
import { getOpportunityData } from '@/lib/supabase/opportunity';
import type { DashboardData } from '@/types';

async function getDashboard(): Promise<DashboardData> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/dashboard`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch dashboard');
  return res.json();
}

export default async function DashboardPage() {
  const [data, opportunity] = await Promise.all([getDashboard(), getOpportunityData()]);

  return (
    <div className="space-y-6">
      <MarketStatusBanner status={data.market_status} tradeDate={data.trade_date} />

      <TodayStrategyCard data={data} />

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)] mb-3">指数</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {data.index_cards.map(card => <IndexCard key={card.symbol} data={card} />)}
        </div>
      </section>

      <DashboardIndexCharts />

      <EtfGrid etfs={data.etf_cards} />

      <OpportunitySummaryBar data={opportunity} />
      <OpportunityGroup groupKey="pullback-candidate" title="回调买入候选" cards={opportunity.groups.pullback_candidate} />
      <OpportunityGroup groupKey="strong-watch" title="继续强关注" cards={opportunity.groups.strong_watch} />
      <OpportunityGroup groupKey="risk-high" title="风险过高" cards={opportunity.groups.risk_high} />
      <OpportunityGroup groupKey="other" title="其他观察" cards={opportunity.groups.other} />

      <RecommendationSection title="A股板块" emoji="🇨🇳" variant="info" items={data.cn_sectors} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DcaSuggestion dca={data.dca} />
        <DailyReportCard report={data.daily_report} />
      </div>
    </div>
  );
}
