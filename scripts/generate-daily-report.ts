// Run via: npx tsx scripts/generate-daily-report.ts
import { createClient } from '@supabase/supabase-js';
import { chatCompletion } from '../lib/llm/client';
import type { MarketIndicatorDaily, RecommendationDaily } from '../types';

const REQUIRED_ENV = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'LLM_API_KEY'] as const;
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
  const tradeDate = await getLatestTradeDate();

  const [{ data: indicators }, { data: recs }] = await Promise.all([
    supabase
      .from('market_indicator_daily')
      .select('*')
      .eq('trade_date', tradeDate)
      .in('symbol', ['NDX', 'SPX', 'VIX', 'QQQ', 'SPY']),
    supabase
      .from('recommendation_daily')
      .select('*')
      .eq('trade_date', tradeDate)
      .order('score', { ascending: false })
      .limit(8),
  ]);

  const marketContext = ((indicators ?? []) as MarketIndicatorDaily[])
    .map(i => `${i.symbol}: close=${i.close}, 今日=${i.pct_change_1d?.toFixed(2)}%, 风险=${i.risk_level}`)
    .join('\n');

  const recContext = ((recs ?? []) as RecommendationDaily[])
    .map(r => `${r.symbol}[${r.recommendation_type}, ${r.score}分]: ${r.reason}`)
    .join('\n');

  const prompt = `你是一位专业的投资分析师，请根据以下数据生成今日（${tradeDate}）市场复盘。

【市场指标】
${marketContext || '暂无数据'}

【推荐列表】
${recContext || '暂无数据'}

请以JSON格式返回，包含以下字段（每字段1-3句中文）：
- market_summary: 整体市场状态
- us_summary: 美股重点标的分析
- etf_summary: ETF配置建议
- cn_sector_summary: A股板块概况（如无数据写"暂无A股数据"）
- dca_suggestion: 今日定投建议（含QQQ/SPY基础金额）
- risk_summary: 主要风险提示

仅返回JSON，不要markdown代码块。`;

  const response = await chatCompletion([{ role: 'user', content: prompt }], { maxTokens: 1000 });

  let reportData: Record<string, string>;
  try {
    reportData = JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim()) as Record<string, string>;
  } catch {
    console.error('LLM response was not valid JSON:', response);
    reportData = { market_summary: response, us_summary: '', etf_summary: '', cn_sector_summary: '', dca_suggestion: '', risk_summary: '' };
  }

  const { error } = await supabase
    .from('daily_report')
    .upsert({ trade_date: tradeDate, ...reportData }, { onConflict: 'trade_date' });
  if (error) throw error;

  console.log(`✓ Daily report generated for ${tradeDate}`);
}

main().catch(console.error);
