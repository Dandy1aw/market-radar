# Market Radar Full Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal investment monitoring dashboard that shows US/A-share market status, ETF/stock recommendations, and daily AI-generated reports — from bare scaffold to deployed product.

**Architecture:** Next.js 16.2.6 App Router with Server Components for the dashboard; Supabase PostgreSQL as data store; GitHub Actions runs nightly pipelines (fetch prices → compute indicators → fetch news → LLM summaries → recommendation engine → daily report).

**Tech Stack:** Next.js 16.2.6, React 19, TypeScript, Tailwind CSS v4, `@supabase/supabase-js`, ECharts, Lucide React, Jest, `tsx`, Alpha Vantage, Finnhub, AkShare (Python), OpenAI-compatible LLM API.

---

## File Map

| File | Responsibility |
|------|---------------|
| `lib/supabase/client.ts` | Supabase client factories (admin + anon) |
| `lib/supabase/queries.ts` | All DB read queries → typed `DashboardData` |
| `lib/mock-data.ts` | Realistic mock `DashboardData` for M1 fallback |
| `lib/llm/client.ts` | OpenAI-compatible chat wrapper + prompt builders |
| `lib/indicators.ts` | MA, drawdown, volume ratio, risk level calculations |
| `lib/recommendation-engine.ts` | Scoring → `RecommendationType` derivation |
| `lib/data-sources/alpha-vantage.ts` | Alpha Vantage API client + parser |
| `lib/data-sources/finnhub.ts` | Finnhub news API client |
| `supabase/migrations/001_create_tables.sql` | All 6 table definitions + watchlist seed |
| `app/api/dashboard/route.ts` | `GET /api/dashboard` → `DashboardData` JSON |
| `app/api/tasks/refresh/route.ts` | `POST /api/tasks/refresh` (admin token required) |
| `app/components/MarketStatusBanner.tsx` | Today's market status banner |
| `app/components/IndexCard.tsx` | NDX/SPX/VIX card with change % and MA metrics |
| `app/components/EtfGrid.tsx` | ETF grid using `IndexCard` |
| `app/components/RecommendationSection.tsx` | Recommendation list (strong/pullback/risk/sector) |
| `app/components/DcaSuggestion.tsx` | DCA suggestion card |
| `app/components/DailyReportCard.tsx` | LLM-generated daily report sections |
| `app/page.tsx` | Root Server Component — fetches `/api/dashboard` and composes |
| `app/layout.tsx` | Root layout — update title and metadata |
| `scripts/fetch-us-market.ts` | Alpha Vantage → prices + indicators → Supabase |
| `scripts/fetch-us-news.ts` | Finnhub → news → LLM summary → Supabase |
| `scripts/generate-recommendations.ts` | Rule engine → `recommendation_daily` rows |
| `scripts/generate-daily-report.ts` | LLM → `daily_report` row |
| `scripts/fetch-cn-sectors.py` | AkShare → sector recommendations → Supabase |
| `scripts/requirements.txt` | Python deps for AkShare script |
| `.github/workflows/fetch-us-market.yml` | Cron 23:00 UTC (07:00 BJ) weekdays |
| `.github/workflows/fetch-us-news.yml` | Cron 23:30 UTC (07:30 BJ) weekdays |
| `.github/workflows/fetch-cn-sectors.yml` | Cron 08:30 UTC (16:30 BJ) weekdays |
| `.github/workflows/generate-recommendations.yml` | Cron 00:00 UTC (08:00 BJ) weekdays |
| `.github/workflows/generate-daily-report.yml` | Cron 00:30 UTC (08:30 BJ) weekdays |
| `jest.config.ts` | Jest configuration for Node env + path aliases |
| `.env.example` | Environment variable template |

---

## M1: Foundation + Mock Dashboard

### Task 1: Environment Setup

**Files:**
- Create: `.env.example`
- Create: `.env.local` (manually, not committed)

- [ ] **Step 1: Create `.env.example`**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# US Market Data
ALPHA_VANTAGE_API_KEY=your-alpha-vantage-key
FINNHUB_API_KEY=your-finnhub-key

# LLM (OpenAI-compatible)
LLM_API_KEY=your-llm-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini

