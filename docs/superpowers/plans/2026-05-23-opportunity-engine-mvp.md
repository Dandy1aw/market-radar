# Opportunity Engine MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable `/opportunity` vertical slice using deterministic seed data, explainable scoring, grouped opportunity cards, and evidence review.

**Architecture:** Keep the MVP local-first and rule-driven. Seed data feeds pure scoring and decision helpers; the API returns grouped opportunity cards with a Supabase hook point and seed fallback; the page renders dense operational cards without live news APIs, LLM calls, scheduled jobs, or candidate discovery.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Jest, React Testing Library, Supabase read helpers.

---

## Pre-Implementation Notes

- Work from a dedicated branch or worktree, for example `feature/opportunity-engine-mvp`.
- Before editing Next.js route or page files, read the local Next.js docs required by `AGENTS.md`:
  - `node_modules/next/dist/docs/app/api-reference/file-conventions/page.md`
  - `node_modules/next/dist/docs/app/api-reference/file-conventions/route.md`
- Do not modify or commit the user's untracked `docs/idea/` files unless explicitly asked.
- Keep the first version deterministic. No external news API, no DeepSeek call, no GitHub Actions.
- Commit after every task.

## File Structure

Create and modify these files:

```text
lib/opportunity/types.ts              # Shared domain/view types
lib/opportunity/seed.ts               # Deterministic MVP seed data
lib/opportunity/scoring.ts            # Pure score calculations
lib/opportunity/decision.ts           # Decision levels, grouping, card assembly
lib/supabase/opportunity.ts           # Supabase query hook with seed fallback
app/api/opportunity/route.ts          # Read-only grouped opportunity API
app/opportunity/page.tsx              # Server-rendered opportunity page
components/opportunity/OpportunitySummaryBar.tsx
components/opportunity/OpportunityCard.tsx
components/opportunity/OpportunityGroup.tsx
components/layout/Navbar.tsx          # Add Opportunity navigation link
__tests__/lib/opportunity/seed.test.ts
__tests__/lib/opportunity/scoring.test.ts
__tests__/lib/opportunity/decision.test.ts
__tests__/api/opportunity.test.ts
__tests__/components/OpportunityCard.test.tsx
__tests__/components/OpportunityGroup.test.tsx
__tests__/app/opportunity-page.test.tsx
```

---

### Task 1: Domain Types and Seed Data

**Files:**
- Create: `lib/opportunity/types.ts`
- Create: `lib/opportunity/seed.ts`
- Test: `__tests__/lib/opportunity/seed.test.ts`

- [ ] **Step 1: Write the failing seed data tests**

Create `__tests__/lib/opportunity/seed.test.ts`:

```ts
import {
  seedCompanyEvents,
  seedContext,
  seedCoreWatchlist,
  seedIndicators,
  seedRawNews,
} from '@/lib/opportunity/seed';

describe('opportunity seed data', () => {
  it('contains the five MVP core targets', () => {
    expect(seedCoreWatchlist.map(item => item.symbol).sort()).toEqual([
      'AMD',
      'MU',
      'NVDA',
      'QQQ',
      'SMH',
    ]);
  });

  it('keeps context entities out of the core pool', () => {
    const coreSymbols = new Set(seedCoreWatchlist.map(item => item.symbol));

    expect(seedContext.some(item => item.related_name === 'Samsung Memory')).toBe(
      true,
    );
    expect(coreSymbols.has('Samsung Memory')).toBe(false);
    expect(coreSymbols.has('CXMT')).toBe(false);
  });

  it('links each event to at least one evidence news item', () => {
    const newsIds = new Set(seedRawNews.map(news => news.id));

    for (const event of seedCompanyEvents) {
      expect(event.evidence_news_ids.length).toBeGreaterThan(0);
      for (const newsId of event.evidence_news_ids) {
        expect(newsIds.has(newsId)).toBe(true);
      }
    }
  });

  it('provides indicator snapshots for every core target', () => {
    const indicatorSymbols = new Set(
      seedIndicators.map(indicator => indicator.symbol),
    );

    for (const target of seedCoreWatchlist) {
      expect(indicatorSymbols.has(target.symbol)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx jest __tests__/lib/opportunity/seed.test.ts --no-coverage
```

Expected: FAIL because `@/lib/opportunity/seed` does not exist.

- [ ] **Step 3: Create the opportunity type definitions**

Create `lib/opportunity/types.ts`:

```ts
import type { AssetType, Market, RiskLevel } from '@/types';

export type OpportunityDecisionLevel =
  | 'small_probe'
  | 'pullback_candidate'
  | 'strong_watch'
  | 'breakout_confirm'
  | 'post_earnings_wait'
  | 'risk_high';

export type OpportunityDirection = 'positive' | 'neutral' | 'negative' | 'mixed';

export interface OpportunityCoreTarget {
  id: number;
  symbol: string;
  name: string;
  market: Market;
  asset_type: AssetType;
  theme: string;
  priority: number;
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface OpportunityContextEntity {
  id: number;
  core_symbol: string;
  related_symbol: string | null;
  related_name: string;
  market: Market | 'GLOBAL';
  relation_type:
    | 'competitor'
    | 'supplier'
    | 'customer'
    | 'peer'
    | 'etf_holding'
    | 'industry_signal'
    | 'policy_signal';
  relation_strength: number;
  reason: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpportunityRawNews {
  id: number;
  source: string;
  title: string;
  summary: string;
  url: string | null;
  published_at: string;
  hash: string;
  raw_json: Record<string, unknown>;
  created_at: string;
}

export interface OpportunityCompanyEvent {
  id: number;
  symbol: string;
  company_name: string;
  theme: string;
  event_type:
    | 'demand'
    | 'competition'
    | 'product'
    | 'supply_chain'
    | 'earnings_risk'
    | 'macro'
    | 'price_action';
  event_direction: OpportunityDirection;
  importance_score: number;
  event_summary: string;
  evidence_news_ids: number[];
  published_at: string;
  raw_payload: Record<string, unknown>;
  created_at: string;
}

export interface OpportunityIndicatorSnapshot {
  symbol: string;
  close: number;
  pct_change_5d: number | null;
  pct_change_20d: number | null;
  pct_from_ma500: number | null;
  drawdown_1y: number | null;
  volume_ratio: number | null;
  risk_level: RiskLevel | null;
}

export interface OpportunityScores {
  total_score: number;
  news_score: number;
  price_position_score: number;
  context_signal_score: number;
  risk_score: number;
}

export interface OpportunityDecisionInput {
  target: OpportunityCoreTarget;
  indicator: OpportunityIndicatorSnapshot;
  directEvents: OpportunityCompanyEvent[];
  contextEvents: OpportunityCompanyEvent[];
  evidenceNews: OpportunityRawNews[];
}

export interface OpportunityCardData extends OpportunityScores {
  symbol: string;
  company_name: string;
  asset_type: AssetType;
  market: Market;
  theme: string;
  decision_level: OpportunityDecisionLevel;
  decision_label: string;
  summary: string;
  watch_conditions: string[];
  risk_factors: string[];
  evidence_events: OpportunityCompanyEvent[];
  evidence_news: OpportunityRawNews[];
  updated_at: string;
}

export interface OpportunityApiResponse {
  updated_at: string;
  summary: {
    total: number;
    strong_watch: number;
    pullback_candidate: number;
    risk_high: number;
  };
  groups: {
    strong_watch: OpportunityCardData[];
    pullback_candidate: OpportunityCardData[];
    risk_high: OpportunityCardData[];
    other: OpportunityCardData[];
  };
}
```

