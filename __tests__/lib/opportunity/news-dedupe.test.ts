import {
  createNewsHash,
  dedupeNews,
  normalizeNewsTitle,
} from '@/lib/opportunity/news-dedupe';

const baseNews = {
  source: 'finnhub',
  source_type: 'company_news',
  title: ' Micron Highlights HBM Demand! ',
  summary: 'HBM demand remains strong.',
  content: null,
  url: 'https://example.com/article?utm_source=x',
  published_at: '2026-05-24T01:20:00.000Z',
  lang: 'en',
  raw_json: {},
};

describe('news dedupe helpers', () => {
  it('normalizes title casing and punctuation', () => {
    expect(normalizeNewsTitle(' Micron, highlights HBM demand! ')).toBe(
      'micron highlights hbm demand',
    );
  });

  it('creates stable hashes for equivalent title url and published date', () => {
    expect(createNewsHash(baseNews)).toBe(
      createNewsHash({
        ...baseNews,
        title: 'micron highlights hbm demand',
        url: 'https://example.com/article?ref=abc',
      }),
    );
  });

  it('creates stable hashes for different times on the same published day', () => {
    expect(createNewsHash(baseNews)).toBe(
      createNewsHash({
        ...baseNews,
        published_at: '2026-05-24T23:59:00.000Z',
      }),
    );
  });

  it('creates different hashes for different published days', () => {
    expect(createNewsHash(baseNews)).not.toBe(
      createNewsHash({
        ...baseNews,
        published_at: '2026-05-25T01:20:00.000Z',
      }),
    );
  });

  it('includes valid URL ports in the hash', () => {
    expect(
      createNewsHash({
        ...baseNews,
        url: 'https://example.com:8080/article',
      }),
    ).not.toBe(
      createNewsHash({
        ...baseNews,
        url: 'https://example.com:9090/article',
      }),
    );
  });

  it('strips fragments from malformed URL fallback canonicalization', () => {
    expect(
      createNewsHash({
        ...baseNews,
        url: 'relative/article#fragment',
      }),
    ).toBe(
      createNewsHash({
        ...baseNews,
        url: 'relative/article',
      }),
    );
  });

  it('removes duplicate news by hash', () => {
    const deduped = dedupeNews([
      baseNews,
      { ...baseNews, title: 'micron highlights hbm demand' },
      {
        ...baseNews,
        title: 'NVIDIA demand remains robust',
        url: 'https://example.com/nvda',
      },
    ]);

    expect(deduped).toHaveLength(2);
    expect(deduped[0].hash).toBeDefined();
  });

  it('preserves the first-seen item when duplicates collapse', () => {
    const deduped = dedupeNews([
      baseNews,
      {
        ...baseNews,
        title: 'micron highlights hbm demand',
        summary: 'Second duplicate should be dropped.',
      },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].summary).toBe(baseNews.summary);
  });
});
