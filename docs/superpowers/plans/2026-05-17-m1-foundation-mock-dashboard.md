# Market Radar M1: Foundation + Mock Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 mock 数据跑通完整的 Dashboard 页面，建立 Supabase Schema，确保项目可在本地运行并可部署到 Vercel。

**Architecture:** Next.js 15 App Router 作为前端和 API 层，Supabase PostgreSQL 作为数据库。M1 阶段所有数据来自 `lib/mock-data.ts`，API Route 返回 mock JSON，前端直接消费；后续 Milestone 只需替换 API Route 实现，UI 层不变。

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4, Supabase JS SDK, ECharts, Lucide React, Jest + React Testing Library

---

## File Map

```
market_radar/
├── types/
│   └── index.ts                          # 全部 TypeScript 类型（单一 source of truth）
├── lib/
│   ├── supabase.ts                       # Supabase 客户端（server + browser）
│   ├── mock-data.ts                      # 所有实体的 mock 数据
│   └── utils.ts                          # 数值格式化工具函数
├── supabase/
│   └── schema.sql                        # 建表 SQL（在 Supabase console 执行）
├── app/
│   ├── layout.tsx                        # Root layout：Navbar + 全局字体
│   ├── globals.css                       # 全局样式 + CSS 变量
│   ├── page.tsx                          # Dashboard 首页，组装所有 section
│   └── api/
│       └── dashboard/
│           └── route.ts                  # GET /api/dashboard，M1 返回 mock 数据
├── components/
│   ├── ui/
│   │   ├── Badge.tsx                     # 状态徽章：强关注/回调/风险/Building/Done
│   │   └── Card.tsx                      # 基础卡片容器
│   ├── dashboard/
│   │   ├── MarketStatusBanner.tsx        # 顶部市场状态横幅（正常/谨慎/风险）
│   │   ├── IndexCard.tsx                 # 指数卡片：NDX/SPX/VIX，含涨跌幅和均线距离
│   │   ├── EtfGrid.tsx                   # ETF 卡片网格
│   │   ├── RecommendationSection.tsx     # 强关注/回调关注/风险观察三列
│   │   ├── DcaSuggestion.tsx             # 定投建议卡片
│   │   └── DailyReportCard.tsx           # 每日复盘文案卡片
│   └── layout/
│       └── Navbar.tsx                    # 顶部导航
├── __tests__/
│   ├── lib/
│   │   └── utils.test.ts                 # 格式化函数单测
│   └── components/
│       ├── Badge.test.tsx
│       └── IndexCard.test.tsx
├── .env.local.example                    # 环境变量模板
├── jest.config.ts
└── jest.setup.ts
```

---

## Task 1: 测试环境 + 项目配置

**Files:**
- Create: `.env.local.example`
- Create: `jest.config.ts`
- Create: `jest.setup.ts`
- Modify: `package.json` (add test scripts + deps)
- Modify: `app/globals.css`

- [ ] **Step 1: 安装测试依赖**

```bash
cd d:\claudeCode\market_radar
npm install -D jest @types/jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom ts-jest
```

- [ ] **Step 2: 创建 jest.config.ts**

```ts
// jest.config.ts
import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
};

export default createJestConfig(config);
```

> 注意：`next/jest` 会自动处理 CSS modules 和 Next.js 内部模块。

- [ ] **Step 3: 创建 jest.setup.ts**

```ts
// jest.setup.ts
import '@testing-library/jest-dom';
```

- [ ] **Step 4: 在 package.json 中添加 test script**

在 `scripts` 中加入：
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 5: 创建 .env.local.example**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Market Data (M2 onwards)
ALPHA_VANTAGE_API_KEY=
FINNHUB_API_KEY=

# LLM (M3 onwards) — 支持 OpenAI / DeepSeek 等兼容接口
LLM_API_KEY=
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini

# App
APP_ADMIN_TOKEN=your-secret-token
NEXT_PUBLIC_APP_NAME=Market Radar
```

- [ ] **Step 6: 更新 app/globals.css，设置深色主题 CSS 变量**

完整替换文件内容：
```css
@import "tailwindcss";

:root {
  --bg: #0a0a10;
  --bg-card: #111118;
  --bg-card-hover: #16161f;
  --border: #1e1e2e;
  --text: #e8e8f0;
  --muted: #6b7280;
  --accent: #6366f1;
  --positive: #22c55e;
  --negative: #ef4444;
  --warning: #f59e0b;
}

html {
  background-color: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}

body {
  min-height: 100vh;
}
```

- [ ] **Step 7: 复制 .env.local.example 为 .env.local（填入真实或占位值）**

```bash
cp .env.local.example .env.local
```

M1 阶段 Supabase Key 可以先留空，mock 数据不依赖数据库连接。

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "chore: setup jest, env template, global css theme"
```

---

## Task 2: TypeScript 类型定义

**Files:**
- Create: `types/index.ts`

- [ ] **Step 1: 创建 types/index.ts**

