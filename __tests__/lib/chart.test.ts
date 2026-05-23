import { getChartData } from '@/lib/supabase/chart';

const mockPriceRows = [
  {
    trade_date: '2026-05-20',
    open: 100,
    high: 110,
    low: 95,
    close: 105,
    volume: 1000000,
  },
  {
    trade_date: '2026-05-19',
    open: 98,
    high: 108,
    low: 93,
    close: 100,
    volume: 900000,
  },
];

const mockMaRows = [
  { trade_date: '2026-05-20', ma20: 102, ma60: 99, ma250: 95 },
  { trade_date: '2026-05-19', ma20: 101, ma60: 98, ma250: 94 },
];

const mockWatchlistRow = { name: 'Nasdaq 100' };

function makeMockSupabase(
  priceRows: unknown[],
  maRows: unknown[],
  watchlistRow: unknown,
) {
  const maQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockResolvedValue({ data: maRows, error: null }),
  };
  const priceQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({ data: priceRows, error: null }),
  };
  const watchlistQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest
      .fn()
      .mockResolvedValue({ data: watchlistRow, error: null }),
  };

  return {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'market_price_daily') return priceQuery;
      if (table === 'market_indicator_daily') return maQuery;
      return watchlistQuery;
    }),
  };
}

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
import { createClient } from '@supabase/supabase-js';

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  (createClient as jest.Mock).mockReturnValue(
    makeMockSupabase(mockPriceRows, mockMaRows, mockWatchlistRow),
  );
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('getChartData', () => {
  it('returns ascending candles and matching moving averages', async () => {
    const result = await getChartData('NDX', 63);

    expect(result).not.toBeNull();
    expect(result!.symbol).toBe('NDX');
    expect(result!.name).toBe('Nasdaq 100');
    expect(result!.candles.map(c => c.date)).toEqual([
      '2026-05-19',
      '2026-05-20',
    ]);
    expect(result!.candles[0].close).toBe(100);
    expect(result!.ma[1].ma20).toBe(102);
  });

  it('returns null when no price data exists', async () => {
    (createClient as jest.Mock).mockReturnValue(
      makeMockSupabase([], [], null),
    );

    await expect(getChartData('UNKNOWN', 63)).resolves.toBeNull();
  });

  it('falls back to symbol as name when watchlist has no entry', async () => {
    (createClient as jest.Mock).mockReturnValue(
      makeMockSupabase(mockPriceRows, mockMaRows, null),
    );

    const result = await getChartData('NDX', 63);

    expect(result!.name).toBe('NDX');
  });
});
