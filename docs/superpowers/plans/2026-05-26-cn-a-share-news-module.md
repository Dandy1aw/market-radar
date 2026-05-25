# CN A股资讯模块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone A-share news signal section to the dashboard, backed by AkShare-based Python collectors, a TypeScript LLM processing pipeline, and real Supabase data — with mock data on the frontend until the backend is wired up.

**Architecture:** Python scripts collect CN news from 东方财富/巨潮/新浪RSS into two new tables (`raw_cn_news`, `raw_cn_announcement`). A TypeScript script reads those tables, calls the LLM with a CN-specific prompt, and writes events + decisions into the existing `company_event` and `opportunity_decision` tables (filtered by `market='CN'`). The frontend new section reads mock data initially; switching to real data requires changing one import in `app/page.tsx`.

**Tech Stack:** Next.js 16, TypeScript, React, Supabase (supabase-js), Python 3.11, AkShare, feedparser, Jest + React Testing Library, pytest

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/add_cn_news_tables.sql` | Create | raw_cn_news + raw_cn_announcement tables |
| `lib/cn-news/types.ts` | Create | CnNewsCardData, CnNewsApiResponse types |
| `lib/cn-news/mock.ts` | Create | Static mock data (4 CN stock cards) |
| `lib/cn-news/queries.ts` | Create | getCnNewsData() — real Supabase query |
| `components/cn-news/CnNewsSummaryBar.tsx` | Create | 4-stat summary bar |
| `components/cn-news/CnNewsCard.tsx` | Create | Single A-share signal card |
| `app/page.tsx` | Modify | Add CN news section after opportunity cards |
| `__tests__/components/CnNewsSummaryBar.test.tsx` | Create | Component render test |
| `__tests__/components/CnNewsCard.test.tsx` | Create | Component render + expand test |
| `requirements-cn.txt` | Create | Python deps for CN scripts |
| `scripts/fetch_cn_eastmoney_news.py` | Create | 东方财富 news via AkShare |
| `scripts/fetch_cn_cninfo_announcements.py` | Create | 巨潮 announcements via AkShare |
| `scripts/fetch_cn_sina_rss.py` | Create | 新浪财经 RSS via feedparser |
| `scripts/fetch_cn_free_sources.py` | Create | Main Python orchestrator |
| `scripts/tests/conftest.py` | Create | pytest fixtures |
| `scripts/tests/test_fetch_cn_eastmoney_news.py` | Create | pytest tests for east money |
| `scripts/tests/test_fetch_cn_cninfo_announcements.py` | Create | pytest tests for cninfo |
| `scripts/tests/test_fetch_cn_sina_rss.py` | Create | pytest tests for sina rss |
| `scripts/tests/test_fetch_cn_free_sources.py` | Create | pytest tests for orchestrator |
| `prompts/cn_news_event_extraction.md` | Create | Chinese LLM prompt template |
| `scripts/process-cn-news.ts` | Create | TS script: raw_cn_* → LLM → company_event + opportunity_decision |
| `.github/workflows/fetch-cn-news.yml` | Create | GitHub Actions: every 4h weekdays |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/add_cn_news_tables.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
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
```

- [ ] **Step 2: Apply the migration in Supabase**

Open the Supabase dashboard → SQL Editor → paste and run the migration SQL above. Confirm both tables appear in the Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/add_cn_news_tables.sql
git commit -m "feat: add raw_cn_news and raw_cn_announcement tables"
```

---

## Task 2: TypeScript Types + Mock Data

**Files:**
- Create: `lib/cn-news/types.ts`
- Create: `lib/cn-news/mock.ts`

- [ ] **Step 1: Write the types**

```typescript
// lib/cn-news/types.ts

export type CnEventDirection = 'positive' | 'neutral' | 'negative' | 'mixed';
export type CnConfidenceLevel = 'high' | 'medium' | 'low';
export type CnSourceType = 'announcement' | 'company_news' | 'rss';

export interface CnNewsCardData {
  symbol: string;
  company_name: string;
  theme: string;
  event_direction: CnEventDirection;
  confidence_level: CnConfidenceLevel;
  source_type: CnSourceType;
  source_label: string;
  event_type: string;
  importance_score: number;
  event_summary: string;
  watch_points: string[];
  risk_notes: string[];
  evidence: string[];
  updated_at: string;
}

export interface CnNewsSummary {
  total: number;
  positive: number;
  negative: number;
  high_confidence: number;
}

export interface CnNewsApiResponse {
  updated_at: string;
  summary: CnNewsSummary;
  cards: CnNewsCardData[];
}
```

- [ ] **Step 2: Write the mock data**

```typescript
// lib/cn-news/mock.ts
import type { CnNewsApiResponse } from './types';

export const mockCnNewsData: CnNewsApiResponse = {
  updated_at: '2026-05-26T08:00:00.000Z',
  summary: {
    total: 4,
    positive: 2,
    negative: 1,
    high_confidence: 2,
  },
  cards: [
    {
      symbol: '688981',
      company_name: '中芯国际',
      theme: '半导体 / 国产替代',
      event_direction: 'positive',
      confidence_level: 'high',
      source_type: 'announcement',
      source_label: '巨潮资讯',
      event_type: '业绩快报',
      importance_score: 8.5,
      event_summary:
        '公司发布 Q1 业绩快报，营收同比增长 18%，28nm 制程满产，国产替代订单持续增加。属于 high_confidence 公告级别。',
      watch_points: [
        '板块是否持续放量配合',
        '年报是否验证 Q1 数据',
        '设备端订单是否落地',
      ],
      risk_notes: [
        '单条公告不能单独触发买入判断',
        '出口管制政策风险持续存在',
      ],
      evidence: [
        '2026-05-20 巨潮公告：中芯国际 Q1 业绩快报，营收 208 亿元',
        '2026-05-18 东方财富：28nm 满产相关报道',
      ],
      updated_at: '2026-05-26T08:00:00.000Z',
    },
    {
      symbol: '002371',
      company_name: '北方华创',
      theme: '半导体设备 / 国产替代',
      event_direction: 'positive',
      confidence_level: 'high',
      source_type: 'announcement',
      source_label: '巨潮资讯',
      event_type: '重大合同',
      importance_score: 7.8,
      event_summary:
        '公司公告与国内晶圆厂签订刻蚀设备采购合同，金额超 10 亿元，国产设备替代进程加速。',
      watch_points: [
        '合同执行进度与交货周期',
        '后续是否有追加订单公告',
      ],
      risk_notes: [
        '客户集中度风险',
        '技术迭代竞争压力',
      ],
      evidence: [
        '2026-05-22 巨潮公告：重大合同公告，客户某晶圆厂',
      ],
      updated_at: '2026-05-26T08:00:00.000Z',
    },
    {
      symbol: '688008',
      company_name: '澜起科技',
      theme: '存储接口 / AI服务器',
      event_direction: 'neutral',
      confidence_level: 'medium',
      source_type: 'company_news',
      source_label: '东方财富',
      event_type: '产业政策',
      importance_score: 5.2,
      event_summary:
        '东方财富报道显示 AI 服务器需求回升，存储接口芯片受益，但尚无公司公告验证订单层面变化。',
      watch_points: [
        '是否有订单或业绩预告验证',
        'DDR5 内存接口芯片放量进度',
      ],
      risk_notes: [
        '资讯为 medium_confidence，不能单独触发判断',
        '竞争对手也在同步布局',
      ],
      evidence: [
        '2026-05-24 东方财富：AI服务器复苏相关行业报道',
      ],
      updated_at: '2026-05-26T08:00:00.000Z',
    },
    {
      symbol: '300274',
      company_name: '阳光电源',
      theme: '光伏逆变器 / 新能源',
      event_direction: 'negative',
      confidence_level: 'medium',
      source_type: 'company_news',
      source_label: '东方财富',
      event_type: '监管风险',
      importance_score: 6.1,
      event_summary:
        '行业报道显示海外市场关税政策收紧，光伏逆变器出口面临压力，公司海外收入占比约 60%。',
      watch_points: [
        '关税政策最终落地细节',
        '公司是否发布应对公告',
        '国内市场能否对冲影响',
      ],
      risk_notes: [
        '关税风险可能持续 2-3 个季度',
        '当前为新闻级别，需等待公司公告确认',
      ],
      evidence: [
        '2026-05-23 东方财富：光伏逆变器出口关税风险报道',
      ],
      updated_at: '2026-05-26T08:00:00.000Z',
    },
  ],
};
```

- [ ] **Step 3: Commit**

```bash
git add lib/cn-news/types.ts lib/cn-news/mock.ts
git commit -m "feat: add CnNewsCardData types and mock data"
```

---

## Task 3: CnNewsSummaryBar Component + Test

**Files:**
- Create: `components/cn-news/CnNewsSummaryBar.tsx`
- Create: `__tests__/components/CnNewsSummaryBar.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/components/CnNewsSummaryBar.test.tsx
/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { CnNewsSummaryBar } from '@/components/cn-news/CnNewsSummaryBar';
import type { CnNewsApiResponse } from '@/lib/cn-news/types';