```ts
// types/index.ts
export type Market = 'US' | 'CN';
export type AssetType = 'index' | 'etf' | 'stock' | 'sector';
export type RiskLevel = 'low' | 'medium' | 'high' | 'extreme';
export type RecommendationType =
  | 'strong_watch'
  | 'pullback_watch'
  | 'risk_watch'
  | 'base_dca'
  | 'sector_watch';
export type Sentiment = 'positive' | 'negative' | 'neutral';
export type MarketStatusLevel = 'normal' | 'caution' | 'risk';

export interface IndicatorCard {
  symbol: string;
  name: string;
  trade_date: string;
  close: number;
  pct_change_1d: number;
  pct_change_5d: number;
  pct_change_20d: number;
  ma20: number | null;
  ma60: number | null;
  ma250: number | null;
  ma500: number | null;
  ma1000: number | null;
  pct_from_ma500: number | null;
  pct_from_ma1000: number | null;
  drawdown_1y: number | null;
  volume_ratio: number | null;
  risk_level: RiskLevel;
}

export interface RecommendationCard {
  symbol: string;
  name: string;
  market: Market;
  asset_type: AssetType;
  recommendation_type: RecommendationType;
  score: number;
  reason: string;
  risk: string;
  action_suggestion: string;
}

export interface DailyReport {
  trade_date: string;
  market_summary: string;
  us_summary: string;
  etf_summary: string;
  cn_sector_summary: string;
  dca_suggestion: string;
  risk_summary: string;
}

export interface DcaSuggestion {
  base: { symbol: string; name: string; amount: number }[];
  enhanced_triggered: boolean;
  reason: string;
}

export interface MarketStatus {
  label: string;
  level: MarketStatusLevel;
  description: string;
}

export interface DashboardData {
  trade_date: string;
  market_status: MarketStatus;
  index_cards: IndicatorCard[];
  etf_cards: IndicatorCard[];
  strong_watch: RecommendationCard[];
  pullback_watch: RecommendationCard[];
  risk_watch: RecommendationCard[];
  cn_sectors: RecommendationCard[];
  dca: DcaSuggestion;
  daily_report: DailyReport;
}
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: add TypeScript types for all domain entities"
```

---

## Task 3: Supabase Schema + 客户端

**Files:**
- Create: `supabase/schema.sql`
- Create: `lib/supabase.ts`

- [ ] **Step 1: 创建 supabase/schema.sql**

```sql
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
  updated_at TIMESTAMPTZ DEFAULT NOW()
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
ON CONFLICT DO NOTHING;

-- 索引
CREATE INDEX IF NOT EXISTS idx_price_symbol_date   ON market_price_daily(symbol, trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_ind_symbol_date     ON market_indicator_daily(symbol, trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_news_symbol         ON market_news(symbol);
CREATE INDEX IF NOT EXISTS idx_news_pub            ON market_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_rec_date            ON recommendation_daily(trade_date DESC);
```

- [ ] **Step 2: 创建 lib/supabase.ts**

```ts
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 浏览器客户端（公开只读操作）
export const supabase = createClient(url, anonKey);

// 服务端客户端（写入操作，仅在 API Routes / Server Actions 中使用）
export function createServiceClient() {
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql lib/supabase.ts
git commit -m "feat: add supabase schema and client"
```

---

## Task 4: 工具函数 + 单测

**Files:**
- Create: `lib/utils.ts`
- Create: `__tests__/lib/utils.test.ts`
- Create: `__tests__` 目录结构

- [ ] **Step 1: 写失败测试**

```bash
mkdir -p __tests__/lib __tests__/components
```

创建 `__tests__/lib/utils.test.ts`：

```ts
import { formatPct, formatPrice, getPctColor, getRiskLabel } from '@/lib/utils';

describe('formatPct', () => {
  it('formats positive number with + sign and 2 decimals', () => {
    expect(formatPct(1.234)).toBe('+1.23%');
  });
  it('formats negative number with - sign', () => {
    expect(formatPct(-2.5)).toBe('-2.50%');
  });
  it('formats zero as 0.00%', () => {
    expect(formatPct(0)).toBe('0.00%');
  });
});

describe('formatPrice', () => {
  it('formats number with comma separators and 2 decimals', () => {
    expect(formatPrice(12345.678)).toBe('12,345.68');
  });
  it('formats number below 1000 without commas', () => {
    expect(formatPrice(99.5)).toBe('99.50');
  });
});

describe('getPctColor', () => {
  it('returns positive class for positive value', () => {
    expect(getPctColor(1)).toBe('text-green-400');
  });
  it('returns negative class for negative value', () => {
    expect(getPctColor(-1)).toBe('text-red-400');
  });
  it('returns muted class for zero', () => {
    expect(getPctColor(0)).toBe('text-gray-400');
  });
});

describe('getRiskLabel', () => {
  it('maps risk levels to Chinese labels', () => {
    expect(getRiskLabel('low')).toBe('低风险');
    expect(getRiskLabel('medium')).toBe('中等');
    expect(getRiskLabel('high')).toBe('高风险');
    expect(getRiskLabel('extreme')).toBe('极端');
  });
});
```

