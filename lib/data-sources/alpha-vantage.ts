const BASE_URL = 'https://www.alphavantage.co/query';

export interface OhlcvRecord {
  symbol: string;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source: 'alpha_vantage';
}

export function parseAlphaVantageDaily(
  data: Record<string, unknown>,
  symbol: string,
): OhlcvRecord[] {
  const series = data['Time Series (Daily)'] as Record<string, Record<string, string>> | undefined;
  if (!series) return [];

  return Object.entries(series)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      symbol,
      trade_date: date,
      open: parseFloat(v['1. open']),
      high: parseFloat(v['2. high']),
      low: parseFloat(v['3. low']),
      close: parseFloat(v['4. close']),
      volume: parseInt(v['5. volume'], 10),
      source: 'alpha_vantage' as const,
    }));
}

export async function fetchDailyFull(symbol: string, apiKey: string): Promise<OhlcvRecord[]> {
  const url = `${BASE_URL}?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Alpha Vantage fetch failed for ${symbol}: ${res.status}`);
  const json = await res.json() as Record<string, unknown>;
  if (json['Note']) throw new Error(`Alpha Vantage rate limit: ${json['Note']}`);
  if (json['Information']) throw new Error(`Alpha Vantage API error: ${json['Information']}`);
  return parseAlphaVantageDaily(json, symbol);
}