# App
APP_ADMIN_TOKEN=generate-a-random-token-here
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Market Radar
```

Copy `.env.example` to `.env.local` and fill in real values (get Supabase keys from your project dashboard → Settings → API).

- [ ] **Step 2: Commit**

```bash
git init
git add .env.example types/index.ts docs/design.md
git commit -m "chore: initial project scaffold with design doc and types"
```

---

### Task 2: Supabase Client Library

**Files:**
- Create: `lib/supabase/client.ts`

- [ ] **Step 1: Create `lib/supabase/client.ts`**

```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export function createAdminClient() {
  return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export function createAnonClient() {
  return createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase/client.ts
git commit -m "feat: add Supabase client factories"
```

---

### Task 3: Database Schema

**Files:**
- Create: `supabase/migrations/001_create_tables.sql`

- [ ] **Step 1: Create migration SQL**

```sql
-- supabase/migrations/001_create_tables.sql

create table if not exists watchlist (
  id bigserial primary key,
  symbol text not null unique,
  name text not null,
  market text not null check (market in ('US', 'CN')),
  asset_type text not null check (asset_type in ('index', 'etf', 'stock', 'sector')),
  category text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists market_price_daily (
  id bigserial primary key,
  symbol text not null,
  trade_date date not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  volume bigint,
  source text,
  created_at timestamptz not null default now(),
  unique(symbol, trade_date)
);

create table if not exists market_indicator_daily (
  id bigserial primary key,
  symbol text not null,
  trade_date date not null,
  close numeric,
  pct_change_1d numeric,
  pct_change_5d numeric,
  pct_change_20d numeric,
  ma20 numeric,
  ma60 numeric,
  ma250 numeric,
  ma500 numeric,
  ma1000 numeric,
  pct_from_ma500 numeric,
  pct_from_ma1000 numeric,
  drawdown_1y numeric,
  volume_ratio numeric,
  risk_level text check (risk_level in ('low', 'medium', 'high', 'extreme')),
  created_at timestamptz not null default now(),
  unique(symbol, trade_date)
);

create table if not exists market_news (
  id bigserial primary key,
  symbol text,
  title text not null,
  url text,
  source text,
  published_at timestamptz,
  summary text,
  sentiment text check (sentiment in ('positive', 'negative', 'neutral')),
  news_type text,
  importance_score numeric,
  created_at timestamptz not null default now()
);

create table if not exists recommendation_daily (
  id bigserial primary key,
  trade_date date not null,
  symbol text not null,
  name text,
  market text check (market in ('US', 'CN')),
  asset_type text check (asset_type in ('index', 'etf', 'stock', 'sector')),
  recommendation_type text not null check (recommendation_type in ('strong_watch', 'pullback_watch', 'risk_watch', 'base_dca', 'sector_watch')),
  recommendation_level text,
  score numeric,
  reason text,
  risk text,
  action_suggestion text,
  created_at timestamptz not null default now(),
  unique(trade_date, symbol, recommendation_type)
);

create table if not exists daily_report (
  id bigserial primary key,
  trade_date date not null unique,
  market_summary text,
  us_summary text,
  etf_summary text,
  cn_sector_summary text,
  dca_suggestion text,
  risk_summary text,
  created_at timestamptz not null default now()
);

-- Seed watchlist
insert into watchlist (symbol, name, market, asset_type, category) values
  ('NDX', '纳斯达克100', 'US', 'index', 'index'),
  ('SPX', '标普500', 'US', 'index', 'index'),
  ('VIX', '恐慌指数', 'US', 'index', 'index'),
  ('QQQ', '纳指ETF', 'US', 'etf', 'etf'),
  ('SPY', '标普ETF', 'US', 'etf', 'etf'),
  ('VOO', 'Vanguard标普ETF', 'US', 'etf', 'etf'),
  ('XLK', '科技ETF', 'US', 'etf', 'etf'),
  ('SMH', '半导体ETF', 'US', 'etf', 'etf'),
  ('SOXX', '半导体ETF2', 'US', 'etf', 'etf'),
  ('TLT', '长债ETF', 'US', 'etf', 'etf'),
  ('GLD', '黄金ETF', 'US', 'etf', 'etf'),
  ('AAPL', '苹果', 'US', 'stock', 'mega'),
  ('MSFT', '微软', 'US', 'stock', 'mega'),
  ('NVDA', '英伟达', 'US', 'stock', 'mega'),
  ('GOOGL', '谷歌', 'US', 'stock', 'mega'),
  ('AMZN', '亚马逊', 'US', 'stock', 'mega'),
  ('META', 'Meta', 'US', 'stock', 'mega'),
  ('AMD', 'AMD', 'US', 'stock', 'chip'),
  ('AVGO', '博通', 'US', 'stock', 'chip'),
  ('TSLA', '特斯拉', 'US', 'stock', 'ev'),
  ('半导体', '半导体板块', 'CN', 'sector', 'sector'),
  ('AI应用', 'AI应用板块', 'CN', 'sector', 'sector'),
  ('新能源', '新能源板块', 'CN', 'sector', 'sector'),
  ('消费', '消费板块', 'CN', 'sector', 'sector'),
  ('医药', '医药板块', 'CN', 'sector', 'sector')
on conflict (symbol) do nothing;
```

- [ ] **Step 2: Apply to Supabase**

Go to your Supabase project → SQL Editor → paste the SQL above → Run.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/001_create_tables.sql
git commit -m "feat: add database schema and watchlist seed"
```

---

### Task 4: Mock Dashboard Data

**Files:**
- Create: `lib/mock-data.ts`

- [ ] **Step 1: Create `lib/mock-data.ts`**

```ts
import type { DashboardData } from '@/types';

const TODAY = new Date().toISOString().split('T')[0];

export const MOCK_DASHBOARD_DATA: DashboardData = {
  tradeDate: TODAY,
  marketStatus: { label: '正常区 — 趋势良好，维持基础定投', level: 'normal' },
  indexCards: [
    {
      id: 1, symbol: 'NDX', trade_date: TODAY,
      close: 19850.25, pct_change_1d: 0.82, pct_change_5d: 2.15, pct_change_20d: 4.3,
      ma20: 19400, ma60: 18800, ma250: 17200, ma500: 15100, ma1000: 12800,
      pct_from_ma500: 0.314, pct_from_ma1000: 0.551,
      drawdown_1y: -0.04, volume_ratio: 1.1, risk_level: 'low',
      created_at: TODAY, name: '纳斯达克100',
    },
    {
      id: 2, symbol: 'SPX', trade_date: TODAY,
      close: 5480.5, pct_change_1d: 0.45, pct_change_5d: 1.2, pct_change_20d: 3.1,
      ma20: 5380, ma60: 5210, ma250: 4950, ma500: 4400, ma1000: 3800,
      pct_from_ma500: 0.245, pct_from_ma1000: 0.442,
      drawdown_1y: -0.03, volume_ratio: 0.95, risk_level: 'low',
      created_at: TODAY, name: '标普500',
    },
    {
      id: 3, symbol: 'VIX', trade_date: TODAY,
      close: 14.2, pct_change_1d: -3.5, pct_change_5d: -8.0, pct_change_20d: -12.0,
      ma20: 16.5, ma60: 18.2, ma250: 19.0, ma500: null, ma1000: null,
      pct_from_ma500: null, pct_from_ma1000: null,
      drawdown_1y: null, volume_ratio: null, risk_level: 'low',
      created_at: TODAY, name: '恐慌指数',
    },
  ],
  etfCards: [
    {
      id: 4, symbol: 'QQQ', trade_date: TODAY,
      close: 482.1, pct_change_1d: 0.78, pct_change_5d: 2.0, pct_change_20d: 4.1,
      ma20: 471, ma60: 456, ma250: 418, ma500: 368, ma1000: 310,
      pct_from_ma500: 0.310, pct_from_ma1000: 0.555,
      drawdown_1y: -0.04, volume_ratio: 1.05, risk_level: 'low',
      created_at: TODAY, name: '纳指ETF',
    },
    {
      id: 5, symbol: 'SPY', trade_date: TODAY,
      close: 546.3, pct_change_1d: 0.42, pct_change_5d: 1.1, pct_change_20d: 3.0,
      ma20: 536, ma60: 520, ma250: 493, ma500: 437, ma1000: 379,
      pct_from_ma500: 0.250, pct_from_ma1000: 0.441,
      drawdown_1y: -0.03, volume_ratio: 0.9, risk_level: 'low',
      created_at: TODAY, name: '标普ETF',
    },
    {
      id: 6, symbol: 'SMH', trade_date: TODAY,
      close: 248.5, pct_change_1d: 1.2, pct_change_5d: 3.5, pct_change_20d: 7.2,
      ma20: 235, ma60: 218, ma250: 195, ma500: 165, ma1000: 132,
      pct_from_ma500: 0.506, pct_from_ma1000: 0.882,
      drawdown_1y: -0.08, volume_ratio: 1.35, risk_level: 'low',
      created_at: TODAY, name: '半导体ETF',
    },
    {
      id: 7, symbol: 'TLT', trade_date: TODAY,
      close: 88.4, pct_change_1d: -0.3, pct_change_5d: -1.2, pct_change_20d: -2.5,
      ma20: 89.5, ma60: 91.2, ma250: 94.0, ma500: null, ma1000: null,
      pct_from_ma500: null, pct_from_ma1000: null,
      drawdown_1y: -0.18, volume_ratio: 0.85, risk_level: 'medium',
      created_at: TODAY, name: '长债ETF',
    },
    {
      id: 8, symbol: 'GLD', trade_date: TODAY,
      close: 223.8, pct_change_1d: 0.2, pct_change_5d: 0.8, pct_change_20d: 2.1,
      ma20: 221, ma60: 215, ma250: 202, ma500: 185, ma1000: 165,
      pct_from_ma500: 0.209, pct_from_ma1000: 0.356,
      drawdown_1y: -0.04, volume_ratio: 1.0, risk_level: 'low',
      created_at: TODAY, name: '黄金ETF',
    },
  ],
  strongWatch: [
    {
      id: 1, trade_date: TODAY, symbol: 'NVDA', name: '英伟达',
      market: 'US', asset_type: 'stock', recommendation_type: 'strong_watch',
      recommendation_level: 'A', score: 88,
      reason: '价格站稳MA20/MA60，AI算力需求持续，财报超预期。量比1.4，温和放量。',
      risk: '5日涨幅已达8%，短期追高风险中等',
      action_suggestion: '可轻仓买入或等回调至MA20附近加仓',
      created_at: TODAY,
    },
    {
      id: 2, trade_date: TODAY, symbol: 'MSFT', name: '微软',
      market: 'US', asset_type: 'stock', recommendation_type: 'strong_watch',
      recommendation_level: 'A', score: 82,
      reason: 'Azure云业务增速回升，Copilot商业化进展顺利，价格突破前高。',
      risk: '估值偏高，PE 35x',
      action_suggestion: '定投标的之外可适量持有',
      created_at: TODAY,
    },
  ],
  pullbackWatch: [
    {
      id: 3, trade_date: TODAY, symbol: 'AMD', name: 'AMD',
      market: 'US', asset_type: 'stock', recommendation_type: 'pullback_watch',
      recommendation_level: 'B+', score: 72,
      reason: '长期趋势完好(>MA250)，近期跌至MA60附近，AI GPU份额持续提升。',
      risk: '竞争加剧，Intel反弹可能分流市场',
      action_suggestion: '回调至MA60-MA20区间可分批买入',
      created_at: TODAY,
    },
  ],
  riskWatch: [
    {
      id: 4, trade_date: TODAY, symbol: 'TSLA', name: '特斯拉',
      market: 'US', asset_type: 'stock', recommendation_type: 'risk_watch',
      recommendation_level: 'C', score: 45,
      reason: '交付量环比下滑，价格跌破MA60，多空争议较大。',
      risk: '基本面压力，关注下季度交付数据',
      action_suggestion: '观望为主，不建议新仓',
      created_at: TODAY,
    },
  ],
  cnSectors: [
    {
      id: 5, trade_date: TODAY, symbol: '半导体', name: '半导体板块',
      market: 'CN', asset_type: 'sector', recommendation_type: 'sector_watch',
      recommendation_level: 'A', score: 80,
      reason: '国产替代加速，板块资金持续流入，龙头股创近期新高。',
      risk: '外部制裁风险，地缘政治不确定性',
      action_suggestion: '可配置相关ETF（如512480）',
      created_at: TODAY,
    },
    {
      id: 6, trade_date: TODAY, symbol: 'AI应用', name: 'AI应用板块',
      market: 'CN', asset_type: 'sector', recommendation_type: 'sector_watch',
      recommendation_level: 'B+', score: 74,
      reason: '大模型商业化落地提速，To-B软件方向持续受资金关注。',
      risk: '短期涨幅过大，注意回调风险',
      action_suggestion: '关注回调机会',
      created_at: TODAY,
    },
  ],
  dailyReport: {
    id: 1, trade_date: TODAY,
    market_summary: '美股整体维持强势，科技板块领涨。纳指突破前高，市场情绪偏乐观。VIX保持低位，系统性风险可控。',
    us_summary: 'AI算力方向龙头（NVDA、MSFT）表现亮眼，半导体ETF（SMH）量价俱佳。建议关注NVDA和MSFT，AMD提供良好的回调买点。',
    etf_summary: 'QQQ/SPY均站稳均线上方，基础定投维持。SMH超额收益明显，可适量超配。TLT受利率压制，暂回避。',
    cn_sector_summary: 'A股半导体和AI应用板块持续强势，资金流入趋势明确。建议关注相关ETF配置机会。',
    dca_suggestion: '本日维持基础定投：QQQ ¥1000 + SPY ¥200。市场处于正常区间，无需增强加仓。',
    risk_summary: '主要风险：1) 美联储利率政策不确定性；2) 地缘政治摩擦（半导体出口管制）；3) 科技股估值偏高。当前VIX=14.2，系统性风险低。',
    created_at: TODAY,
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/mock-data.ts
git commit -m "feat: add realistic mock dashboard data"
```

---

### Task 5: Supabase Query Layer + Dashboard API Route

**Files:**
- Create: `lib/supabase/queries.ts`
- Create: `app/api/dashboard/route.ts`

- [ ] **Step 1: Create `lib/supabase/queries.ts`**

```ts
import { createAdminClient } from './client';
import type { DashboardData, MarketIndicatorDaily, RecommendationDaily, DailyReport, RiskLevel } from '@/types';

type IndicatorWithName = MarketIndicatorDaily & { name: string };

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().split('T')[0];

  const [indicatorsRes, watchlistRes, recommendationsRes, reportRes] = await Promise.all([
    supabase
      .from('market_indicator_daily')
      .select('*')
      .eq('trade_date', today),
    supabase
      .from('watchlist')
      .select('symbol, name'),
    supabase
      .from('recommendation_daily')
      .select('*')
      .eq('trade_date', today)
      .order('score', { ascending: false }),
    supabase
      .from('daily_report')
      .select('*')
      .eq('trade_date', today)
      .maybeSingle(),
  ]);

  const indicators = (indicatorsRes.data ?? []) as MarketIndicatorDaily[];
  const nameMap = Object.fromEntries(
    ((watchlistRes.data ?? []) as { symbol: string; name: string }[]).map(w => [w.symbol, w.name])
  );
  const recommendations = (recommendationsRes.data ?? []) as RecommendationDaily[];
  const report = reportRes.data as DailyReport | null;

  const withName = (ind: MarketIndicatorDaily): IndicatorWithName => ({
    ...ind,
    name: nameMap[ind.symbol] ?? ind.symbol,
  });

  const INDEX_SYMBOLS = ['NDX', 'SPX', 'VIX'];
  const ETF_SYMBOLS = ['QQQ', 'SPY', 'VOO', 'XLK', 'SMH', 'SOXX', 'TLT', 'GLD'];

  const indexCards = indicators.filter(i => INDEX_SYMBOLS.includes(i.symbol)).map(withName);
  const etfCards = indicators.filter(i => ETF_SYMBOLS.includes(i.symbol)).map(withName);

  const vix = indicators.find(i => i.symbol === 'VIX');
  const ndx = indicators.find(i => i.symbol === 'NDX');

  return {
    tradeDate: today,
    marketStatus: deriveMarketStatus(ndx ?? null, vix ?? null),
    indexCards,
    etfCards,
    strongWatch: recommendations.filter(r => r.recommendation_type === 'strong_watch'),
    pullbackWatch: recommendations.filter(r => r.recommendation_type === 'pullback_watch'),
    riskWatch: recommendations.filter(r => r.recommendation_type === 'risk_watch'),
    cnSectors: recommendations.filter(r => r.recommendation_type === 'sector_watch'),
    dailyReport: report,
  };
}

function deriveMarketStatus(
  ndx: MarketIndicatorDaily | null,
  vix: MarketIndicatorDaily | null,
): DashboardData['marketStatus'] {
  const vixClose = vix?.close ?? 0;
  const ndxRisk = ndx?.risk_level as RiskLevel | null;

  if (vixClose > 30 || ndxRisk === 'extreme') {
    return { label: '极端区 — 高度警惕，暂停定投', level: 'risk' };
  }
  if (vixClose > 25 || ndxRisk === 'high') {
    return { label: '风险区 — 谨慎操作，缩减仓位', level: 'risk' };
  }
  if (vixClose > 20 || ndxRisk === 'medium') {
    return { label: '关注区 — 市场波动加大，注意回撤', level: 'caution' };
  }
  return { label: '正常区 — 趋势良好，维持基础定投', level: 'normal' };
}
```

- [ ] **Step 2: Create `app/api/dashboard/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { getDashboardData } from '@/lib/supabase/queries';
import { MOCK_DASHBOARD_DATA } from '@/lib/mock-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(MOCK_DASHBOARD_DATA);
    }
    const data = await getDashboardData();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[/api/dashboard]', error);
    return NextResponse.json(MOCK_DASHBOARD_DATA);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/queries.ts app/api/dashboard/route.ts
git commit -m "feat: add Supabase query layer and dashboard API route"
```

---

### Task 6: MarketStatusBanner Component

**Files:**
- Create: `app/components/MarketStatusBanner.tsx`

- [ ] **Step 1: Create component**

```tsx
import type { DashboardData } from '@/types';

const LEVEL_STYLES = {
  normal: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  caution: 'bg-amber-50 text-amber-800 border-amber-200',
  risk: 'bg-red-50 text-red-800 border-red-200',
} as const;

const LEVEL_DOT = {
  normal: 'bg-emerald-500',
  caution: 'bg-amber-500',
  risk: 'bg-red-500',
} as const;

interface Props {
  marketStatus: DashboardData['marketStatus'];
  tradeDate: string;
}

export function MarketStatusBanner({ marketStatus, tradeDate }: Props) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-5 py-3 ${LEVEL_STYLES[marketStatus.level]}`}>
      <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${LEVEL_DOT[marketStatus.level]}`} />
      <span className="font-medium">{marketStatus.label}</span>
      <span className="ml-auto text-sm opacity-60">{tradeDate}</span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/MarketStatusBanner.tsx
git commit -m "feat: add MarketStatusBanner component"
```

---

### Task 7: IndexCard Component

**Files:**
- Create: `app/components/IndexCard.tsx`

- [ ] **Step 1: Create component**

```tsx
import type { MarketIndicatorDaily } from '@/types';

const RISK_BADGE = {
  low: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  extreme: 'bg-red-100 text-red-700',
} as const;

interface Props {
  card: MarketIndicatorDaily & { name: string };
}

function fmt(value: number | null, suffix = '%', decimals = 2): string {
  if (value === null) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}${suffix}`;
}

function fmtPct(value: number | null): string {
  if (value === null) return '—';
  return fmt(value * 100);
}

function changeClass(value: number | null): string {
  if (value === null || value === 0) return 'text-zinc-500';
  return value > 0 ? 'text-emerald-600' : 'text-red-500';
}

export function IndexCard({ card }: Props) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 flex flex-col gap-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider">{card.symbol}</p>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{card.name}</p>
        </div>
        {card.risk_level && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RISK_BADGE[card.risk_level]}`}>
            {card.risk_level}
          </span>
        )}
      </div>

      <div>
        <p className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
          {card.close?.toLocaleString() ?? '—'}
        </p>
        <p className={`text-sm font-medium ${changeClass(card.pct_change_1d)}`}>
          {fmt(card.pct_change_1d)} 今日
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1 text-xs text-zinc-500">
        <span>5日: <span className={changeClass(card.pct_change_5d)}>{fmt(card.pct_change_5d)}</span></span>
        <span>20日: <span className={changeClass(card.pct_change_20d)}>{fmt(card.pct_change_20d)}</span></span>
        {card.pct_from_ma500 !== null && (
          <span>距MA500: <span className={changeClass(card.pct_from_ma500)}>{fmtPct(card.pct_from_ma500)}</span></span>
        )}
        {card.drawdown_1y !== null && (
          <span>1年回撤: <span className="text-red-500">{fmtPct(card.drawdown_1y)}</span></span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/IndexCard.tsx
git commit -m "feat: add IndexCard component"
```

---

### Task 8: EtfGrid Component

**Files:**
- Create: `app/components/EtfGrid.tsx`

- [ ] **Step 1: Create component**

```tsx
import { IndexCard } from './IndexCard';
import type { MarketIndicatorDaily } from '@/types';

interface Props {
  etfCards: (MarketIndicatorDaily & { name: string })[];
}

export function EtfGrid({ etfCards }: Props) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">ETF</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {etfCards.map(card => (
          <IndexCard key={card.symbol} card={card} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/EtfGrid.tsx
git commit -m "feat: add EtfGrid component"
```

---

### Task 9: RecommendationSection Component

**Files:**
- Create: `app/components/RecommendationSection.tsx`

- [ ] **Step 1: Create component**

```tsx
import type { RecommendationDaily, RecommendationType } from '@/types';

const TYPE_CONFIG: Record<RecommendationType, { label: string; headerClass: string; badgeClass: string }> = {
  strong_watch: {
    label: '强关注',
    headerClass: 'text-emerald-700',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  pullback_watch: {
    label: '回调关注',
    headerClass: 'text-blue-700',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
  risk_watch: {
    label: '风险观察',
    headerClass: 'text-red-700',
    badgeClass: 'bg-red-100 text-red-700',
  },
  base_dca: {
    label: '基础定投',
    headerClass: 'text-zinc-700',
    badgeClass: 'bg-zinc-100 text-zinc-700',
  },
  sector_watch: {
    label: 'A股板块',
    headerClass: 'text-purple-700',
    badgeClass: 'bg-purple-100 text-purple-700',
  },
};

interface Props {
  type: RecommendationType;
  items: RecommendationDaily[];
}

export function RecommendationSection({ type, items }: Props) {
  if (items.length === 0) return null;
  const config = TYPE_CONFIG[type];

  return (
    <section>
      <h2 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${config.headerClass}`}>
        {config.label}
      </h2>
      <div className="flex flex-col gap-3">
        {items.map(item => (
          <div
            key={`${item.symbol}-${item.recommendation_type}`}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="font-semibold text-zinc-900 dark:text-zinc-50">{item.symbol}</span>
                {item.name && <span className="ml-2 text-sm text-zinc-500">{item.name}</span>}
              </div>
              <div className="flex items-center gap-2">
                {item.score !== null && (
                  <span className="text-xs font-mono text-zinc-400">{item.score}分</span>
                )}
                {item.recommendation_level && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.badgeClass}`}>
                    {item.recommendation_level}
                  </span>
                )}
              </div>
            </div>
            {item.reason && <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">{item.reason}</p>}
            {item.risk && <p className="text-xs text-red-500">风险: {item.risk}</p>}
            {item.action_suggestion && (
              <p className="text-xs text-zinc-500 mt-1">建议: {item.action_suggestion}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/RecommendationSection.tsx
git commit -m "feat: add RecommendationSection component"
```

---

### Task 10: DcaSuggestion + DailyReportCard Components

**Files:**
- Create: `app/components/DcaSuggestion.tsx`
- Create: `app/components/DailyReportCard.tsx`

- [ ] **Step 1: Create `app/components/DcaSuggestion.tsx`**

```tsx
interface Props {
  suggestion: string | null;
}

export function DcaSuggestion({ suggestion }: Props) {
  if (!suggestion) return null;
  return (
    <section>
      <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">定投建议</h2>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{suggestion}</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create `app/components/DailyReportCard.tsx`**

```tsx
import type { DailyReport } from '@/types';

interface Props {
  report: DailyReport | null;
}

function Section({ title, content }: { title: string; content: string | null }) {
  if (!content) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-zinc-400 uppercase mb-1">{title}</p>
      <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{content}</p>
    </div>
  );
}

export function DailyReportCard({ report }: Props) {
  if (!report) {
    return (
      <section>
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">每日复盘</h2>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-400">今日复盘尚未生成</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">每日复盘</h2>
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 flex flex-col gap-4">
        <Section title="市场总结" content={report.market_summary} />
        <Section title="美股分析" content={report.us_summary} />
        <Section title="ETF概况" content={report.etf_summary} />
        <Section title="A股板块" content={report.cn_sector_summary} />
        <Section title="风险提示" content={report.risk_summary} />
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/components/DcaSuggestion.tsx app/components/DailyReportCard.tsx
git commit -m "feat: add DcaSuggestion and DailyReportCard components"
```

---

### Task 11: Dashboard Page Assembly

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Update `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Market Radar',
  description: '个人投资监控仪表盘 — 美股 A股 每日复盘',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Replace `app/page.tsx`**

```tsx
import { MarketStatusBanner } from '@/app/components/MarketStatusBanner';
import { IndexCard } from '@/app/components/IndexCard';
import { EtfGrid } from '@/app/components/EtfGrid';
import { RecommendationSection } from '@/app/components/RecommendationSection';
import { DcaSuggestion } from '@/app/components/DcaSuggestion';
import { DailyReportCard } from '@/app/components/DailyReportCard';
import type { DashboardData } from '@/types';

async function fetchDashboard(): Promise<DashboardData> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const res = await fetch(`${base}/api/dashboard`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Dashboard fetch failed: ${res.status}`);
  return res.json() as Promise<DashboardData>;
}

export default async function HomePage() {
  const data = await fetchDashboard();

  return (
    <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          {process.env.NEXT_PUBLIC_APP_NAME ?? 'Market Radar'}
        </h1>
      </header>

      <MarketStatusBanner marketStatus={data.marketStatus} tradeDate={data.tradeDate} />

      <section>
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">指数</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {data.indexCards.map(card => (
            <IndexCard key={card.symbol} card={card} />
          ))}
        </div>
      </section>

      <EtfGrid etfCards={data.etfCards} />

      <RecommendationSection type="strong_watch" items={data.strongWatch} />
      <RecommendationSection type="pullback_watch" items={data.pullbackWatch} />
      <RecommendationSection type="risk_watch" items={data.riskWatch} />
      <RecommendationSection type="sector_watch" items={data.cnSectors} />

      <DcaSuggestion suggestion={data.dailyReport?.dca_suggestion ?? null} />
      <DailyReportCard report={data.dailyReport} />
    </main>
  );
}
```

- [ ] **Step 3: Run the dev server and verify**

```bash
npm run dev
```

Open http://localhost:3000 — you should see the full mock dashboard with market status, index cards, ETF grid, recommendations, DCA suggestion, and daily report.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/layout.tsx
git commit -m "feat: assemble M1 dashboard — mock data flows end-to-end"
```

