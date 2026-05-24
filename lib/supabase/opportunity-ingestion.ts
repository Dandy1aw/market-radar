import { createClient } from '@supabase/supabase-js';
import { groupOpportunityCards, opportunityDecisionLabels } from '@/lib/opportunity/decision';
import { hasSupabaseConfig } from './env';
import type {
  CandidateValidationDecision,
  DiscoveredCandidate,
  OpportunityApiResponse,
  OpportunityCardData,
  OpportunityCompanyEvent,
  OpportunityContextEntity,
  OpportunityCoreTarget,
  OpportunityPipelineRawNews,
  OpportunityRawNews,
  PersistedOpportunityDecision,
} from '@/lib/opportunity/types';

export type RawNewsInsert = Omit<OpportunityPipelineRawNews, 'id' | 'created_at'>;

export interface CompanyEventInsert {
  symbol: string;
  market: string | null;
  company_name: string;
  theme: string;
  event_type: OpportunityCompanyEvent['event_type'];
  event_direction: OpportunityCompanyEvent['event_direction'];
  importance_score: number;
  event_summary: string;
  evidence_news_ids: number[];
  published_at: string;
  raw_llm_json: Record<string, unknown>;
  llm_input_summary: string;
  llm_model: string;
  extraction_status?: string;
  extraction_error?: string | null;
}

interface CompanyEventRow extends CompanyEventInsert {
  id: number;
  created_at: string;
}

export interface DiscoveredCandidateInsert {
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
  status: DiscoveredCandidate['status'];
  ai_decision: DiscoveredCandidate['ai_decision'];
  raw_llm_json: Record<string, unknown>;
  evidence_news_ids: number[];
}