- [ ] **Step 4: Create deterministic seed data**

Create `lib/opportunity/seed.ts`:

```ts
import type {
  OpportunityCompanyEvent,
  OpportunityContextEntity,
  OpportunityCoreTarget,
  OpportunityIndicatorSnapshot,
  OpportunityRawNews,
} from './types';

const now = '2026-05-23T08:00:00.000Z';

export const seedCoreWatchlist: OpportunityCoreTarget[] = [
  {
    id: 1,
    symbol: 'MU',
    name: 'Micron Technology',
    market: 'US',
    asset_type: 'stock',
    theme: 'HBM / memory cycle',
    priority: 1,
    is_active: true,
    notes: '重点观察 HBM、DRAM、NAND 周期和三星认证进度。',
    created_at: now,
    updated_at: now,
  },
  {
    id: 2,
    symbol: 'NVDA',
    name: 'NVIDIA',
    market: 'US',
    asset_type: 'stock',
    theme: 'AI compute',
    priority: 1,
    is_active: true,
    notes: '观察数据中心需求、供应链约束和估值拥挤度。',
    created_at: now,
    updated_at: now,
  },
  {
    id: 3,
    symbol: 'AMD',
    name: 'Advanced Micro Devices',
    market: 'US',
    asset_type: 'stock',
    theme: 'AI accelerator competition',
    priority: 2,
    is_active: true,
    notes: '观察 MI 系列放量和与 NVDA 的竞争差距。',
    created_at: now,
    updated_at: now,
  },
  {
    id: 4,
    symbol: 'QQQ',
    name: 'Invesco QQQ Trust',
    market: 'US',
    asset_type: 'etf',
    theme: 'Nasdaq 100 beta',
    priority: 1,
    is_active: true,
    notes: '核心定投和市场温度标的。',
    created_at: now,
    updated_at: now,
  },
  {
    id: 5,
    symbol: 'SMH',
    name: 'VanEck Semiconductor ETF',
    market: 'US',
    asset_type: 'etf',
    theme: 'semiconductor basket',
    priority: 2,
    is_active: true,
    notes: '半导体主题拥挤度和趋势观察。',
    created_at: now,
    updated_at: now,
  },
];

export const seedContext: OpportunityContextEntity[] = [
  {
    id: 1,
    core_symbol: 'MU',
    related_symbol: null,
    related_name: 'Samsung Memory',
    market: 'GLOBAL',
    relation_type: 'competitor',
    relation_strength: 0.8,
    reason: 'Samsung HBM 认证进度影响 MU 的竞争格局和供需判断。',
    is_active: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: 2,
    core_symbol: 'MU',
    related_symbol: null,
    related_name: 'SK Hynix',
    market: 'GLOBAL',
    relation_type: 'competitor',
    relation_strength: 0.75,
    reason: 'SK Hynix 是 HBM 供给侧关键参照。',
    is_active: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: 3,
    core_symbol: 'MU',
    related_symbol: null,
    related_name: 'CXMT',
    market: 'CN',
    relation_type: 'industry_signal',
    relation_strength: 0.55,
    reason: '国产 DRAM 扩产影响长期供给叙事。',
    is_active: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: 4,
    core_symbol: 'NVDA',
    related_symbol: 'TSM',
    related_name: 'TSMC',
    market: 'US',
    relation_type: 'supplier',
    relation_strength: 0.85,
    reason: '先进封装与产能约束影响 NVDA 交付节奏。',
    is_active: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: 5,
    core_symbol: 'SMH',
    related_symbol: 'ASML',
    related_name: 'ASML',
    market: 'US',
    relation_type: 'etf_holding',
    relation_strength: 0.65,
    reason: 'ASML 订单影响半导体资本开支周期判断。',
    is_active: true,
    created_at: now,
    updated_at: now,
  },
];

export const seedRawNews: OpportunityRawNews[] = [
  {
    id: 1,
    source: 'seed',
    title: 'Micron highlights sustained HBM demand from AI server customers',
    summary:
      'Micron management says HBM demand remains stronger than planned and supply remains tight.',
    url: null,
    published_at: '2026-05-23T01:00:00.000Z',
    hash: 'seed-mu-hbm-demand-2026-05-23',
    raw_json: { source: 'seed' },
    created_at: now,
  },
  {
    id: 2,
    source: 'seed',
    title: 'Samsung HBM certification timeline reportedly slips again',
    summary:
      'A delay in Samsung HBM certification could keep near-term high-end supply tighter.',
    url: null,
    published_at: '2026-05-23T02:00:00.000Z',
    hash: 'seed-samsung-hbm-delay-2026-05-23',
    raw_json: { source: 'seed' },
    created_at: now,
  },
  {
    id: 3,
    source: 'seed',
    title: 'NVIDIA data center demand remains robust as cloud capex expands',
    summary:
      'Large cloud customers continue to expand AI infrastructure budgets.',
    url: null,
    published_at: '2026-05-23T03:00:00.000Z',
    hash: 'seed-nvda-demand-2026-05-23',
    raw_json: { source: 'seed' },
    created_at: now,
  },
  {
    id: 4,
    source: 'seed',
    title: 'AMD AI accelerator checks improve but competition remains intense',
    summary:
      'Channel checks suggest improving interest in AMD accelerators, with pricing pressure from incumbents.',
    url: null,
    published_at: '2026-05-23T04:00:00.000Z',
    hash: 'seed-amd-accelerator-2026-05-23',
    raw_json: { source: 'seed' },
    created_at: now,
  },
  {
    id: 5,
    source: 'seed',
    title: 'Semiconductor ETF momentum remains strong after rapid 20-day rally',
    summary:
      'SMH trend is strong, but short-term returns and volume show crowding risk.',
    url: null,
    published_at: '2026-05-23T05:00:00.000Z',
    hash: 'seed-smh-overheat-2026-05-23',
    raw_json: { source: 'seed' },
    created_at: now,
  },
];

export const seedCompanyEvents: OpportunityCompanyEvent[] = [
  {
    id: 1,
    symbol: 'MU',
    company_name: 'Micron Technology',
    theme: 'HBM / memory cycle',
    event_type: 'demand',
    event_direction: 'positive',
    importance_score: 86,
    event_summary: 'HBM demand remains strong and supply tight, supporting MU narrative.',
    evidence_news_ids: [1],
    published_at: '2026-05-23T01:00:00.000Z',
    raw_payload: { seed: true },
    created_at: now,
  },
  {
    id: 2,
    symbol: 'Samsung Memory',
    company_name: 'Samsung Memory',
    theme: 'HBM / memory cycle',
    event_type: 'competition',
    event_direction: 'positive',
    importance_score: 78,
    event_summary:
      'Samsung HBM certification delay may keep competitive supply pressure lower for MU.',
    evidence_news_ids: [2],
    published_at: '2026-05-23T02:00:00.000Z',
    raw_payload: { maps_to_core_symbol: 'MU', seed: true },
    created_at: now,
  },
  {
    id: 3,
    symbol: 'NVDA',
    company_name: 'NVIDIA',
    theme: 'AI compute',
    event_type: 'demand',
    event_direction: 'positive',
    importance_score: 88,
    event_summary: 'Cloud AI capex remains strong and supports NVDA demand.',
    evidence_news_ids: [3],
    published_at: '2026-05-23T03:00:00.000Z',
    raw_payload: { seed: true },
    created_at: now,
  },
  {
    id: 4,
    symbol: 'AMD',
    company_name: 'Advanced Micro Devices',
    theme: 'AI accelerator competition',
    event_type: 'product',
    event_direction: 'mixed',
    importance_score: 62,
    event_summary:
      'AMD accelerator interest improves, but competitive pressure remains high.',
    evidence_news_ids: [4],
    published_at: '2026-05-23T04:00:00.000Z',
    raw_payload: { seed: true },
    created_at: now,
  },
  {
    id: 5,
    symbol: 'SMH',
    company_name: 'VanEck Semiconductor ETF',
    theme: 'semiconductor basket',
    event_type: 'price_action',
    event_direction: 'mixed',
    importance_score: 70,
    event_summary:
      'SMH momentum is strong but recent gains raise short-term overheating risk.',
    evidence_news_ids: [5],
    published_at: '2026-05-23T05:00:00.000Z',
    raw_payload: { seed: true, overheat: true },
    created_at: now,
  },
];

export const seedIndicators: OpportunityIndicatorSnapshot[] = [
  {
    symbol: 'MU',
    close: 128,
    pct_change_5d: 3.2,
    pct_change_20d: 8.4,
    pct_from_ma500: 18.2,
    drawdown_1y: -7.6,
    volume_ratio: 1.15,
    risk_level: 'medium',
  },
  {
    symbol: 'NVDA',
    close: 1240,
    pct_change_5d: 7.8,
    pct_change_20d: 17.5,
    pct_from_ma500: 42.1,
    drawdown_1y: -2.1,
    volume_ratio: 1.55,
    risk_level: 'high',
  },
  {
    symbol: 'AMD',
    close: 176,
    pct_change_5d: 2.1,
    pct_change_20d: 5.2,
    pct_from_ma500: 11.4,
    drawdown_1y: -15.2,
    volume_ratio: 1.05,
    risk_level: 'medium',
  },
  {
    symbol: 'QQQ',
    close: 468,
    pct_change_5d: 1.7,
    pct_change_20d: 4.4,
    pct_from_ma500: 13.1,
    drawdown_1y: -4.5,
    volume_ratio: 0.96,
    risk_level: 'low',
  },
  {
    symbol: 'SMH',
    close: 244,
    pct_change_5d: 6.4,
    pct_change_20d: 15.6,
    pct_from_ma500: 27.8,
    drawdown_1y: -3.4,
    volume_ratio: 1.72,
    risk_level: 'high',
  },
];
```

