import { parseAlphaVantageDaily } from '@/lib/data-sources/alpha-vantage';

describe('parseAlphaVantageDaily', () => {
  it('parses time series into sorted OHLCV records', () => {
    const raw = {
      'Time Series (Daily)': {
        '2024-01-02': { '1. open': '150', '2. high': '155', '3. low': '149', '4. close': '153', '5. volume': '1000000' },
        '2024-01-01': { '1. open': '148', '2. high': '152', '3. low': '147', '4. close': '150', '5. volume': '900000' },
      },
    };

    const result = parseAlphaVantageDaily(raw, 'AAPL');
    expect(result).toHaveLength(2);
    expect(result[0].trade_date).toBe('2024-01-01');
    expect(result[1].trade_date).toBe('2024-01-02');
    expect(result[1].close).toBeCloseTo(153);
    expect(result[1].volume).toBe(1000000);
    expect(result[0].symbol).toBe('AAPL');
    expect(result[0].source).toBe('alpha_vantage');
  });

  it('returns empty array for missing time series key', () => {
    expect(parseAlphaVantageDaily({}, 'AAPL')).toEqual([]);
  });
});