- [ ] **Step 2: 运行，确认失败**

```bash
npm test -- __tests__/lib/utils.test.ts
```

预期：FAIL — `Cannot find module '@/lib/utils'`

- [ ] **Step 3: 创建 lib/utils.ts**

```ts
// lib/utils.ts
import type { RiskLevel } from '@/types';

export function formatPct(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatPrice(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function getPctColor(value: number): string {
  if (value > 0) return 'text-green-400';
  if (value < 0) return 'text-red-400';
  return 'text-gray-400';
}

export function getRiskLabel(level: RiskLevel): string {
  const map: Record<RiskLevel, string> = {
    low: '低风险',
    medium: '中等',
    high: '高风险',
    extreme: '极端',
  };
  return map[level];
}
```

- [ ] **Step 4: 运行，确认通过**

```bash
npm test -- __tests__/lib/utils.test.ts
```

预期：PASS — 7 tests passed

- [ ] **Step 5: Commit**

```bash
git add lib/utils.ts __tests__/lib/utils.test.ts
git commit -m "feat: add utility functions with tests"
```

---

## Task 5: Mock 数据层

**Files:**
- Create: `lib/mock-data.ts`

- [ ] **Step 1: 创建 lib/mock-data.ts**

```ts
// lib/mock-data.ts
import type {
  DashboardData,
  IndicatorCard,
  RecommendationCard,
} from '@/types';

const TODAY = '2026-05-17';

const indexCards: IndicatorCard[] = [
  {
    symbol: 'NDX', name: '纳斯达克100', trade_date: TODAY,
    close: 19823.45, pct_change_1d: 0.82, pct_change_5d: 2.14, pct_change_20d: 4.37,
    ma20: 19421.0, ma60: 18930.0, ma250: 18100.0, ma500: 16540.0, ma1000: 13200.0,
    pct_from_ma500: 19.9, pct_from_ma1000: 50.2,
    drawdown_1y: -8.3, volume_ratio: 1.05, risk_level: 'low',
  },
  {
    symbol: 'SPX', name: '标普500', trade_date: TODAY,
    close: 5312.18, pct_change_1d: 0.54, pct_change_5d: 1.32, pct_change_20d: 3.11,
    ma20: 5220.0, ma60: 5080.0, ma250: 4900.0, ma500: 4450.0, ma1000: 3600.0,
    pct_from_ma500: 19.4, pct_from_ma1000: 47.6,
    drawdown_1y: -6.1, volume_ratio: 0.98, risk_level: 'low',
  },
  {
    symbol: 'VIX', name: '恐慌指数', trade_date: TODAY,
    close: 14.23, pct_change_1d: -3.12, pct_change_5d: -8.4, pct_change_20d: -12.1,
    ma20: 16.5, ma60: 18.2, ma250: 19.8, ma500: null, ma1000: null,
    pct_from_ma500: null, pct_from_ma1000: null,
    drawdown_1y: null, volume_ratio: null, risk_level: 'low',
  },
];

const etfCards: IndicatorCard[] = [
  {
    symbol: 'QQQ', name: '纳指ETF', trade_date: TODAY,
    close: 482.31, pct_change_1d: 0.79, pct_change_5d: 2.05, pct_change_20d: 4.12,
    ma20: 472.8, ma60: 461.0, ma250: 440.5, ma500: 402.0, ma1000: 320.0,
    pct_from_ma500: 20.0, pct_from_ma1000: 50.7,
    drawdown_1y: -8.9, volume_ratio: 1.12, risk_level: 'low',
  },
  {
    symbol: 'SPY', name: '标普ETF', trade_date: TODAY,
    close: 530.44, pct_change_1d: 0.51, pct_change_5d: 1.28, pct_change_20d: 3.05,
    ma20: 521.0, ma60: 507.0, ma250: 489.0, ma500: 444.0, ma1000: 359.0,
    pct_from_ma500: 19.5, pct_from_ma1000: 47.8,
    drawdown_1y: -6.3, volume_ratio: 0.95, risk_level: 'low',
  },
  {
    symbol: 'SMH', name: '半导体ETF', trade_date: TODAY,
    close: 248.72, pct_change_1d: 1.43, pct_change_5d: 5.21, pct_change_20d: 11.4,
    ma20: 231.0, ma60: 219.5, ma250: 208.0, ma500: 185.0, ma1000: 142.0,
    pct_from_ma500: 34.4, pct_from_ma1000: 75.0,
    drawdown_1y: -14.2, volume_ratio: 1.68, risk_level: 'medium',
  },
  {
    symbol: 'TLT', name: '长期国债ETF', trade_date: TODAY,
    close: 89.12, pct_change_1d: -0.21, pct_change_5d: -1.05, pct_change_20d: -2.3,
    ma20: 90.8, ma60: 92.4, ma250: 96.1, ma500: 102.0, ma1000: 118.0,
    pct_from_ma500: -12.6, pct_from_ma1000: -24.5,
    drawdown_1y: -18.4, volume_ratio: 0.88, risk_level: 'high',
  },
  {
    symbol: 'GLD', name: '黄金ETF', trade_date: TODAY,
    close: 238.45, pct_change_1d: 0.33, pct_change_5d: 0.82, pct_change_20d: 3.75,
    ma20: 234.0, ma60: 226.0, ma250: 210.0, ma500: 192.0, ma1000: 165.0,
    pct_from_ma500: 24.2, pct_from_ma1000: 44.5,
    drawdown_1y: -4.1, volume_ratio: 1.02, risk_level: 'low',
  },
];

const strongWatch: RecommendationCard[] = [
  {
    symbol: 'NVDA', name: '英伟达', market: 'US', asset_type: 'stock',
    recommendation_type: 'strong_watch', score: 88,
    reason: '半导体板块强势，AI 芯片需求新闻密集，价格位于 MA60 上方，趋势健康。',
    risk: '短期涨幅较高，追高风险需关注。',
    action_suggestion: '等待回调至 MA20 附近后关注买入机会。',
  },
  {
    symbol: 'META', name: 'Meta', market: 'US', asset_type: 'stock',
    recommendation_type: 'strong_watch', score: 82,
    reason: 'AI 广告效率提升，财报超预期，价格创52周新高附近。',
    risk: '估值偏高，宏观利率敏感。',
    action_suggestion: '维持关注，不追高，等待整理后入场。',
  },
];

const pullbackWatch: RecommendationCard[] = [
  {
    symbol: 'QQQ', name: '纳指ETF', market: 'US', asset_type: 'etf',
    recommendation_type: 'pullback_watch', score: 74,
    reason: '长期趋势仍在 MA500 上方，短期接近 MA20，未出现明显利空。',
    risk: '若跌破 MA60，需要降低短期风险偏好。',
    action_suggestion: '维持基础定投，暂不增强加仓。',
  },
];

const riskWatch: RecommendationCard[] = [
  {
    symbol: 'SMH', name: '半导体ETF', market: 'US', asset_type: 'etf',
    recommendation_type: 'risk_watch', score: 45,
    reason: '短期涨幅明显高于 QQQ，成交量放大 1.68 倍，存在追高风险。',
    risk: '若新闻驱动减弱，可能出现快速回撤。',
    action_suggestion: '不追涨，等待回调后评估。',
  },
];

const cnSectors: RecommendationCard[] = [
  {
    symbol: 'CN_SEMI', name: 'A股半导体', market: 'CN', asset_type: 'sector',
    recommendation_type: 'sector_watch', score: 71,
    reason: '板块涨幅 +2.3%，中芯国际、北方华创放量上涨，受国产替代政策驱动。',
    risk: '政策博弈风险，短期情绪化波动大。',
    action_suggestion: '仅观察，不作为直接买入信号。',
  },
  {
    symbol: 'CN_AI', name: 'A股AI应用', market: 'CN', asset_type: 'sector',
    recommendation_type: 'sector_watch', score: 65,
    reason: '板块涨幅 +1.8%，AI 算力主题持续活跃，科大讯飞、商汤表现领先。',
    risk: '估值较高，需关注业绩兑现。',
    action_suggestion: '观察为主，关注回调后龙头机会。',
  },
];

export const mockDashboard: DashboardData = {
  trade_date: TODAY,
  market_status: {
    label: '正常偏强',
    level: 'normal',
    description: '纳指100 和标普500 均位于 MA500 上方，VIX 处于低位，整体市场情绪偏乐观。',
  },
  index_cards: indexCards,
  etf_cards: etfCards,
  strong_watch: strongWatch,
  pullback_watch: pullbackWatch,
  risk_watch: riskWatch,
  cn_sectors: cnSectors,
  dca: {
    base: [
      { symbol: 'QQQ', name: '纳指100ETF', amount: 1000 },
      { symbol: 'SPY', name: '标普500ETF', amount: 200 },
    ],
    enhanced_triggered: false,
    reason: '纳指100 仍在 MA500 上方，回撤未进入中度区间（< 10%），维持基础定投。',
  },
  daily_report: {
    trade_date: TODAY,
    market_summary: '今日美股市场整体偏强，纳指100 继续位于 MA500 上方，VIX 下行至 14.23。',
    us_summary: '科技板块领涨，NVDA 和 META 表现突出，半导体 ETF（SMH）单日涨幅 1.43%，但成交量放大需注意追高风险。',
    etf_summary: 'QQQ 稳健，TLT 弱势延续，GLD 小幅上涨，防御资产整体偏弱。',
    cn_sector_summary: 'A股半导体和 AI 应用板块今日强势，受政策预期驱动，建议观察为主。',
    dca_suggestion: '今日基础定投建议维持：纳指100 1000 元，标普500 200 元。未触发增强加仓条件。',
    risk_summary: '主要风险：SMH 短期追高风险、TLT 长债继续承压、宏观利率预期变化。',
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/mock-data.ts
git commit -m "feat: add realistic mock dashboard data"
```

