// lib/cn-news/types.ts

export type CnEventDirection = 'positive' | 'neutral' | 'negative' | 'mixed';
export type CnConfidenceLevel = 'high' | 'medium' | 'low';
export type CnSourceType = 'announcement' | 'company_news' | 'rss';

export interface CnNewsCardData {
  symbol: string;
  company_name: string;
  theme: string;
  event_direction: CnEventDirection;
  confidence_level: CnConfidenceLevel;
  source_type: CnSourceType;
  source_label: string;
  event_type: string;
  importance_score: number;
  event_summary: string;
  watch_points: string[];
  risk_notes: string[];
  evidence: string[];
  updated_at: string;
}

export interface CnNewsSummary {
  total: number;
  positive: number;
  negative: number;
  high_confidence: number;
}

export interface CnNewsApiResponse {
  updated_at: string;
  summary: CnNewsSummary;
  cards: CnNewsCardData[];
}
