import { GET } from '@/app/api/chart/[symbol]/route';

const mockData = {
  symbol: 'NDX',
  name: 'Nasdaq 100',
  candles: [
    {
      date: '2026-05-19',
      open: 100,
      high: 110,
      low: 95,
      close: 105,
      volume: 1000000,
    },
  ],
  ma: [{ date: '2026-05-19', ma20: 102, ma60: 99, ma250: 95 }],
};

jest.mock('@/lib/supabase/chart', () => ({
  getChartData: jest.fn(),
}));
import { getChartData } from '@/lib/supabase/chart';

function makeReq(
  symbol: string,
  range?: string,
): [Request, { params: Promise<{ symbol: string }> }] {
  const url = `http://localhost/api/chart/${symbol}${range ? `?range=${range}` : ''}`;
  return [new Request(url), { params: Promise.resolve({ symbol }) }];
}

beforeEach(() => {
  (getChartData as jest.Mock).mockResolvedValue(mockData);
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('GET /api/chart/[symbol]', () => {
  it('returns chart data for the default 3m range', async () => {
    const [req, ctx] = makeReq('ndx');

    const res = await GET(req, ctx);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.symbol).toBe('NDX');
    expect(getChartData).toHaveBeenCalledWith('NDX', 63);
  });

  it('uses the expected row limit for each supported range', async () => {
    const cases: [string, number][] = [
      ['3m', 63],
      ['6m', 126],
      ['1y', 252],
      ['3y', 756],
    ];

    for (const [range, limit] of cases) {
      jest.clearAllMocks();
      (getChartData as jest.Mock).mockResolvedValue(mockData);

      const [req, ctx] = makeReq('NDX', range);
      await GET(req, ctx);

      expect(getChartData).toHaveBeenCalledWith('NDX', limit);
    }
  });

  it('returns 400 for unsupported ranges', async () => {
    const [req, ctx] = makeReq('NDX', 'bad');

    const res = await GET(req, ctx);

    expect(res.status).toBe(400);
  });

  it('returns 404 when no chart data is found', async () => {
    (getChartData as jest.Mock).mockResolvedValue(null);
    const [req, ctx] = makeReq('UNKNOWN');

    const res = await GET(req, ctx);

    expect(res.status).toBe(404);
  });
});
