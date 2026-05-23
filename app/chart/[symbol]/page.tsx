import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import { ChartPageClient } from '@/components/chart/ChartPageClient';
import { getMockIndicatorCard } from '@/lib/mock-chart';
import { hasSupabaseConfig } from '@/lib/supabase/env';
import type { IndicatorCard, MarketNews, RiskLevel } from '@/types';

export const dynamic = 'force-dynamic';

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function toNullableNumber(value: unknown): number | null {
  return value != null ? Number(value) : null;
}

export default async function ChartPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const upperSymbol = symbol.toUpperCase();

  if (!hasSupabaseConfig()) {
    const indicator = getMockIndicatorCard(upperSymbol);
    if (!indicator) notFound();

    return (
      <div className="mx-auto max-w-5xl px-0 py-1 sm:px-2">
        <ChartPageClient symbol={upperSymbol} indicator={indicator} news={[]} />
      </div>
    );
  }

  const supabase = createAdminClient();

  const [indicatorRes, nameRes, newsRes] = await Promise.all([
    supabase
      .from('market_indicator_daily')
      .select('*')
      .eq('symbol', upperSymbol)
      .order('trade_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('watchlist')
      .select('name')
      .eq('symbol', upperSymbol)
      .maybeSingle(),
    supabase
      .from('market_news')
      .select('*')
      .eq('symbol', upperSymbol)
      .order('published_at', { ascending: false })
      .limit(5),
  ]);

  if (!indicatorRes.data) notFound();

  const row = indicatorRes.data as Record<string, unknown>;
  const indicator: IndicatorCard = {
    symbol: upperSymbol,
    name: (nameRes.data?.name as string | undefined) ?? upperSymbol,
    trade_date: row.trade_date as string,
    close: Number(row.close),
    pct_change_1d: toNullableNumber(row.pct_change_1d),
    pct_change_5d: toNullableNumber(row.pct_change_5d),
    pct_change_20d: toNullableNumber(row.pct_change_20d),
    ma20: toNullableNumber(row.ma20),
    ma60: toNullableNumber(row.ma60),
    ma250: toNullableNumber(row.ma250),
    ma500: toNullableNumber(row.ma500),
    ma1000: toNullableNumber(row.ma1000),
    pct_from_ma500: toNullableNumber(row.pct_from_ma500),
    pct_from_ma1000: toNullableNumber(row.pct_from_ma1000),
    drawdown_1y: toNullableNumber(row.drawdown_1y),
    volume_ratio: toNullableNumber(row.volume_ratio),
    risk_level: (row.risk_level as RiskLevel) ?? null,
  };
  const news = (newsRes.data ?? []) as MarketNews[];

  return (
    <div className="mx-auto max-w-5xl px-0 py-1 sm:px-2">
      <ChartPageClient
        symbol={upperSymbol}
        indicator={indicator}
        news={news}
      />
    </div>
  );
}