- [ ] **Step 5: Run the seed data test**

Run:

```bash
npx jest __tests__/lib/opportunity/seed.test.ts --no-coverage
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/opportunity/types.ts lib/opportunity/seed.ts __tests__/lib/opportunity/seed.test.ts
git commit -m "feat: add opportunity seed data"
```

---

### Task 2: Scoring Helpers

**Files:**
- Create: `lib/opportunity/scoring.ts`
- Test: `__tests__/lib/opportunity/scoring.test.ts`

- [ ] **Step 1: Write the failing scoring tests**

Create `__tests__/lib/opportunity/scoring.test.ts`:

```ts
import {
  calcContextSignalScore,
  calcNewsScore,
  calcOpportunityScores,
  calcPricePositionScore,
  calcRiskScore,
  isPriceOverheated,
} from '@/lib/opportunity/scoring';
import { seedCompanyEvents, seedIndicators } from '@/lib/opportunity/seed';

describe('opportunity scoring', () => {
  it('positive direct events raise the news score', () => {
    const muEvent = seedCompanyEvents.find(event => event.symbol === 'MU');

    expect(calcNewsScore(muEvent ? [muEvent] : [])).toBeGreaterThanOrEqual(80);
  });

  it('context events can map back to a core target', () => {
    const samsungEvent = seedCompanyEvents.find(
      event => event.symbol === 'Samsung Memory',
    );

    expect(calcContextSignalScore(samsungEvent ? [samsungEvent] : [])).toBe(78);
  });

  it('high recent returns and distance from MA500 make price overheated', () => {
    const nvda = seedIndicators.find(indicator => indicator.symbol === 'NVDA');

    expect(nvda).toBeDefined();
    expect(isPriceOverheated(nvda!)).toBe(true);
    expect(calcPricePositionScore(nvda!)).toBeLessThan(50);
  });

  it('risk score is high for high-risk indicators', () => {
    const smh = seedIndicators.find(indicator => indicator.symbol === 'SMH');

    expect(smh).toBeDefined();
    expect(calcRiskScore(smh!)).toBeGreaterThanOrEqual(75);
  });

  it('combines component scores into a rounded total', () => {
    const mu = seedIndicators.find(indicator => indicator.symbol === 'MU');
    const directEvents = seedCompanyEvents.filter(event => event.symbol === 'MU');
    const contextEvents = seedCompanyEvents.filter(
      event => event.symbol === 'Samsung Memory',
    );

    const scores = calcOpportunityScores({
      indicator: mu!,
      directEvents,
      contextEvents,
    });

    expect(scores.news_score).toBeGreaterThan(80);
    expect(scores.context_signal_score).toBeGreaterThan(70);
    expect(Number.isInteger(scores.total_score)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx jest __tests__/lib/opportunity/scoring.test.ts --no-coverage
```

