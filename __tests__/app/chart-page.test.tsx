import ChartPage from '@/app/chart/[symbol]/page';

jest.mock('@/components/chart/ChartPageClient', () => ({
  ChartPageClient: (props: { symbol: string }) => (
    <div data-testid="chart-page-client">{props.symbol}</div>
  ),
}));

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
import { createClient } from '@supabase/supabase-js';

function makeQuery(result: unknown) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
}

describe('/chart/[symbol] page', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders the chart client with an upper-case symbol', async () => {
    const indicatorQuery = makeQuery({
      data: {
        trade_date: '2026-05-20',
        close: 100,
        pct_change_1d: 1,
        pct_change_5d: 2,
        pct_change_20d: 3,
        ma20: 98,
        ma60: 96,
        ma250: 90,
        ma500: 80,
        ma1000: 70,
        pct_from_ma500: 25,
        pct_from_ma1000: 40,
        drawdown_1y: -5,
        volume_ratio: 1.2,
        risk_level: 'low',
      },
      error: null,
    });
    const watchlistQuery = makeQuery({
      data: { name: 'Nasdaq 100' },
      error: null,
    });
    const newsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    };

    (createClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'market_indicator_daily') return indicatorQuery;
        if (table === 'watchlist') return watchlistQuery;
        return newsQuery;
      }),
    });

    const element = await ChartPage({
      params: Promise.resolve({ symbol: 'ndx' }),
    });

    expect(element).toEqual(
      expect.objectContaining({
        props: expect.objectContaining({
          children: expect.objectContaining({
            props: expect.objectContaining({ symbol: 'NDX' }),
          }),
        }),
      }),
    );
  });

  it('uses mock dashboard data when Supabase env is not configured', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://your-project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'your-service-role-key';

    const element = await ChartPage({
      params: Promise.resolve({ symbol: 'ndx' }),
    });

    expect(createClient).not.toHaveBeenCalled();
    expect(element).toEqual(
      expect.objectContaining({
        props: expect.objectContaining({
          children: expect.objectContaining({
            props: expect.objectContaining({ symbol: 'NDX' }),
          }),
        }),
      }),
    );
  });
});
