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

CREATE TABLE IF NOT EXISTS watchlist_core (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('US', 'CN')),
  exchange TEXT,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('index', 'etf', 'stock', 'sector')),
  theme TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(symbol, market, asset_type)
);

CREATE TABLE IF NOT EXISTS watchlist_context (
  id BIGSERIAL PRIMARY KEY,
  core_symbol TEXT NOT NULL,
  related_symbol TEXT,
  related_name TEXT NOT NULL,
  market TEXT NOT NULL DEFAULT 'GLOBAL',
  relation_type TEXT NOT NULL CHECK (relation_type IN (
    'competitor', 'supplier', 'customer', 'peer', 'etf_holding', 'industry_signal', 'policy_signal'
  )),
  relation_strength NUMERIC NOT NULL DEFAULT 0.5,
  reason TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS raw_news (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  source_type TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  url TEXT,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hash TEXT UNIQUE NOT NULL,
  lang TEXT,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_event (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT,
  market TEXT,
  company_name TEXT,
  theme TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'demand', 'competition', 'product', 'supply_chain', 'earnings_risk', 'macro', 'price_action'
  )),
  event_direction TEXT NOT NULL CHECK (event_direction IN ('positive', 'neutral', 'negative', 'mixed')),
  importance_score NUMERIC NOT NULL,
  event_summary TEXT NOT NULL,
  evidence_news_ids BIGINT[] NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  raw_llm_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  llm_input_summary TEXT NOT NULL,
  llm_model TEXT NOT NULL,
  extraction_status TEXT NOT NULL DEFAULT 'ok' CHECK (extraction_status IN (
    'ok', 'irrelevant', 'parse_failed', 'rejected'
  )),
  extraction_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opportunity_decision (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  market TEXT NOT NULL,
  company_name TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('index', 'etf', 'stock', 'sector')),
  theme TEXT NOT NULL,
  decision_level TEXT NOT NULL CHECK (decision_level IN (
    'small_probe',
    'pullback_candidate',
    'strong_watch',
    'breakout_confirm',
    'post_earnings_wait',
    'risk_high'
  )),
  total_score NUMERIC NOT NULL,
  news_score NUMERIC NOT NULL,
  price_position_score NUMERIC NOT NULL,
  context_signal_score NUMERIC NOT NULL,
  risk_score NUMERIC NOT NULL,
  summary TEXT NOT NULL,
  watch_conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_event_ids BIGINT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS discovered_candidates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT,
  market TEXT,
  theme TEXT,
  discovered_from TEXT,
  related_to_symbol TEXT,
  relation_type TEXT CHECK (relation_type IN (
    'competitor', 'supplier', 'customer', 'peer', 'etf_holding', 'industry_signal', 'policy_signal'
  )),
  reason TEXT,
  mention_count INT NOT NULL DEFAULT 1,
  importance_score NUMERIC NOT NULL DEFAULT 0,
  confidence NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_ai_review' CHECK (status IN (
    'auto_added_context', 'auto_added_core', 'pending_ai_review', 'rejected'
  )),
  ai_decision TEXT CHECK (ai_decision IN (
    'add_context', 'add_core', 'keep_candidate', 'reject'
  )),
  raw_llm_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_news_ids BIGINT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_news_published ON raw_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_event_symbol_created ON company_event(symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunity_decision_symbol_created ON opportunity_decision(symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovered_candidates_status ON discovered_candidates(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_discovered_candidates_unique_candidate
  ON discovered_candidates(name, related_to_symbol, relation_type) NULLS NOT DISTINCT;
