export type Market = 'US' | 'CN';
export type AssetType = 'index' | 'etf' | 'stock' | 'sector';
export type RiskLevel = 'low' | 'medium' | 'high' | 'extreme';
export type RecommendationType =
  | 'strong_watch'
  | 'pullback_watch'
  | 'risk_watch'
  | 'base_dca'
  | 'sector_watch';

export interface Watchlist {
  id: number;
  symbol: string;
  name: string;
  market: Market;
  asset_type: AssetType;
  category: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface MarketPriceDaily {
  id: number;
  symbol: string;
  trade_date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  source: string | null;
  created_at: string;
}

export interface MarketIndicatorDaily {
  id: number;
  symbol: string;
  trade_date: string;
  close: number | null;
  pct_change_1d: number | null;
  pct_change_5d: number | null;
  pct_change_20d: number | null;
  ma20: number | null;
  ma60: number | null;
  ma250: number | null;
  ma500: number | null;
  ma1000: number | null;
  pct_from_ma500: number | null;
  pct_from_ma1000: number | null;
  drawdown_1y: number | null;
  volume_ratio: number | null;
  risk_level: RiskLevel | null;
  created_at: string;
}

export interface MarketNews {
  id: number;
  symbol: string | null;
  title: string;
  url: string | null;
  source: string | null;
  published_at: string | null;
  summary: string | null;
  sentiment: 'positive' | 'negative' | 'neutral' | null;
  news_type: string | null;
  importance_score: number | null;
  created_at: string;
}

export interface RecommendationDaily {
  id: number;
  trade_date: string;
  symbol: string;
  name: string | null;
  market: Market | null;
  asset_type: AssetType | null;
  recommendation_type: RecommendationType;
  recommendation_level: string | null;
  score: number | null;
  reason: string | null;
  risk: string | null;
  action_suggestion: string | null;
  created_at: string;
}

export interface DailyReport {
  id: number;
  trade_date: string;
  market_summary: string | null;
  us_summary: string | null;
  etf_summary: string | null;
  cn_sector_summary: string | null;
  dca_suggestion: string | null;
  risk_summary: string | null;
  created_at: string;
}

// ---- Frontend view types (mock / dashboard layer) ----

export interface IndicatorCard {
  symbol: string;
  name: string;
  trade_date: string;
  close: number;
  pct_change_1d: number | null;
  pct_change_5d: number | null;
  pct_change_20d: number | null;
  ma20: number | null;
  ma60: number | null;
  ma250: number | null;
  ma500: number | null;
  ma1000: number | null;
  pct_from_ma500: number | null;
  pct_from_ma1000: number | null;
  drawdown_1y: number | null;
  volume_ratio: number | null;
  risk_level: RiskLevel | null;
}

export interface RecommendationCard {
  symbol: string;
  name: string;
  market: Market;
  asset_type: AssetType;
  recommendation_type: RecommendationType;
  score: number;
  reason: string;
  risk: string;
  action_suggestion: string;
}

export type MarketStatusLevel = 'normal' | 'caution' | 'risk';
export type Sentiment = 'positive' | 'negative' | 'neutral';

export interface MarketStatus {
  label: string;
  level: MarketStatusLevel;
  description: string;
}

export interface DcaSuggestion {
  base: { symbol: string; name: string; amount: number }[];
  enhanced_triggered: boolean;
  reason: string;
}

export interface DashboardDailyReport {
  trade_date: string;
  market_summary: string;
  us_summary: string;
  etf_summary: string;
  cn_sector_summary: string;
  dca_suggestion: string;
  risk_summary: string;
}

export interface DashboardData {
  trade_date: string;
  market_status: MarketStatus;
  index_cards: IndicatorCard[];
  etf_cards: IndicatorCard[];
  strong_watch: RecommendationCard[];
  pullback_watch: RecommendationCard[];
  risk_watch: RecommendationCard[];
  cn_sectors: RecommendationCard[];
  dca: DcaSuggestion;
  daily_report: DashboardDailyReport;
}
