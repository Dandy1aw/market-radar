// Run via: npx tsx scripts/generate-recommendations.ts
import { createClient } from '@supabase/supabase-js';
import { calcTotalScore, deriveRecommendationType, deriveRecommendationLevel } from '../lib/recommendation-engine';
import type { MarketIndicatorDaily, MarketNews } from '../types';
import { getEnabledSymbols } from '../lib/supabase/watchlist';

const REQUIRED_ENV = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) { console.error(`Missing required env var: ${key}`); process.exit(1); }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getLatestTradeDate(): Promise<string> {
  const { data } = await supabase
    .from('market_indicator_daily')
    .select('trade_date')
    .order('trade_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.trade_date as string) ?? new Date().toISOString().split('T')[0];
}

async function main() {
  const symbols = await getEnabledSymbols('US');
  if (symbols.length === 0) {
    console.error('No enabled US symbols in watchlist. Aborting.');
    process.exit(1);
  }

  const tradeDate = await getLatestTradeDate();
  const since48h = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

  const { data: indicators } = await supabase
    .from('market_indicator_daily')
    .select('*')
    .eq('trade_date', tradeDate)
    .in('symbol', symbols);

  const { data: watchlist } = await supabase
    .from('watchlist')
    .select('symbol, name, market, asset_type')
    .in('symbol', symbols);

  const meta = Object.fromEntries(
    ((watchlist ?? []) as { symbol: string; name: string; market: string; asset_type: string }[])
      .map(w => [w.symbol, w])
  );

  const recommendations = [];

  for (const ind of (indicators ?? []) as MarketIndicatorDaily[]) {
    const { data: news } = await supabase
      .from('market_news')
      .select('*')
      .eq('symbol', ind.symbol)
      .gte('published_at', since48h)
      .order('published_at', { ascending: false })
      .limit(5);

    const score = calcTotalScore(ind, (news ?? []) as MarketNews[]);
    const recType = deriveRecommendationType(score, ind.risk_level ?? 'low');
    const recLevel = deriveRecommendationLevel(score);
    const m = meta[ind.symbol];

    recommendations.push({
      trade_date: tradeDate,
      symbol: ind.symbol,
      name: m?.name ?? ind.symbol,
      market: m?.market ?? 'US',
      asset_type: m?.asset_type ?? 'stock',
      recommendation_type: recType,
      recommendation_level: recLevel,
      score,
      reason: `综合评分 ${score}/100。趋势: MA位置评分，结合近48h新闻情绪。`,
      risk: ind.risk_level === 'high' || ind.risk_level === 'extreme'
        ? `风险级别: ${ind.risk_level}，价格处于关键均线下方` : null,
      action_suggestion:
        recType === 'strong_watch' ? '可适量建仓或加仓' :
        recType === 'pullback_watch' ? '等待回调至均线支撑后分批买入' : '暂观望',
    });
  }

  if (recommendations.length > 0) {
    const { error } = await supabase
      .from('recommendation_daily')
      .upsert(recommendations, { onConflict: 'trade_date,symbol,recommendation_type' });
    if (error) throw error;
  }

  console.log(`Generated ${recommendations.length} recommendations for ${tradeDate}`);
}

main().catch(console.error);
