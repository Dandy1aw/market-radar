import { fetchCompanyNews } from '../../../lib/data-sources/finnhub';

describe('fetchCompanyNews', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('normalizes Finnhub headline into title', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          category: 'company',
          datetime: 1779618660,
          headline: 'Micron HBM demand remains strong',
          id: 140403997,
          image: '',
          related: 'MU',
          source: 'Yahoo',
          summary: 'Micron demand summary',
          url: 'https://example.com/news',
        },
      ],
    }) as jest.Mock;

    const news = await fetchCompanyNews('MU', '2026-05-23', '2026-05-24', 'token');

    expect(news).toEqual([
      expect.objectContaining({
        symbol: 'MU',
        title: 'Micron HBM demand remains strong',
        summary: 'Micron demand summary',
      }),
    ]);
  });
});