---

## Task 6: Dashboard API Route

**Files:**
- Create: `app/api/dashboard/route.ts`

- [ ] **Step 1: 创建 app/api/dashboard/route.ts**

```ts
// app/api/dashboard/route.ts
import { NextResponse } from 'next/server';
import { mockDashboard } from '@/lib/mock-data';

export async function GET() {
  // M1: 直接返回 mock 数据
  // M2 onwards: 从 Supabase 查询真实数据
  return NextResponse.json(mockDashboard);
}
```

- [ ] **Step 2: 启动开发服务器，手动验证 API**

```bash
npm run dev
```

打开浏览器访问 `http://localhost:3000/api/dashboard`，应看到完整的 JSON 响应。

- [ ] **Step 3: Commit**

```bash
git add app/api/dashboard/route.ts
git commit -m "feat: add dashboard API route returning mock data"
```

---

## Task 7: UI 基础组件

**Files:**
- Create: `components/ui/Badge.tsx`
- Create: `components/ui/Card.tsx`
- Create: `__tests__/components/Badge.test.tsx`

- [ ] **Step 1: 写 Badge 失败测试**

创建 `__tests__/components/Badge.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/Badge';

describe('Badge', () => {
  it('renders label text', () => {
    render(<Badge variant="positive" label="强关注" />);
    expect(screen.getByText('强关注')).toBeInTheDocument();
  });

  it('applies positive styles for positive variant', () => {
    const { container } = render(<Badge variant="positive" label="强关注" />);
    expect(container.firstChild).toHaveClass('text-green-400');
  });

  it('applies negative styles for negative variant', () => {
    const { container } = render(<Badge variant="negative" label="风险观察" />);
    expect(container.firstChild).toHaveClass('text-red-400');
  });

  it('applies warning styles for warning variant', () => {
    const { container } = render(<Badge variant="warning" label="回调关注" />);
    expect(container.firstChild).toHaveClass('text-amber-400');
  });
});
```

