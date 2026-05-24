import { applyCandidateHardRules } from './candidate-validation';
import { buildOpportunityCards } from './decision';
import type { ExtractOpportunityEventInput } from './event-extraction';
import { filter_news_by_watchlist } from './news-filter';
import { dedupeNews, type NewsLike, type NewsWithHash } from './news-dedupe';
import type {
  CandidateValidationDecision,
  ExtractedCompanyMention,
  ExtractedOpportunityEvent,
  OpportunityCardData,
  OpportunityCompanyEvent,
  OpportunityContextEntity,
  OpportunityCoreTarget,
  OpportunityIndicatorSnapshot,
  OpportunityPipelineRawNews,
  OpportunityRawNews,
} from './types';
import type {
  CompanyEventInsert,
  DiscoveredCandidateInsert,
} from '@/lib/supabase/opportunity-ingestion';

interface PipelineLimits {
  maxNewsPerRun: number;
  maxLlmCallsPerRun: number;
}

interface CandidateValidationInput {
  mention: ExtractedCompanyMention;
  event: ExtractedOpportunityEvent;
  evidenceNewsIds: number[];
  sourceSummary: string;
}

interface CandidateValidationOutput {
  decision: CandidateValidationDecision;
}

interface PipelinePersistence {
  upsertRawNews(news: OpportunityPipelineRawNews[]): Promise<OpportunityPipelineRawNews[]>;
  insertCompanyEvents(events: CompanyEventInsert[]): Promise<void>;
  replaceLatestOpportunityDecisions(cards: OpportunityCardData[]): Promise<void>;
  upsertDiscoveredCandidate(candidate: DiscoveredCandidateInsert): Promise<void>;
  upsertContextFromCandidate(decision: CandidateValidationDecision): Promise<void>;
  upsertCoreFromCandidate(decision: CandidateValidationDecision): Promise<void>;
}

export interface RunOpportunityNewsPipelineInput {
  coreTargets: OpportunityCoreTarget[];
  contextEntities: OpportunityContextEntity[];
  indicators: OpportunityIndicatorSnapshot[];
  fetchNews: () => Promise<NewsLike[]>;
  extractEvent: (
    input: Omit<ExtractOpportunityEventInput, 'chat' | 'model'>,
  ) => Promise<ExtractedOpportunityEvent | null>;
  validateCandidate: (
    input: CandidateValidationInput,
  ) => Promise<CandidateValidationOutput | null>;
  persist: PipelinePersistence;
  limits: PipelineLimits;
}

export interface PipelineSummary {
  fetched: number;
  deduped: number;
  filtered: number;
  llmCalls: number;
  eventsInserted: number;
  candidatesProcessed: number;
  decisionsGenerated: number;
}

function toPipelineRawNews(news: NewsWithHash): OpportunityPipelineRawNews {
  const now = new Date().toISOString();

  return {
    id: 0,
    source: news.source,
    source_type: news.source_type,
    title: news.title,
    summary: news.summary,
    content: news.content,
    url: news.url,
    published_at: news.published_at,
    fetched_at: now,
    hash: news.hash,
    lang: news.lang,
    raw_json: news.raw_json,
    created_at: now,
  };
}

function eventSymbol(event: ExtractedOpportunityEvent): string {
  return (
    event.related_context_entities[0] ??
    event.related_core_symbols[0] ??
    'UNKNOWN'
  );
}

function toCompanyEventInsert(
  event: ExtractedOpportunityEvent,
  evidenceNewsIds: number[],
): CompanyEventInsert {
  const symbol = eventSymbol(event);

  return {
    symbol,
    market: null,
    company_name: symbol,
    theme: event.theme,
    event_type: event.event_type,
    event_direction: event.event_direction,
    importance_score: event.importance_score,
    event_summary: event.summary,
    evidence_news_ids: evidenceNewsIds,
    published_at: new Date().toISOString(),
    raw_llm_json: event.raw_llm_json,
    llm_input_summary: event.llm_input_summary,
    llm_model: event.llm_model,
    extraction_status: 'ok',
    extraction_error: null,
  };
}

function toOpportunityRawNews(news: OpportunityPipelineRawNews): OpportunityRawNews {
  return {
    id: news.id,
    source: news.source,
    title: news.title,
    summary: news.summary ?? '',
    url: news.url,
    published_at: news.published_at ?? news.fetched_at,
    hash: news.hash,
    raw_json: news.raw_json,
    created_at: news.created_at,
  };
}

