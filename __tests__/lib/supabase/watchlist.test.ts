import { filterEnabledSymbols, type WatchlistRow } from '@/lib/supabase/watchlist';

describe('filterEnabledSymbols', () => {
  const rows: WatchlistRow[] = [
    { id: 1, symbol: 'QQQ', name: 'NDX ETF', market: 'US', asset_type: 'etf', category: 'tech', enabled: true },
    { id: 2, symbol: 'AAPL', name: 'Apple', market: 'US', asset_type: 'stock', category: 'tech', enabled: true },
    { id: 3, symbol: 'OLD', name: 'Disabled', market: 'US', asset_type: 'stock', category: null, enabled: false },
    { id: 4, symbol: '510300', name: '沪深300ETF', market: 'CN', asset_type: 'etf', category: 'broad', enabled: true },
  ];

  it('returns only enabled rows when market is omitted', () => {
    expect(filterEnabledSymbols(rows).map(r => r.symbol)).toEqual(['QQQ', 'AAPL', '510300']);
  });

  it('filters by market when provided', () => {
    expect(filterEnabledSymbols(rows, 'US').map(r => r.symbol)).toEqual(['QQQ', 'AAPL']);
    expect(filterEnabledSymbols(rows, 'CN').map(r => r.symbol)).toEqual(['510300']);
  });

  it('excludes disabled rows even when market matches', () => {
    const disabledOnly: WatchlistRow[] = [{ ...rows[2] }];
    expect(filterEnabledSymbols(disabledOnly, 'US')).toEqual([]);
  });
});
