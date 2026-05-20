-- watchlist
CREATE TABLE IF NOT EXISTS watchlist (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  name TEXT,
  market TEXT NOT NULL CHECK (market IN ('US', 'CN')),
  asset_type TEXT NOT NULL CHECK (asset_type IN ('index', 'etf', 'stock', 'sector')),
  category TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, market)
);

-- market_price_daily
CREATE TABLE IF NOT EXISTS market_price_daily (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  trade_date DATE NOT NULL,
  open NUMERIC,
  high NUMERIC,
  low NUMERIC,
  close NUMERIC,
  volume NUMERIC,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, trade_date)
);

-- market_indicator_daily
CREATE TABLE IF NOT EXISTS market_indicator_daily (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  trade_date DATE NOT NULL,
  close NUMERIC,
  pct_change_1d NUMERIC,
  pct_change_5d NUMERIC,
  pct_change_20d NUMERIC,
  ma20 NUMERIC,
  ma60 NUMERIC,
  ma250 NUMERIC,
  ma500 NUMERIC,
  ma1000 NUMERIC,
  pct_from_ma500 NUMERIC,
  pct_from_ma1000 NUMERIC,
  drawdown_1y NUMERIC,
  volume_ratio NUMERIC,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'extreme')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, trade_date)
);

-- market_news
CREATE TABLE IF NOT EXISTS market_news (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT,
  title TEXT NOT NULL,
  url TEXT,
  source TEXT,
  published_at TIMESTAMPTZ,
  summary TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  news_type TEXT,
  importance_score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- recommendation_daily
CREATE TABLE IF NOT EXISTS recommendation_daily (
  id BIGSERIAL PRIMARY KEY,
  trade_date DATE NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT,
  market TEXT,
  asset_type TEXT,
  recommendation_type TEXT CHECK (recommendation_type IN (
    'strong_watch', 'pullback_watch', 'risk_watch', 'base_dca', 'sector_watch'
  )),
  recommendation_level TEXT,
  score NUMERIC,
  reason TEXT,
  risk TEXT,
  action_suggestion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trade_date, symbol, recommendation_type)
);

-- daily_report
CREATE TABLE IF NOT EXISTS daily_report (
  id BIGSERIAL PRIMARY KEY,
  trade_date DATE NOT NULL UNIQUE,
  market_summary TEXT,
  us_summary TEXT,
  etf_summary TEXT,
  cn_sector_summary TEXT,
  dca_suggestion TEXT,
  risk_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- watchlist 初始数据
INSERT INTO watchlist (symbol, name, market, asset_type, category) VALUES
  ('NDX',  '纳斯达克100',   'US', 'index', 'broad_market'),
  ('SPX',  '标普500',       'US', 'index', 'broad_market'),
  ('VIX',  '恐慌指数',      'US', 'index', 'volatility'),
  ('QQQ',  '纳指ETF',       'US', 'etf',   'tech'),
  ('SPY',  '标普ETF',       'US', 'etf',   'broad_market'),
  ('VOO',  '先锋标普ETF',   'US', 'etf',   'broad_market'),
  ('XLK',  '科技ETF',       'US', 'etf',   'tech'),
  ('SMH',  '半导体ETF',     'US', 'etf',   'semiconductor'),
  ('SOXX', '费城半导体ETF', 'US', 'etf',   'semiconductor'),
  ('TLT',  '长期国债ETF',   'US', 'etf',   'bond'),
  ('GLD',  '黄金ETF',       'US', 'etf',   'gold'),
  ('AAPL', '苹果',          'US', 'stock',  'tech'),
  ('MSFT', '微软',          'US', 'stock',  'tech'),
  ('NVDA', '英伟达',        'US', 'stock',  'semiconductor'),
  ('GOOGL','谷歌',          'US', 'stock',  'tech'),
  ('AMZN', '亚马逊',       'US', 'stock',  'tech'),
  ('META', 'Meta',          'US', 'stock',  'tech'),
  ('AMD',  'AMD',           'US', 'stock',  'semiconductor'),
  ('AVGO', '博通',          'US', 'stock',  'semiconductor'),
  ('TSLA', '特斯拉',       'US', 'stock',  'ev')
ON CONFLICT (symbol, market) DO NOTHING;

-- 索引
CREATE INDEX IF NOT EXISTS idx_price_symbol_date   ON market_price_daily(symbol, trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_ind_symbol_date     ON market_indicator_daily(symbol, trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_news_symbol         ON market_news(symbol);
CREATE INDEX IF NOT EXISTS idx_news_pub            ON market_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_rec_date            ON recommendation_daily(trade_date DESC);
