describe('GET /api/opportunity', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'placeholder',
      SUPABASE_SERVICE_ROLE_KEY: 'placeholder',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.dontMock('@/lib/supabase/opportunity-ingestion');
  });

  it('returns grouped seed opportunity data when Supabase is not configured', async () => {
    const { GET } = await import('@/app/api/opportunity/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary.total).toBe(5);
    expect(body.groups.pullback_candidate.length).toBeGreaterThanOrEqual(1);
    expect(body.groups.risk_high.length).toBeGreaterThanOrEqual(1);
    expect(
      [
        ...body.groups.strong_watch,
        ...body.groups.pullback_candidate,
        ...body.groups.risk_high,
        ...body.groups.other,
      ].length,
    ).toBe(5);
  });

  it('does not expose context entities as recommendation cards', async () => {
    const { GET } = await import('@/app/api/opportunity/route');
    const response = await GET();
    const body = await response.json();
    const allSymbols = [
      ...body.groups.strong_watch,
      ...body.groups.pullback_candidate,
      ...body.groups.risk_high,
      ...body.groups.other,
    ].map((card: { symbol: string }) => card.symbol);

    expect(allSymbols).toContain('MU');
    expect(allSymbols).not.toContain('Samsung Memory');
    expect(allSymbols).not.toContain('CXMT');
  });

  it('returns persisted opportunity data when available', async () => {
    jest.doMock('@/lib/supabase/opportunity-ingestion', () => ({
      getLatestOpportunityDecisionData: jest.fn().mockResolvedValue({
        updated_at: '2026-05-24T01:00:00.000Z',
        summary: {
          total: 1,
          strong_watch: 1,
          pullback_candidate: 0,
          risk_high: 0,
          other: 0,
        },
        groups: {
          strong_watch: [
            {
              symbol: 'MU',
              company_name: 'Micron Technology',
              asset_type: 'stock',
              market: 'US',
              theme: 'HBM / memory cycle',
              decision_level: 'strong_watch',
              decision_label: '强关注',
              total_score: 75,
              news_score: 85,
              price_position_score: 55,
              context_signal_score: 78,
              risk_score: 42,
              summary: 'Persisted decision.',
              watch_conditions: [],
              risk_factors: [],
              evidence_events: [],
              evidence_news: [],
              updated_at: '2026-05-24T01:00:00.000Z',
            },
          ],
          pullback_candidate: [],
          risk_high: [],
          other: [],
        },
      }),
    }));

    const { GET } = await import('@/app/api/opportunity/route');
    const response = await GET();
    const body = await response.json();

    expect(body.summary.total).toBe(1);
    expect(body.groups.strong_watch[0].summary).toBe('Persisted decision.');
  });
});