function adminClient() {
  if (!hasSupabaseConfig()) {
    throw new Error('Supabase service configuration is missing.');
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function assertNoError(error: unknown): void {
  if (error) throw error;
}

export function mapRawNewsForInsert(
  news: OpportunityPipelineRawNews,
): RawNewsInsert {
  return {
    source: news.source,
    source_type: news.source_type,
    title: news.title,
    summary: news.summary,
    content: news.content,
    url: news.url,
    published_at: news.published_at,
    fetched_at: news.fetched_at,
    hash: news.hash,
    lang: news.lang,
    raw_json: news.raw_json,
  };
}

function mapCompanyEventRow(row: CompanyEventRow): OpportunityCompanyEvent {
  return {
    id: row.id,
    symbol: row.symbol,
    company_name: row.company_name,
    theme: row.theme,
    event_type: row.event_type,
    event_direction: row.event_direction,
    importance_score: row.importance_score,
    event_summary: row.event_summary,
    evidence_news_ids: row.evidence_news_ids,
    published_at: row.published_at,
    raw_payload: row.raw_llm_json,
    created_at: row.created_at,
  };
}

function mapRawNewsRow(row: OpportunityPipelineRawNews): OpportunityRawNews {
  return {
    id: row.id,
    source: row.source,
    title: row.title,
    summary: row.summary ?? '',
    url: row.url,
    published_at: row.published_at ?? row.fetched_at,
    hash: row.hash,
    raw_json: row.raw_json,
    created_at: row.created_at,
  };
}

function evidenceForCard(
  eventIds: number[],
  events: OpportunityCompanyEvent[],
  rawNews: OpportunityRawNews[],
): Pick<OpportunityCardData, 'evidence_events' | 'evidence_news'> {
  const eventIdSet = new Set(eventIds);
  const evidence_events = events.filter((event) => eventIdSet.has(event.id));
  const newsIds = new Set(evidence_events.flatMap((event) => event.evidence_news_ids));
  const evidence_news = rawNews.filter((news) => newsIds.has(news.id));

  return { evidence_events, evidence_news };
}

export function mapDecisionRowsToOpportunityResponse(
  rows: PersistedOpportunityDecision[],
  events: OpportunityCompanyEvent[],
  rawNews: OpportunityRawNews[],
): OpportunityApiResponse {
  const cards: OpportunityCardData[] = rows.map((row) => ({
    symbol: row.symbol,
    company_name: row.company_name,
    asset_type: row.asset_type,
    market: row.market,
    theme: row.theme,
    decision_level: row.decision_level,
    decision_label: opportunityDecisionLabels[row.decision_level],
    total_score: row.total_score,
    news_score: row.news_score,
    price_position_score: row.price_position_score,
    context_signal_score: row.context_signal_score,
    risk_score: row.risk_score,
    summary: row.summary,
    watch_conditions: row.watch_conditions,
    risk_factors: row.risk_factors,
    ...evidenceForCard(row.evidence_event_ids, events, rawNews),
    updated_at: row.created_at,
  }));

  return groupOpportunityCards(cards);
}

export async function getCoreTargets(): Promise<OpportunityCoreTarget[]> {
  const { data, error } = await adminClient()
    .from('watchlist_core')
    .select('*')
    .order('priority', { ascending: true })
    .order('symbol', { ascending: true });

  assertNoError(error);
  return (data ?? []) as OpportunityCoreTarget[];
}

export async function getContextEntities(): Promise<OpportunityContextEntity[]> {
  const { data, error } = await adminClient()
    .from('watchlist_context')
    .select('*')
    .order('core_symbol', { ascending: true })
    .order('related_name', { ascending: true });

  assertNoError(error);
  return (data ?? []) as OpportunityContextEntity[];
}

export async function upsertRawNews(
  news: OpportunityPipelineRawNews[],
): Promise<OpportunityPipelineRawNews[]> {
  if (news.length === 0) return [];

  const { data, error } = await adminClient()
    .from('raw_news')
    .upsert(news.map(mapRawNewsForInsert), { onConflict: 'hash' })
    .select('*');

  assertNoError(error);
  return (data ?? []) as OpportunityPipelineRawNews[];
}

export async function insertCompanyEvents(
  events: CompanyEventInsert[],
): Promise<OpportunityCompanyEvent[]> {
  if (events.length === 0) return [];

  const { data, error } = await adminClient()
    .from('company_event')
    .insert(events)
    .select('*');
  assertNoError(error);
  return ((data ?? []) as CompanyEventRow[]).map(mapCompanyEventRow);
}

export async function upsertDiscoveredCandidate(
  candidate: DiscoveredCandidateInsert,
): Promise<void> {
  const { error } = await adminClient()
    .from('discovered_candidates')
    .upsert(candidate, { onConflict: 'name,related_to_symbol,relation_type' });

  assertNoError(error);
}

export async function upsertContextFromCandidate(
  decision: CandidateValidationDecision,
): Promise<void> {
  if (!decision.related_core_symbol || !decision.relation_type) return;

  const { error } = await adminClient().from('watchlist_context').insert({
    core_symbol: decision.related_core_symbol,
    related_symbol: decision.symbol,
    related_name: decision.name,
    market: decision.market ?? 'GLOBAL',
    relation_type: decision.relation_type,
    relation_strength: decision.confidence,
    reason: decision.reason,
    is_active: true,
  });

  assertNoError(error);
}

export async function upsertCoreFromCandidate(
  decision: CandidateValidationDecision,
): Promise<void> {
  if (!decision.symbol || !decision.market) return;

  const { error } = await adminClient().from('watchlist_core').insert({
    symbol: decision.symbol,
    name: decision.name,
    market: decision.market,
    asset_type: 'stock',
    theme: decision.theme ?? 'AI infrastructure',
    priority: 3,
    is_active: true,
    notes: decision.reason,
  });

  assertNoError(error);
}

export async function replaceLatestOpportunityDecisions(
  cards: OpportunityCardData[],
): Promise<void> {
  if (cards.length === 0) return;

  const rows = cards.map((card) => ({
    symbol: card.symbol,
    market: card.market,
    company_name: card.company_name,
    asset_type: card.asset_type,
    theme: card.theme,
    decision_level: card.decision_level,
    total_score: card.total_score,
    news_score: card.news_score,
    price_position_score: card.price_position_score,
    context_signal_score: card.context_signal_score,
    risk_score: card.risk_score,
    summary: card.summary,
    watch_conditions: card.watch_conditions,
    risk_factors: card.risk_factors,
    evidence_event_ids: card.evidence_events.map((event) => event.id),
  }));

  const { error } = await adminClient().from('opportunity_decision').insert(rows);
  assertNoError(error);
}

export async function getLatestOpportunityDecisionData(): Promise<OpportunityApiResponse | null> {
  if (!hasSupabaseConfig()) return null;

  const { data, error } = await adminClient()
    .from('opportunity_decision')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  assertNoError(error);

  const latestRows = new Map<string, PersistedOpportunityDecision>();
  for (const row of (data ?? []) as PersistedOpportunityDecision[]) {
    if (!latestRows.has(row.symbol)) {
      latestRows.set(row.symbol, row);
    }
  }

  if (latestRows.size === 0) return null;

  const rows = [...latestRows.values()];
  const eventIds = [...new Set(rows.flatMap((row) => row.evidence_event_ids))];
  let events: OpportunityCompanyEvent[] = [];
  let rawNews: OpportunityRawNews[] = [];

  if (eventIds.length > 0) {
    const { data: eventRows, error: eventError } = await adminClient()
      .from('company_event')
      .select('*')
      .in('id', eventIds);
    assertNoError(eventError);
    events = ((eventRows ?? []) as CompanyEventRow[]).map(mapCompanyEventRow);

    const newsIds = [...new Set(events.flatMap((event) => event.evidence_news_ids))];
    if (newsIds.length > 0) {
      const { data: newsRows, error: newsError } = await adminClient()
        .from('raw_news')
        .select('*')
        .in('id', newsIds);
      assertNoError(newsError);
      rawNews = ((newsRows ?? []) as OpportunityPipelineRawNews[]).map(mapRawNewsRow);
    }
  }

  return mapDecisionRowsToOpportunityResponse(rows, events, rawNews);
}
