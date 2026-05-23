import { OpportunityGroup } from '@/components/opportunity/OpportunityGroup';
import { OpportunitySummaryBar } from '@/components/opportunity/OpportunitySummaryBar';
import { getOpportunityData } from '@/lib/supabase/opportunity';

export const dynamic = 'force-dynamic';

export default async function OpportunityPage() {
  const data = await getOpportunityData();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
          Opportunity Radar
        </p>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
            自选机会雷达
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            只围绕核心关注池输出机会判断，关联公司仅作为证据信号。
          </p>
        </div>
        <p className="text-xs text-[var(--muted)]">
          更新时间 {new Date(data.updated_at).toLocaleString('zh-CN')}
        </p>
      </header>

      <OpportunitySummaryBar data={data} />

      <OpportunityGroup groupKey="pullback-candidate" title="回调买入候选" cards={data.groups.pullback_candidate} />
      <OpportunityGroup groupKey="strong-watch" title="继续强关注" cards={data.groups.strong_watch} />
      <OpportunityGroup groupKey="risk-high" title="风险过高" cards={data.groups.risk_high} />
      <OpportunityGroup groupKey="other" title="其他观察" cards={data.groups.other} />
    </div>
  );
}