const data: CnNewsApiResponse = {
  updated_at: '2026-05-26T08:00:00.000Z',
  summary: { total: 4, positive: 2, negative: 1, high_confidence: 2 },
  cards: [],
};

describe('CnNewsSummaryBar', () => {
  it('renders all four summary stats', () => {
    render(<CnNewsSummaryBar data={data} />);
    expect(screen.getByText('活跃信号')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('正面信号')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('负面信号')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('高可信度')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest __tests__/components/CnNewsSummaryBar.test.tsx --no-coverage
```

Expected: FAIL — `Cannot find module '@/components/cn-news/CnNewsSummaryBar'`

- [ ] **Step 3: Write the component**

```tsx
// components/cn-news/CnNewsSummaryBar.tsx
import type { CnNewsApiResponse } from '@/lib/cn-news/types';

interface CnNewsSummaryBarProps {
  data: CnNewsApiResponse;
}

export function CnNewsSummaryBar({ data }: CnNewsSummaryBarProps) {
  const { summary } = data;
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
        <p className="text-xs text-[var(--muted)]">活跃信号</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--text)]">{summary.total}</p>
      </div>
      <div className="rounded-xl border border-green-400/20 bg-green-400/5 p-3">
        <p className="text-xs text-[var(--muted)]">正面信号</p>
        <p className="mt-1 text-2xl font-semibold text-green-400">{summary.positive}</p>
      </div>
      <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-3">
        <p className="text-xs text-[var(--muted)]">负面信号</p>
        <p className="mt-1 text-2xl font-semibold text-red-400">{summary.negative}</p>
      </div>
      <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
        <p className="text-xs text-[var(--muted)]">高可信度</p>
        <p className="mt-1 text-2xl font-semibold text-amber-400">{summary.high_confidence}</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx jest __tests__/components/CnNewsSummaryBar.test.tsx --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/cn-news/CnNewsSummaryBar.tsx __tests__/components/CnNewsSummaryBar.test.tsx
git commit -m "feat: add CnNewsSummaryBar component"
```

---

## Task 4: CnNewsCard Component + Test

**Files:**
- Create: `components/cn-news/CnNewsCard.tsx`
- Create: `__tests__/components/CnNewsCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/components/CnNewsCard.test.tsx
/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { CnNewsCard } from '@/components/cn-news/CnNewsCard';
import type { CnNewsCardData } from '@/lib/cn-news/types';

const card: CnNewsCardData = {
  symbol: '688981',
  company_name: '中芯国际',
  theme: '半导体 / 国产替代',
  event_direction: 'positive',
  confidence_level: 'high',
  source_type: 'announcement',
  source_label: '巨潮资讯',
  event_type: '业绩快报',
  importance_score: 8.5,
  event_summary: '公司发布 Q1 业绩快报，营收同比增长 18%。',
  watch_points: ['板块是否持续放量'],
  risk_notes: ['单条公告不能单独触发买入判断'],
  evidence: ['2026-05-20 巨潮公告：中芯国际 Q1 业绩快报'],
  updated_at: '2026-05-26T08:00:00.000Z',
};

describe('CnNewsCard', () => {
  it('renders symbol, company name, and summary', () => {
    render(<CnNewsCard card={card} />);
    expect(screen.getByText('688981')).toBeInTheDocument();
    expect(screen.getByText('中芯国际')).toBeInTheDocument();
    expect(screen.getByText(/Q1 业绩快报/)).toBeInTheDocument();
  });

  it('shows direction and confidence badges', () => {
    render(<CnNewsCard card={card} />);
    expect(screen.getByText('正面信号')).toBeInTheDocument();
    expect(screen.getByText('公告')).toBeInTheDocument();
  });

  it('expands evidence on button click', () => {
    render(<CnNewsCard card={card} />);
    fireEvent.click(screen.getByRole('button', { name: /证据/ }));
    expect(screen.getByText(/中芯国际 Q1 业绩快报/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest __tests__/components/CnNewsCard.test.tsx --no-coverage
```

Expected: FAIL — `Cannot find module '@/components/cn-news/CnNewsCard'`

- [ ] **Step 3: Write the component**

```tsx
// components/cn-news/CnNewsCard.tsx
'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import type { CnNewsCardData, CnConfidenceLevel, CnEventDirection } from '@/lib/cn-news/types';

const directionStyle: Record<CnEventDirection, string> = {
  positive: 'border-green-400/30 bg-green-400/10 text-green-400',
  negative: 'border-red-400/30 bg-red-400/10 text-red-400',
  neutral: 'border-gray-400/30 bg-gray-400/10 text-gray-400',
  mixed: 'border-amber-400/30 bg-amber-400/10 text-amber-400',
};

const directionLabel: Record<CnEventDirection, string> = {
  positive: '正面信号',
  negative: '负面信号',
  neutral: '中性信号',
  mixed: '混合信号',
};

const confidenceStyle: Record<CnConfidenceLevel, string> = {
  high: 'border-amber-400/30 bg-amber-400/10 text-amber-400',
  medium: 'border-sky-400/30 bg-sky-400/10 text-sky-400',
  low: 'border-gray-400/30 bg-gray-400/10 text-gray-400',
};

const sourceTypeLabel: Record<string, string> = {
  announcement: '公告',
  company_news: '新闻',
  rss: 'RSS',
};

interface CnNewsCardProps {
  card: CnNewsCardData;
}

function Chip({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)]">
      {label}
      <span className="font-semibold text-[var(--text)]">{value}</span>
    </span>
  );
}

export function CnNewsCard({ card }: CnNewsCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-[var(--text)]">{card.symbol}</h3>
            <span className="text-sm text-[var(--muted)]">{card.company_name}</span>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${directionStyle[card.event_direction]}`}
            >
              {directionLabel[card.event_direction]}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${confidenceStyle[card.confidence_level]}`}
            >
              {sourceTypeLabel[card.source_type] ?? card.source_type}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">{card.theme}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs text-[var(--muted)]">可信度</p>
          <p className={`text-xl font-semibold ${{ high: 'text-amber-400', medium: 'text-sky-400', low: 'text-gray-400' }[card.confidence_level]}`}>
            {{ high: '高', medium: '中', low: '低' }[card.confidence_level]}
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{card.event_summary}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Chip label="来源" value={card.source_label} />
        <Chip label="事件" value={card.event_type} />
        <Chip label="重要性" value={card.importance_score} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">后续观察</p>
          <ul className="space-y-1 text-sm text-[var(--text)]">
            {card.watch_points.map((p, i) => <li key={i}>• {p}</li>)}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">风险提示</p>
          <ul className="space-y-1 text-sm text-[var(--text)]">
            {card.risk_notes.map((r, i) => <li key={i}>• {r}</li>)}
          </ul>
        </div>
      </div>

      {card.evidence.length > 0 && (
        <div className="mt-4 border-t border-[var(--border)] pt-3">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded(v => !v)}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)]"
          >
            <ChevronDown
              size={14}
              className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'}
              aria-hidden="true"
            />
            证据 {card.evidence.length}
          </button>
          {expanded && (
            <ul className="mt-3 space-y-1">
              {card.evidence.map((e, i) => (
                <li key={i} className="text-sm text-[var(--muted)]">{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx jest __tests__/components/CnNewsCard.test.tsx --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/cn-news/CnNewsCard.tsx __tests__/components/CnNewsCard.test.tsx
git commit -m "feat: add CnNewsCard component"
```

---

## Task 5: Dashboard Integration

**Files:**
- Modify: `app/page.tsx`
- Modify: `__tests__/app/dashboard-page.test.tsx`

- [ ] **Step 1: Read the current dashboard test**

```bash
cat __tests__/app/dashboard-page.test.tsx
```

Note what's currently tested so you don't break it.

- [ ] **Step 2: Add CN news section to `app/page.tsx`**

In `app/page.tsx`, add the following imports at the top:

```typescript
import { CnNewsSummaryBar } from '@/components/cn-news/CnNewsSummaryBar';
import { CnNewsCard } from '@/components/cn-news/CnNewsCard';
import { mockCnNewsData } from '@/lib/cn-news/mock';
```

Then in the JSX, insert this block after the OpportunityCard grid and before `<RecommendationSection`:

```tsx
<section>
  <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)] mb-3">
    A股资讯信号
  </h2>
  <CnNewsSummaryBar data={mockCnNewsData} />
  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 mt-3">
    {mockCnNewsData.cards.map(card => (
      <CnNewsCard key={card.symbol} card={card} />
    ))}
  </div>
</section>
```

- [ ] **Step 3: Run the full test suite to confirm no regressions**

```bash
npx jest --no-coverage
```

Expected: all existing tests pass, new component tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add A股资讯信号 section to dashboard with mock data"
```

---

## Task 6: Python Requirements + East Money News Fetcher

**Files:**
- Create: `requirements-cn.txt`
- Create: `scripts/fetch_cn_eastmoney_news.py`
- Create: `scripts/tests/conftest.py`
- Create: `scripts/tests/test_fetch_cn_eastmoney_news.py`

- [ ] **Step 1: Write requirements-cn.txt**

```
# requirements-cn.txt
akshare>=1.14.0
feedparser>=6.0.0
supabase>=2.0.0
python-dotenv>=1.0.0
requests>=2.31.0
pandas>=2.0.0
pytest>=8.0.0
```

- [ ] **Step 2: Write the failing test**

```python
# scripts/tests/conftest.py
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
```

```python
# scripts/tests/test_fetch_cn_eastmoney_news.py
import hashlib
from unittest.mock import MagicMock, patch

import pandas as pd


def test_normalize_eastmoney_news_deduplicates_by_hash():
    from fetch_cn_eastmoney_news import normalize_news_rows

    rows = [
        {
            'title': '中芯国际 Q1 业绩增长',
            'content': '正文内容',
            'published_at': '2026-05-20 10:00:00',
            'source': '东方财富',
            'url': 'https://example.com/1',
            'symbol': '688981',
        },
        # duplicate
        {
            'title': '中芯国际 Q1 业绩增长',
            'content': '正文内容',
            'published_at': '2026-05-20 10:00:00',
            'source': '东方财富',
            'url': 'https://example.com/1',
            'symbol': '688981',
        },
    ]
    result = normalize_news_rows(rows)
    assert len(result) == 1
    assert result[0]['hash'] == hashlib.md5('中芯国际 Q1 业绩增长'.encode()).hexdigest()
    assert result[0]['related_symbol'] == '688981'
    assert result[0]['confidence_level'] == 'medium'
    assert result[0]['source_type'] == 'company_news'


def test_fetch_eastmoney_news_calls_akshare():
    with patch('fetch_cn_eastmoney_news.ak') as mock_ak:
        mock_ak.stock_news_em.return_value = pd.DataFrame({
            '新闻标题': ['标题A'],
            '新闻内容': ['内容A'],
            '发布时间': ['2026-05-20 10:00:00'],
            '文章来源': ['财联社'],
            '新闻链接': ['https://example.com/a'],
        })

        from fetch_cn_eastmoney_news import fetch_eastmoney_news
        result = fetch_eastmoney_news('688981')

    mock_ak.stock_news_em.assert_called_once_with(symbol='688981')
    assert len(result) == 1
    assert result[0]['title'] == '标题A'
    assert result[0]['symbol'] == '688981'
```

- [ ] **Step 3: Run test to confirm it fails**

```bash
cd D:/claudeCode/market_radar
pip install -r requirements-cn.txt
pytest scripts/tests/test_fetch_cn_eastmoney_news.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'fetch_cn_eastmoney_news'`

- [ ] **Step 4: Write the implementation**

```python
# scripts/fetch_cn_eastmoney_news.py
"""
Fetch stock news from 东方财富 (East Money) via AkShare.
Returns a list of normalized news dicts ready to insert into raw_cn_news.
"""
import hashlib
from typing import Any

import akshare as ak
import pandas as pd


def normalize_news_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    result = []
    for row in rows:
        title = str(row.get('title', ''))
        h = hashlib.md5(title.encode()).hexdigest()
        if h in seen:
            continue
        seen.add(h)
        result.append({
            'source': str(row.get('source', '东方财富')),
            'source_type': 'company_news',
            'title': title,
            'summary': None,
            'content': str(row.get('content', '')) or None,
            'url': str(row.get('url', '')) or None,
            'published_at': str(row.get('published_at', '')) or None,
            'hash': h,
            'related_symbol': str(row.get('symbol', '')),
            'related_theme': None,
            'confidence_level': 'medium',
            'raw_json': row,
        })
    return result


def fetch_eastmoney_news(symbol: str) -> list[dict[str, Any]]:
    """Fetch news for a single CN stock symbol from 东方财富."""
    try:
        df: pd.DataFrame = ak.stock_news_em(symbol=symbol)
    except Exception as exc:
        print(f"[eastmoney] Failed to fetch news for {symbol}: {exc}")
        return []

    rows = []
    for _, r in df.iterrows():
        rows.append({
            'title': str(r.get('新闻标题', r.get('title', ''))),
            'content': str(r.get('新闻内容', r.get('content', ''))),
            'published_at': str(r.get('发布时间', r.get('published_at', ''))),
            'source': str(r.get('文章来源', r.get('source', '东方财富'))),
            'url': str(r.get('新闻链接', r.get('url', ''))),
            'symbol': symbol,
        })
    return rows
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
pytest scripts/tests/test_fetch_cn_eastmoney_news.py -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add requirements-cn.txt scripts/fetch_cn_eastmoney_news.py scripts/tests/conftest.py scripts/tests/test_fetch_cn_eastmoney_news.py
git commit -m "feat: add East Money news fetcher with normalization and dedup"
```

---

## Task 7: CNInfo Announcements Fetcher

**Files:**
- Create: `scripts/fetch_cn_cninfo_announcements.py`
- Create: `scripts/tests/test_fetch_cn_cninfo_announcements.py`

- [ ] **Step 1: Write the failing test**

```python
# scripts/tests/test_fetch_cn_cninfo_announcements.py
from unittest.mock import patch
import pandas as pd


def test_normalize_announcement_sets_high_confidence():
    from fetch_cn_cninfo_announcements import normalize_announcement_rows

    rows = [
        {
            'symbol': '688981',
            'name': '中芯国际',
            'title': '业绩快报',
            'type': '业绩报告',
            'url': 'https://cninfo.com.cn/1',
            'published_at': '2026-05-20',
        }
    ]
    result = normalize_announcement_rows(rows)
    assert len(result) == 1
    assert result[0]['confidence_level'] == 'high'
    assert result[0]['symbol'] == '688981'
    assert result[0]['announcement_type'] == '业绩报告'


def test_fetch_cninfo_announcements_calls_akshare():
    with patch('fetch_cn_cninfo_announcements.ak') as mock_ak:
        mock_ak.stock_zh_a_disclosure_report_cninfo.return_value = pd.DataFrame({
            '代码': ['688981'],
            '简称': ['中芯国际'],
            '公告标题': ['2026年一季报'],
            '公告类型': ['季报'],
            '公告日期': ['2026-05-20'],
            '链接': ['https://cninfo.com.cn/abc'],
        })
        from fetch_cn_cninfo_announcements import fetch_cninfo_announcements
        result = fetch_cninfo_announcements('688981', '20260501', '20260526')

    assert len(result) == 1
    assert result[0]['title'] == '2026年一季报'
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pytest scripts/tests/test_fetch_cn_cninfo_announcements.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Write the implementation**

```python
# scripts/fetch_cn_cninfo_announcements.py
"""
Fetch company announcements from 巨潮资讯 via AkShare.
"""
import hashlib
from typing import Any

import akshare as ak
import pandas as pd


def normalize_announcement_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    result = []
    for row in rows:
        title = str(row.get('title', ''))
        symbol = str(row.get('symbol', ''))
        h = hashlib.md5(f"{symbol}:{title}".encode()).hexdigest()
        if h in seen:
            continue
        seen.add(h)
        result.append({
            'symbol': symbol,
            'name': str(row.get('name', '')),
            'market': 'CN',
            'title': title,
            'announcement_type': str(row.get('type', '')),
            'url': str(row.get('url', '')) or None,
            'published_at': str(row.get('published_at', '')) or None,
            'hash': h,
            'confidence_level': 'high',
            'raw_json': row,
        })
    return result


def fetch_cninfo_announcements(
    symbol: str,
    start_date: str,
    end_date: str,
) -> list[dict[str, Any]]:
    """Fetch announcements for a CN stock from 巨潮资讯."""
    try:
        df: pd.DataFrame = ak.stock_zh_a_disclosure_report_cninfo(
            symbol=symbol,
            market='沪深京',
            category='',
            start_date=start_date,
            end_date=end_date,
        )
    except Exception as exc:
        print(f"[cninfo] Failed to fetch announcements for {symbol}: {exc}")
        return []

    rows = []
    for _, r in df.iterrows():
        rows.append({
            'symbol': str(r.get('代码', r.get('symbol', symbol))),
            'name': str(r.get('简称', r.get('name', ''))),
            'title': str(r.get('公告标题', r.get('title', ''))),
            'type': str(r.get('公告类型', r.get('type', ''))),
            'url': str(r.get('链接', r.get('url', ''))),
            'published_at': str(r.get('公告日期', r.get('date', ''))),
        })
    return rows
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
pytest scripts/tests/test_fetch_cn_cninfo_announcements.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch_cn_cninfo_announcements.py scripts/tests/test_fetch_cn_cninfo_announcements.py
git commit -m "feat: add CNInfo announcements fetcher"
```

---

## Task 8: Sina Finance RSS Fetcher

**Files:**
- Create: `scripts/fetch_cn_sina_rss.py`
- Create: `scripts/tests/test_fetch_cn_sina_rss.py`

- [ ] **Step 1: Write the failing test**

```python
# scripts/tests/test_fetch_cn_sina_rss.py
from unittest.mock import MagicMock, patch


def test_filter_rss_entries_by_keywords():
    from fetch_cn_sina_rss import filter_by_keywords

    entries = [
        {'title': '半导体国产替代加速', 'summary': '相关政策出台'},
        {'title': '今日天气预报', 'summary': '晴天'},
        {'title': '存储芯片价格上涨', 'summary': 'DRAM 需求回升'},
    ]
    keywords = ['半导体', '存储芯片', 'DRAM', 'HBM']
    result = filter_by_keywords(entries, keywords)
    assert len(result) == 2
    assert all('半导体' in e['title'] or '存储芯片' in e['title'] for e in result)


def test_normalize_rss_sets_low_confidence():
    from fetch_cn_sina_rss import normalize_rss_entries

    entries = [
        {
            'title': '半导体板块上涨',
            'summary': '市场情绪回暖',
            'link': 'https://finance.sina.com.cn/1',
            'published': 'Mon, 20 May 2026 10:00:00 +0800',
        }
    ]
    result = normalize_rss_entries(entries)
    assert result[0]['confidence_level'] == 'low'
    assert result[0]['source_type'] == 'rss'
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pytest scripts/tests/test_fetch_cn_sina_rss.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Write the implementation**

```python
# scripts/fetch_cn_sina_rss.py
"""
Fetch finance news from 新浪财经 RSS feeds.
"""
import hashlib
from typing import Any

import feedparser

SINA_RSS_URLS = [
    'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2509&k=&num=50&page=1&r=0.1&format=json',
    'https://finance.sina.com.cn/roll/index.d.html?cids=57,1150753010&interface=api&num=20&format=json',
]

# Fallback static RSS URL that feedparser can parse
SINA_STOCK_RSS = 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&num=50&format=rss'


def filter_by_keywords(
    entries: list[dict[str, Any]],
    keywords: list[str],
) -> list[dict[str, Any]]:
    result = []
    for entry in entries:
        text = f"{entry.get('title', '')} {entry.get('summary', '')}".lower()
        if any(kw.lower() in text for kw in keywords):
            result.append(entry)
    return result


def normalize_rss_entries(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    result = []
    for entry in entries:
        title = str(entry.get('title', ''))
        h = hashlib.md5(title.encode()).hexdigest()
        if h in seen:
            continue
        seen.add(h)
        result.append({
            'source': '新浪财经',
            'source_type': 'rss',
            'title': title,
            'summary': str(entry.get('summary', '')) or None,
            'content': None,
            'url': str(entry.get('link', '')) or None,
            'published_at': str(entry.get('published', '')) or None,
            'hash': h,
            'related_symbol': None,
            'related_theme': None,
            'confidence_level': 'low',
            'raw_json': entry,
        })
    return result


def fetch_sina_rss(keywords: list[str]) -> list[dict[str, Any]]:
    """Fetch and filter 新浪财经 RSS feed by keywords."""
    try:
        feed = feedparser.parse(SINA_STOCK_RSS)
        raw_entries = [
            {
                'title': e.get('title', ''),
                'summary': e.get('summary', ''),
                'link': e.get('link', ''),
                'published': e.get('published', ''),
            }
            for e in feed.entries
        ]
    except Exception as exc:
        print(f"[sina_rss] Failed to fetch RSS: {exc}")
        return []

    filtered = filter_by_keywords(raw_entries, keywords)
    return normalize_rss_entries(filtered)
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
pytest scripts/tests/test_fetch_cn_sina_rss.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch_cn_sina_rss.py scripts/tests/test_fetch_cn_sina_rss.py
git commit -m "feat: add Sina Finance RSS fetcher with keyword filtering"
```

---

## Task 9: Python Main Orchestrator

**Files:**
- Create: `scripts/fetch_cn_free_sources.py`
- Create: `scripts/tests/test_fetch_cn_free_sources.py`

- [ ] **Step 1: Write the failing test**

```python
# scripts/tests/test_fetch_cn_free_sources.py
from unittest.mock import MagicMock, patch


def test_main_calls_all_fetchers_and_inserts():
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.upsert.return_value.execute.return_value = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[
            {'symbol': '688981', 'name': '中芯国际', 'notes': '半导体'},
        ]
    )

    with (
        patch('fetch_cn_free_sources.create_client', return_value=mock_supabase),
        patch('fetch_cn_free_sources.fetch_eastmoney_news', return_value=[{
            'source': '东方财富', 'source_type': 'company_news',
            'title': '测试新闻', 'summary': None, 'content': None,
            'url': None, 'published_at': None,
            'hash': 'abc123', 'related_symbol': '688981',
            'related_theme': None, 'confidence_level': 'medium',
            'raw_json': {},
        }]) as mock_em,
        patch('fetch_cn_free_sources.fetch_cninfo_announcements', return_value=[]) as mock_cn,
        patch('fetch_cn_free_sources.fetch_sina_rss', return_value=[]) as mock_rss,
    ):
        from fetch_cn_free_sources import main
        summary = main()

    mock_em.assert_called_once_with('688981')
    assert summary['news_inserted'] >= 0
    assert summary['announcements_inserted'] >= 0
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pytest scripts/tests/test_fetch_cn_free_sources.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Write the implementation**

```python
# scripts/fetch_cn_free_sources.py
"""
Main orchestrator for CN free data sources.
Reads watchlist_core (market=CN), fetches news + announcements + RSS,
deduplicates, and upserts into raw_cn_news / raw_cn_announcement.
"""
import os
import time
from datetime import datetime, timedelta
from typing import Any

from dotenv import load_dotenv
from supabase import create_client, Client

from fetch_cn_eastmoney_news import fetch_eastmoney_news, normalize_news_rows
from fetch_cn_cninfo_announcements import fetch_cninfo_announcements, normalize_announcement_rows
from fetch_cn_sina_rss import fetch_sina_rss

load_dotenv()

THEME_KEYWORDS = [
    '半导体', '存储芯片', '国产替代', '光模块', 'AI服务器',
    '液冷', 'PCB', '算力', '人工智能', '机器人',
    '新能源', '券商', '银行', 'HBM', 'DRAM', 'NAND', 'CPO',
    '长鑫存储', '中芯国际', '北方华创',
]

MAX_NEWS_PER_RUN = int(os.getenv('MAX_CN_NEWS_PER_RUN', '100'))


def get_supabase_client() -> Client:
    url = os.environ['SUPABASE_URL']
    key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
    return create_client(url, key)


def load_cn_watchlist(client: Client) -> list[dict[str, Any]]:
    resp = (
        client.table('watchlist_core')
        .select('symbol,name,notes,theme')
        .eq('market', 'CN')
        .eq('is_active', True)
        .execute()
    )
    return resp.data or []


def upsert_raw_cn_news(client: Client, rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0
    result = (
        client.table('raw_cn_news')
        .upsert(rows, on_conflict='hash')
        .execute()
    )
    return len(result.data) if result.data else 0


def upsert_raw_cn_announcements(client: Client, rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0
    result = (
        client.table('raw_cn_announcement')
        .upsert(rows, on_conflict='hash')
        .execute()
    )
    return len(result.data) if result.data else 0


def get_date_range() -> tuple[str, str]:
    today = datetime.now()
    yesterday = today - timedelta(days=1)
    return yesterday.strftime('%Y%m%d'), today.strftime('%Y%m%d')


def main() -> dict[str, int]:
    client = get_supabase_client()
    cn_targets = load_cn_watchlist(client)
    print(f"[main] Loaded {len(cn_targets)} CN watchlist targets")

    start_date, end_date = get_date_range()

    all_news_rows: list[dict[str, Any]] = []
    all_announcement_rows: list[dict[str, Any]] = []

    for target in cn_targets:
        symbol = target.get('symbol', '')
        if not symbol:
            continue

        # East Money news
        raw_news = fetch_eastmoney_news(symbol)
        all_news_rows.extend(normalize_news_rows(raw_news))
        time.sleep(0.5)

        # CNInfo announcements
        raw_ann = fetch_cninfo_announcements(symbol, start_date, end_date)
        all_announcement_rows.extend(normalize_announcement_rows(raw_ann))
        time.sleep(0.5)

    # Sina RSS (theme-based)
    rss_rows = fetch_sina_rss(THEME_KEYWORDS)
    all_news_rows.extend(rss_rows)

    # Deduplicate by hash across entire batch
    seen: set[str] = set()
    deduped_news = []
    for row in all_news_rows:
        h = row.get('hash', '')
        if h and h not in seen:
            seen.add(h)
            deduped_news.append(row)

    deduped_news = deduped_news[:MAX_NEWS_PER_RUN]

    news_inserted = upsert_raw_cn_news(client, deduped_news)
    ann_inserted = upsert_raw_cn_announcements(client, all_announcement_rows)

    summary = {
        'news_fetched': len(deduped_news),
        'news_inserted': news_inserted,
        'announcements_fetched': len(all_announcement_rows),
        'announcements_inserted': ann_inserted,
    }
    print(f"[main] Done: {summary}")
    return summary


if __name__ == '__main__':
    main()
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
pytest scripts/tests/test_fetch_cn_free_sources.py -v
```

Expected: PASS

- [ ] **Step 5: Run all Python tests together**

```bash
pytest scripts/tests/ -v
```

Expected: all 4 test files pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/fetch_cn_free_sources.py scripts/tests/test_fetch_cn_free_sources.py
git commit -m "feat: add CN free sources main orchestrator"
```

---

## Task 10: CN LLM Prompt

**Files:**
- Create: `prompts/cn_news_event_extraction.md`

- [ ] **Step 1: Create the prompt file**

```markdown
<!-- prompts/cn_news_event_extraction.md -->
# 角色

你是 A股科技产业机会发现引擎的信息抽取助手。

你的任务是从 A股新闻、公告、财报、业绩预告中抽取结构化事件，判断它是否影响用户自选标的，并输出严格 JSON。

# 重要约束

1. 只分析与用户自选标的、关联标的、核心主题相关的信息。
2. 不要输出买入或卖出建议。
3. 不要编造输入中不存在的信息。
4. 必须区分公告、主流新闻、社媒传闻的可信度。
5. 如果证据不足，必须输出 uncertainty。
6. 未上市公司只能作为产业信号，不得直接作为可交易标的推荐。
7. 只输出 JSON，不输出任何其他内容。

# 输入

自选核心池：
{{watchlist_core}}

核心主题关键词：
{{theme_keywords}}

资讯内容：
{{document_text}}

来源：
{{source}}

可信度：
{{confidence_level}}

# 输出 JSON（严格遵守此结构）

{
  "is_relevant": true,
  "related_core_symbols": ["688981"],
  "theme": "半导体 / 国产替代",
  "cn_event_type": "earnings_forecast",
  "event_type": "earnings_risk",
  "event_direction": "positive",
  "importance_score": 7.5,
  "cn_confidence_level": "high",
  "event_summary": "公司发布业绩预告，Q1 净利润同比增长 25%。",
  "watch_points": [
    "年报是否验证预告数据",
    "板块是否持续放量"
  ],
  "risk_notes": [
    "单条公告不能单独触发买入判断",
    "出口管制政策持续存在"
  ],
  "positive_factors": ["业绩增长超预期"],
  "negative_factors": [],
  "uncertainty": ["预告数据待年报最终确认"],
  "evidence": [
    {"text": "Q1净利润同比增长25%", "reason": "直接财务证据"}
  ]
}

# cn_event_type 枚举（选其一）

earnings_report, earnings_forecast, company_announcement, industry_policy,
product_progress, capacity_expansion, supply_chain, order_contract,
price_change, funding_financing, ipo_listing, regulatory_risk,
litigation_risk, market_sentiment, other

# event_type 枚举（选其一，映射到系统约束）

demand, competition, product, supply_chain, earnings_risk, macro, price_action

# 映射规则

earnings_report/earnings_forecast/regulatory_risk/litigation_risk → earnings_risk
industry_policy/funding_financing/ipo_listing/market_sentiment/other/company_announcement → macro
product_progress → product
capacity_expansion/order_contract → demand
supply_chain → supply_chain
price_change → price_action
```

- [ ] **Step 2: Commit**

```bash
git add prompts/cn_news_event_extraction.md
git commit -m "feat: add CN LLM event extraction prompt"
```

---

## Task 11: process-cn-news.ts

**Files:**
- Create: `scripts/process-cn-news.ts`

- [ ] **Step 1: Write the script**

```typescript
// scripts/process-cn-news.ts
// Run via: npx tsx scripts/process-cn-news.ts
import { loadEnvConfig } from '@next/env';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

import { chatCompletion, getLlmModelName } from '../lib/llm/client';
import { parseJsonWithRepair } from '../lib/opportunity/llm-json';

loadEnvConfig(process.cwd());

const PROMPT_TEMPLATE = readFileSync(
  join(process.cwd(), 'prompts/cn_news_event_extraction.md'),
  'utf-8',
);

const THEME_KEYWORDS = [
  '半导体', '存储芯片', '国产替代', '光模块', 'AI服务器',
  '液冷', '算力', '人工智能', '机器人', '新能源',
];

const MAX_LLM_CALLS = Number(process.env.MAX_CN_DEEPSEEK_CALLS_PER_RUN ?? '20');
const LOOKBACK_HOURS = Number(process.env.CN_NEWS_LOOKBACK_HOURS ?? '8');

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

interface CnRawNews {
  id: number;
  source: string;
  source_type: string | null;
  title: string;
  summary: string | null;
  content: string | null;
  url: string | null;
  published_at: string | null;
  related_symbol: string | null;
  confidence_level: string;
  raw_json: Record<string, unknown>;
}

interface CnAnnouncement {
  id: number;
  symbol: string;
  name: string | null;
  title: string;
  announcement_type: string | null;
  url: string | null;
  published_at: string | null;
  confidence_level: string;
}

interface CnTarget {
  symbol: string;
  name: string;
  theme: string;
  notes: string;
}

interface ExtractedCnEvent {
  is_relevant: boolean;
  related_core_symbols: string[];
  theme: string;
  cn_event_type: string;
  event_type: string;
  event_direction: 'positive' | 'neutral' | 'negative' | 'mixed';
  importance_score: number;
  cn_confidence_level: string;
  event_summary: string;
  watch_points: string[];
  risk_notes: string[];
  positive_factors: string[];
  negative_factors: string[];
  uncertainty: string[];
  evidence: { text: string; reason: string }[];
}

async function loadCnTargets(client: ReturnType<typeof adminClient>): Promise<CnTarget[]> {
  const { data } = await client
    .from('watchlist_core')
    .select('symbol,name,theme,notes')
    .eq('market', 'CN')
    .eq('is_active', true);
  return (data ?? []) as CnTarget[];
}

async function loadRecentCnNews(
  client: ReturnType<typeof adminClient>,
  sinceIso: string,
): Promise<CnRawNews[]> {
  const { data } = await client
    .from('raw_cn_news')
    .select('id,source,source_type,title,summary,content,url,published_at,related_symbol,confidence_level,raw_json')
    .gte('fetched_at', sinceIso)
    .order('published_at', { ascending: false })
    .limit(200);
  return (data ?? []) as CnRawNews[];
}

async function loadRecentCnAnnouncements(
  client: ReturnType<typeof adminClient>,
  sinceIso: string,
): Promise<CnAnnouncement[]> {
  const { data } = await client
    .from('raw_cn_announcement')
    .select('id,symbol,name,title,announcement_type,url,published_at,confidence_level')
    .gte('fetched_at', sinceIso)
    .order('published_at', { ascending: false })
    .limit(100);
  return (data ?? []) as CnAnnouncement[];
}

function buildPrompt(
  documentText: string,
  source: string,
  confidenceLevel: string,
  targets: CnTarget[],
): string {
  const watchlistSummary = targets
    .map(t => `${t.symbol} ${t.name} [${t.theme}]`)
    .join('\n');
  return PROMPT_TEMPLATE
    .replace('{{watchlist_core}}', watchlistSummary)
    .replace('{{theme_keywords}}', THEME_KEYWORDS.join(', '))
    .replace('{{document_text}}', documentText.slice(0, 3000))
    .replace('{{source}}', source)
    .replace('{{confidence_level}}', confidenceLevel);
}

async function extractCnEvent(
  text: string,
  source: string,
  confidenceLevel: string,
  targets: CnTarget[],
): Promise<ExtractedCnEvent | null> {
  const prompt = buildPrompt(text, source, confidenceLevel, targets);
  const raw = await chatCompletion([{ role: 'user', content: prompt }], {
    temperature: 0.1,
    maxTokens: 900,
  });
  return parseJsonWithRepair<ExtractedCnEvent>({
    rawText: raw,
    repair: (invalid) =>
      chatCompletion(
        [
          { role: 'system', content: 'Repair this into valid strict JSON only. Output JSON only.' },
          { role: 'user', content: invalid },
        ],
        { temperature: 0, maxTokens: 900 },
      ),
  });
}

async function insertCnCompanyEvent(
  client: ReturnType<typeof adminClient>,
  symbol: string,
  companyName: string,
  event: ExtractedCnEvent,
  evidenceNewsIds: number[],
  model: string,
): Promise<number | null> {
  const row = {
    symbol,
    market: 'CN',
    company_name: companyName,
    theme: event.theme,
    event_type: event.event_type as string,
    event_direction: event.event_direction,
    importance_score: event.importance_score,
    event_summary: event.event_summary,
    evidence_news_ids: evidenceNewsIds,
    published_at: new Date().toISOString(),
    raw_llm_json: {
      ...event,
      cn_event_type: event.cn_event_type,
      cn_confidence_level: event.cn_confidence_level,
      watch_points: event.watch_points,
      risk_notes: event.risk_notes,
    },
    llm_input_summary: `CN news for ${symbol}`,
    llm_model: model,
    extraction_status: 'ok',
  };
  const { data, error } = await client.from('company_event').insert(row).select('id');
  if (error) { console.error('[insertCnCompanyEvent]', error.message); return null; }
  return (data?.[0] as { id: number } | undefined)?.id ?? null;
}

async function upsertCnOpportunityDecision(
  client: ReturnType<typeof adminClient>,
  target: CnTarget,
  events: Array<{ id: number; event: ExtractedCnEvent }>,
): Promise<void> {
  if (events.length === 0) return;

  const positiveCount = events.filter(e => e.event.event_direction === 'positive').length;
  const negativeCount = events.filter(e => e.event.event_direction === 'negative').length;
  const maxImportance = Math.max(...events.map(e => e.event.importance_score));
  const topConfidence = events.some(e => e.event.cn_confidence_level === 'high')
    ? 'high'
    : events.some(e => e.event.cn_confidence_level === 'medium')
      ? 'medium'
      : 'low';

  const newsScore = Math.min(10, Math.round(maxImportance));
  const riskScore = negativeCount > 0 ? -Math.min(5, negativeCount * 2) : 0;
  const totalScore = newsScore + riskScore + (topConfidence === 'high' ? 2 : 0);

  let decisionLevel: string;
  if (negativeCount > positiveCount) {
    decisionLevel = 'risk_high';
  } else if (totalScore >= 8) {
    decisionLevel = 'strong_watch';
  } else if (totalScore >= 5) {
    decisionLevel = 'pullback_candidate';
  } else {
    decisionLevel = 'post_earnings_wait';
  }

  const topEvent = events[0].event;
  const watchConditions = topEvent.watch_points ?? [];
  const riskFactors = topEvent.risk_notes ?? [];

  const row = {
    symbol: target.symbol,
    market: 'CN',
    company_name: target.name,
    asset_type: 'stock',
    theme: topEvent.theme || target.theme,
    decision_level: decisionLevel,
    total_score: totalScore,
    news_score: newsScore,
    price_position_score: 0,
    context_signal_score: 0,
    risk_score: riskScore,
    summary: topEvent.event_summary,
    watch_conditions: watchConditions,
    risk_factors: riskFactors,
    evidence_event_ids: events.map(e => e.id),
  };

  // No unique constraint on (symbol, market), so delete the existing row then insert
  await client
    .from('opportunity_decision')
    .delete()
    .eq('symbol', target.symbol)
    .eq('market', 'CN');

  const { error } = await client.from('opportunity_decision').insert(row);
  if (error) console.error('[upsertCnOpportunityDecision]', error.message);
}

async function main(): Promise<void> {
  const client = adminClient();
  const model = getLlmModelName();

  const sinceIso = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
  const targets = await loadCnTargets(client);
  const allNews = await loadRecentCnNews(client, sinceIso);
  const allAnnouncements = await loadRecentCnAnnouncements(client, sinceIso);

  console.log(`[process-cn-news] targets=${targets.length} news=${allNews.length} ann=${allAnnouncements.length}`);

  let llmCallCount = 0;

  for (const target of targets) {
    if (llmCallCount >= MAX_LLM_CALLS) break;

    const relevantNews = allNews.filter(n => n.related_symbol === target.symbol);
    const relevantAnn = allAnnouncements.filter(a => a.symbol === target.symbol);

    const items: Array<{ text: string; source: string; confidence: string; ids: number[] }> = [
      ...relevantAnn.map(a => ({
        text: `${a.title}\n${a.announcement_type ?? ''}`,
        source: `巨潮资讯 (${a.announcement_type ?? '公告'})`,
        confidence: a.confidence_level,
        ids: [a.id],
      })),
      ...relevantNews.slice(0, 3).map(n => ({
        text: `${n.title}\n${n.summary ?? ''}\n${n.content?.slice(0, 500) ?? ''}`,
        source: n.source,
        confidence: n.confidence_level,
        ids: [n.id],
      })),
    ];

    if (items.length === 0) continue;

    const extractedEvents: Array<{ id: number; event: ExtractedCnEvent }> = [];

    for (const item of items.slice(0, 3)) {
      if (llmCallCount >= MAX_LLM_CALLS) break;
      llmCallCount++;

      const event = await extractCnEvent(item.text, item.source, item.confidence, targets);
      if (!event || !event.is_relevant) continue;

      const eventId = await insertCnCompanyEvent(
        client,
        target.symbol,
        target.name,
        event,
        item.ids,
        model,
      );
      if (eventId !== null) {
        extractedEvents.push({ id: eventId, event });
      }
    }

    await upsertCnOpportunityDecision(client, target, extractedEvents);
  }

  console.log(`[process-cn-news] Done. LLM calls used: ${llmCallCount}/${MAX_LLM_CALLS}`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors (or only pre-existing errors unrelated to this file).

- [ ] **Step 3: Commit**

```bash
git add scripts/process-cn-news.ts
git commit -m "feat: add process-cn-news TypeScript LLM pipeline"
```

---

## Task 12: Real Data Query (lib/cn-news/queries.ts)

**Files:**
- Create: `lib/cn-news/queries.ts`

- [ ] **Step 1: Write the query module**

```typescript
// lib/cn-news/queries.ts
import { createClient } from '@supabase/supabase-js';
import type { CnNewsApiResponse, CnNewsCardData, CnEventDirection, CnConfidenceLevel, CnSourceType } from './types';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

interface DecisionRow {
  id: number;
  symbol: string;
  company_name: string;
  theme: string;
  decision_level: string;
  total_score: number;
  summary: string;
  watch_conditions: string[];
  risk_factors: string[];
  evidence_event_ids: number[];
  created_at: string;
}

interface EventRow {
  id: number;
  event_direction: string;
  importance_score: number;
  event_summary: string;
  raw_llm_json: Record<string, unknown>;
}

function mapEventToCard(
  decision: DecisionRow,
  topEvent: EventRow | undefined,
): CnNewsCardData {
  const llmJson = topEvent?.raw_llm_json ?? {};

  return {
    symbol: decision.symbol,
    company_name: decision.company_name,
    theme: decision.theme,
    event_direction: (topEvent?.event_direction ?? 'neutral') as CnEventDirection,
    confidence_level: (llmJson.cn_confidence_level ?? 'medium') as CnConfidenceLevel,
    source_type: (llmJson.cn_source_type ?? 'company_news') as CnSourceType,
    source_label: String(llmJson.cn_source_label ?? '东方财富'),
    event_type: String(llmJson.cn_event_type ?? '资讯'),
    importance_score: topEvent?.importance_score ?? 0,
    event_summary: decision.summary,
    watch_points: Array.isArray(llmJson.watch_points) ? llmJson.watch_points as string[] : [],
    risk_notes: Array.isArray(llmJson.risk_notes) ? llmJson.risk_notes as string[] : [],
    evidence: Array.isArray(llmJson.evidence)
      ? (llmJson.evidence as Array<{ text: string }>).map(e => e.text)
      : [],
    updated_at: decision.created_at,
  };
}

export async function getCnNewsData(): Promise<CnNewsApiResponse> {
  const client = adminClient();

  // Get latest decision per symbol for market='CN'
  const { data: decisions, error: dErr } = await client
    .from('opportunity_decision')
    .select('id,symbol,company_name,theme,decision_level,total_score,summary,watch_conditions,risk_factors,evidence_event_ids,created_at')
    .eq('market', 'CN')
    .order('created_at', { ascending: false })
    .limit(50);

  if (dErr) throw dErr;
  if (!decisions || decisions.length === 0) {
    return { updated_at: new Date().toISOString(), summary: { total: 0, positive: 0, negative: 0, high_confidence: 0 }, cards: [] };
  }

  // Deduplicate to latest per symbol
  const latestBySymbol = new Map<string, DecisionRow>();
  for (const d of decisions as DecisionRow[]) {
    if (!latestBySymbol.has(d.symbol)) latestBySymbol.set(d.symbol, d);
  }
  const uniqueDecisions = Array.from(latestBySymbol.values());

  // Collect all evidence event IDs
  const allEventIds = uniqueDecisions.flatMap(d => d.evidence_event_ids ?? []);

  let events: EventRow[] = [];
  if (allEventIds.length > 0) {
    const { data: evData } = await client
      .from('company_event')
      .select('id,event_direction,importance_score,event_summary,raw_llm_json')
      .in('id', allEventIds);
    events = (evData ?? []) as EventRow[];
  }

  const eventMap = new Map(events.map(e => [e.id, e]));

  const cards: CnNewsCardData[] = uniqueDecisions.map(d => {
    const topEventId = d.evidence_event_ids?.[0];
    const topEvent = topEventId !== undefined ? eventMap.get(topEventId) : undefined;
    return mapEventToCard(d, topEvent);
  });

  const summary = {
    total: cards.length,
    positive: cards.filter(c => c.event_direction === 'positive').length,
    negative: cards.filter(c => c.event_direction === 'negative').length,
    high_confidence: cards.filter(c => c.confidence_level === 'high').length,
  };

  return {
    updated_at: uniqueDecisions[0]?.created_at ?? new Date().toISOString(),
    summary,
    cards,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/cn-news/queries.ts
git commit -m "feat: add getCnNewsData real Supabase query"
```

---

## Task 13: GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/fetch-cn-news.yml`

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/fetch-cn-news.yml
name: Fetch CN News

on:
  schedule:
    - cron: "0 1,5,9,13 * * 1-5"   # 01:00, 05:00, 09:00, 13:00 UTC — weekdays only
  workflow_dispatch:

jobs:
  fetch-cn-news:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install Python dependencies
        run: pip install -r requirements-cn.txt

      - name: Fetch CN raw news and announcements
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          MAX_CN_NEWS_PER_RUN: "100"
        run: python scripts/fetch_cn_free_sources.py

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install Node dependencies
        run: npm ci

      - name: Process CN news with LLM
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          LLM_API_KEY: ${{ secrets.LLM_API_KEY }}
          LLM_BASE_URL: ${{ secrets.LLM_BASE_URL }}
          MAX_CN_DEEPSEEK_CALLS_PER_RUN: "20"
          CN_NEWS_LOOKBACK_HOURS: "8"
        run: npx tsx scripts/process-cn-news.ts
```

- [ ] **Step 2: Verify the workflow file is valid YAML**

```bash
python -c "import yaml; yaml.safe_load(open('.github/workflows/fetch-cn-news.yml'))" && echo "YAML valid"
```

Expected: `YAML valid`

- [ ] **Step 3: Run full test suite one final time**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/fetch-cn-news.yml
git commit -m "ci: add fetch-cn-news GitHub Actions workflow (every 4h weekdays)"
```

---

## Done

After Task 13, the A股资讯信号 section appears on the dashboard with mock data (4 CN stock cards). To switch to real data:

1. Add CN stocks to `watchlist_core` in Supabase (market='CN', is_active=true)
2. Run `python scripts/fetch_cn_free_sources.py` to populate `raw_cn_news` / `raw_cn_announcement`
3. Run `npx tsx scripts/process-cn-news.ts` to generate `company_event` and `opportunity_decision` (market='CN')
4. In `app/page.tsx`, replace the three mock imports with:

```typescript
import { getCnNewsData } from '@/lib/cn-news/queries';
// ...
const cnNewsData = await getCnNewsData();
```

And pass `cnNewsData` to `CnNewsSummaryBar` and `CnNewsCard`.
