import {
  seedCompanyEvents,
  seedContext,
  seedCoreWatchlist,
  seedIndicators,
  seedRawNews,
} from '@/lib/opportunity/seed';

describe('opportunity seed data', () => {
  it('contains the five MVP core targets', () => {
    expect(seedCoreWatchlist.map(item => item.symbol).sort()).toEqual([
      'AMD',
      'MU',
      'NVDA',
      'QQQ',
      'SMH',
    ]);
  });

  it('keeps context entities out of the core pool', () => {
    const coreSymbols = new Set(seedCoreWatchlist.map(item => item.symbol));

    expect(seedContext.some(item => item.related_name === 'Samsung Memory')).toBe(
      true,
    );
    expect(coreSymbols.has('Samsung Memory')).toBe(false);
    expect(coreSymbols.has('CXMT')).toBe(false);
  });

  it('links each event to at least one evidence news item', () => {
    const newsIds = new Set(seedRawNews.map(news => news.id));

    for (const event of seedCompanyEvents) {
      expect(event.evidence_news_ids.length).toBeGreaterThan(0);
      for (const newsId of event.evidence_news_ids) {
        expect(newsIds.has(newsId)).toBe(true);
      }
    }
  });

  it('provides indicator snapshots for every core target', () => {
    const coreSymbols = seedCoreWatchlist.map(target => target.symbol).sort();
    const indicatorSymbols = seedIndicators
      .map(indicator => indicator.symbol)
      .sort();

    expect(indicatorSymbols).toEqual(coreSymbols);
  });
});
