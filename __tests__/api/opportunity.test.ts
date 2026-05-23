import { GET } from '@/app/api/opportunity/route';

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
  });

  it('returns grouped seed opportunity data when Supabase is not configured', async () => {
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
});