Expected: FAIL because `@/lib/opportunity/scoring` does not exist.

- [ ] **Step 3: Implement pure scoring helpers**

Create `lib/opportunity/scoring.ts`:

```ts
import type {
  OpportunityCompanyEvent,
  OpportunityIndicatorSnapshot,
  OpportunityScores,
} from './types';

interface CalcOpportunityScoresArgs {
  indicator: OpportunityIndicatorSnapshot;
  directEvents: OpportunityCompanyEvent[];
  contextEvents: OpportunityCompanyEvent[];
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[], fallback: number) {
  if (values.length === 0) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function isPriceOverheated(indicator: OpportunityIndicatorSnapshot) {
  return (
    (indicator.pct_change_20d != null && indicator.pct_change_20d >= 12) ||
    (indicator.pct_from_ma500 != null && indicator.pct_from_ma500 >= 25) ||
    (indicator.volume_ratio != null &&
      indicator.volume_ratio >= 1.5 &&
      indicator.drawdown_1y != null &&
      indicator.drawdown_1y > -5)
  );
}

export function calcNewsScore(events: OpportunityCompanyEvent[]) {
  const scores = events.map(event => {
    if (event.event_direction === 'positive') {
      return event.importance_score;
    }
    if (event.event_direction === 'mixed') {
      return event.importance_score * 0.75;
    }
    if (event.event_direction === 'negative') {
      return 100 - event.importance_score;
    }
    return 50;
  });

  return clamp(average(scores, 50));
}

export function calcContextSignalScore(events: OpportunityCompanyEvent[]) {
  const scores = events.map(event => {
    if (event.event_direction === 'positive') return event.importance_score;
    if (event.event_direction === 'mixed') return event.importance_score * 0.65;
    if (event.event_direction === 'negative') return 100 - event.importance_score;
    return 50;
  });

  return clamp(average(scores, 50));
}

export function calcPricePositionScore(indicator: OpportunityIndicatorSnapshot) {
  let score = 55;

  if (indicator.drawdown_1y != null && indicator.drawdown_1y <= -10) score += 15;
  if (indicator.drawdown_1y != null && indicator.drawdown_1y <= -20) score += 10;

  if (indicator.pct_from_ma500 != null && indicator.pct_from_ma500 <= 8) {
    score += 12;
  }
  if (indicator.pct_from_ma500 != null && indicator.pct_from_ma500 >= 18) {
    score -= 14;
  }
  if (indicator.pct_from_ma500 != null && indicator.pct_from_ma500 >= 30) {
    score -= 18;
  }

  if (indicator.pct_change_20d != null && indicator.pct_change_20d >= 10) {
    score -= 16;
  }
  if (indicator.pct_change_5d != null && indicator.pct_change_5d >= 8) {
    score -= 10;
  }

  return clamp(score);
}

export function calcRiskScore(indicator: OpportunityIndicatorSnapshot) {
  let risk = 20;

  if (indicator.risk_level === 'medium') risk += 20;
  if (indicator.risk_level === 'high') risk += 45;
  if (indicator.risk_level === 'extreme') risk += 70;

  if (indicator.pct_change_20d != null && indicator.pct_change_20d >= 12) {
    risk += 15;
  }
  if (indicator.pct_from_ma500 != null && indicator.pct_from_ma500 >= 25) {
    risk += 15;
  }
  if (indicator.volume_ratio != null && indicator.volume_ratio >= 1.5) {
    risk += 10;
  }

  return clamp(risk);
}

export function calcOpportunityScores({
  indicator,
  directEvents,
  contextEvents,
}: CalcOpportunityScoresArgs): OpportunityScores {
  const news_score = calcNewsScore(directEvents);
  const price_position_score = calcPricePositionScore(indicator);
  const context_signal_score = calcContextSignalScore(contextEvents);
  const risk_score = calcRiskScore(indicator);
  const total_score = clamp(
    0.35 * news_score +
      0.25 * price_position_score +
      0.2 * context_signal_score -
      0.2 * risk_score +
      20,
  );

  return {
    total_score,
    news_score,
    price_position_score,
    context_signal_score,
    risk_score,
  };
}
```

- [ ] **Step 4: Run the scoring test**

Run:

```bash
npx jest __tests__/lib/opportunity/scoring.test.ts --no-coverage
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/opportunity/scoring.ts __tests__/lib/opportunity/scoring.test.ts
git commit -m "feat: add opportunity scoring"
```

---

### Task 3: Decision and Grouping Logic

**Files:**
- Create: `lib/opportunity/decision.ts`
- Test: `__tests__/lib/opportunity/decision.test.ts`

- [ ] **Step 1: Write the failing decision tests**

Create `__tests__/lib/opportunity/decision.test.ts`:

```ts
import {
  buildOpportunityCards,
  deriveDecisionLevel,
  groupOpportunityCards,
  opportunityDecisionLabels,
} from '@/lib/opportunity/decision';
import {
  seedCompanyEvents,
  seedContext,
  seedCoreWatchlist,
  seedIndicators,
  seedRawNews,
} from '@/lib/opportunity/seed';

describe('opportunity decisions', () => {
  it('high risk overrides positive news', () => {
    expect(
      deriveDecisionLevel({
        total_score: 78,
        news_score: 88,
        price_position_score: 30,
        context_signal_score: 70,
        risk_score: 82,
      }),
    ).toBe('risk_high');
  });

  it('overheated strong news becomes a pullback candidate', () => {
    expect(
      deriveDecisionLevel({
        total_score: 72,
        news_score: 86,
        price_position_score: 35,
        context_signal_score: 78,
        risk_score: 58,
      }),
    ).toBe('pullback_candidate');
  });

  it('balanced strong setups can become small probe candidates', () => {
    expect(
      deriveDecisionLevel({
        total_score: 78,
        news_score: 84,
        price_position_score: 72,
        context_signal_score: 68,
        risk_score: 38,
      }),
    ).toBe('small_probe');
  });

  it('provides Chinese labels for each decision level', () => {
    expect(opportunityDecisionLabels.risk_high).toBe('风险过高');
    expect(opportunityDecisionLabels.pullback_candidate).toBe('回调买入候选');
  });

  it('builds one card per core target and excludes context entities as cards', () => {
    const cards = buildOpportunityCards({
      coreTargets: seedCoreWatchlist,
      context: seedContext,
      events: seedCompanyEvents,
      indicators: seedIndicators,
      rawNews: seedRawNews,
    });

    expect(cards.map(card => card.symbol).sort()).toEqual([
      'AMD',
      'MU',
      'NVDA',
      'QQQ',
      'SMH',
    ]);
    expect(cards.some(card => card.symbol === 'Samsung Memory')).toBe(false);
  });

  it('groups cards by decision level', () => {
    const cards = buildOpportunityCards({
      coreTargets: seedCoreWatchlist,
      context: seedContext,
      events: seedCompanyEvents,
      indicators: seedIndicators,
      rawNews: seedRawNews,
    });
    const grouped = groupOpportunityCards(cards);

    expect(grouped.summary.total).toBe(cards.length);
    expect(grouped.groups.pullback_candidate.length).toBeGreaterThanOrEqual(1);
    expect(grouped.groups.risk_high.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx jest __tests__/lib/opportunity/decision.test.ts --no-coverage
```