- [ ] **Step 2: 运行，确认失败**

```bash
npm test -- __tests__/components/Badge.test.tsx
```

预期：FAIL — `Cannot find module '@/components/ui/Badge'`

- [ ] **Step 3: 创建 components/ui/Badge.tsx**

```tsx
// components/ui/Badge.tsx
type BadgeVariant = 'positive' | 'negative' | 'warning' | 'neutral' | 'info';

interface BadgeProps {
  variant: BadgeVariant;
  label: string;
  className?: string;
}

const styles: Record<BadgeVariant, string> = {
  positive: 'text-green-400 bg-green-400/10 border-green-400/20',
  negative: 'text-red-400 bg-red-400/10 border-red-400/20',
  warning:  'text-amber-400 bg-amber-400/10 border-amber-400/20',
  neutral:  'text-gray-400 bg-gray-400/10 border-gray-400/20',
  info:     'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
};

export function Badge({ variant, label, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[variant]} ${className}`}>
      {label}
    </span>
  );
}
```

- [ ] **Step 4: 运行，确认通过**

```bash
npm test -- __tests__/components/Badge.test.tsx
```

预期：PASS — 4 tests passed

- [ ] **Step 5: 创建 components/ui/Card.tsx**

```tsx
// components/ui/Card.tsx
interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className = '', hover = false }: CardProps) {
  return (
    <div
      className={`
        rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4
        ${hover ? 'transition-colors hover:bg-[var(--bg-card-hover)] hover:border-indigo-500/30' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add components/ui/ __tests__/components/Badge.test.tsx
git commit -m "feat: add Badge and Card UI primitives"
```

---

## Task 8: Dashboard 业务组件

**Files:**
- Create: `components/layout/Navbar.tsx`
- Create: `components/dashboard/MarketStatusBanner.tsx`
- Create: `components/dashboard/IndexCard.tsx`
- Create: `components/dashboard/EtfGrid.tsx`
- Create: `components/dashboard/RecommendationSection.tsx`
- Create: `components/dashboard/DcaSuggestion.tsx`
- Create: `components/dashboard/DailyReportCard.tsx`
- Create: `__tests__/components/IndexCard.test.tsx`

- [ ] **Step 1: 写 IndexCard 失败测试**

创建 `__tests__/components/IndexCard.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react';
import { IndexCard } from '@/components/dashboard/IndexCard';
import type { IndicatorCard } from '@/types';

const mockCard: IndicatorCard = {
  symbol: 'NDX', name: '纳斯达克100', trade_date: '2026-05-17',
  close: 19823.45, pct_change_1d: 0.82, pct_change_5d: 2.14, pct_change_20d: 4.37,
  ma20: 19421.0, ma60: 18930.0, ma250: 18100.0, ma500: 16540.0, ma1000: 13200.0,
  pct_from_ma500: 19.9, pct_from_ma1000: 50.2,
  drawdown_1y: -8.3, volume_ratio: 1.05, risk_level: 'low',
};

describe('IndexCard', () => {
  it('renders symbol and name', () => {
    render(<IndexCard data={mockCard} />);
    expect(screen.getByText('NDX')).toBeInTheDocument();
    expect(screen.getByText('纳斯达克100')).toBeInTheDocument();
  });

  it('renders formatted price', () => {
    render(<IndexCard data={mockCard} />);
    expect(screen.getByText('19,823.45')).toBeInTheDocument();
  });

  it('renders positive pct_change_1d with + prefix', () => {
    render(<IndexCard data={mockCard} />);
    expect(screen.getByText('+0.82%')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行，确认失败**

```bash
npm test -- __tests__/components/IndexCard.test.tsx
```

预期：FAIL — `Cannot find module '@/components/dashboard/IndexCard'`

- [ ] **Step 3: 创建 components/layout/Navbar.tsx**

```tsx
// components/layout/Navbar.tsx
import Link from 'next/link';

export function Navbar() {
  return (
    <nav className="border-b border-[var(--border)] bg-[var(--bg)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <Link href="/" className="text-sm font-semibold text-[var(--text)]">
          📡 Market Radar
        </Link>
        <div className="flex items-center gap-6 text-sm text-[var(--muted)]">
          <Link href="/" className="hover:text-[var(--text)] transition-colors">Dashboard</Link>
          <Link href="/reports" className="hover:text-[var(--text)] transition-colors">复盘</Link>
          <Link href="/sectors" className="hover:text-[var(--text)] transition-colors">A股板块</Link>
          <Link href="/settings" className="hover:text-[var(--text)] transition-colors">设置</Link>
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: 创建 components/dashboard/MarketStatusBanner.tsx**

```tsx
// components/dashboard/MarketStatusBanner.tsx
import type { MarketStatus } from '@/types';

const levelStyles = {
  normal:  { bg: 'bg-green-500/10 border-green-500/20', dot: 'bg-green-400', text: 'text-green-400' },
  caution: { bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400', text: 'text-amber-400' },
  risk:    { bg: 'bg-red-500/10 border-red-500/20',     dot: 'bg-red-400',   text: 'text-red-400' },
};

interface Props { status: MarketStatus; tradeDate: string; }

export function MarketStatusBanner({ status, tradeDate }: Props) {
  const s = levelStyles[status.level];
  return (
    <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${s.bg}`}>
      <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
      <div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${s.text}`}>今日市场：{status.label}</span>
          <span className="text-xs text-[var(--muted)]">{tradeDate}</span>
        </div>
        <p className="mt-0.5 text-xs text-[var(--muted)]">{status.description}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 创建 components/dashboard/IndexCard.tsx**

```tsx
// components/dashboard/IndexCard.tsx
import { formatPrice, formatPct, getPctColor, getRiskLabel } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { IndicatorCard, RiskLevel } from '@/types';

const riskVariant: Record<RiskLevel, 'positive' | 'warning' | 'negative'> = {
  low: 'positive', medium: 'warning', high: 'negative', extreme: 'negative',
};

interface Props { data: IndicatorCard; }

export function IndexCard({ data }: Props) {
  return (
    <Card hover>
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-xs font-mono text-[var(--muted)]">{data.symbol}</span>
          <p className="text-sm font-medium text-[var(--text)]">{data.name}</p>
        </div>
        <Badge variant={riskVariant[data.risk_level]} label={getRiskLabel(data.risk_level)} />
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-xl font-semibold tabular-nums">{formatPrice(data.close)}</span>
        <span className={`text-sm font-medium tabular-nums ${getPctColor(data.pct_change_1d)}`}>
          {formatPct(data.pct_change_1d)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
        <span>5日</span>
        <span className={`tabular-nums ${getPctColor(data.pct_change_5d)}`}>{formatPct(data.pct_change_5d)}</span>
        <span>20日</span>
        <span className={`tabular-nums ${getPctColor(data.pct_change_20d)}`}>{formatPct(data.pct_change_20d)}</span>
        {data.pct_from_ma500 !== null && (
          <>
            <span>距MA500</span>
            <span className={`tabular-nums ${getPctColor(data.pct_from_ma500)}`}>{formatPct(data.pct_from_ma500)}</span>
          </>
        )}
        {data.drawdown_1y !== null && (
          <>
            <span>年内回撤</span>
            <span className="tabular-nums text-red-400">{formatPct(data.drawdown_1y)}</span>
          </>
        )}
      </div>
    </Card>
  );
}
```

- [ ] **Step 6: 运行，确认 IndexCard 测试通过**

```bash
npm test -- __tests__/components/IndexCard.test.tsx
```

预期：PASS — 3 tests passed

- [ ] **Step 7: 创建 components/dashboard/EtfGrid.tsx**

```tsx
// components/dashboard/EtfGrid.tsx
import { IndexCard } from './IndexCard';
import type { IndicatorCard } from '@/types';

interface Props { etfs: IndicatorCard[]; }

export function EtfGrid({ etfs }: Props) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-[var(--muted)] mb-3 uppercase tracking-wider">ETF 监控</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {etfs.map(etf => <IndexCard key={etf.symbol} data={etf} />)}
      </div>
    </section>
  );
}
```

- [ ] **Step 8: 创建 components/dashboard/RecommendationSection.tsx**

```tsx
// components/dashboard/RecommendationSection.tsx
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { RecommendationCard } from '@/types';

const sectionConfig = {
  strong_watch:  { title: '强关注',   variant: 'positive' as const, emoji: '🔥' },
  pullback_watch:{ title: '回调关注', variant: 'warning'  as const, emoji: '📉' },
  risk_watch:    { title: '风险观察', variant: 'negative' as const, emoji: '⚠️' },
  sector_watch:  { title: 'A股板块',  variant: 'info'     as const, emoji: '🇨🇳' },
};

function RecCard({ item }: { item: RecommendationCard }) {
  const cfg = sectionConfig[item.recommendation_type];
  return (
    <Card hover className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-mono text-[var(--muted)]">{item.symbol}</span>
          <p className="text-sm font-medium text-[var(--text)]">{item.name}</p>
        </div>
        <Badge variant={cfg.variant} label={`${item.score}分`} />
      </div>
      <p className="text-xs text-[var(--muted)] leading-relaxed">{item.reason}</p>
      <p className="text-xs text-[var(--muted)] leading-relaxed">
        <span className="text-red-400/70">风险：</span>{item.risk}
      </p>
      <p className="text-xs text-indigo-400">{item.action_suggestion}</p>
    </Card>
  );
}

interface Props {
  title: string;
  emoji: string;
  items: RecommendationCard[];
  variant: 'positive' | 'warning' | 'negative' | 'info';
}

export function RecommendationSection({ title, emoji, items, variant }: Props) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="text-sm font-semibold text-[var(--muted)] mb-3 uppercase tracking-wider flex items-center gap-1.5">
        <span>{emoji}</span>{title}
        <Badge variant={variant} label={String(items.length)} className="ml-1" />
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map(item => <RecCard key={`${item.symbol}-${item.recommendation_type}`} item={item} />)}
      </div>
    </section>
  );
}
```

- [ ] **Step 9: 创建 components/dashboard/DcaSuggestion.tsx**

```tsx
// components/dashboard/DcaSuggestion.tsx
import { Card } from '@/components/ui/Card';
import type { DcaSuggestion as DcaSuggestionType } from '@/types';