---

## M2: Indicator Calculation + US Market Data Pipeline

### Task 12: Jest Setup

**Files:**
- Create: `jest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install test dependencies**

```bash
npm install -D jest @types/jest ts-jest
```

- [ ] **Step 2: Create `jest.config.ts`**

```ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
};

export default config;
```

- [ ] **Step 3: Add test scripts to `package.json`**

In `"scripts"`, add:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 4: Verify setup**

```bash
npm test
```

Expected output: `No tests found, exiting with code 1` (or similar — no crash)

- [ ] **Step 5: Commit**

```bash
git add jest.config.ts package.json package-lock.json
git commit -m "chore: add Jest + ts-jest configuration"
```

---

### Task 13: Indicator Calculation

**Files:**
- Create: `lib/indicators.ts`
- Create: `__tests__/lib/indicators.test.ts`

- [ ] **Step 1: Write failing tests in `__tests__/lib/indicators.test.ts`**

```ts
import { calcMA, calcDrawdown1y, calcVolumeRatio, calcRiskLevel } from '@/lib/indicators';

describe('calcMA', () => {
  it('returns null when prices array is shorter than period', () => {
    expect(calcMA([100, 200], 5)).toBeNull();
  });

  it('calculates average of last N prices', () => {
    const prices = [10, 20, 30, 40, 50];
    expect(calcMA(prices, 3)).toBeCloseTo(40);
  });

  it('returns exact value when prices length equals period', () => {
    expect(calcMA([1, 2, 3], 3)).toBeCloseTo(2);
  });
});

