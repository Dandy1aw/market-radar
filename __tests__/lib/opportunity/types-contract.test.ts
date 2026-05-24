import type {
  CandidateValidationDecision,
  DiscoveredCandidate,
  ExtractedOpportunityEvent,
  OpportunityPipelineRawNews,
  PersistedOpportunityDecision,
} from '@/lib/opportunity/types';

describe('opportunity ingestion type contracts', () => {
  it('supports LLM extraction audit fields', () => {
    const event: ExtractedOpportunityEvent = {
      is_relevant: true,
      related_core_symbols: ['MU'],
      related_context_entities: ['Samsung Memory'],
      theme: 'HBM / memory cycle',
      event_type: 'competition',
      event_direction: 'positive',
      importance_score: 82,
      summary: 'Samsung HBM delay supports MU context signal.',
      key_facts: ['Samsung HBM certification slipped.'],
      positive_factors: ['Tighter HBM supply may support MU.'],
      negative_factors: [],
      supply_chain_mentions: ['Samsung Memory'],
      new_company_mentions: [],
      uncertainty: [],
      evidence: [{ text: 'Samsung HBM certification slipped', reason: 'title evidence' }],
      raw_llm_json: { is_relevant: true },
      llm_input_summary: 'Samsung HBM certification slipped',
      llm_model: 'deepseek-chat',
    };

    expect(event.llm_model).toBe('deepseek-chat');
  });

  it('supports candidate auto-confirm decisions', () => {
    const decision: CandidateValidationDecision = {
      decision: 'add_context',
      confidence: 0.86,
      name: 'Samsung Electronics',
      symbol: '005930.KS',
      market: 'KR',
      theme: 'HBM / memory cycle',
      related_core_symbol: 'MU',
      relation_type: 'competitor',
      reason: 'Samsung is a recurring HBM competitor signal for MU.',
      evidence_news_ids: [2],
      risk_notes: ['Foreign ticker may not have market data.'],
    };

    expect(decision.decision).toBe('add_context');
  });

  it('supports discovered candidate rows', () => {
    const candidate: DiscoveredCandidate = {
      id: 1,
      name: 'Samsung Electronics',
      symbol: '005930.KS',
      market: 'KR',
      theme: 'HBM / memory cycle',
      discovered_from: 'llm_extraction',
      related_to_symbol: 'MU',
      relation_type: 'competitor',
      reason: 'Samsung is a recurring HBM competitor signal for MU.',
      mention_count: 2,
      importance_score: 82,
      confidence: 0.86,
      status: 'pending_ai_review',
      ai_decision: 'add_context',
      raw_llm_json: { decision: 'add_context' },
      evidence_news_ids: [2],
      created_at: '2026-05-24T01:00:00.000Z',
      updated_at: '2026-05-24T01:00:00.000Z',
    };

    expect(candidate.name).toBe('Samsung Electronics');
    expect(candidate.status).toBe('pending_ai_review');
  });

  it('supports persisted raw news and decision rows', () => {
    const news: OpportunityPipelineRawNews = {
      id: 1,
      source: 'finnhub',
      source_type: 'company_news',
      title: 'Micron highlights HBM demand',
      summary: 'Demand remains strong.',
      content: null,
      url: 'https://example.com/mu',
      published_at: '2026-05-24T00:00:00.000Z',
      fetched_at: '2026-05-24T01:00:00.000Z',
      hash: 'hash',
      lang: 'en',
      raw_json: {},
      created_at: '2026-05-24T01:00:00.000Z',
    };
    const decision: PersistedOpportunityDecision = {
      id: 1,
      symbol: 'MU',
      market: 'US',
      company_name: 'Micron Technology',
      asset_type: 'stock',
      theme: 'HBM / memory cycle',
      decision_level: 'strong_watch',
      total_score: 75,
      news_score: 85,
      price_position_score: 55,
      context_signal_score: 78,
      risk_score: 42,
      summary: 'MU remains a strong watch.',
      watch_conditions: ['Confirm HBM demand persists.'],
      risk_factors: ['Price may be extended.'],
      evidence_event_ids: [1],
      created_at: '2026-05-24T01:00:00.000Z',
    };

    expect(news.hash).toBe('hash');
    expect(decision.symbol).toBe('MU');
  });
});
