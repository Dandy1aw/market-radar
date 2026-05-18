import { createClient } from '@supabase/supabase-js';
import type {
  DashboardData,
  IndicatorCard,
  RecommendationCard,
  RiskLevel,
  Market,
  AssetType,
  RecommendationType,
} from '@/types';

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}


function deriveMarketStatus(
  ndx: IndicatorCard | undefined,
  vix: IndicatorCard | undefined,
) {
  const vixClose = vix?.close ?? 0;
  const ndxRisk = ndx?.risk_level;

  if (vixClose > 30 || ndxRisk === 'extreme') {
    return {
      label: '极端区 — 高度警惕，暂停定投',
      level: 'risk' as const,
      description: 'VIX 超过 30 或 NDX 处于极端风险区，建议暂停所有加仓操作。',
    };
  }
  if (vixClose > 25 || ndxRisk === 'high') {
    return {
      label: '风险区 — 谨慎操作，缩减仓位',
      level: 'risk' as const,
      description: 'VIX 高位或 NDX 跌破 MA500，市场下行风险显著。',
    };
  }
  if (vixClose > 20 || ndxRisk === 'medium') {
    return {
      label: '关注区 — 市场波动加大，注意回撤',
      level: 'caution' as const,
      description: 'VIX 偏高或 NDX 有回调压力，维持基础定投但暂缓增强。',
    };
  }
  return {
    label: '正常区 — 趋势良好，维持基础定投',
    level: 'normal' as const,
    description: 'NDX 站稳 MA500 上方，VIX 处于低位，市场情绪稳定。',
  };
}

async function getLatestTradeDate(supabase: ReturnType<typeof createAdminClient>): Promise<string> {
  const { data } = await supabase
    .from('market_indicator_daily')
    .select('trade_date')
    .order('trade_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.trade_date as string) ?? new Date().toISOString().split('T')[0];
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = createAdminClient();
  const tradeDate = await getLatestTradeDate(supabase);

  const [indicatorsRes, watchlistRes, recommendationsRes, reportRes] =
    await Promise.all([
      supabase
        .from('market_indicator_daily')
        .select('*')
        .eq('trade_date', tradeDate),
      supabase
        .from('watchlist')
        .select('symbol, name, market, asset_type')
        .eq('enabled', true),
      supabase
        .from('recommendation_daily')
        .select('*')
        .eq('trade_date', tradeDate)
        .order('score', { ascending: false }),
      supabase
        .from('daily_report')
        .select('*')
        .eq('trade_date', tradeDate)
        .maybeSingle(),
    ]);

  const nameMap = Object.fromEntries(
    (
      (watchlistRes.data ?? []) as { symbol: string; name: string }[]
    ).map(w => [w.symbol, w.name]),
  );

  const assetTypeMap = Object.fromEntries(
    (
      (watchlistRes.data ?? []) as { symbol: string; asset_type: string }[]
    ).map(w => [w.symbol, w.asset_type]),
  );

  const rawIndicators = (indicatorsRes.data ?? []) as Record<string, unknown>[];
  const indicators: IndicatorCard[] = rawIndicators.map(row => ({
    symbol: row.symbol as string,
    name: nameMap[row.symbol as string] ?? (row.symbol as string),
    trade_date: row.trade_date as string,
    close: Number(row.close),
    pct_change_1d: row.pct_change_1d != null ? Number(row.pct_change_1d) : null,
    pct_change_5d: row.pct_change_5d != null ? Number(row.pct_change_5d) : null,
    pct_change_20d:
      row.pct_change_20d != null ? Number(row.pct_change_20d) : null,
    ma20: row.ma20 != null ? Number(row.ma20) : null,
    ma60: row.ma60 != null ? Number(row.ma60) : null,
    ma250: row.ma250 != null ? Number(row.ma250) : null,
    ma500: row.ma500 != null ? Number(row.ma500) : null,
    ma1000: row.ma1000 != null ? Number(row.ma1000) : null,
    pct_from_ma500:
      row.pct_from_ma500 != null ? Number(row.pct_from_ma500) : null,
    pct_from_ma1000:
      row.pct_from_ma1000 != null ? Number(row.pct_from_ma1000) : null,
    drawdown_1y: row.drawdown_1y != null ? Number(row.drawdown_1y) : null,
    volume_ratio: row.volume_ratio != null ? Number(row.volume_ratio) : null,
    risk_level: (row.risk_level as RiskLevel) ?? null,
  }));

  const rawRecs = (recommendationsRes.data ?? []) as Record<string, unknown>[];
  const recommendations: RecommendationCard[] = rawRecs.map(row => ({
    symbol: row.symbol as string,
    name:
      (row.name as string) ??
      nameMap[row.symbol as string] ??
      (row.symbol as string),
    market: row.market as Market,
    asset_type: row.asset_type as AssetType,
    recommendation_type: row.recommendation_type as RecommendationType,
    score: Number(row.score),
    reason: (row.reason as string) ?? '',
    risk: (row.risk as string) ?? '',
    action_suggestion: (row.action_suggestion as string) ?? '',
  }));

  const report = reportRes.data as Record<string, unknown> | null;
  const indexCards = indicators.filter(i => assetTypeMap[i.symbol] === 'index');
  const etfCards = indicators.filter(i => assetTypeMap[i.symbol] === 'etf');

  const ndx = indexCards.find(i => i.symbol === 'NDX');
  const vix = indexCards.find(i => i.symbol === 'VIX');

  return {
    trade_date: tradeDate,
    market_status: deriveMarketStatus(ndx, vix),
    index_cards: indexCards,
    etf_cards: etfCards,
    strong_watch: recommendations.filter(
      r => r.recommendation_type === 'strong_watch',
    ),
    pullback_watch: recommendations.filter(
      r => r.recommendation_type === 'pullback_watch',
    ),
    risk_watch: recommendations.filter(
      r => r.recommendation_type === 'risk_watch',
    ),
    cn_sectors: recommendations.filter(
      r => r.recommendation_type === 'sector_watch',
    ),
    dca: {
      base: [
        { symbol: 'QQQ', name: '纳指100ETF', amount: 1000 },
        { symbol: 'SPY', name: '标普500ETF', amount: 200 },
      ],
      enhanced_triggered: false,
      reason: (report?.dca_suggestion as string) ?? '维持基础定投。',
    },
    daily_report: {
      trade_date: tradeDate,
      market_summary: (report?.market_summary as string) ?? '',
      us_summary: (report?.us_summary as string) ?? '',
      etf_summary: (report?.etf_summary as string) ?? '',
      cn_sector_summary: (report?.cn_sector_summary as string) ?? '',
      dca_suggestion: (report?.dca_suggestion as string) ?? '',
      risk_summary: (report?.risk_summary as string) ?? '',
    },
  };
}