Expected: FAIL because `@/lib/opportunity/decision` does not exist.

- [ ] **Step 3: Implement decision and grouping helpers**

Create `lib/opportunity/decision.ts`:

```ts
import { calcOpportunityScores } from './scoring';
import type {
  OpportunityApiResponse,
  OpportunityCardData,
  OpportunityCompanyEvent,
  OpportunityContextEntity,
  OpportunityCoreTarget,
  OpportunityDecisionLevel,
  OpportunityIndicatorSnapshot,
  OpportunityRawNews,
  OpportunityScores,
} from './types';

interface BuildOpportunityCardsArgs {
  coreTargets: OpportunityCoreTarget[];
  context: OpportunityContextEntity[];
  events: OpportunityCompanyEvent[];
  indicators: OpportunityIndicatorSnapshot[];
  rawNews: OpportunityRawNews[];
}

export const opportunityDecisionLabels: Record<
  OpportunityDecisionLevel,
  string
> = {
  small_probe: '可小仓试探',
  pullback_candidate: '回调买入候选',
  strong_watch: '继续强关注',
  breakout_confirm: '突破确认观察',
  post_earnings_wait: '财报后再判断',
  risk_high: '风险过高',
};

export function deriveDecisionLevel(
  scores: OpportunityScores,
): OpportunityDecisionLevel {
  if (scores.risk_score >= 75) return 'risk_high';
  if (scores.news_score >= 70 && scores.price_position_score < 45) {
    return 'pullback_candidate';
  }
  if (scores.total_score >= 75 && scores.risk_score < 50) {
    return 'small_probe';
  }
  if (scores.news_score >= 70 || scores.context_signal_score >= 70) {
    return 'strong_watch';
  }
  if (scores.total_score >= 55) return 'breakout_confirm';
  return 'post_earnings_wait';
}

function getDirectEvents(target: OpportunityCoreTarget, events: OpportunityCompanyEvent[]) {
  return events.filter(event => event.symbol === target.symbol);
}

function getContextEvents(
  target: OpportunityCoreTarget,
  context: OpportunityContextEntity[],
  events: OpportunityCompanyEvent[],
) {
  const relatedNames = new Set(
    context
      .filter(item => item.core_symbol === target.symbol && item.is_active)
      .map(item => item.related_name),
  );
  const relatedSymbols = new Set(
    context
      .filter(item => item.core_symbol === target.symbol && item.is_active)
      .map(item => item.related_symbol)
      .filter(Boolean),
  );

  return events.filter(
    event => relatedNames.has(event.symbol) || relatedSymbols.has(event.symbol),
  );
}

function getEvidenceNews(
  events: OpportunityCompanyEvent[],
  rawNews: OpportunityRawNews[],
) {
  const evidenceIds = new Set(events.flatMap(event => event.evidence_news_ids));
  return rawNews.filter(news => evidenceIds.has(news.id));
}

function buildSummary(
  target: OpportunityCoreTarget,
  decision_level: OpportunityDecisionLevel,
  scores: OpportunityScores,
) {
  if (decision_level === 'risk_high') {
    return `${target.symbol} 的主题仍值得跟踪，但当前风险分 ${scores.risk_score} 偏高，优先控制追高风险。`;
  }
  if (decision_level === 'pullback_candidate') {
    return `${target.symbol} 的事件和产业信号较强，但价格位置不够舒服，适合等待回调或确认。`;
  }
  if (decision_level === 'small_probe') {
    return `${target.symbol} 的新闻、价格和风险组合较均衡，可以进入小仓试探观察清单。`;
  }
  if (decision_level === 'strong_watch') {
    return `${target.symbol} 的叙事正在增强，当前更适合强关注而不是直接追高。`;
  }
  if (decision_level === 'breakout_confirm') {
    return `${target.symbol} 有改善迹象，但证据强度还不够，需要继续观察突破确认。`;
  }
  return `${target.symbol} 的关键事件风险尚未释放，适合等财报或指引后再判断。`;
}

function buildWatchConditions(decision_level: OpportunityDecisionLevel) {
  if (decision_level === 'risk_high') {
    return ['等待 20 日涨幅降温', '等待风险等级回落', '不在高波动日主动加仓'];
  }
  if (decision_level === 'pullback_candidate') {
    return ['等待接近 MA500 或 10% 以上回撤', '观察正面事件是否持续', '确认成交量不过热'];
  }
  if (decision_level === 'small_probe') {
    return ['保持风险分低于 50', '确认核心事件没有反转', '用小仓位分批观察'];
  }
  return ['等待更多证据新闻', '观察价格能否站稳关键均线', '复查同主题标的是否同步走强'];
}

function buildRiskFactors(scores: OpportunityScores) {
  const factors: string[] = [];
  if (scores.risk_score >= 75) factors.push('风险分过高，追高容错率低');
  if (scores.price_position_score < 45) factors.push('价格位置偏高或短期涨幅过大');
  if (scores.news_score < 60) factors.push('直接正面事件证据不足');
  if (factors.length === 0) factors.push('主要风险是事件持续性和市场整体波动');
  return factors;
}

export function buildOpportunityCards({
  coreTargets,
  context,
  events,
  indicators,
  rawNews,
}: BuildOpportunityCardsArgs): OpportunityCardData[] {
  return coreTargets
    .filter(target => target.is_active)
    .map(target => {
      const indicator = indicators.find(item => item.symbol === target.symbol);
      if (!indicator) return null;

      const directEvents = getDirectEvents(target, events);
      const contextEvents = getContextEvents(target, context, events);
      const evidenceEvents = [...directEvents, ...contextEvents];
      const scores = calcOpportunityScores({
        indicator,
        directEvents,
        contextEvents,
      });
      const decision_level = deriveDecisionLevel(scores);
      const evidence_news = getEvidenceNews(evidenceEvents, rawNews);

      return {
        symbol: target.symbol,
        company_name: target.name,
        asset_type: target.asset_type,
        market: target.market,
        theme: target.theme,
        decision_level,
        decision_label: opportunityDecisionLabels[decision_level],
        ...scores,
        summary: buildSummary(target, decision_level, scores),
        watch_conditions: buildWatchConditions(decision_level),
        risk_factors: buildRiskFactors(scores),
        evidence_events: evidenceEvents,
        evidence_news,
        updated_at: target.updated_at,
      };
    })
    .filter((card): card is OpportunityCardData => card !== null)
    .sort((a, b) => b.total_score - a.total_score);
}

export function groupOpportunityCards(
  cards: OpportunityCardData[],
): OpportunityApiResponse {
  const groups = {
    strong_watch: cards.filter(card => card.decision_level === 'strong_watch'),
    pullback_candidate: cards.filter(
      card => card.decision_level === 'pullback_candidate',
    ),
    risk_high: cards.filter(card => card.decision_level === 'risk_high'),
    other: cards.filter(
      card =>
        card.decision_level !== 'strong_watch' &&
        card.decision_level !== 'pullback_candidate' &&
        card.decision_level !== 'risk_high',
    ),
  };

  return {
    updated_at:
      cards[0]?.updated_at ?? new Date('2026-05-23T08:00:00.000Z').toISOString(),
    summary: {
      total: cards.length,
      strong_watch: groups.strong_watch.length,
      pullback_candidate: groups.pullback_candidate.length,
      risk_high: groups.risk_high.length,
    },
    groups,
  };
}
```