interface Props { dca: DcaSuggestionType; }

export function DcaSuggestion({ dca }: Props) {
  return (
    <Card>
      <h2 className="text-sm font-semibold text-[var(--muted)] mb-3 uppercase tracking-wider">📋 定投建议</h2>
      <div className="flex flex-wrap gap-3 mb-3">
        {dca.base.map(item => (
          <div key={item.symbol} className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2">
            <span className="text-xs font-mono text-indigo-300">{item.symbol}</span>
            <span className="text-sm font-semibold text-[var(--text)]">¥{item.amount.toLocaleString()}</span>
          </div>
        ))}
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${
          dca.enhanced_triggered
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            : 'bg-[var(--bg)] border-[var(--border)] text-[var(--muted)]'
        }`}>
          <span className="text-xs">增强加仓：{dca.enhanced_triggered ? '已触发 ⚡' : '未触发'}</span>
        </div>
      </div>
      <p className="text-xs text-[var(--muted)] leading-relaxed">{dca.reason}</p>
    </Card>
  );
}
```

- [ ] **Step 10: 创建 components/dashboard/DailyReportCard.tsx**

```tsx
// components/dashboard/DailyReportCard.tsx
import { Card } from '@/components/ui/Card';
import type { DailyReport } from '@/types';

interface Props { report: DailyReport; }

export function DailyReportCard({ report }: Props) {
  const sections = [
    { label: '市场概况', text: report.market_summary },
    { label: '美股',     text: report.us_summary },
    { label: 'ETF',      text: report.etf_summary },
    { label: 'A股板块',  text: report.cn_sector_summary },
    { label: '定投',     text: report.dca_suggestion },
    { label: '风险',     text: report.risk_summary },
  ];

  return (
    <Card>
      <h2 className="text-sm font-semibold text-[var(--muted)] mb-4 uppercase tracking-wider">
        📝 每日复盘 · {report.trade_date}
      </h2>
      <div className="space-y-3">
        {sections.map(({ label, text }) => (
          <div key={label} className="flex gap-3">
            <span className="flex-shrink-0 text-xs font-medium text-indigo-400 w-14 pt-0.5">{label}</span>
            <p className="text-xs text-[var(--muted)] leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
```

- [ ] **Step 11: Commit**

```bash
git add components/ __tests__/components/IndexCard.test.tsx
git commit -m "feat: add dashboard components (Navbar, StatusBanner, IndexCard, EtfGrid, RecommendationSection, DcaSuggestion, DailyReportCard)"
```

---

## Task 9: Dashboard 首页组装

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: 更新 app/layout.tsx**

```tsx
// app/layout.tsx
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Navbar } from '@/components/layout/Navbar';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: 'Market Radar',
  description: '美股 ETF 智能监控台',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="font-[var(--font-geist)]">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: 更新 app/page.tsx**

```tsx
// app/page.tsx
import { MarketStatusBanner } from '@/components/dashboard/MarketStatusBanner';
import { IndexCard } from '@/components/dashboard/IndexCard';
import { EtfGrid } from '@/components/dashboard/EtfGrid';
import { RecommendationSection } from '@/components/dashboard/RecommendationSection';
import { DcaSuggestion } from '@/components/dashboard/DcaSuggestion';
import { DailyReportCard } from '@/components/dashboard/DailyReportCard';
import type { DashboardData } from '@/types';

async function getDashboard(): Promise<DashboardData> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/dashboard`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch dashboard');
  return res.json();
}

export default async function DashboardPage() {
  const data = await getDashboard();

  return (
    <div className="space-y-6">
      <MarketStatusBanner status={data.market_status} tradeDate={data.trade_date} />

      {/* 指数 */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--muted)] mb-3 uppercase tracking-wider">指数</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {data.index_cards.map(card => <IndexCard key={card.symbol} data={card} />)}
        </div>
      </section>

      {/* ETF */}
      <EtfGrid etfs={data.etf_cards} />

      {/* 推荐 */}
      <RecommendationSection title="强关注" emoji="🔥" variant="positive" items={data.strong_watch} />
      <RecommendationSection title="回调关注" emoji="📉" variant="warning" items={data.pullback_watch} />
      <RecommendationSection title="风险观察" emoji="⚠️" variant="negative" items={data.risk_watch} />
      <RecommendationSection title="A股板块" emoji="🇨🇳" variant="info" items={data.cn_sectors} />

      {/* 定投 + 复盘 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DcaSuggestion dca={data.dca} />
        <DailyReportCard report={data.daily_report} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 在 .env.local 中添加 BASE_URL**

```bash
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

- [ ] **Step 4: 启动并在浏览器中验证**

```bash
npm run dev
```

访问 `http://localhost:3000`，检查：
- 顶部市场状态横幅显示"正常偏强"
- 3 个指数卡片（NDX / SPX / VIX）
- 5 个 ETF 卡片
- 强关注 2 条、回调关注 1 条、风险观察 1 条、A股板块 2 条
- 定投建议 + 每日复盘

- [ ] **Step 5: 运行全部测试，确认通过**

```bash
npm test
```

预期：所有测试 PASS

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx app/page.tsx .env.local
git commit -m "feat: assemble dashboard page with all sections"
```

---

## Task 10: Git 初始化 + 收尾

**Files:**
- Create: `.gitignore`（验证 .env.local 已被忽略）
- Create: `README.md`

- [ ] **Step 1: 确认 .env.local 在 .gitignore 中**

```bash
cat .gitignore | grep env
```

预期输出包含 `.env*.local`

- [ ] **Step 2: 创建 README.md**

```markdown
# Market Radar

美股 ETF 智能监控台。每日自动拉取行情、计算均线指标、聚合新闻并用 AI 生成摘要，输出关注等级和定投建议。

## Tech Stack

Next.js 15 · Supabase · Tailwind CSS · ECharts · Vercel

## 本地运行

```bash
cp .env.local.example .env.local
# 填写 Supabase Key（M1 阶段可留空）
npm install
npm run dev
```

## Milestone

- [x] M1: Foundation + Mock Dashboard
- [ ] M2: 行情接入 + 指标计算（Alpha Vantage / Finnhub）
- [ ] M3: 新闻接入 + LLM 摘要
- [ ] M4: 推荐规则引擎
- [ ] M5: 每日复盘自动生成
- [ ] M6: 定时任务 + Vercel 部署

## 数据库

在 Supabase SQL Editor 中执行 `supabase/schema.sql` 建表。
```

- [ ] **Step 3: 最终提交**

```bash
git add README.md
git commit -m "docs: add README with milestone tracker"
```

---

## 自检：Spec 覆盖确认

| Spec 要求 | 对应 Task |
|-----------|-----------|
| 数据库 Schema（6张表 + 索引）| Task 3 |
| watchlist 初始数据 | Task 3 schema.sql |
| TypeScript 类型定义 | Task 2 |
| Mock 数据层（可替换为真实数据）| Task 5 |
| Dashboard API Route | Task 6 |
| 市场状态横幅 | Task 8 MarketStatusBanner |
| 指数卡片（NDX/SPX/VIX）| Task 8 IndexCard |
| ETF 卡片网格 | Task 8 EtfGrid |
| 强关注/回调/风险推荐列表 | Task 8 RecommendationSection |
| A股板块展示 | Task 8 RecommendationSection（sector_watch）|
| 定投建议卡片 | Task 8 DcaSuggestion |
| 每日复盘卡片 | Task 8 DailyReportCard |
| 导航栏 | Task 8 Navbar |
| 环境变量模板 | Task 1 |
| LLM 厂商无关设计 | Task 1 .env（LLM_BASE_URL 可换 DeepSeek）|
| 测试覆盖 | Task 4 utils、Task 7 Badge、Task 8 IndexCard |

**无遗漏。**
