import type { AssetType, Market, RiskLevel } from '@/types';

export type OpportunityDecisionLevel =
  | 'small_probe'
  | 'pullback_candidate'
  | 'strong_watch'
  | 'breakout_confirm'
  | 'post_earnings_wait'
  | 'risk_high';

export type OpportunityDirection = 'positive' | 'neutral' | 'negative' | 'mixed';

export interface OpportunityCoreTarget {
  id: number;
  symbol: string;
  name: string;
  market: Market;
  asset_type: AssetType;
  theme: string;
  priority: number;
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface OpportunityContextEntity {
  id: number;
  core_symbol: string;
  related_symbol: string | null;
  related_name: string;
  market: Market | 'GLOBAL';
  relation_type:
    | 'competitor'
    | 'supplier'
    | 'customer'
    | 'peer'
    | 'etf_holding'
    | 'industry_signal'
    | 'policy_signal';
  relation_strength: number;
  reason: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpportunityRawNews {
  id: number;
  source: string;
  title: string;
  summary: string;
  url: string | null;
  published_at: string;
  hash: string;
  raw_json: Record<string, unknown>;
  created_at: string;
}

export interface OpportunityCompanyEvent {
  id: number;
  symbol: string;
  company_name: string;
  theme: string;
  event_type:
    | 'demand'
    | 'competition'
    | 'product'
    | 'supply_chain'
    | 'earnings_risk'
    | 'macro'
    | 'price_action';
  event_direction: OpportunityDirection;
  importance_score: number;
  event_summary: string;
  evidence_news_ids: number[];
  published_at: string;
  raw_payload: Record<string, unknown>;
  created_at: string;
}

export interface OpportunityIndicatorSnapshot {
  symbol: string;
  close: number;
  pct_change_5d: number | null;
  pct_change_20d: number | null;
  pct_from_ma500: number | null;
  drawdown_1y: number | null;
  volume_ratio: number | null;
  risk_level: RiskLevel | null;
}

export interface OpportunityScores {
  total_score: number;
  news_score: number;
  price_position_score: number;
  context_signal_score: number;
  risk_score: number;
}

export interface OpportunityDecisionInput {
  target: OpportunityCoreTarget;
  indicator: OpportunityIndicatorSnapshot;
  directEvents: OpportunityCompanyEvent[];
  contextEvents: OpportunityCompanyEvent[];
  evidenceNews: OpportunityRawNews[];
}

export interface OpportunityCardData extends OpportunityScores {
  symbol: string;
  company_name: string;
  asset_type: AssetType;
  market: Market;
  theme: string;
  decision_level: OpportunityDecisionLevel;
  decision_label: string;
  summary: string;
  watch_conditions: string[];
  risk_factors: string[];
  evidence_events: OpportunityCompanyEvent[];
  evidence_news: OpportunityRawNews[];
  updated_at: string;
}

export interface OpportunityApiResponse {
  updated_at: string;
  summary: {
    total: number;
    strong_watch: number;
    pullback_candidate: number;
    risk_high: number;
  };
  groups: {
    strong_watch: OpportunityCardData[];
    pullback_candidate: OpportunityCardData[];
    risk_high: OpportunityCardData[];
    other: OpportunityCardData[];
  };
}