- [ ] **Step 4: Run the decision test**

Run:

```bash
npx jest __tests__/lib/opportunity/decision.test.ts --no-coverage
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/opportunity/decision.ts __tests__/lib/opportunity/decision.test.ts
git commit -m "feat: add opportunity decisions"
```

---

### Task 4: API and Supabase Hook Point

**Files:**
- Create: `lib/supabase/opportunity.ts`
- Create: `app/api/opportunity/route.ts`
- Test: `__tests__/api/opportunity.test.ts`

- [ ] **Step 1: Write the failing API tests**

Create `__tests__/api/opportunity.test.ts`:

```ts
import { GET } from '@/app/api/opportunity/route';

describe('GET /api/opportunity', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'placeholder',
      SUPABASE_SERVICE_ROLE_KEY: 'placeholder',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns grouped seed opportunity data when Supabase is not configured', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary.total).toBe(5);
    expect(body.groups.pullback_candidate.length).toBeGreaterThanOrEqual(1);
    expect(body.groups.risk_high.length).toBeGreaterThanOrEqual(1);
  });

  it('does not expose context entities as recommendation cards', async () => {
    const response = await GET();
    const body = await response.json();
    const allSymbols = [
      ...body.groups.strong_watch,
      ...body.groups.pullback_candidate,
      ...body.groups.risk_high,
      ...body.groups.other,
    ].map((card: { symbol: string }) => card.symbol);

    expect(allSymbols).toContain('MU');
    expect(allSymbols).not.toContain('Samsung Memory');
    expect(allSymbols).not.toContain('CXMT');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx jest __tests__/api/opportunity.test.ts --no-coverage
```

Expected: FAIL because `@/app/api/opportunity/route` does not exist.

- [ ] **Step 3: Implement the Supabase opportunity helper with seed fallback**

Create `lib/supabase/opportunity.ts`:

```ts
import { createClient } from '@supabase/supabase-js';
import {
  seedCompanyEvents,
  seedContext,
  seedCoreWatchlist,
  seedIndicators,
  seedRawNews,
} from '@/lib/opportunity/seed';
import { buildOpportunityCards, groupOpportunityCards } from '@/lib/opportunity/decision';
import type { OpportunityApiResponse } from '@/lib/opportunity/types';

function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder') &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('placeholder'),
  );
}

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export function getSeedOpportunityData(): OpportunityApiResponse {
  const cards = buildOpportunityCards({
    coreTargets: seedCoreWatchlist,
    context: seedContext,
    events: seedCompanyEvents,
    indicators: seedIndicators,
    rawNews: seedRawNews,
  });

  return groupOpportunityCards(cards);
}

export async function getOpportunityData(): Promise<OpportunityApiResponse> {
  if (!hasSupabaseConfig()) {
    return getSeedOpportunityData();
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('opportunity_decision')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data || data.length === 0) {
    return getSeedOpportunityData();
  }

  return getSeedOpportunityData();
}
```

The helper intentionally falls back to seed data even when Supabase exists but the MVP tables are empty. Mapping real Supabase rows can be added after the seed UI proves useful.

- [ ] **Step 4: Implement the API route**

Create `app/api/opportunity/route.ts`:

```ts
import { NextResponse } from 'next/server';
import {
  getOpportunityData,
  getSeedOpportunityData,
} from '@/lib/supabase/opportunity';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getOpportunityData();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[/api/opportunity]', error);
    const data = getSeedOpportunityData();
    return NextResponse.json(data);
  }
}
```

- [ ] **Step 5: Run the API test**

Run:

```bash
npx jest __tests__/api/opportunity.test.ts --no-coverage
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/opportunity.ts app/api/opportunity/route.ts __tests__/api/opportunity.test.ts
git commit -m "feat: add opportunity API"
```

---

### Task 5: Opportunity UI Components

**Files:**
- Create: `components/opportunity/OpportunitySummaryBar.tsx`
- Create: `components/opportunity/OpportunityCard.tsx`
- Create: `components/opportunity/OpportunityGroup.tsx`
- Test: `__tests__/components/OpportunityCard.test.tsx`
- Test: `__tests__/components/OpportunityGroup.test.tsx`

- [ ] **Step 1: Write the failing component tests**

