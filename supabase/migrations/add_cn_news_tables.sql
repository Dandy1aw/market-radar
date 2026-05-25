-- supabase/migrations/add_cn_news_tables.sql

CREATE TABLE IF NOT EXISTS raw_cn_news (
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
  related_symbol TEXT,
  related_theme TEXT,
  confidence_level TEXT NOT NULL DEFAULT 'medium',
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS raw_cn_announcement (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  name TEXT,
  market TEXT NOT NULL DEFAULT 'CN',
  title TEXT NOT NULL,
  announcement_type TEXT,
  url TEXT,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hash TEXT UNIQUE NOT NULL,
  confidence_level TEXT NOT NULL DEFAULT 'high',
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_cn_news_symbol ON raw_cn_news(related_symbol);
CREATE INDEX IF NOT EXISTS idx_raw_cn_news_published ON raw_cn_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_cn_announcement_symbol ON raw_cn_announcement(symbol, published_at DESC);
