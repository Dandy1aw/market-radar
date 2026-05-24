import {
  extract_context_matches,
  filter_news_by_watchlist,
} from '@/lib/opportunity/news-filter';
import { seedContext, seedCoreWatchlist } from '@/lib/opportunity/seed';
import type { NewsWithHash } from '@/lib/opportunity/news-dedupe';

const news = (title: string, summary = ''): NewsWithHash => ({
  source: 'finnhub',
  source_type: 'company_news',
  title,
  summary,
  content: null,
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
});