Create `__tests__/components/OpportunityCard.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { buildOpportunityCards } from '@/lib/opportunity/decision';
import {
  seedCompanyEvents,
  seedContext,
  seedCoreWatchlist,
  seedIndicators,
  seedRawNews,
} from '@/lib/opportunity/seed';
import { OpportunityCard } from '@/components/opportunity/OpportunityCard';

const cards = buildOpportunityCards({
  coreTargets: seedCoreWatchlist,
  context: seedContext,
  events: seedCompanyEvents,
  indicators: seedIndicators,
  rawNews: seedRawNews,
});

describe('OpportunityCard', () => {
  it('renders decision label, scores, watch conditions, and risks', () => {
    const mu = cards.find(card => card.symbol === 'MU')!;

    render(<OpportunityCard card={mu} />);

    expect(screen.getByText('MU')).toBeInTheDocument();
    expect(screen.getByText(mu.decision_label)).toBeInTheDocument();
    expect(screen.getByText(/总分/)).toBeInTheDocument();
    expect(screen.getByText(mu.watch_conditions[0])).toBeInTheDocument();
    expect(screen.getByText(mu.risk_factors[0])).toBeInTheDocument();
  });

  it('expands evidence news', () => {
    const mu = cards.find(card => card.symbol === 'MU')!;

    render(<OpportunityCard card={mu} />);
    fireEvent.click(screen.getByRole('button', { name: /证据/ }));

    expect(screen.getByText(/Micron highlights sustained HBM/)).toBeInTheDocument();
  });
});
```

Create `__tests__/components/OpportunityGroup.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { buildOpportunityCards } from '@/lib/opportunity/decision';
import {
  seedCompanyEvents,
  seedContext,
  seedCoreWatchlist,
  seedIndicators,
  seedRawNews,
} from '@/lib/opportunity/seed';
import { OpportunityGroup } from '@/components/opportunity/OpportunityGroup';

const cards = buildOpportunityCards({
  coreTargets: seedCoreWatchlist,
  context: seedContext,
  events: seedCompanyEvents,
  indicators: seedIndicators,
  rawNews: seedRawNews,
});

describe('OpportunityGroup', () => {
  it('renders cards in a group', () => {
    render(<OpportunityGroup title="回调买入候选" cards={cards.slice(0, 2)} />);

    expect(screen.getByText('回调买入候选')).toBeInTheDocument();
    expect(screen.getAllByText(/总分/).length).toBe(2);
  });

  it('renders a compact empty state', () => {
    render(<OpportunityGroup title="风险过高" cards={[]} />);

    expect(screen.getByText('暂无匹配标的')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npx jest __tests__/components/OpportunityCard.test.tsx __tests__/components/OpportunityGroup.test.tsx --no-coverage
```

Expected: FAIL because the opportunity components do not exist.

- [ ] **Step 3: Implement the summary bar**

Create `components/opportunity/OpportunitySummaryBar.tsx`:

```tsx
import type { OpportunityApiResponse } from '@/lib/opportunity/types';

interface OpportunitySummaryBarProps {
  data: OpportunityApiResponse;
}

export function OpportunitySummaryBar({ data }: OpportunitySummaryBarProps) {
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
        <p className="text-xs text-[var(--muted)]">活跃机会</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--text)]">
          {data.summary.total}
        </p>
      </div>
      <div className="rounded-lg border border-green-400/20 bg-green-400/5 p-3">
        <p className="text-xs text-[var(--muted)]">强关注</p>
        <p className="mt-1 text-2xl font-semibold text-green-400">
          {data.summary.strong_watch}
        </p>
      </div>
      <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3">
        <p className="text-xs text-[var(--muted)]">回调候选</p>
        <p className="mt-1 text-2xl font-semibold text-amber-400">
          {data.summary.pullback_candidate}
        </p>
      </div>
      <div className="rounded-lg border border-red-400/20 bg-red-400/5 p-3">
        <p className="text-xs text-[var(--muted)]">风险过高</p>
        <p className="mt-1 text-2xl font-semibold text-red-400">
          {data.summary.risk_high}
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Implement the opportunity card**

Create `components/opportunity/OpportunityCard.tsx`:

```tsx
'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { OpportunityCardData } from '@/lib/opportunity/types';

interface OpportunityCardProps {
  card: OpportunityCardData;
}

const decisionTone: Record<string, string> = {
  small_probe: 'border-green-400/20 bg-green-400/10 text-green-400',
  pullback_candidate: 'border-amber-400/20 bg-amber-400/10 text-amber-400',
  strong_watch: 'border-sky-400/20 bg-sky-400/10 text-sky-400',
  breakout_confirm: 'border-indigo-400/20 bg-indigo-400/10 text-indigo-400',
  post_earnings_wait: 'border-gray-400/20 bg-gray-400/10 text-gray-400',
  risk_high: 'border-red-400/20 bg-red-400/10 text-red-400',
};

function ScoreChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)]">
      {label}
      <span className="font-semibold text-[var(--text)]">{value}</span>
    </span>
  );
}

