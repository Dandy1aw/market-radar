const BASE_URL = 'https://finnhub.io/api/v1';

export interface FinnhubNewsItem {
  symbol: string;
  title: string;
  url: string;
  source: string;
  datetime: number;
  summary: string;
}

export async function fetchCompanyNews(
  symbol: string,
  from: string,
  to: string,
  apiKey: string,
): Promise<FinnhubNewsItem[]> {
  const url = `${BASE_URL}/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Finnhub news fetch failed for ${symbol}: ${res.status}`);
  return res.json() as Promise<FinnhubNewsItem[]>;
}
