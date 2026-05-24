import {
  buildEventExtractionPrompt,
  extractOpportunityEvent,
} from '@/lib/opportunity/event-extraction';
import { seedContext, seedCoreWatchlist } from '@/lib/opportunity/seed';
import type { FilteredNews } from '@/lib/opportunity/news-filter';

const filtered: FilteredNews = {
  news: {
    source: 'finnhub',
    source_type: 'company_news',
    title: 'Samsung HBM certification timeline slips again',
    summary: 'The delay could keep high-end memory supply tight.',
    content: null,
    url: null,
    published_at: '2026-05-24T01:00:00.000Z',
    lang: 'en',
    raw_json: {},
    hash: 'samsung-hbm',
  },
  matched_core_symbols: ['MU'],
  matched_context: [
    {
      core_symbol: 'MU',
      related_symbol: null,
      related_name: 'Samsung Memory',
      relation_type: 'competitor',
      relation_strength: 0.8,
    },
  ],
  matched_themes: ['HBM / memory cycle'],
  rule_confidence: 0.8,
  llm_input_summary: 'Samsung HBM certification timeline slips again',
};

describe('event extraction', () => {
  it('builds a strict JSON prompt with core and context pools', () => {
    const prompt = buildEventExtractionPrompt({
      filtered,
      coreTargets: seedCoreWatchlist,
      contextEntities: seedContext,
    });

    expect(prompt).toContain('Return strict JSON');
    expect(prompt).toContain('MU');
    expect(prompt).toContain('Samsung Memory');
    expect(prompt).toContain('Do not output buy or sell instructions');
  });

  it('maps Samsung HBM delay into a MU context event', async () => {
    const chat = jest.fn().mockResolvedValue(
      JSON.stringify({
        is_relevant: true,
        related_core_symbols: ['MU'],
        related_context_entities: ['Samsung Memory'],
        theme: 'HBM / memory cycle',
        event_type: 'competition',
        event_direction: 'positive',
        importance_score: 78,
        summary: 'Samsung HBM certification delay may keep supply tight.',
        key_facts: ['Samsung HBM certification slipped.'],
        positive_factors: ['Supports MU competitive setup.'],
        negative_factors: [],
        supply_chain_mentions: ['Samsung Memory'],
        new_company_mentions: [],
        uncertainty: [],
        evidence: [{ text: 'certification timeline slips', reason: 'title evidence' }],
      }),
    );

    const event = await extractOpportunityEvent({
      filtered,
      coreTargets: seedCoreWatchlist,
      contextEntities: seedContext,
      chat,
      model: 'deepseek-chat',
    });

    expect(event?.related_core_symbols).toEqual(['MU']);
    expect(event?.event_type).toBe('competition');
    expect(event?.llm_model).toBe('deepseek-chat');
  });
});
