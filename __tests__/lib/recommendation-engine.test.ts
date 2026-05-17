import {
  calcTrendScore, calcNewsScore, calcRiskPenalty,
  calcTotalScore, deriveRecommendationType, deriveRecommendationLevel,
} from '@/lib/recommendation-engine';
import type { MarketIndicatorDaily, MarketNews } from '@/types';

const BASE_IND: MarketIndicatorDaily = {
  id: 1, symbol: 'AAPL', trade_date: '2024-01-01',
  close: 180, pct_change_1d: 1, pct_change_5d: 2, pct_change_20d: 5,
  ma20: 175, ma60: 170, ma250: 160, ma500: 140, ma1000: 120,
  pct_from_ma500: 0.286, pct_from_ma1000: 0.5,
  drawdown_1y: -0.05, volume_ratio: 1.1, risk_level: 'low',
  created_at: '2024-01-01',
};

describe('calcTrendScore', () => {
  it('gives maximum score when price is above all MAs', () => {
    const score = calcTrendScore(BASE_IND);
    expect(score).toBe(100); // 15+20+25+30+10=100, capped
  });

  it('applies penalty when price is below MA500', () => {
    const score = calcTrendScore({ ...BASE_IND, close: 130, ma500: 140 });
    expect(score).toBeLessThan(50);
  });

  it('applies heavy penalty when price is below MA1000', () => {
    const score = calcTrendScore({ ...BASE_IND, close: 100, ma500: 140, ma1000: 120 });
    expect(score).toBe(0); // floor at 0
  });
});

describe('calcNewsScore', () => {
  it('returns neutral 50 when no news', () => {
    expect(calcNewsScore([])).toBe(50);
  });

  it('increases score for positive news', () => {
    const news = [{ sentiment: 'positive', importance_score: 8 }] as MarketNews[];
    expect(calcNewsScore(news)).toBeGreaterThan(50);
  });

  it('decreases score for negative news', () => {
    const news = [{ sentiment: 'negative', importance_score: 8 }] as MarketNews[];
    expect(calcNewsScore(news)).toBeLessThan(50);
  });
});

describe('calcRiskPenalty', () => {
  it('returns 0 penalty for healthy indicators', () => {
    expect(calcRiskPenalty(BASE_IND)).toBe(0);
  });

  it('penalizes 5-day gain exceeding 15%', () => {
    expect(calcRiskPenalty({ ...BASE_IND, pct_change_5d: 16 })).toBeLessThan(0);
  });

  it('penalizes when price is below MA60', () => {
    expect(calcRiskPenalty({ ...BASE_IND, close: 165, ma60: 170 })).toBeLessThan(0);
  });
});

describe('deriveRecommendationType', () => {
  it('returns strong_watch for high score + low risk', () => {
    expect(deriveRecommendationType(80, 'low')).toBe('strong_watch');
  });

  it('returns pullback_watch for medium score + low risk', () => {
    expect(deriveRecommendationType(65, 'low')).toBe('pullback_watch');
  });

  it('returns risk_watch for high risk level regardless of score', () => {
    expect(deriveRecommendationType(85, 'high')).toBe('risk_watch');
  });

  it('returns risk_watch for low score', () => {
    expect(deriveRecommendationType(40, 'low')).toBe('risk_watch');
  });
});

describe('deriveRecommendationLevel', () => {
  it('returns A+ for score >= 85', () => {
    expect(deriveRecommendationLevel(90)).toBe('A+');
  });
  it('returns C for score < 55', () => {
    expect(deriveRecommendationLevel(40)).toBe('C');
  });
});