function toOpportunityEvent(
  event: ExtractedOpportunityEvent,
  index: number,
  evidenceNewsIds: number[],
): OpportunityCompanyEvent {
  const symbol = eventSymbol(event);

  return {
    id: index + 1,
    symbol,
    company_name: symbol,
    theme: event.theme,
    event_type: event.event_type,
    event_direction: event.event_direction,
    importance_score: event.importance_score,
    event_summary: event.summary,
    evidence_news_ids: evidenceNewsIds,
    published_at: new Date().toISOString(),
    raw_payload: event.raw_llm_json,
    created_at: new Date().toISOString(),
  };
}

function toCandidateInsert(
  decision: CandidateValidationDecision,
  status: DiscoveredCandidateInsert['status'],
  event: ExtractedOpportunityEvent,
): DiscoveredCandidateInsert {
  return {
    name: decision.name,
    symbol: decision.symbol,
    market: decision.market,
    theme: decision.theme,
    discovered_from: 'llm_event_extraction',
    related_to_symbol: decision.related_core_symbol,
    relation_type: decision.relation_type,
    reason: decision.reason,
    mention_count: 1,
    importance_score: event.importance_score,
    confidence: decision.confidence,
    status,
    ai_decision: decision.decision,
    raw_llm_json: event.raw_llm_json,
    evidence_news_ids: decision.evidence_news_ids,
  };
}

export async function runOpportunityNewsPipeline({
  coreTargets,
  contextEntities,
  indicators,
  fetchNews,
  extractEvent,
  validateCandidate,
  persist,
  limits,
}: RunOpportunityNewsPipelineInput): Promise<PipelineSummary> {
  const fetchedNews = (await fetchNews()).slice(0, limits.maxNewsPerRun);
  const dedupedNews = dedupeNews(fetchedNews);
  const persistedNews = await persist.upsertRawNews(
    dedupedNews.map(toPipelineRawNews),
  );
  const persistedByHash = new Map(persistedNews.map((news) => [news.hash, news]));
  const filtered = filter_news_by_watchlist(
    dedupedNews,
    coreTargets,
    contextEntities,
  );
  const extractedEvents: ExtractedOpportunityEvent[] = [];
  const evidenceIdsByEvent = new Map<ExtractedOpportunityEvent, number[]>();
  let candidatesProcessed = 0;

  for (const item of filtered.slice(0, limits.maxLlmCallsPerRun)) {
    const event = await extractEvent({
      filtered: item,
      coreTargets,
      contextEntities,
    });
    if (!event) continue;

    const persisted = persistedByHash.get(item.news.hash);
    const evidenceNewsIds = persisted?.id ? [persisted.id] : [];
    extractedEvents.push(event);
    evidenceIdsByEvent.set(event, evidenceNewsIds);

    for (const mention of event.new_company_mentions) {
      const validation = await validateCandidate({
        mention,
        event,
        evidenceNewsIds,
        sourceSummary: item.llm_input_summary,
      });
      if (!validation) continue;

      const hardRule = applyCandidateHardRules({
        decision: validation.decision,
        mentionCount: 1,
        coreTargets,
        contextEntities,
      });
      await persist.upsertDiscoveredCandidate(
        toCandidateInsert(validation.decision, hardRule.status, event),
      );
      if (hardRule.shouldAddContext) {
        await persist.upsertContextFromCandidate(validation.decision);
      }
      if (hardRule.shouldAddCore) {
        await persist.upsertCoreFromCandidate(validation.decision);
      }
      candidatesProcessed += 1;
    }
  }

  const eventInserts = extractedEvents.map((event) =>
    toCompanyEventInsert(event, evidenceIdsByEvent.get(event) ?? []),
  );
  const opportunityEvents = extractedEvents.map((event, index) =>
    toOpportunityEvent(event, index, evidenceIdsByEvent.get(event) ?? []),
  );
  await persist.insertCompanyEvents(eventInserts);

  const cards = buildOpportunityCards({
    coreTargets,
    context: contextEntities,
    events: opportunityEvents,
    indicators,
    rawNews: persistedNews.map(toOpportunityRawNews),
  });
  await persist.replaceLatestOpportunityDecisions(cards);

  return {
    fetched: fetchedNews.length,
    deduped: dedupedNews.length,
    filtered: filtered.length,
    llmCalls: Math.min(filtered.length, limits.maxLlmCallsPerRun),
    eventsInserted: eventInserts.length,
    candidatesProcessed,
    decisionsGenerated: cards.length,
  };
}
