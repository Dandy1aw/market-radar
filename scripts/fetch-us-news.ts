// Run via: npx tsx scripts/fetch-us-news.ts
import { createClient } from '@supabase/supabase-js';
import { fetchCompanyNews } from '../lib/data-sources/finnhub';
import { summarizeNews } from '../lib/llm/client';

const REQUIRED_ENV = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'FINNHUB_API_KEY', 'LLM_API_KEY'] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) { console.error(`Missing required env var: ${key}`); process.exit(1); }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'AMD', 'AVGO', 'TSLA'];

function dateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 1);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

async function main() {
  const { from, to } = dateRange();
  const apiKey = process.env.FINNHUB_API_KEY!;

  for (const symbol of SYMBOLS) {
    console.log(`Fetching news for ${symbol}...`);
    try {
      const news = await fetchCompanyNews(symbol, from, to, apiKey);
      if (news.length === 0) { console.log(`  no news`); continue; }

      const top5 = news.slice(0, 5);
      const { summary, sentiment } = await summarizeNews(symbol, top5.map(n => n.title));

      const records = top5.map(n => ({
        symbol,
        title: n.title,
        url: n.url,
        source: n.source,
        published_at: new Date(n.datetime * 1000).toISOString(),
        summary,
        sentiment,
        news_type: 'company',
        importance_score: null,
      }));

      const { error } = await supabase.from('market_news').insert(records);
      if (error) throw error;
      console.log(`  ✓ ${records.length} articles, sentiment=${sentiment}`);
    } catch (err) {
      console.error(`  ✗ ${symbol}:`, err);
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  console.log('News fetch done.');
}

main().catch(console.error);
