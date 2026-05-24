import { runOpportunityNewsPipeline } from '@/lib/opportunity/pipeline';
import {
  seedContext,
  seedCoreWatchlist,
  seedIndicators,
} from '@/lib/opportunity/seed';
import type { OpportunityPipelineRawNews } from '@/lib/opportunity/types';

describe('opportunity news pipeline', () => {
  it('filters before calling LLM and persists generated decisions', async () => {
    const fetchNews = jest.fn().mockResolvedValue([
      {
        source: 'finnhub',
        source_type: 'company_news',
        title: 'Samsung HBM certification timeline slips again',
        summary: 'The delay could keep high-end memory supply tight.',
        content: null,
        url: null,
        published_at: '2026-05-24T01:00:00.000Z',
        lang: 'en',
        raw_json: {},
      },
      {
        source: 'finnhub',
        source_type: 'company_news',
        title: 'Restaurant chain launches summer menu',
        summary: 'Unrelated article.',
        content: null,
        url: null,
        published_at: '2026-05-24T01:00:00.000Z',
        lang: 'en',
        raw_json: {},
      },
    ]);
    const extractEvent = jest.fn().mockResolvedValue({
      is_relevant: true,
      related_core_symbols: ['MU'],
      related_context_entities: ['Samsung Memory'],
      theme: 'HBM / memory cycle',
      event_type: 'competition',
      event_direction: 'positive',
      importance_score: 78,
      summary: 'Samsung delay supports MU context signal.',
      key_facts: [],
      positive_factors: [],
      negative_factors: [],
      supply_chain_mentions: [],
      new_company_mentions: [],
      uncertainty: [],
      evidence: [],
      raw_llm_json: {},
      llm_input_summary: 'Samsung HBM certification timeline slips again',
      llm_model: 'deepseek-chat',
    });
    const persist = {
      upsertRawNews: jest.fn(async (news: OpportunityPipelineRawNews[]) =>
        news.map((item: OpportunityPipelineRawNews, index: number) => ({
          ...item,
          id: index + 1,
          created_at: 'now',
        })),
      ),
      insertCompanyEvents: jest.fn(async () => [
        {
          id: 1,
          symbol: 'Samsung Memory',
          company_name: 'Samsung Memory',
          theme: 'HBM / memory cycle',
          event_type: 'competition' as const,
          event_direction: 'positive' as const,
          importance_score: 78,
          event_summary: 'Samsung delay supports MU context signal.',
          evidence_news_ids: [1],
          published_at: '2026-05-24T01:00:00.000Z',
          raw_payload: {},
          created_at: '2026-05-24T01:00:00.000Z',
        },
      ]),
      replaceLatestOpportunityDecisions: jest.fn(),
      upsertDiscoveredCandidate: jest.fn(),
      upsertContextFromCandidate: jest.fn(),
      upsertCoreFromCandidate: jest.fn(),
    };

    await runOpportunityNewsPipeline({
      coreTargets: seedCoreWatchlist,
      contextEntities: seedContext,
      indicators: seedIndicators,
      fetchNews,
      extractEvent,
      validateCandidate: jest.fn(),
      persist,
      limits: { maxNewsPerRun: 50, maxLlmCallsPerRun: 20 },
    });

    expect(extractEvent).toHaveBeenCalledTimes(1);
    expect(persist.insertCompanyEvents).toHaveBeenCalledTimes(1);
    expect(persist.replaceLatestOpportunityDecisions).toHaveBeenCalledTimes(1);
  });

  it('uses persisted company event ids as decision evidence', async () => {
    const fetchNews = jest.fn().mockResolvedValue([
      {
        source: 'finnhub',
        source_type: 'company_news',
        title: 'Samsung HBM certification timeline slips again',
        summary: 'The delay could keep high-end memory supply tight.',
        content: null,
        url: null,
        published_at: '2026-05-24T01:00:00.000Z',
        lang: 'en',
        raw_json: {},
      },
    ]);
    const extractEvent = jest.fn().mockResolvedValue({
      is_relevant: true,
      related_core_symbols: ['MU'],
      related_context_entities: ['Samsung Memory'],
      theme: 'HBM / memory cycle',
      event_type: 'competition',
      event_direction: 'positive',
      importance_score: 78,
      summary: 'Samsung delay supports MU context signal.',
      key_facts: [],
      positive_factors: [],
      negative_factors: [],
      supply_chain_mentions: [],
      new_company_mentions: [],
      uncertainty: [],
      evidence: [],
      raw_llm_json: {},
      llm_input_summary: 'Samsung HBM certification timeline slips again',
      llm_model: 'deepseek-chat',
    });
    const persist = {
      upsertRawNews: jest.fn(async (news: OpportunityPipelineRawNews[]) =>
        news.map((item: OpportunityPipelineRawNews) => ({
          ...item,
          id: 11,
          created_at: 'now',
        })),
      ),
      insertCompanyEvents: jest.fn(async () => [
        {
          id: 42,
          symbol: 'Samsung Memory',
          company_name: 'Samsung Memory',
          theme: 'HBM / memory cycle',
          event_type: 'competition' as const,
          event_direction: 'positive' as const,
          importance_score: 78,
          event_summary: 'Samsung delay supports MU context signal.',
          evidence_news_ids: [11],
          published_at: '2026-05-24T01:00:00.000Z',
          raw_payload: {},
          created_at: '2026-05-24T01:00:00.000Z',
        },
      ]),
      replaceLatestOpportunityDecisions: jest.fn(),
      upsertDiscoveredCandidate: jest.fn(),
      upsertContextFromCandidate: jest.fn(),
      upsertCoreFromCandidate: jest.fn(),
    };

    await runOpportunityNewsPipeline({
      coreTargets: seedCoreWatchlist,
      contextEntities: seedContext,
      indicators: seedIndicators,
      fetchNews,
      extractEvent,
      validateCandidate: jest.fn(),
      persist,
      limits: { maxNewsPerRun: 50, maxLlmCallsPerRun: 20 },
    });

    expect(persist.replaceLatestOpportunityDecisions).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        symbol: 'MU',
        evidence_events: [
          expect.objectContaining({
            id: 42,
            evidence_news_ids: [11],
          }),
        ],
      }),
    ]));
  });
});
