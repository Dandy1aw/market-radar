// Run via: npx tsx scripts/seed-watchlist.ts
import { createClient } from '@supabase/supabase-js';

const REQUIRED_ENV = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) { console.error(`Missing: ${key}`); process.exit(1); }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const DEFAULT_SYMBOLS = [
  { symbol: 'NDX',   name: '纳斯达克100',    market: 'US', asset_type: 'index',  category: 'broad_market'   },
  { symbol: 'SPX',   name: '标普500',         market: 'US', asset_type: 'index',  category: 'broad_market'   },
  { symbol: 'VIX',   name: '恐慌指数',        market: 'US', asset_type: 'index',  category: 'volatility'     },
  { symbol: 'QQQ',   name: '纳指ETF',         market: 'US', asset_type: 'etf',    category: 'tech'           },
  { symbol: 'SPY',   name: '标普ETF',         market: 'US', asset_type: 'etf',    category: 'broad_market'   },
  { symbol: 'VOO',   name: '先锋标普ETF',     market: 'US', asset_type: 'etf',    category: 'broad_market'   },
  { symbol: 'XLK',   name: '科技ETF',         market: 'US', asset_type: 'etf',    category: 'tech'           },
  { symbol: 'SMH',   name: '半导体ETF',       market: 'US', asset_type: 'etf',    category: 'semiconductor'  },
  { symbol: 'SOXX',  name: '费城半导体ETF',   market: 'US', asset_type: 'etf',    category: 'semiconductor'  },
  { symbol: 'TLT',   name: '长期国债ETF',     market: 'US', asset_type: 'etf',    category: 'bond'           },
  { symbol: 'GLD',   name: '黄金ETF',         market: 'US', asset_type: 'etf',    category: 'gold'           },
  { symbol: 'AAPL',  name: '苹果',            market: 'US', asset_type: 'stock',  category: 'tech'           },
  { symbol: 'MSFT',  name: '微软',            market: 'US', asset_type: 'stock',  category: 'tech'           },
  { symbol: 'NVDA',  name: '英伟达',          market: 'US', asset_type: 'stock',  category: 'semiconductor'  },
  { symbol: 'GOOGL', name: '谷歌',            market: 'US', asset_type: 'stock',  category: 'tech'           },
  { symbol: 'AMZN',  name: '亚马逊',          market: 'US', asset_type: 'stock',  category: 'tech'           },
  { symbol: 'META',  name: 'Meta',            market: 'US', asset_type: 'stock',  category: 'tech'           },
  { symbol: 'AMD',   name: 'AMD',             market: 'US', asset_type: 'stock',  category: 'semiconductor'  },
  { symbol: 'AVGO',  name: '博通',            market: 'US', asset_type: 'stock',  category: 'semiconductor'  },
  { symbol: 'TSLA',  name: '特斯拉',          market: 'US', asset_type: 'stock',  category: 'ev'             },
] as const;

async function main() {
  const { error, count } = await supabase
    .from('watchlist')
    .upsert(DEFAULT_SYMBOLS, { onConflict: 'symbol,market', ignoreDuplicates: true, count: 'exact' });

  if (error) { console.error('Seed failed:', error.message); process.exit(1); }
  console.log(`Seed complete. ${count ?? 0} rows inserted (duplicates skipped).`);
}

main().catch(console.error);
