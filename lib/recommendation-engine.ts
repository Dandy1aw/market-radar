import type { MarketIndicatorDaily, MarketNews, RecommendationType, RiskLevel } from '@/types';

export function calcTrendScore(ind: MarketIndicatorDaily): number {
  let score = 0;
  const { close, ma20, ma60, ma250, ma500, ma1000 } = ind;
  if (ma20 !== null && close !== null && close > ma20) score += 15;
  if (ma60 !== null && close !== null && close > ma60) score += 20;
  if (ma250 !== null && close !== null && close > ma250) score += 25;
  if (ma500 !== null && close !== null) { if (close > ma500) score += 30; else score -= 20; }
  if (ma1000 !== null && close !== null) { if (close > ma1000) score += 10; else score -= 30; }
  return Math.min(100, Math.max(0, score));
}

export function calcNewsScore(news: MarketNews[]): number {
  if (news.length === 0) return 50;
  let score = 50;
  for (const item of news) {
    const high = item.importance_score !== null && item.importance_score >= 7;
    if (item.sentiment === 'positive') score += high ? 20 : 10;
    if (item.sentiment === 'negative') score += high ? -25 : -15;
  }
  return Math.min(100, Math.max(0, score));
}

export function calcRiskPenalty(ind: MarketIndicatorDaily): number {
  let penalty = 0;
  const { pct_change_5d, volume_ratio, drawdown_1y, ma60, ma250, close } = ind;
  if (pct_change_5d !== null && pct_change_5d > 15) penalty -= 20;
  if (drawdown_1y !== null && drawdown_1y > -0.02 && volume_ratio !== null && volume_ratio > 1.5) penalty -= 15;
  if (ma60 !== null && close !== null && close < ma60) penalty -= 15;
  if (ma250 !== null && close !== null && close < ma250) penalty -= 25;
  return penalty;
}

export function calcTotalScore(ind: MarketIndicatorDaily, news: MarketNews[]): number {
  const trend = calcTrendScore(ind);
  const newsScore = calcNewsScore(news);
  const penalty = calcRiskPenalty(ind);
  const raw = trend * 0.35 + newsScore * 0.25 + 50 * 0.20 + 50 * 0.10 + (50 + penalty) * 0.10;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

export function deriveRecommendationType(score: number, riskLevel: RiskLevel): RecommendationType {
  if (riskLevel === 'high' || riskLevel === 'extreme' || score < 50) return 'risk_watch';
  if (score >= 75 && riskLevel === 'low') return 'strong_watch';
  if (score >= 55) return 'pullback_watch';
  return 'risk_watch';
}

export function deriveRecommendationLevel(score: number): string {
  if (score >= 85) return 'A+';
  if (score >= 75) return 'A';
  if (score >= 65) return 'B+';
  if (score >= 55) return 'B';
  return 'C';
}
