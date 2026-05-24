import type { AssetType, Market, RiskLevel } from '@/types';

export type OpportunityDecisionLevel =
  | 'small_probe'
  | 'pullback_candidate'
  | 'strong_watch'
  | 'breakout_confirm'
  | 'post_earnings_wait'
  | 'risk_high';

export type OpportunityDirection = 'positive' | 'neutral' | 'negative' | 'mixed';

export type OpportunityIngestionAssetType =
  | AssetType
  | 'fund'
  | 'company'
  | 'private_company';

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
    other: number;
  };
  groups: {
    strong_watch: OpportunityCardData[];
    pullback_candidate: OpportunityCardData[];
    risk_high: OpportunityCardData[];
    other: OpportunityCardData[];
  };
}

export type OpportunityExtractionStatus = 'ok' | 'irrelevant' | 'parse_failed' | 'rejected';

export type CandidateAutoStatus =
  | 'auto_added_context'
  | 'auto_added_core'
  | 'pending_ai_review'
  | 'rejected';

export type CandidateValidationAction =
  | 'add_context'
  | 'add_core'
  | 'keep_candidate'
  | 'reject';

export interface OpportunityPipelineRawNews
  extends Omit<OpportunityRawNews, 'summary' | 'published_at'> {
  source_type: string | null;
  summary: string | null;
  content: string | null;
  published_at: string | null;
  fetched_at: string;
  lang: string | null;
}

export interface ExtractedCompanyMention {
  name: string;
  symbol: string | null;
  market: string | null;
  theme: string | null;
  relation_to_core: OpportunityContextEntity['relation_type'] | null;
  related_core_symbol: string | null;
  reason: string;
  confidence: number;
}

export interface ExtractedOpportunityEvent {
  is_relevant: boolean;
  related_core_symbols: string[];
  related_context_entities: string[];
  theme: string;
  event_type: OpportunityCompanyEvent['event_type'];
  event_direction: OpportunityDirection;
  importance_score: number;
  summary: string;
  key_facts: string[];
  positive_factors: string[];
  negative_factors: string[];
  supply_chain_mentions: string[];
  new_company_mentions: ExtractedCompanyMention[];
  uncertainty: string[];
  evidence: { text: string; reason: string }[];
  raw_llm_json: Record<string, unknown>;
  llm_input_summary: string;
  llm_model: string;
}

export interface CandidateValidationDecision {
  decision: CandidateValidationAction;
  confidence: number;
  name: string;
  symbol: string | null;
  market: string | null;
  theme: string | null;
  related_core_symbol: string | null;
  relation_type: OpportunityContextEntity['relation_type'] | null;
  reason: string;
  evidence_news_ids: number[];
  risk_notes: string[];
}

export interface DiscoveredCandidate {
  id: number;
  name: string;
  symbol: string | null;
  market: string | null;
  theme: string | null;
  discovered_from: string | null;
  related_to_symbol: string | null;
  relation_type: OpportunityContextEntity['relation_type'] | null;
  reason: string | null;
  mention_count: number;
  importance_score: number;
  confidence: number;
  status: CandidateAutoStatus;
  ai_decision: CandidateValidationAction | null;
  raw_llm_json: Record<string, unknown>;
  evidence_news_ids: number[];
  created_at: string;
  updated_at: string;
}

export interface PersistedOpportunityDecision {
  id: number;
  symbol: string;
  market: Market;
  company_name: string;
  asset_type: OpportunityIngestionAssetType;
  theme: string;
  decision_level: OpportunityDecisionLevel;
  total_score: number;
  news_score: number;
  price_position_score: number;
  context_signal_score: number;
  risk_score: number;
  summary: string;
  watch_conditions: string[];
  risk_factors: string[];
  evidence_event_ids: number[];
  created_at: string;
}