export function OpportunityCard({ card }: OpportunityCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-[var(--text)]">
              {card.symbol}
            </h3>
            <span className="text-sm text-[var(--muted)]">
              {card.company_name}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${decisionTone[card.decision_level]}`}
            >
              {card.decision_label}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">{card.theme}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs text-[var(--muted)]">总分</p>
          <p className="text-2xl font-semibold tabular-nums text-[var(--text)]">
            {card.total_score}
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
        {card.summary}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <ScoreChip label="新闻" value={card.news_score} />
        <ScoreChip label="位置" value={card.price_position_score} />
        <ScoreChip label="关联" value={card.context_signal_score} />
        <ScoreChip label="风险" value={card.risk_score} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
            观察条件
          </p>
          <ul className="space-y-1 text-sm text-[var(--text)]">
            {card.watch_conditions.map(condition => (
              <li key={condition}>{condition}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
            风险因素
          </p>
          <ul className="space-y-1 text-sm text-[var(--text)]">
            {card.risk_factors.map(factor => (
              <li key={factor}>{factor}</li>
            ))}
          </ul>
        </div>
      </div>

      {card.evidence_news.length > 0 && (
        <div className="mt-4 border-t border-[var(--border)] pt-3">
          <button
            type="button"
            onClick={() => setExpanded(value => !value)}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)]"
          >
            <ChevronDown
              size={14}
              className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'}
              aria-hidden="true"
            />
            证据 {card.evidence_news.length}
          </button>
          {expanded && (
            <ul className="mt-3 space-y-2">
              {card.evidence_news.map(news => (
                <li key={news.id}>
                  <p className="text-sm font-medium text-[var(--text)]">
                    {news.title}
                  </p>
                  <p className="text-xs text-[var(--muted)]">{news.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}
```

- [ ] **Step 5: Implement the opportunity group**

Create `components/opportunity/OpportunityGroup.tsx`:

```tsx
import type { OpportunityCardData } from '@/lib/opportunity/types';
import { OpportunityCard } from './OpportunityCard';

interface OpportunityGroupProps {
  title: string;
  cards: OpportunityCardData[];
}

export function OpportunityGroup({ title, cards }: OpportunityGroupProps) {
  return (
    <section aria-labelledby={`${title}-title`} className="space-y-3">
      <div className="flex items-center justify-between">
        <h2
          id={`${title}-title`}
          className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]"
        >
          {title}
        </h2>
        <span className="text-xs text-[var(--muted)]">{cards.length}</span>
      </div>
      {cards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
          暂无匹配标的
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {cards.map(card => (
            <OpportunityCard key={card.symbol} card={card} />
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Run the component tests**

Run:

```bash
npx jest __tests__/components/OpportunityCard.test.tsx __tests__/components/OpportunityGroup.test.tsx --no-coverage
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/opportunity/OpportunitySummaryBar.tsx components/opportunity/OpportunityCard.tsx components/opportunity/OpportunityGroup.tsx __tests__/components/OpportunityCard.test.tsx __tests__/components/OpportunityGroup.test.tsx
git commit -m "feat: add opportunity cards"
```

---

### Task 6: Opportunity Page and Navigation

**Files:**
- Create: `app/opportunity/page.tsx`
- Modify: `components/layout/Navbar.tsx`
- Test: `__tests__/app/opportunity-page.test.tsx`

- [ ] **Step 1: Write the failing page test**

Create `__tests__/app/opportunity-page.test.tsx`:

```tsx
import OpportunityPage from '@/app/opportunity/page';
import { getOpportunityData } from '@/lib/supabase/opportunity';
import { OpportunitySummaryBar } from '@/components/opportunity/OpportunitySummaryBar';
import { OpportunityGroup } from '@/components/opportunity/OpportunityGroup';
import type { ReactElement } from 'react';

jest.mock('@/lib/supabase/opportunity', () => ({
  getOpportunityData: jest.fn(),
}));

jest.mock('@/components/opportunity/OpportunitySummaryBar', () => ({
  OpportunitySummaryBar: () => <div data-testid="opportunity-summary" />,
}));

jest.mock('@/components/opportunity/OpportunityGroup', () => ({
  OpportunityGroup: () => <div data-testid="opportunity-group" />,
}));

describe('OpportunityPage', () => {
  it('renders summary and grouped opportunity sections', async () => {
    (getOpportunityData as jest.Mock).mockResolvedValue({
      updated_at: '2026-05-23T08:00:00.000Z',
      summary: {
        total: 5,
        strong_watch: 1,
        pullback_candidate: 2,
        risk_high: 1,
      },
      groups: {
        strong_watch: [],
        pullback_candidate: [],
        risk_high: [],
        other: [],
      },
    });

    const page = (await OpportunityPage()) as ReactElement;
    const children = page.props.children as ReactElement[];

    expect(children.some(child => child.type === OpportunitySummaryBar)).toBe(
      true,
    );
    expect(children.filter(child => child.type === OpportunityGroup).length).toBe(
      4,
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx jest __tests__/app/opportunity-page.test.tsx --no-coverage
```

Expected: FAIL because `@/app/opportunity/page` does not exist.

- [ ] **Step 3: Implement the page**

Create `app/opportunity/page.tsx`:

```tsx
import { OpportunityGroup } from '@/components/opportunity/OpportunityGroup';
import { OpportunitySummaryBar } from '@/components/opportunity/OpportunitySummaryBar';
import { getOpportunityData } from '@/lib/supabase/opportunity';

export const dynamic = 'force-dynamic';

export default async function OpportunityPage() {
  const data = await getOpportunityData();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
          Opportunity Radar
        </p>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
            自选机会雷达
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            只围绕核心关注池输出机会判断，关联公司仅作为证据信号。
          </p>
        </div>
        <p className="text-xs text-[var(--muted)]">
          更新时间 {new Date(data.updated_at).toLocaleString('zh-CN')}
        </p>
      </header>

      <OpportunitySummaryBar data={data} />

      <OpportunityGroup title="回调买入候选" cards={data.groups.pullback_candidate} />
      <OpportunityGroup title="继续强关注" cards={data.groups.strong_watch} />
      <OpportunityGroup title="风险过高" cards={data.groups.risk_high} />
      <OpportunityGroup title="其他观察" cards={data.groups.other} />
    </div>
  );
}
```

- [ ] **Step 4: Add navigation link**

Modify `components/layout/Navbar.tsx` by adding this link next to the watchlist link:

```tsx
<Link href="/opportunity" className="hover:text-[var(--text)] transition-colors">
  机会雷达
</Link>
```

Keep existing links and disabled items in place.

- [ ] **Step 5: Run the page test**

Run:

```bash
npx jest __tests__/app/opportunity-page.test.tsx --no-coverage
```

Expected: PASS.

- [ ] **Step 6: Run an HTTP smoke check**

Start dev server if one is not running:

```bash
npm run dev
```

Then in another terminal:

```powershell
$res = Invoke-WebRequest -Uri http://localhost:3000/opportunity -UseBasicParsing
$res.StatusCode
$res.Content.Contains('自选机会雷达')
$res.Content.Contains('MU')
```

Expected:

```text
200
True
True
```

- [ ] **Step 7: Commit**

```bash
git add app/opportunity/page.tsx components/layout/Navbar.tsx __tests__/app/opportunity-page.test.tsx
git commit -m "feat: add opportunity page"
```

---

### Task 7: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused opportunity tests**

Run:

```bash
npx jest __tests__/lib/opportunity/seed.test.ts __tests__/lib/opportunity/scoring.test.ts __tests__/lib/opportunity/decision.test.ts __tests__/api/opportunity.test.ts __tests__/components/OpportunityCard.test.tsx __tests__/components/OpportunityGroup.test.tsx __tests__/app/opportunity-page.test.tsx --no-coverage
```

Expected: PASS for all listed suites.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test -- --no-coverage
```

Expected: PASS. If the existing `calcTotalScore` lint warning remains, do not change it in this task unless it causes a failure.

- [ ] **Step 3: Run TypeScript**

Run:

```bash
npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 4: Run lint**

Run:

```bash
npm run lint
```

Expected: exit code 0. A pre-existing warning in `__tests__/lib/recommendation-engine.test.ts` may appear; do not mix that cleanup into the opportunity MVP.

- [ ] **Step 5: Run production build**

Run:

```bash
npm run build
```

Expected: build succeeds and the route list includes `/opportunity` and `/api/opportunity`.

- [ ] **Step 6: Check git status**

Run:

```bash
git status --short
```

Expected: clean working tree.
