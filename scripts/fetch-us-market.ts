// Run via: npx tsx scripts/fetch-us-market.ts
import { createClient } from '@supabase/supabase-js';
import { fetchDailyFull, type OhlcvRecord } from '../lib/data-sources/alpha-vantage';
import { calcMA, calcDrawdown1y, calcVolumeRatio, calcRiskLevel } from '../lib/indicators';

const REQUIRED_ENV = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ALPHA_VANTAGE_API_KEY'] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Note: Alpha Vantage uses standard ticker symbols.
// For NDX use 'NDX', for SPX use 'SPX', for VIX use 'VIX'.
// If the API returns an error for index symbols, use ETF proxies (QQQ for NDX, SPY for SPX).
const US_SYMBOLS = [
  'QQQ', 'SPY', 'VOO', 'XLK', 'SMH', 'SOXX', 'TLT', 'GLD',
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'AMD', 'AVGO', 'TSLA',
];

const API_KEY = process.env.ALPHA_VANTAGE_API_KEY!;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function upsertPrices(records: OhlcvRecord[]) {
  const { error } = await supabase
    .from('market_price_daily')
    .upsert(records, { onConflict: 'symbol,trade_date' });
  if (error) throw error;
}

async function computeAndUpsertIndicators(symbol: string, prices: OhlcvRecord[]) {
  if (prices.length === 0) return;
  const closes = prices.map(p => p.close);
  const volumes = prices.map(p => p.volume);
  const lastIdx = closes.length - 1;
  const close = closes[lastIdx];
  const tradeDate = prices[lastIdx].trade_date;

  const ma20Vol = calcMA(volumes.slice(0, lastIdx), 20);
  const ma500 = calcMA(closes.slice(0, lastIdx + 1), 500);
  const ma1000 = calcMA(closes.slice(0, lastIdx + 1), 1000);
  const drawdown1y = calcDrawdown1y(closes.slice(-250));

  const indicator = {
    symbol,
    trade_date: tradeDate,
    close,
    pct_change_1d: lastIdx >= 1 ? (close - closes[lastIdx - 1]) / closes[lastIdx - 1] * 100 : null,
    pct_change_5d: lastIdx >= 5 ? (close - closes[lastIdx - 5]) / closes[lastIdx - 5] * 100 : null,
    pct_change_20d: lastIdx >= 20 ? (close - closes[lastIdx - 20]) / closes[lastIdx - 20] * 100 : null,
    ma20: calcMA(closes.slice(0, lastIdx + 1), 20),
    ma60: calcMA(closes.slice(0, lastIdx + 1), 60),
    ma250: calcMA(closes.slice(0, lastIdx + 1), 250),
    ma500,
    ma1000,
    pct_from_ma500: ma500 ? (close - ma500) / ma500 * 100 : null,
    pct_from_ma1000: ma1000 ? (close - ma1000) / ma1000 * 100 : null,
    drawdown_1y: drawdown1y,
    volume_ratio: ma20Vol ? calcVolumeRatio(volumes[lastIdx], ma20Vol) : null,
    risk_level: calcRiskLevel({ close, ma500, ma1000, drawdown1y }),
  };

  const { error } = await supabase
    .from('market_indicator_daily')
    .upsert(indicator, { onConflict: 'symbol,trade_date' });
  if (error) throw error;
}

async function main() {
  for (const symbol of US_SYMBOLS) {
    console.log(`Fetching ${symbol}...`);
    try {
      const prices = await fetchDailyFull(symbol, API_KEY);
      await upsertPrices(prices);
      await computeAndUpsertIndicators(symbol, prices);
      console.log(`  ✓ ${symbol} (${prices.length} days)`);
    } catch (err) {
      console.error(`  ✗ ${symbol}:`, err);
    }
    // Alpha Vantage free tier: 5 req/min → 13s between requests
    await sleep(13000);
  }
  console.log('Done.');
}

main().catch(console.error);
