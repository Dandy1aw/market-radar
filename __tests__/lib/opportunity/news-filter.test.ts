import {
  extract_context_matches,
  filter_news_by_watchlist,
} from '@/lib/opportunity/news-filter';
import { seedContext, seedCoreWatchlist } from '@/lib/opportunity/seed';
import type { NewsWithHash } from '@/lib/opportunity/news-dedupe';
import type { OpportunityContextEntity, OpportunityCoreTarget } from '@/lib/opportunity/types';

const news = (title: string, summary = '', content: string | null = null): NewsWithHash => ({
  source: 'finnhub',
  source_type: 'company_news',
  title,
  summary,
  content,
  url: null,
  published_at: '2026-05-24T01:00:00.000Z',
  lang: 'en',
  raw_json: {},
  hash: title,
});

describe('opportunity news filtering', () => {
  it('keeps articles that mention a core symbol', () => {
    const result = filter_news_by_watchlist(
      [news('MU highlights stronger HBM demand')],
      seedCoreWatchlist,
      seedContext,
    );

    expect(result).toHaveLength(1);
    expect(result[0].matched_core_symbols).toContain('MU');
  });

  it('maps context entity matches back to a core symbol', () => {
    const matches = extract_context_matches(
      news('Samsung HBM certification delay creates memory supply tension'),
      seedCoreWatchlist,
      seedContext,
    );

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          core_symbol: 'MU',
          related_name: 'Samsung Memory',
        }),
      ]),
    );
  });

  it('filters unrelated articles out before LLM calls', () => {
    const result = filter_news_by_watchlist(
      [news('Restaurant chain launches summer menu')],
      seedCoreWatchlist,
      seedContext,
    );

    expect(result).toEqual([]);
  });

  it('does not match context entity from a broad first-token alias alone', () => {
    const matches = extract_context_matches(
      news('Samsung launches new phone with brighter display'),
      seedCoreWatchlist,
      seedContext,
    );

    expect(matches).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          core_symbol: 'MU',
          related_name: 'Samsung Memory',
        }),
      ]),
    );
  });

  it('does not match weak context alias with generic supply language alone', () => {
    const matches = extract_context_matches(
      news('Samsung phone supply constraints ease'),
      seedCoreWatchlist,
      seedContext,
    );

    expect(matches).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          core_symbol: 'MU',
          related_name: 'Samsung Memory',
        }),
      ]),
    );
  });

  it('matches weak context alias when the related core theme also matches', () => {
    const matches = extract_context_matches(
      news('Samsung HBM certification delay'),
      seedCoreWatchlist,
      seedContext,
    );

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          core_symbol: 'MU',
          related_name: 'Samsung Memory',
        }),
      ]),
    );
  });

  it('matches full context entity names without weak alias theme gating', () => {
    const matches = extract_context_matches(
      news('Samsung Memory expands HBM supply'),
      seedCoreWatchlist,
      seedContext,
    );

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          core_symbol: 'MU',
          related_name: 'Samsung Memory',
        }),
      ]),
    );
  });

  it('does not match theme keywords inside longer unrelated tokens', () => {
    const result = filter_news_by_watchlist(
      [news('Chipotle expands mobile ordering rewards')],
      seedCoreWatchlist,
      seedContext,
    );

    expect(result).toEqual([]);
  });

  it('ignores inactive context entities', () => {
    const inactiveContext: OpportunityContextEntity[] = seedContext.map((entity) =>
      entity.related_name === 'Samsung Memory' ? { ...entity, is_active: false } : entity,
    );

    const matches = extract_context_matches(
      news('Samsung HBM certification delay creates memory supply tension'),
      seedCoreWatchlist,
      inactiveContext,
    );

    expect(matches).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          related_name: 'Samsung Memory',
        }),
      ]),
    );
  });

  it('keeps active core theme-only matches with lower confidence', () => {
    const result = filter_news_by_watchlist(
      [news('Data center demand remains resilient across hyperscalers')],
      seedCoreWatchlist,
      seedContext,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        matched_core_symbols: ['NVDA'],
        matched_themes: ['AI compute'],
        rule_confidence: 0.65,
      }),
    );
  });

  it('filters theme-only matches when that core theme is inactive', () => {
    const inactiveHbmWatchlist: OpportunityCoreTarget[] = seedCoreWatchlist.map((core) =>
      core.theme === 'HBM / memory cycle' ? { ...core, is_active: false } : core,
    );

    const result = filter_news_by_watchlist(
      [news('HBM demand remains strong across the memory supply chain')],
      inactiveHbmWatchlist,
      [],
    );

    expect(result).toEqual([]);
  });

  it('matches summary and content fields, not only title', () => {
    const result = filter_news_by_watchlist(
      [news('Analyst note updates outlook', 'No direct ticker in summary.', 'MU demand improves.')],
      seedCoreWatchlist,
      seedContext,
    );

    expect(result).toHaveLength(1);
    expect(result[0].matched_core_symbols).toContain('MU');
  });

  it('bounds llm input summary to 4000 characters', () => {
    const result = filter_news_by_watchlist(
      [news('MU update', 'x'.repeat(5000), 'y'.repeat(5000))],
      seedCoreWatchlist,
      seedContext,
    );

    expect(result).toHaveLength(1);
    expect(result[0].llm_input_summary).toHaveLength(4000);
  });
});