describe('calcDrawdown1y', () => {
  it('returns null for empty array', () => {
    expect(calcDrawdown1y([])).toBeNull();
  });

  it('calculates drawdown from 1-year high', () => {
    // high=120, last=90 → (90-120)/120 = -0.25
    expect(calcDrawdown1y([100, 120, 80, 90])).toBeCloseTo(-0.25);
  });

  it('returns 0 when current price equals the high', () => {
    expect(calcDrawdown1y([80, 90, 100])).toBeCloseTo(0);
  });
});

describe('calcVolumeRatio', () => {
  it('returns null when ma20 volume is 0', () => {
    expect(calcVolumeRatio(1000, 0)).toBeNull();
  });

  it('calculates today / ma20 ratio', () => {
    expect(calcVolumeRatio(1500, 1000)).toBeCloseTo(1.5);
  });
});

describe('calcRiskLevel', () => {
  it('returns extreme when price below MA1000', () => {
    expect(calcRiskLevel({ close: 50, ma500: 120, ma1000: 100, drawdown1y: -0.5 })).toBe('extreme');
  });

  it('returns high when price below MA500 but above MA1000', () => {
    expect(calcRiskLevel({ close: 90, ma500: 100, ma1000: 80, drawdown1y: -0.25 })).toBe('high');
  });

  it('returns medium when drawdown exceeds 15%', () => {
    expect(calcRiskLevel({ close: 110, ma500: 100, ma1000: 80, drawdown1y: -0.16 })).toBe('medium');
  });

  it('returns low for healthy indicators', () => {
    expect(calcRiskLevel({ close: 110, ma500: 100, ma1000: 80, drawdown1y: -0.05 })).toBe('low');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- __tests__/lib/indicators.test.ts
```

Expected: `FAIL` — `Cannot find module '@/lib/indicators'`

- [ ] **Step 3: Create `lib/indicators.ts`**

```ts
import type { RiskLevel } from '@/types';

export function calcMA(closePrices: number[], period: number): number | null {
  if (closePrices.length < period) return null;
  const slice = closePrices.slice(-period);
  return slice.reduce((sum, p) => sum + p, 0) / period;
}

export function calcDrawdown1y(yearlyCloses: number[]): number | null {
  if (yearlyCloses.length === 0) return null;
  const high = Math.max(...yearlyCloses);
  const last = yearlyCloses[yearlyCloses.length - 1];
  return (last - high) / high;
}

export function calcVolumeRatio(todayVolume: number, ma20Volume: number): number | null {
  if (ma20Volume === 0) return null;
  return todayVolume / ma20Volume;
}

export function calcRiskLevel(params: {
  close: number;
  ma500: number | null;
  ma1000: number | null;
  drawdown1y: number | null;
}): RiskLevel {
  const { close, ma500, ma1000, drawdown1y } = params;
  if (ma1000 !== null && close < ma1000) return 'extreme';
  if (ma500 !== null && close < ma500) return 'high';
  if (drawdown1y !== null && drawdown1y < -0.15) return 'medium';
  return 'low';
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- __tests__/lib/indicators.test.ts
```

Expected: `PASS` — 10 tests passing

- [ ] **Step 5: Commit**

```bash
git add lib/indicators.ts __tests__/lib/indicators.test.ts
git commit -m "feat: add indicator calculation with TDD"
```

---

### Task 14: Alpha Vantage Client

**Files:**
- Create: `lib/data-sources/alpha-vantage.ts`
- Create: `__tests__/lib/data-sources/alpha-vantage.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/lib/data-sources/alpha-vantage.test.ts
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
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- __tests__/lib/data-sources/alpha-vantage.test.ts
```

Expected: `FAIL`

- [ ] **Step 3: Create `lib/data-sources/alpha-vantage.ts`**

```ts
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
  const data = await res.json() as Record<string, unknown>;
  return parseAlphaVantageDaily(data, symbol);
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
npm test -- __tests__/lib/data-sources/alpha-vantage.test.ts
```

Expected: `PASS`

- [ ] **Step 5: Commit**

```bash
git add lib/data-sources/alpha-vantage.ts __tests__/lib/data-sources/alpha-vantage.test.ts
git commit -m "feat: add Alpha Vantage client with parser tests"
```

---

### Task 15: Finnhub Client

**Files:**
- Create: `lib/data-sources/finnhub.ts`

- [ ] **Step 1: Create `lib/data-sources/finnhub.ts`**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/data-sources/finnhub.ts
git commit -m "feat: add Finnhub news API client"
```

---

### Task 16: tsx + US Market Fetch Script

**Files:**
- Create: `scripts/fetch-us-market.ts`
- Create: `.github/workflows/fetch-us-market.yml`

- [ ] **Step 1: Install tsx**

```bash
npm install -D tsx
```

- [ ] **Step 2: Create `scripts/fetch-us-market.ts`**

```ts
// Run via: npx tsx scripts/fetch-us-market.ts
import { createClient } from '@supabase/supabase-js';
import { fetchDailyFull, type OhlcvRecord } from '../lib/data-sources/alpha-vantage';
import { calcMA, calcDrawdown1y, calcVolumeRatio, calcRiskLevel } from '../lib/indicators';

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
    pct_from_ma500: ma500 ? (close - ma500) / ma500 : null,
    pct_from_ma1000: ma1000 ? (close - ma1000) / ma1000 : null,
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
```

- [ ] **Step 3: Create `.github/workflows/fetch-us-market.yml`**

```yaml
name: Fetch US Market Data

on:
  schedule:
    - cron: '0 23 * * 1-5'   # 23:00 UTC = 07:00 BJ next day
  workflow_dispatch:

jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx tsx scripts/fetch-us-market.ts
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          ALPHA_VANTAGE_API_KEY: ${{ secrets.ALPHA_VANTAGE_API_KEY }}
```

- [ ] **Step 4: Add GitHub repository secrets**

Go to your GitHub repo → Settings → Secrets and variables → Actions → New repository secret. Add each of:
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALPHA_VANTAGE_API_KEY`, `FINNHUB_API_KEY`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `APP_ADMIN_TOKEN`, `NEXT_PUBLIC_BASE_URL`

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch-us-market.ts .github/workflows/fetch-us-market.yml package.json package-lock.json
git commit -m "feat: add US market data fetch script and GitHub Actions workflow"
```

---

## M3: News + LLM

### Task 17: LLM Client

**Files:**
- Create: `lib/llm/client.ts`
- Create: `__tests__/lib/llm/client.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/lib/llm/client.test.ts
import { buildNewsPrompt } from '@/lib/llm/client';

describe('buildNewsPrompt', () => {
  it('includes symbol name in prompt', () => {
    const prompt = buildNewsPrompt('NVDA', ['NVIDIA beats Q4 earnings']);
    expect(prompt).toContain('NVDA');
  });

  it('includes all headlines in prompt', () => {
    const headlines = ['Headline A', 'Headline B'];
    const prompt = buildNewsPrompt('AAPL', headlines);
    expect(prompt).toContain('Headline A');
    expect(prompt).toContain('Headline B');
  });

  it('requests sentiment output in Chinese format', () => {
    const prompt = buildNewsPrompt('MSFT', ['Some news']);
    expect(prompt).toContain('情绪');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- __tests__/lib/llm/client.test.ts
```

Expected: `FAIL`

- [ ] **Step 3: Create `lib/llm/client.ts`**

```ts
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const apiKey = process.env.LLM_API_KEY!;
  const baseUrl = process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1';
  const model = process.env.LLM_MODEL ?? 'gpt-4o-mini';

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 500,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM API ${res.status}: ${err}`);
  }

  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
}

export function buildNewsPrompt(symbol: string, headlines: string[]): string {
  return `你是一位专业的股票分析师。以下是关于 ${symbol} 的最新新闻标题：

${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}

请用2-3句中文总结这些新闻的核心信息，并判断情绪倾向（正面/负面/中性）。
格式：摘要：<内容> | 情绪：<正面/负面/中性>`;
}

export async function summarizeNews(
  symbol: string,
  headlines: string[],
): Promise<{ summary: string; sentiment: 'positive' | 'negative' | 'neutral' }> {
  const response = await chatCompletion([{ role: 'user', content: buildNewsPrompt(symbol, headlines) }]);

  const sentimentMap: Record<string, 'positive' | 'negative' | 'neutral'> = {
    正面: 'positive', 负面: 'negative', 中性: 'neutral',
  };

  const sentimentMatch = response.match(/情绪[：:]\s*(正面|负面|中性)/);
  const summaryMatch = response.match(/摘要[：:]\s*(.+?)(?:\s*\||\s*情绪|$)/s);

  return {
    summary: summaryMatch?.[1]?.trim() ?? response.trim(),
    sentiment: sentimentMap[sentimentMatch?.[1] ?? '中性'] ?? 'neutral',
  };
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
npm test -- __tests__/lib/llm/client.test.ts
```

Expected: `PASS`

- [ ] **Step 5: Commit**

```bash
git add lib/llm/client.ts __tests__/lib/llm/client.test.ts
git commit -m "feat: add OpenAI-compatible LLM client with tests"
```

---

### Task 18: US News Fetch Script

**Files:**
- Create: `scripts/fetch-us-news.ts`
- Create: `.github/workflows/fetch-us-news.yml`

- [ ] **Step 1: Create `scripts/fetch-us-news.ts`**

```ts
// Run via: npx tsx scripts/fetch-us-news.ts
import { createClient } from '@supabase/supabase-js';
import { fetchCompanyNews } from '../lib/data-sources/finnhub';
import { summarizeNews } from '../lib/llm/client';

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
```

- [ ] **Step 2: Create `.github/workflows/fetch-us-news.yml`**

```yaml
name: Fetch US News

on:
  schedule:
    - cron: '30 23 * * 1-5'   # 23:30 UTC = 07:30 BJ
  workflow_dispatch:

jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx tsx scripts/fetch-us-news.ts
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          FINNHUB_API_KEY: ${{ secrets.FINNHUB_API_KEY }}
          LLM_API_KEY: ${{ secrets.LLM_API_KEY }}
          LLM_BASE_URL: ${{ secrets.LLM_BASE_URL }}
          LLM_MODEL: ${{ secrets.LLM_MODEL }}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/fetch-us-news.ts .github/workflows/fetch-us-news.yml
git commit -m "feat: add news fetch + LLM summary script and workflow"
```

---

## M4: Recommendation Engine

### Task 19: Scoring Engine

**Files:**
- Create: `lib/recommendation-engine.ts`
- Create: `__tests__/lib/recommendation-engine.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/lib/recommendation-engine.test.ts
import {
  calcTrendScore, calcNewsScore, calcRiskPenalty,
  calcTotalScore, deriveRecommendationType, deriveRecommendationLevel,
} from '@/lib/recommendation-engine';
import type { MarketIndicatorDaily, MarketNews } from '@/types';

const BASE_IND: MarketIndicatorDaily = {
  id: 1, symbol: 'AAPL', trade_date: '2024-01-01',
  close: 180, pct_change_1d: 1, pct_change_5d: 2, pct_change_20d: 5,
  ma20: 175, ma60: 170, ma250: 160, ma500: 140, ma1000: 120,
  pct_from_ma500: 0.286, pct_from_ma1000: 0.5,
  drawdown_1y: -0.05, volume_ratio: 1.1, risk_level: 'low',
  created_at: '2024-01-01',
};

describe('calcTrendScore', () => {
  it('gives maximum score when price is above all MAs', () => {
    const score = calcTrendScore(BASE_IND);
    expect(score).toBe(100); // 15+20+25+30+10=100, capped
  });

  it('applies penalty when price is below MA500', () => {
    const score = calcTrendScore({ ...BASE_IND, close: 130, ma500: 140 });
    expect(score).toBeLessThan(50);
  });

  it('applies heavy penalty when price is below MA1000', () => {
    const score = calcTrendScore({ ...BASE_IND, close: 100, ma500: 140, ma1000: 120 });
    expect(score).toBe(0); // floor at 0
  });
});

describe('calcNewsScore', () => {
  it('returns neutral 50 when no news', () => {
    expect(calcNewsScore([])).toBe(50);
  });

  it('increases score for positive news', () => {
    const news = [{ sentiment: 'positive', importance_score: 8 }] as MarketNews[];
    expect(calcNewsScore(news)).toBeGreaterThan(50);
  });

  it('decreases score for negative news', () => {
    const news = [{ sentiment: 'negative', importance_score: 8 }] as MarketNews[];
    expect(calcNewsScore(news)).toBeLessThan(50);
  });
});

describe('calcRiskPenalty', () => {
  it('returns 0 penalty for healthy indicators', () => {
    expect(calcRiskPenalty(BASE_IND)).toBe(0);
  });

  it('penalizes 5-day gain exceeding 15%', () => {
    expect(calcRiskPenalty({ ...BASE_IND, pct_change_5d: 16 })).toBeLessThan(0);
  });

  it('penalizes when price is below MA60', () => {
    expect(calcRiskPenalty({ ...BASE_IND, close: 165, ma60: 170 })).toBeLessThan(0);
  });
});

describe('deriveRecommendationType', () => {
  it('returns strong_watch for high score + low risk', () => {
    expect(deriveRecommendationType(80, 'low')).toBe('strong_watch');
  });

  it('returns pullback_watch for medium score + low risk', () => {
    expect(deriveRecommendationType(65, 'low')).toBe('pullback_watch');
  });

  it('returns risk_watch for high risk level regardless of score', () => {
    expect(deriveRecommendationType(85, 'high')).toBe('risk_watch');
  });

  it('returns risk_watch for low score', () => {
    expect(deriveRecommendationType(40, 'low')).toBe('risk_watch');
  });
});

describe('deriveRecommendationLevel', () => {
  it('returns A+ for score >= 85', () => {
    expect(deriveRecommendationLevel(90)).toBe('A+');
  });
  it('returns C for score < 55', () => {
    expect(deriveRecommendationLevel(40)).toBe('C');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- __tests__/lib/recommendation-engine.test.ts
```

Expected: `FAIL`

- [ ] **Step 3: Create `lib/recommendation-engine.ts`**

```ts
import type { MarketIndicatorDaily, MarketNews, RecommendationType, RiskLevel } from '@/types';

export function calcTrendScore(ind: MarketIndicatorDaily): number {
  let score = 0;
  const { close, ma20, ma60, ma250, ma500, ma1000 } = ind;
  if (ma20 !== null && close > ma20) score += 15;
  if (ma60 !== null && close > ma60) score += 20;
  if (ma250 !== null && close > ma250) score += 25;
  if (ma500 !== null) { if (close > ma500) score += 30; else score -= 20; }
  if (ma1000 !== null) { if (close > ma1000) score += 10; else score -= 30; }
  return Math.min(100, Math.max(0, score));
}

export function calcNewsScore(news: MarketNews[]): number {
  if (news.length === 0) return 50;
  let score = 50;
  for (const item of news) {
    const high = item.importance_score !== null && item.importance_score >= 7;
    if (item.sentiment === 'positive') score += high ? 20 : 10;
    if (item.sentiment === 'negative') score += high ? -25 : -15;
  }
  return Math.min(100, Math.max(0, score));
}

export function calcRiskPenalty(ind: MarketIndicatorDaily): number {
  let penalty = 0;
  const { pct_change_5d, volume_ratio, drawdown_1y, ma60, ma250, close } = ind;
  if (pct_change_5d !== null && pct_change_5d > 15) penalty -= 20;
  if (drawdown_1y !== null && drawdown_1y > -0.02 && volume_ratio !== null && volume_ratio > 1.5) penalty -= 15;
  if (ma60 !== null && close < ma60) penalty -= 15;
  if (ma250 !== null && close < ma250) penalty -= 25;
  return penalty;
}

export function calcTotalScore(ind: MarketIndicatorDaily, news: MarketNews[]): number {
  const trend = calcTrendScore(ind);
  const newsScore = calcNewsScore(news);
  const penalty = calcRiskPenalty(ind);
  const raw = trend * 0.35 + newsScore * 0.25 + 50 * 0.20 + 50 * 0.10 + (50 + penalty) * 0.10;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

export function deriveRecommendationType(score: number, riskLevel: RiskLevel): RecommendationType {
  if (riskLevel === 'high' || riskLevel === 'extreme' || score < 50) return 'risk_watch';
  if (score >= 75 && riskLevel === 'low') return 'strong_watch';
  if (score >= 55) return 'pullback_watch';
  return 'risk_watch';
}

export function deriveRecommendationLevel(score: number): string {
  if (score >= 85) return 'A+';
  if (score >= 75) return 'A';
  if (score >= 65) return 'B+';
  if (score >= 55) return 'B';
  return 'C';
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
npm test -- __tests__/lib/recommendation-engine.test.ts
```

Expected: `PASS`

- [ ] **Step 5: Commit**

```bash
git add lib/recommendation-engine.ts __tests__/lib/recommendation-engine.test.ts
git commit -m "feat: add recommendation scoring engine with TDD"
```

---

### Task 20: Recommendation Generator Script

**Files:**
- Create: `scripts/generate-recommendations.ts`
- Create: `.github/workflows/generate-recommendations.yml`

- [ ] **Step 1: Create `scripts/generate-recommendations.ts`**

```ts
// Run via: npx tsx scripts/generate-recommendations.ts
import { createClient } from '@supabase/supabase-js';
import { calcTotalScore, deriveRecommendationType, deriveRecommendationLevel } from '../lib/recommendation-engine';
import type { MarketIndicatorDaily, MarketNews } from '../types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const STOCK_SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'AMD', 'AVGO', 'TSLA'];

async function main() {
  const today = new Date().toISOString().split('T')[0];
  const since48h = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

  const { data: indicators } = await supabase
    .from('market_indicator_daily')
    .select('*')
    .eq('trade_date', today)
    .in('symbol', STOCK_SYMBOLS);

  const { data: watchlist } = await supabase
    .from('watchlist')
    .select('symbol, name, market, asset_type')
    .in('symbol', STOCK_SYMBOLS);

  const meta = Object.fromEntries(
    ((watchlist ?? []) as { symbol: string; name: string; market: string; asset_type: string }[])
      .map(w => [w.symbol, w])
  );

  const recommendations = [];

  for (const ind of (indicators ?? []) as MarketIndicatorDaily[]) {
    const { data: news } = await supabase
      .from('market_news')
      .select('*')
      .eq('symbol', ind.symbol)
      .gte('published_at', since48h)
      .order('published_at', { ascending: false })
      .limit(5);

    const score = calcTotalScore(ind, (news ?? []) as MarketNews[]);
    const recType = deriveRecommendationType(score, ind.risk_level ?? 'low');
    const recLevel = deriveRecommendationLevel(score);
    const m = meta[ind.symbol];

    recommendations.push({
      trade_date: today,
      symbol: ind.symbol,
      name: m?.name ?? ind.symbol,
      market: m?.market ?? 'US',
      asset_type: m?.asset_type ?? 'stock',
      recommendation_type: recType,
      recommendation_level: recLevel,
      score,
      reason: `综合评分 ${score}/100。趋势: MA位置评分，结合近48h新闻情绪。`,
      risk: ind.risk_level === 'high' || ind.risk_level === 'extreme'
        ? `风险级别: ${ind.risk_level}，价格处于关键均线下方` : null,
      action_suggestion:
        recType === 'strong_watch' ? '可适量建仓或加仓' :
        recType === 'pullback_watch' ? '等待回调至均线支撑后分批买入' : '暂观望',
    });
  }

  if (recommendations.length > 0) {
    const { error } = await supabase
      .from('recommendation_daily')
      .upsert(recommendations, { onConflict: 'trade_date,symbol,recommendation_type' });
    if (error) throw error;
  }

  console.log(`Generated ${recommendations.length} recommendations for ${today}`);
}

main().catch(console.error);
```

- [ ] **Step 2: Create `.github/workflows/generate-recommendations.yml`**

```yaml
name: Generate Recommendations

on:
  schedule:
    - cron: '0 0 * * 2-6'   # 00:00 UTC = 08:00 BJ (after market + news fetch)
  workflow_dispatch:

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx tsx scripts/generate-recommendations.ts
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-recommendations.ts .github/workflows/generate-recommendations.yml
git commit -m "feat: add recommendation generator script and workflow"
```

---

## M5: Daily Report

### Task 21: Daily Report Generator

**Files:**
- Create: `scripts/generate-daily-report.ts`
- Create: `.github/workflows/generate-daily-report.yml`

- [ ] **Step 1: Create `scripts/generate-daily-report.ts`**

```ts
// Run via: npx tsx scripts/generate-daily-report.ts
import { createClient } from '@supabase/supabase-js';
import { chatCompletion } from '../lib/llm/client';
import type { MarketIndicatorDaily, RecommendationDaily } from '../types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const today = new Date().toISOString().split('T')[0];

  const [{ data: indicators }, { data: recs }] = await Promise.all([
    supabase
      .from('market_indicator_daily')
      .select('*')
      .eq('trade_date', today)
      .in('symbol', ['NDX', 'SPX', 'VIX', 'QQQ', 'SPY']),
    supabase
      .from('recommendation_daily')
      .select('*')
      .eq('trade_date', today)
      .order('score', { ascending: false })
      .limit(8),
  ]);

  const marketContext = ((indicators ?? []) as MarketIndicatorDaily[])
    .map(i => `${i.symbol}: close=${i.close}, 今日=${i.pct_change_1d?.toFixed(2)}%, 风险=${i.risk_level}`)
    .join('\n');

  const recContext = ((recs ?? []) as RecommendationDaily[])
    .map(r => `${r.symbol}[${r.recommendation_type}, ${r.score}分]: ${r.reason}`)
    .join('\n');

  const prompt = `你是一位专业的投资分析师，请根据以下数据生成今日（${today}）市场复盘。

【市场指标】
${marketContext || '暂无数据'}

【推荐列表】
${recContext || '暂无数据'}

请以JSON格式返回，包含以下字段（每字段1-3句中文）：
- market_summary: 整体市场状态
- us_summary: 美股重点标的分析
- etf_summary: ETF配置建议
- cn_sector_summary: A股板块概况（如无数据写"暂无A股数据"）
- dca_suggestion: 今日定投建议（含QQQ/SPY基础金额）
- risk_summary: 主要风险提示

仅返回JSON，不要markdown代码块。`;

  const response = await chatCompletion([{ role: 'user', content: prompt }], { maxTokens: 1000 });

  let reportData: Record<string, string>;
  try {
    reportData = JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim()) as Record<string, string>;
  } catch {
    console.error('LLM response was not valid JSON:', response);
    reportData = { market_summary: response, us_summary: '', etf_summary: '', cn_sector_summary: '', dca_suggestion: '', risk_summary: '' };
  }

  const { error } = await supabase
    .from('daily_report')
    .upsert({ trade_date: today, ...reportData }, { onConflict: 'trade_date' });
  if (error) throw error;

  console.log(`✓ Daily report generated for ${today}`);
}

main().catch(console.error);
```

- [ ] **Step 2: Create `.github/workflows/generate-daily-report.yml`**

```yaml
name: Generate Daily Report

on:
  schedule:
    - cron: '30 0 * * 2-6'   # 00:30 UTC = 08:30 BJ
  workflow_dispatch:

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx tsx scripts/generate-daily-report.ts
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          LLM_API_KEY: ${{ secrets.LLM_API_KEY }}
          LLM_BASE_URL: ${{ secrets.LLM_BASE_URL }}
          LLM_MODEL: ${{ secrets.LLM_MODEL }}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-daily-report.ts .github/workflows/generate-daily-report.yml
git commit -m "feat: add daily report LLM generator and workflow"
```

---

## M6: A-Share Sectors + Admin API + Deployment

### Task 22: CN Sectors Fetch (Python + AkShare)

**Files:**
- Create: `scripts/requirements.txt`
- Create: `scripts/fetch-cn-sectors.py`
- Create: `.github/workflows/fetch-cn-sectors.yml`

- [ ] **Step 1: Create `scripts/requirements.txt`**

```
akshare==1.14.65
supabase==2.7.4
```

- [ ] **Step 2: Create `scripts/fetch-cn-sectors.py`**

```python
#!/usr/bin/env python3
"""Fetches A-share sector performance via AkShare and upserts to Supabase."""
import os
from datetime import date
import akshare as ak
from supabase import create_client

supabase = create_client(
    os.environ['NEXT_PUBLIC_SUPABASE_URL'],
    os.environ['SUPABASE_SERVICE_ROLE_KEY'],
)

SECTORS = {
    '半导体': '半导体板块',
    'AI应用': 'AI应用板块',
    '新能源': '新能源板块',
    '消费': '消费板块',
    '医药': '医药板块',
}

def main():
    today = date.today().isoformat()
    print("Fetching A-share sector data via AkShare...")

    df = ak.stock_board_industry_name_em()
    records = []

    for sector_key, sector_name in SECTORS.items():
        row = df[df['板块名称'].str.contains(sector_key, na=False)]
        if row.empty:
            print(f"  Sector not found: {sector_key}")
            continue

        r = row.iloc[0]
        pct_change = float(r.get('涨跌幅', 0))
        score = int(min(100, max(0, 50 + pct_change * 5)))
        level = 'A' if pct_change > 3 else ('B+' if pct_change > 1 else ('B' if pct_change > -1 else 'C'))

        records.append({
            'trade_date': today,
            'symbol': sector_key,
            'name': sector_name,
            'market': 'CN',
            'asset_type': 'sector',
            'recommendation_type': 'sector_watch',
            'recommendation_level': level,
            'score': score,
            'reason': f"板块今日涨跌幅 {pct_change:.2f}%，领涨个股: {r.get('领涨股票', '—')}",
            'risk': None,
            'action_suggestion': '关注相关ETF配置机会' if pct_change > 1 else '暂观望',
        })

    if records:
        supabase.table('recommendation_daily').upsert(
            records,
            on_conflict='trade_date,symbol,recommendation_type',
        ).execute()
        print(f"✓ Upserted {len(records)} sector records for {today}")
    else:
        print("No records to upsert")

if __name__ == '__main__':
    main()
```

- [ ] **Step 3: Create `.github/workflows/fetch-cn-sectors.yml`**

```yaml
name: Fetch CN Sector Data

on:
  schedule:
    - cron: '30 8 * * 1-5'   # 08:30 UTC = 16:30 BJ (after A-share close)
  workflow_dispatch:

jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -r scripts/requirements.txt
      - run: python scripts/fetch-cn-sectors.py
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

- [ ] **Step 4: Commit**

```bash
git add scripts/requirements.txt scripts/fetch-cn-sectors.py .github/workflows/fetch-cn-sectors.yml
git commit -m "feat: add A-share sector fetch via AkShare + GitHub Actions"
```

---

### Task 23: Admin Refresh API

**Files:**
- Create: `app/api/tasks/refresh/route.ts`

- [ ] **Step 1: Create `app/api/tasks/refresh/route.ts`**

```ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token || token !== process.env.APP_ADMIN_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, message: 'Refresh acknowledged — pipelines run via GitHub Actions' });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/tasks/refresh/route.ts
git commit -m "feat: add admin refresh API endpoint"
```

---

### Task 24: Run Full Test Suite

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: All tests passing (indicators, alpha-vantage parser, LLM prompt builder, recommendation engine)

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: No TypeScript errors

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: No lint errors

- [ ] **Step 4: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve any type or lint issues before deployment"
```

---

### Task 25: Vercel Deployment

- [ ] **Step 1: Initialize git and push to GitHub**

```bash
git remote add origin https://github.com/<your-username>/market_radar.git
git push -u origin main
```

- [ ] **Step 2: Connect Vercel**

1. Go to vercel.com/new → Import Git Repository → select `market_radar`
2. Framework: Next.js (auto-detected)
3. Add all environment variables (copy from `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ALPHA_VANTAGE_API_KEY`
   - `FINNHUB_API_KEY`
   - `LLM_API_KEY`
   - `LLM_BASE_URL`
   - `LLM_MODEL`
   - `APP_ADMIN_TOKEN`
   - `NEXT_PUBLIC_BASE_URL` → set to `https://market-radar-<hash>.vercel.app` (update after first deploy)
   - `NEXT_PUBLIC_APP_NAME` → `Market Radar`
4. Click Deploy

- [ ] **Step 3: Update NEXT_PUBLIC_BASE_URL**

After the first deploy completes, copy the actual Vercel URL → update `NEXT_PUBLIC_BASE_URL` in Vercel Environment Variables → redeploy.

- [ ] **Step 4: Trigger first data pipeline manually**

Go to GitHub Actions → "Fetch US Market Data" → Run workflow. Then "Generate Recommendations" → Run workflow. Then "Generate Daily Report" → Run workflow.

- [ ] **Step 5: Verify production**

Open the Vercel URL — dashboard should display live data from Supabase (or gracefully fall back to mock data).

---

## Self-Review

### Spec Coverage

| Design Doc Requirement | Implemented In |
|------------------------|---------------|
| 美股指数/ETF/龙头股监控 | Tasks 11, 16 (fetch + display) |
| A股板块监控 | Tasks 22 (Python/AkShare) |
| 数据库 6 张表 | Task 3 (SQL migration) |
| 评分模型（趋势/新闻/风险） | Tasks 13, 19 |
| 定投策略展示 | Tasks 10, 11 (DcaSuggestion) |
| 5 个定时任务 | Tasks 16, 18, 20, 21, 22 |
| /api/dashboard | Task 5 |
| /api/tasks/refresh | Task 23 |
| Dashboard 组件树 | Tasks 6-11 |
| LLM 厂商无关 | Task 17 (env var driven) |
| 环境变量安全原则 | Tasks 1, 5 (no NEXT_PUBLIC_ leaks) |
| 监控标的清单 (25 symbols) | Task 3 (watchlist seed) |
| M1-M6 路线图 | All tasks |

### Placeholder Scan: None found.

### Type Consistency

- `DashboardData`, `MarketIndicatorDaily & { name: string }`, `RecommendationDaily`, `DailyReport` — all imported from `@/types` (existing `types/index.ts`)
- `RiskLevel`, `RecommendationType` — consistently used across `indicators.ts`, `recommendation-engine.ts`, and components
- `calcRiskLevel` returns `RiskLevel`, accepted by `deriveRecommendationType` — consistent
