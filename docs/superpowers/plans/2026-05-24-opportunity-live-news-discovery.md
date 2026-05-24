# Opportunity Live News Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the seed-only opportunity backend with a real-news Finnhub + DeepSeek pipeline while keeping opportunity cards embedded in the dashboard and preserving seed fallback for local development.

**Architecture:** Add focused opportunity ingestion modules for dedupe, filtering, LLM JSON handling, event extraction, candidate validation, Supabase persistence, and a script entry point. Existing `lib/opportunity/scoring.ts`, `lib/opportunity/decision.ts`, `app/api/opportunity/route.ts`, and dashboard components remain the presentation and grouping layer.

**Tech Stack:** Next.js 16.2.6 App Router, TypeScript, Jest, Supabase JS, Finnhub REST API, OpenAI-compatible DeepSeek chat completions through the existing `LLM_*` environment variables.

---

## File Structure

Create:

- `lib/opportunity/news-dedupe.ts` - normalize titles/URLs, create stable hashes, dedupe fetched news.
- `lib/opportunity/news-filter.ts` - keep only news that matches core targets, context entities, or theme keywords.
- `lib/opportunity/llm-json.ts` - parse strict/fenced JSON and perform one repair retry.
- `lib/opportunity/event-extraction.ts` - build DeepSeek event prompts and map valid JSON into event drafts.
- `lib/opportunity/candidate-validation.ts` - validate `new_company_mentions` with LLM output plus hard rules.
- `lib/opportunity/pipeline.ts` - orchestrate fetch, dedupe, filter, extract, persist, and recompute decisions.
- `lib/supabase/opportunity-ingestion.ts` - server-only Supabase read/write helpers for new tables and latest decisions.
- `scripts/fetch-opportunity-news.ts` - local/cron script entry point.
- `__tests__/lib/opportunity/news-dedupe.test.ts`
- `__tests__/lib/opportunity/news-filter.test.ts`
- `__tests__/lib/opportunity/llm-json.test.ts`
- `__tests__/lib/opportunity/event-extraction.test.ts`
- `__tests__/lib/opportunity/candidate-validation.test.ts`
- `__tests__/lib/supabase/opportunity-ingestion.test.ts`
- `__tests__/lib/opportunity/pipeline.test.ts`

Modify:

- `lib/opportunity/types.ts` - add ingestion, extracted event, candidate, and persisted decision types.
- `lib/llm/client.ts` - expose model name helper and optionally allow injected `chatCompletion` in tests without changing existing callers.
- `lib/supabase/opportunity.ts` - read persisted decisions first, fallback to seed.
- `app/api/opportunity/route.ts` - keep route behavior; only adjust if needed for updated helper.
- `supabase/schema.sql` - add opportunity engine tables and indexes.
- Existing tests under `__tests__/api/opportunity.test.ts` and `__tests__/lib/opportunity/decision.test.ts` if response shape requires minor assertions.

Before changing `app/api/opportunity/route.ts`, run:

```powershell
Get-ChildItem -Recurse node_modules\next\dist\docs | Select-String -Pattern "route handler","NextResponse","force-dynamic" -List
```

Use the relevant local Next.js 16.2.6 docs from `node_modules/next/dist/docs/` if the route needs API changes.

---

### Task 1: Database Schema and Shared Types

**Files:**

- Modify: `supabase/schema.sql`
- Modify: `lib/opportunity/types.ts`

- [ ] **Step 1: Write the failing type/schema test**

Create `__tests__/lib/opportunity/types-contract.test.ts`:

```ts
import type {
  CandidateValidationDecision,
  DiscoveredCandidate,
  ExtractedOpportunityEvent,
  OpportunityPipelineRawNews,
  PersistedOpportunityDecision,
} from '@/lib/opportunity/types';

describe('opportunity ingestion type contracts', () => {
  it('supports LLM extraction audit fields', () => {
    const event: ExtractedOpportunityEvent = {
      is_relevant: true,
      related_core_symbols: ['MU'],
      related_context_entities: ['Samsung Memory'],
      theme: 'HBM / memory cycle',
      event_type: 'competition',
      event_direction: 'positive',
      importance_score: 82,
      summary: 'Samsung HBM delay supports MU context signal.',
      key_facts: ['Samsung HBM certification slipped.'],
      positive_factors: ['Tighter HBM supply may support MU.'],
      negative_factors: [],
      supply_chain_mentions: ['Samsung Memory'],
      new_company_mentions: [],
      uncertainty: [],
      evidence: [{ text: 'Samsung HBM certification slipped', reason: 'title evidence' }],
      raw_llm_json: { is_relevant: true },
      llm_input_summary: 'Samsung HBM certification slipped',
      llm_model: 'deepseek-chat',
    };

    expect(event.llm_model).toBe('deepseek-chat');
  });

  it('supports candidate auto-confirm decisions', () => {
    const decision: CandidateValidationDecision = {
      decision: 'add_context',
      confidence: 0.86,
      name: 'Samsung Electronics',
      symbol: '005930.KS',
      market: 'KR',
      theme: 'HBM / memory cycle',
      related_core_symbol: 'MU',
      relation_type: 'competitor',
      reason: 'Samsung is a recurring HBM competitor signal for MU.',
      evidence_news_ids: [2],
      risk_notes: ['Foreign ticker may not have market data.'],
    };

    expect(decision.decision).toBe('add_context');
  });

  it('supports persisted raw news and decision rows', () => {
    const news: OpportunityPipelineRawNews = {
      id: 1,
      source: 'finnhub',
      source_type: 'company_news',
      title: 'Micron highlights HBM demand',
      summary: 'Demand remains strong.',
      content: null,
      url: 'https://example.com/mu',
      published_at: '2026-05-24T00:00:00.000Z',
      fetched_at: '2026-05-24T01:00:00.000Z',
      hash: 'hash',
      lang: 'en',
      raw_json: {},
      created_at: '2026-05-24T01:00:00.000Z',
    };
    const decision: PersistedOpportunityDecision = {
      id: 1,
      symbol: 'MU',
      market: 'US',
      company_name: 'Micron Technology',
      asset_type: 'stock',
      theme: 'HBM / memory cycle',
      decision_level: 'strong_watch',
      total_score: 75,
      news_score: 85,
      price_position_score: 55,
      context_signal_score: 78,
      risk_score: 42,
      summary: 'MU remains a strong watch.',
      watch_conditions: ['Confirm HBM demand persists.'],
      risk_factors: ['Price may be extended.'],
      evidence_event_ids: [1],
      created_at: '2026-05-24T01:00:00.000Z',
    };

    expect(news.hash).toBe('hash');
    expect(decision.symbol).toBe('MU');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- __tests__/lib/opportunity/types-contract.test.ts
```

Expected: FAIL because the exported type names do not exist.

- [ ] **Step 3: Add schema and types**

Append schema definitions to `supabase/schema.sql` after existing tables:

```sql
CREATE TABLE IF NOT EXISTS watchlist_core (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  market TEXT NOT NULL,
  exchange TEXT,
  asset_type TEXT NOT NULL,
  theme TEXT NOT NULL,
  priority INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, market, asset_type)
);

CREATE TABLE IF NOT EXISTS watchlist_context (
  id BIGSERIAL PRIMARY KEY,
  core_symbol TEXT NOT NULL,
  related_symbol TEXT,
  related_name TEXT NOT NULL,
  market TEXT NOT NULL DEFAULT 'GLOBAL',
  relation_type TEXT NOT NULL,
  relation_strength NUMERIC DEFAULT 0.5,
  reason TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
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
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  hash TEXT UNIQUE NOT NULL,
  lang TEXT,
  raw_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_event (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT,
  market TEXT,
  company_name TEXT,
  theme TEXT,
  event_type TEXT,
  event_direction TEXT CHECK (event_direction IN ('positive', 'neutral', 'negative', 'mixed')),
  importance_score NUMERIC,
  event_summary TEXT,
  evidence_news_ids BIGINT[],
  published_at TIMESTAMPTZ,
  raw_llm_json JSONB DEFAULT '{}'::jsonb,
  llm_input_summary TEXT,
  llm_model TEXT,
  extraction_status TEXT DEFAULT 'ok',
  extraction_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opportunity_decision (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  market TEXT NOT NULL,
  company_name TEXT,
  asset_type TEXT,
  theme TEXT,
  decision_level TEXT,
  total_score NUMERIC,
  news_score NUMERIC,
  price_position_score NUMERIC,
  context_signal_score NUMERIC,
  risk_score NUMERIC,
  summary TEXT,
  watch_conditions JSONB DEFAULT '[]'::jsonb,
  risk_factors JSONB DEFAULT '[]'::jsonb,
  evidence_event_ids BIGINT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS discovered_candidates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT,
  market TEXT,
  theme TEXT,
  discovered_from TEXT,
  related_to_symbol TEXT,
  relation_type TEXT,
  reason TEXT,
  mention_count INT DEFAULT 1,
  importance_score NUMERIC DEFAULT 0,
  confidence NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending_ai_review',
  ai_decision TEXT,
  raw_llm_json JSONB DEFAULT '{}'::jsonb,
  evidence_news_ids BIGINT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_news_published ON raw_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_event_symbol_created ON company_event(symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunity_decision_symbol_created ON opportunity_decision(symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovered_candidates_status ON discovered_candidates(status);
```

Add exports to `lib/opportunity/types.ts`:

```ts
export type OpportunityExtractionStatus = 'ok' | 'irrelevant' | 'parse_failed' | 'rejected';

export type CandidateAutoStatus =
  | 'auto_added_context'
  | 'auto_added_core'
  | 'pending_ai_review'
  | 'rejected';

export type CandidateValidationAction =
  | 'add_context'
  | 'add_core'
  | 'keep_candidate'
  | 'reject';

export interface OpportunityPipelineRawNews extends OpportunityRawNews {
  source_type: string | null;
  content: string | null;
  fetched_at: string;
  lang: string | null;
}

export interface ExtractedCompanyMention {
  name: string;
  symbol: string | null;
  market: string | null;
  theme: string | null;
  relation_to_core: OpportunityContextEntity['relation_type'] | null;
  related_core_symbol: string | null;
  reason: string;
  confidence: number;
}

export interface ExtractedOpportunityEvent {
  is_relevant: boolean;
  related_core_symbols: string[];
  related_context_entities: string[];
  theme: string;
  event_type: OpportunityCompanyEvent['event_type'];
  event_direction: OpportunityDirection;
  importance_score: number;
  summary: string;
  key_facts: string[];
  positive_factors: string[];
  negative_factors: string[];
  supply_chain_mentions: string[];
  new_company_mentions: ExtractedCompanyMention[];
  uncertainty: string[];
  evidence: { text: string; reason: string }[];
  raw_llm_json: Record<string, unknown>;
  llm_input_summary: string;
  llm_model: string;
}

export interface CandidateValidationDecision {
  decision: CandidateValidationAction;
  confidence: number;
  name: string;
  symbol: string | null;
  market: string | null;
  theme: string | null;
  related_core_symbol: string | null;
  relation_type: OpportunityContextEntity['relation_type'] | null;
  reason: string;
  evidence_news_ids: number[];
  risk_notes: string[];
}

export interface DiscoveredCandidate {
  id: number;
  name: string;
  symbol: string | null;
  market: string | null;
  theme: string | null;
  discovered_from: string | null;
  related_to_symbol: string | null;
  relation_type: OpportunityContextEntity['relation_type'] | null;
  reason: string | null;
  mention_count: number;
  importance_score: number;
  confidence: number;
  status: CandidateAutoStatus;
  ai_decision: CandidateValidationAction | null;
  raw_llm_json: Record<string, unknown>;
  evidence_news_ids: number[];
  created_at: string;
  updated_at: string;
}

export interface PersistedOpportunityDecision {
  id: number;
  symbol: string;
  market: Market;
  company_name: string;
  asset_type: AssetType;
  theme: string;
  decision_level: OpportunityDecisionLevel;
  total_score: number;
  news_score: number;
  price_position_score: number;
  context_signal_score: number;
  risk_score: number;
  summary: string;
  watch_conditions: string[];
  risk_factors: string[];
  evidence_event_ids: number[];
  created_at: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
npm test -- __tests__/lib/opportunity/types-contract.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add supabase/schema.sql lib/opportunity/types.ts __tests__/lib/opportunity/types-contract.test.ts
git commit -m "feat: add opportunity ingestion schema types"
```

---

### Task 2: News Dedupe Helpers

**Files:**

- Create: `lib/opportunity/news-dedupe.ts`
- Test: `__tests__/lib/opportunity/news-dedupe.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import {
  createNewsHash,
  dedupeNews,
  normalizeNewsTitle,
} from '@/lib/opportunity/news-dedupe';

const baseNews = {
  source: 'finnhub',
  source_type: 'company_news',
  title: ' Micron Highlights HBM Demand! ',
  summary: 'HBM demand remains strong.',
  content: null,
  url: 'https://example.com/article?utm_source=x',
  published_at: '2026-05-24T01:20:00.000Z',
  lang: 'en',
  raw_json: {},
};

describe('news dedupe helpers', () => {
  it('normalizes title casing and punctuation', () => {
    expect(normalizeNewsTitle(' Micron, highlights HBM demand! ')).toBe(
      'micron highlights hbm demand',
    );
  });

  it('creates stable hashes for equivalent title url and published date', () => {
    expect(createNewsHash(baseNews)).toBe(
      createNewsHash({
        ...baseNews,
        title: 'micron highlights hbm demand',
        url: 'https://example.com/article?ref=abc',
      }),
    );
  });

  it('removes duplicate news by hash', () => {
    const deduped = dedupeNews([
      baseNews,
      { ...baseNews, title: 'micron highlights hbm demand' },
      { ...baseNews, title: 'NVIDIA demand remains robust', url: 'https://example.com/nvda' },
    ]);

    expect(deduped).toHaveLength(2);
    expect(deduped[0].hash).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
npm test -- __tests__/lib/opportunity/news-dedupe.test.ts
```

Expected: FAIL because `news-dedupe.ts` does not exist.

- [ ] **Step 3: Implement minimal dedupe helpers**

```ts
import { createHash } from 'crypto';

export interface NewsLike {
  source: string;
  source_type: string | null;
  title: string;
  summary: string | null;
  content: string | null;
  url: string | null;
  published_at: string;
  lang: string | null;
  raw_json: Record<string, unknown>;
}

export interface NewsWithHash extends NewsLike {
  hash: string;
}

export function normalizeNewsTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalUrl(url: string | null): string {
  if (!url) return '';

  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`.toLowerCase();
  } catch {
    return url.toLowerCase().split('?')[0] ?? '';
  }
}

function publishedDay(publishedAt: string): string {
  return publishedAt.slice(0, 10);
}

export function createNewsHash(news: Pick<NewsLike, 'title' | 'url' | 'published_at'>): string {
  const input = [
    normalizeNewsTitle(news.title),
    canonicalUrl(news.url),
    publishedDay(news.published_at),
  ].join('|');

  return createHash('sha256').update(input).digest('hex');
}

export function dedupeNews<T extends NewsLike>(news: T[]): Array<T & { hash: string }> {
  const seen = new Set<string>();
  const result: Array<T & { hash: string }> = [];

  for (const item of news) {
    const hash = createNewsHash(item);
    if (seen.has(hash)) continue;
    seen.add(hash);
    result.push({ ...item, hash });
  }

  return result;
}
```

- [ ] **Step 4: Run tests**

```powershell
npm test -- __tests__/lib/opportunity/news-dedupe.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib/opportunity/news-dedupe.ts __tests__/lib/opportunity/news-dedupe.test.ts
git commit -m "feat: add opportunity news dedupe"
```

---

### Task 3: News Filtering Rules

**Files:**

- Create: `lib/opportunity/news-filter.ts`
- Test: `__tests__/lib/opportunity/news-filter.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import {
  extract_context_matches,
  filter_news_by_watchlist,
} from '@/lib/opportunity/news-filter';
import { seedContext, seedCoreWatchlist } from '@/lib/opportunity/seed';
import type { NewsWithHash } from '@/lib/opportunity/news-dedupe';

const news = (title: string, summary = ''): NewsWithHash => ({
  source: 'finnhub',
  source_type: 'company_news',
  title,
  summary,
  content: null,
  url: null,
  published_at: '2026-05-24T01:00:00.000Z',
  lang: 'en',
  raw_json: {},
  hash: title,
});

describe('opportunity news filtering', () => {
  it('keeps articles that mention a core symbol', () => {
    const result = filter_news_by_watchlist(
      [news('MU highlights stronger HBM demand')],
      seedCoreWatchlist,
      seedContext,
    );

    expect(result).toHaveLength(1);
    expect(result[0].matched_core_symbols).toContain('MU');
  });

  it('maps context entity matches back to a core symbol', () => {
    const matches = extract_context_matches(
      news('Samsung HBM certification delay creates memory supply tension'),
      seedCoreWatchlist,
      seedContext,
    );

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          core_symbol: 'MU',
          related_name: 'Samsung Memory',
        }),
      ]),
    );
  });

  it('filters unrelated articles out before LLM calls', () => {
    const result = filter_news_by_watchlist(
      [news('Restaurant chain launches summer menu')],
      seedCoreWatchlist,
      seedContext,
    );

    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
npm test -- __tests__/lib/opportunity/news-filter.test.ts
```

Expected: FAIL because `news-filter.ts` does not exist.

- [ ] **Step 3: Implement filtering**

Implement `filter_news_by_watchlist` and `extract_context_matches` with case-insensitive matching over title, summary, and content. Include a small theme keyword map:

```ts
const THEME_KEYWORDS: Record<string, string[]> = {
  'HBM / memory cycle': ['hbm', 'dram', 'nand', 'memory supply', 'certification'],
  'AI compute': ['ai compute', 'data center', 'accelerator', 'gpu', 'cloud capex'],
  'AI accelerator competition': ['ai accelerator', 'mi300', 'mi350', 'gpu competition'],
  'semiconductor basket': ['semiconductor', 'chip', 'wafer', 'advanced packaging', 'capex'],
  'Nasdaq 100 beta': ['nasdaq', 'mega cap', 'growth stocks'],
};
```

Return this shape:

```ts
export interface ContextMatch {
  core_symbol: string;
  related_symbol: string | null;
  related_name: string;
  relation_type: string;
  relation_strength: number;
}

export interface FilteredNews<T extends NewsWithHash = NewsWithHash> {
  news: T;
  matched_core_symbols: string[];
  matched_context: ContextMatch[];
  matched_themes: string[];
  rule_confidence: number;
  llm_input_summary: string;
}
```

Confidence rule:

- core symbol or company name hit: `0.9`
- context match: `0.8`
- theme-only match: `0.65`
- use the max confidence from all hits

- [ ] **Step 4: Run tests**

```powershell
npm test -- __tests__/lib/opportunity/news-filter.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib/opportunity/news-filter.ts __tests__/lib/opportunity/news-filter.test.ts
git commit -m "feat: filter opportunity news by watchlist"
```

---

### Task 4: LLM JSON Parsing and Repair

**Files:**

- Create: `lib/opportunity/llm-json.ts`
- Test: `__tests__/lib/opportunity/llm-json.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { parseJsonWithRepair } from '@/lib/opportunity/llm-json';

describe('LLM JSON parsing', () => {
  it('parses strict JSON', async () => {
    const result = await parseJsonWithRepair<{ ok: boolean }>({
      rawText: '{"ok":true}',
      repair: jest.fn(),
    });

    expect(result).toEqual({ ok: true });
  });

  it('parses fenced JSON', async () => {
    const result = await parseJsonWithRepair<{ ok: boolean }>({
      rawText: '```json\n{"ok":true}\n```',
      repair: jest.fn(),
    });

    expect(result).toEqual({ ok: true });
  });

  it('uses one repair retry for invalid JSON', async () => {
    const repair = jest.fn().mockResolvedValue('{"ok":true}');
    const result = await parseJsonWithRepair<{ ok: boolean }>({
      rawText: '{ok:true}',
      repair,
    });

    expect(result).toEqual({ ok: true });
    expect(repair).toHaveBeenCalledTimes(1);
  });

  it('returns a controlled failure after repair fails', async () => {
    const repair = jest.fn().mockResolvedValue('{still bad}');

    await expect(
      parseJsonWithRepair({
        rawText: '{bad}',
        repair,
      }),
    ).rejects.toThrow('Unable to parse LLM JSON');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
npm test -- __tests__/lib/opportunity/llm-json.test.ts
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement parser**

```ts
interface ParseJsonWithRepairInput {
  rawText: string;
  repair: (invalidJson: string) => Promise<string>;
}

function extractFencedJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenceMatch?.[1]?.trim() ?? text.trim();
}

function parseJson<T>(text: string): T {
  return JSON.parse(extractFencedJson(text)) as T;
}

export async function parseJsonWithRepair<T>({
  rawText,
  repair,
}: ParseJsonWithRepairInput): Promise<T> {
  try {
    return parseJson<T>(rawText);
  } catch {
    const repaired = await repair(rawText);
    try {
      return parseJson<T>(repaired);
    } catch (error) {
      throw new Error(
        `Unable to parse LLM JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
```

- [ ] **Step 4: Run tests**

```powershell
npm test -- __tests__/lib/opportunity/llm-json.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib/opportunity/llm-json.ts __tests__/lib/opportunity/llm-json.test.ts
git commit -m "feat: add llm json repair parser"
```

---

### Task 5: Event Extraction Prompt and Mapping

**Files:**

- Create: `lib/opportunity/event-extraction.ts`
- Test: `__tests__/lib/opportunity/event-extraction.test.ts`
- Modify: `lib/llm/client.ts`

- [ ] **Step 1: Write failing tests**

```ts
import {
  buildEventExtractionPrompt,
  extractOpportunityEvent,
} from '@/lib/opportunity/event-extraction';
import { seedContext, seedCoreWatchlist } from '@/lib/opportunity/seed';
import type { FilteredNews } from '@/lib/opportunity/news-filter';

const filtered: FilteredNews = {
  news: {
    source: 'finnhub',
    source_type: 'company_news',
    title: 'Samsung HBM certification timeline slips again',
    summary: 'The delay could keep high-end memory supply tight.',
    content: null,
    url: null,
    published_at: '2026-05-24T01:00:00.000Z',
    lang: 'en',
    raw_json: {},
    hash: 'samsung-hbm',
  },
  matched_core_symbols: ['MU'],
  matched_context: [
    {
      core_symbol: 'MU',
      related_symbol: null,
      related_name: 'Samsung Memory',
      relation_type: 'competitor',
      relation_strength: 0.8,
    },
  ],
  matched_themes: ['HBM / memory cycle'],
  rule_confidence: 0.8,
  llm_input_summary: 'Samsung HBM certification timeline slips again',
};

describe('event extraction', () => {
  it('builds a strict JSON prompt with core and context pools', () => {
    const prompt = buildEventExtractionPrompt({
      filtered,
      coreTargets: seedCoreWatchlist,
      contextEntities: seedContext,
    });

    expect(prompt).toContain('Return strict JSON');
    expect(prompt).toContain('MU');
    expect(prompt).toContain('Samsung Memory');
    expect(prompt).toContain('Do not output buy or sell instructions');
  });

  it('maps Samsung HBM delay into a MU context event', async () => {
    const chat = jest.fn().mockResolvedValue(
      JSON.stringify({
        is_relevant: true,
        related_core_symbols: ['MU'],
        related_context_entities: ['Samsung Memory'],
        theme: 'HBM / memory cycle',
        event_type: 'competition',
        event_direction: 'positive',
        importance_score: 78,
        summary: 'Samsung HBM certification delay may keep supply tight.',
        key_facts: ['Samsung HBM certification slipped.'],
        positive_factors: ['Supports MU competitive setup.'],
        negative_factors: [],
        supply_chain_mentions: ['Samsung Memory'],
        new_company_mentions: [],
        uncertainty: [],
        evidence: [{ text: 'certification timeline slips', reason: 'title evidence' }],
      }),
    );

    const event = await extractOpportunityEvent({
      filtered,
      coreTargets: seedCoreWatchlist,
      contextEntities: seedContext,
      chat,
      model: 'deepseek-chat',
    });

    expect(event?.related_core_symbols).toEqual(['MU']);
    expect(event?.event_type).toBe('competition');
    expect(event?.llm_model).toBe('deepseek-chat');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
npm test -- __tests__/lib/opportunity/event-extraction.test.ts
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement event extraction**

Implementation requirements:

- Export `buildEventExtractionPrompt`.
- Export `extractOpportunityEvent`.
- Accept injected `chat` for tests.
- Use `parseJsonWithRepair`.
- Return `null` when parsed JSON has `is_relevant: false`.
- Attach `raw_llm_json`, `llm_input_summary`, and `llm_model` to the parsed event.

Add to `lib/llm/client.ts`:

```ts
export function getLlmModelName(): string {
  return process.env.LLM_MODEL ?? 'gpt-4o-mini';
}
```

Use repair callback:

```ts
const repair = (invalidJson: string) =>
  chat([
    {
      role: 'system',
      content: 'Repair this into valid strict JSON only. Do not add prose.',
    },
    { role: 'user', content: invalidJson },
  ]);
```

- [ ] **Step 4: Run tests**

```powershell
npm test -- __tests__/lib/opportunity/event-extraction.test.ts __tests__/lib/llm/client.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib/opportunity/event-extraction.ts lib/llm/client.ts __tests__/lib/opportunity/event-extraction.test.ts __tests__/lib/llm/client.test.ts
git commit -m "feat: extract opportunity events with llm"
```

---

### Task 6: Candidate Auto Validation

**Files:**

- Create: `lib/opportunity/candidate-validation.ts`
- Test: `__tests__/lib/opportunity/candidate-validation.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import {
  applyCandidateHardRules,
  buildCandidateValidationPrompt,
} from '@/lib/opportunity/candidate-validation';
import { seedContext, seedCoreWatchlist } from '@/lib/opportunity/seed';
import type { CandidateValidationDecision, ExtractedCompanyMention } from '@/lib/opportunity/types';

const mention: ExtractedCompanyMention = {
  name: 'Samsung Electronics',
  symbol: '005930.KS',
  market: 'KR',
  theme: 'HBM / memory cycle',
  relation_to_core: 'competitor',
  related_core_symbol: 'MU',
  reason: 'Samsung is a recurring HBM competitor signal.',
  confidence: 0.86,
};

describe('candidate validation', () => {
  it('builds a prompt that asks for one of the allowed decisions', () => {
    const prompt = buildCandidateValidationPrompt({
      mention,
      coreTargets: seedCoreWatchlist,
      contextEntities: seedContext,
      evidenceNewsIds: [2],
      sourceSummary: 'Samsung HBM certification slipped again.',
    });

    expect(prompt).toContain('add_context');
    expect(prompt).toContain('add_core');
    expect(prompt).toContain('keep_candidate');
    expect(prompt).toContain('reject');
  });

  it('allows high-confidence competitors to auto-add to context', () => {
    const decision: CandidateValidationDecision = {
      decision: 'add_context',
      confidence: 0.86,
      name: mention.name,
      symbol: mention.symbol,
      market: mention.market,
      theme: mention.theme,
      related_core_symbol: 'MU',
      relation_type: 'competitor',
      reason: mention.reason,
      evidence_news_ids: [2],
      risk_notes: [],
    };

    expect(
      applyCandidateHardRules({
        decision,
        mentionCount: 1,
        coreTargets: seedCoreWatchlist,
        contextEntities: seedContext.filter(entity => entity.related_name !== 'Samsung Electronics'),
      }),
    ).toEqual(expect.objectContaining({ status: 'auto_added_context' }));
  });

  it('keeps low-confidence mentions out of context and core', () => {
    const decision: CandidateValidationDecision = {
      decision: 'add_context',
      confidence: 0.61,
      name: mention.name,
      symbol: mention.symbol,
      market: mention.market,
      theme: mention.theme,
      related_core_symbol: 'MU',
      relation_type: 'competitor',
      reason: mention.reason,
      evidence_news_ids: [2],
      risk_notes: [],
    };

    expect(
      applyCandidateHardRules({
        decision,
        mentionCount: 1,
        coreTargets: seedCoreWatchlist,
        contextEntities: seedContext,
      }),
    ).toEqual(expect.objectContaining({ status: 'pending_ai_review' }));
  });

  it('requires repeated high-confidence mentions to auto-add to core', () => {
    const decision: CandidateValidationDecision = {
      decision: 'add_core',
      confidence: 0.92,
      name: 'Marvell Technology',
      symbol: 'MRVL',
      market: 'US',
      theme: 'AI networking',
      related_core_symbol: 'NVDA',
      relation_type: 'peer',
      reason: 'The candidate repeatedly appears as a direct AI infrastructure tracking object.',
      evidence_news_ids: [3, 4],
      risk_notes: [],
    };

    expect(
      applyCandidateHardRules({
        decision,
        mentionCount: 2,
        coreTargets: seedCoreWatchlist,
        contextEntities: seedContext,
      }),
    ).toEqual(expect.objectContaining({ status: 'auto_added_core' }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
npm test -- __tests__/lib/opportunity/candidate-validation.test.ts
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement validation**

Implement:

```ts
export function buildCandidateValidationPrompt(input: BuildCandidateValidationPromptInput): string
export function applyCandidateHardRules(input: ApplyCandidateHardRulesInput): {
  status: CandidateAutoStatus;
  shouldAddContext: boolean;
  shouldAddCore: boolean;
  reason: string;
}
```

Hard rule thresholds:

- context confidence: `>= 0.75`
- core confidence: `>= 0.9`
- core mention count: `>= 2`
- reject confidence: `< 0.6`

Supported auto-core markets for this phase: `US`, `CN`, `HK`.

- [ ] **Step 4: Run tests**

```powershell
npm test -- __tests__/lib/opportunity/candidate-validation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib/opportunity/candidate-validation.ts __tests__/lib/opportunity/candidate-validation.test.ts
git commit -m "feat: add ai candidate hard rules"
```

---

### Task 7: Supabase Opportunity Ingestion Layer

**Files:**

- Create: `lib/supabase/opportunity-ingestion.ts`
- Test: `__tests__/lib/supabase/opportunity-ingestion.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import {
  mapDecisionRowsToOpportunityResponse,
  mapRawNewsForInsert,
} from '@/lib/supabase/opportunity-ingestion';
import { seedRawNews } from '@/lib/opportunity/seed';
import type { PersistedOpportunityDecision } from '@/lib/opportunity/types';

describe('opportunity ingestion supabase mapping', () => {
  it('maps raw news for database insert', () => {
    const row = mapRawNewsForInsert({
      ...seedRawNews[0],
      source_type: 'company_news',
      content: null,
      fetched_at: '2026-05-24T01:00:00.000Z',
      lang: 'en',
    });

    expect(row.hash).toBe(seedRawNews[0].hash);
    expect(row.raw_json).toEqual(seedRawNews[0].raw_json);
  });

  it('groups persisted decisions into OpportunityApiResponse', () => {
    const rows: PersistedOpportunityDecision[] = [
      {
        id: 1,
        symbol: 'MU',
        market: 'US',
        company_name: 'Micron Technology',
        asset_type: 'stock',
        theme: 'HBM / memory cycle',
        decision_level: 'strong_watch',
        total_score: 75,
        news_score: 85,
        price_position_score: 55,
        context_signal_score: 78,
        risk_score: 42,
        summary: 'MU remains a strong watch.',
        watch_conditions: ['Confirm demand.'],
        risk_factors: ['Price risk.'],
        evidence_event_ids: [1],
        created_at: '2026-05-24T01:00:00.000Z',
      },
    ];

    const response = mapDecisionRowsToOpportunityResponse(rows, [], []);

    expect(response.summary.total).toBe(1);
    expect(response.groups.strong_watch[0].symbol).toBe('MU');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
npm test -- __tests__/lib/supabase/opportunity-ingestion.test.ts
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement mapping and DB helpers**

Export pure mapping helpers for tests:

```ts
export function mapRawNewsForInsert(news: OpportunityPipelineRawNews)
export function mapDecisionRowsToOpportunityResponse(
  rows: PersistedOpportunityDecision[],
  events: OpportunityCompanyEvent[],
  rawNews: OpportunityRawNews[],
): OpportunityApiResponse
```

Export async helpers using Supabase client:

```ts
export async function getCoreTargets(): Promise<OpportunityCoreTarget[]>
export async function getContextEntities(): Promise<OpportunityContextEntity[]>
export async function upsertRawNews(news: OpportunityPipelineRawNews[]): Promise<OpportunityPipelineRawNews[]>
export async function insertCompanyEvents(events: CompanyEventInsert[]): Promise<void>
export async function upsertDiscoveredCandidate(candidate: DiscoveredCandidateInsert): Promise<void>
export async function upsertContextFromCandidate(decision: CandidateValidationDecision): Promise<void>
export async function upsertCoreFromCandidate(decision: CandidateValidationDecision): Promise<void>
export async function replaceLatestOpportunityDecisions(cards: OpportunityCardData[]): Promise<void>
export async function getLatestOpportunityDecisionData(): Promise<OpportunityApiResponse | null>
```

Keep the Supabase client private and construct it only when `hasSupabaseConfig()` is true. Throw a clear error for write operations when config is absent.

- [ ] **Step 4: Run tests**

```powershell
npm test -- __tests__/lib/supabase/opportunity-ingestion.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib/supabase/opportunity-ingestion.ts __tests__/lib/supabase/opportunity-ingestion.test.ts
git commit -m "feat: add opportunity ingestion persistence"
```

---

### Task 8: Pipeline Orchestration and Script

**Files:**

- Create: `lib/opportunity/pipeline.ts`
- Create: `scripts/fetch-opportunity-news.ts`
- Test: `__tests__/lib/opportunity/pipeline.test.ts`
- Modify: `lib/data-sources/finnhub.ts` if a mapper is needed.

- [ ] **Step 1: Write failing tests**

```ts
import { runOpportunityNewsPipeline } from '@/lib/opportunity/pipeline';
import { seedContext, seedCoreWatchlist, seedIndicators } from '@/lib/opportunity/seed';

describe('opportunity news pipeline', () => {
  it('filters before calling LLM and persists generated decisions', async () => {
    const fetchNews = jest.fn().mockResolvedValue([
      {
        source: 'finnhub',
        source_type: 'company_news',
        title: 'Samsung HBM certification timeline slips again',
        summary: 'The delay could keep high-end memory supply tight.',
        content: null,
        url: null,
        published_at: '2026-05-24T01:00:00.000Z',
        lang: 'en',
        raw_json: {},
      },
      {
        source: 'finnhub',
        source_type: 'company_news',
        title: 'Restaurant chain launches summer menu',
        summary: 'Unrelated article.',
        content: null,
        url: null,
        published_at: '2026-05-24T01:00:00.000Z',
        lang: 'en',
        raw_json: {},
      },
    ]);
    const extractEvent = jest.fn().mockResolvedValue({
      is_relevant: true,
      related_core_symbols: ['MU'],
      related_context_entities: ['Samsung Memory'],
      theme: 'HBM / memory cycle',
      event_type: 'competition',
      event_direction: 'positive',
      importance_score: 78,
      summary: 'Samsung delay supports MU context signal.',
      key_facts: [],
      positive_factors: [],
      negative_factors: [],
      supply_chain_mentions: [],
      new_company_mentions: [],
      uncertainty: [],
      evidence: [],
      raw_llm_json: {},
      llm_input_summary: 'Samsung HBM certification timeline slips again',
      llm_model: 'deepseek-chat',
    });
    const persist = {
      upsertRawNews: jest.fn(async news => news.map((item, index) => ({ ...item, id: index + 1, created_at: 'now' }))),
      insertCompanyEvents: jest.fn(),
      replaceLatestOpportunityDecisions: jest.fn(),
      upsertDiscoveredCandidate: jest.fn(),
      upsertContextFromCandidate: jest.fn(),
      upsertCoreFromCandidate: jest.fn(),
    };

    await runOpportunityNewsPipeline({
      coreTargets: seedCoreWatchlist,
      contextEntities: seedContext,
      indicators: seedIndicators,
      fetchNews,
      extractEvent,
      validateCandidate: jest.fn(),
      persist,
      limits: { maxNewsPerRun: 50, maxLlmCallsPerRun: 20 },
    });

    expect(extractEvent).toHaveBeenCalledTimes(1);
    expect(persist.insertCompanyEvents).toHaveBeenCalledTimes(1);
    expect(persist.replaceLatestOpportunityDecisions).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
npm test -- __tests__/lib/opportunity/pipeline.test.ts
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement pipeline**

Implement `runOpportunityNewsPipeline` with dependency injection:

```ts
export async function runOpportunityNewsPipeline(input: RunOpportunityNewsPipelineInput): Promise<PipelineSummary>
```

Summary fields:

```ts
{
  fetched: number;
  deduped: number;
  filtered: number;
  llmCalls: number;
  eventsInserted: number;
  candidatesProcessed: number;
  decisionsGenerated: number;
}
```

Script behavior in `scripts/fetch-opportunity-news.ts`:

- Validate env vars.
- Load core/context from Supabase ingestion helper.
- Load indicators from existing market indicator source if available; for the first implementation, use latest `market_indicator_daily` rows through the ingestion helper and fall back to seed indicators in local mode.
- Fetch Finnhub company news for active core symbols.
- Respect `OPPORTUNITY_MAX_NEWS_PER_RUN` and `OPPORTUNITY_MAX_LLM_CALLS_PER_RUN`.
- Print summary and exit non-zero only for missing required provider credentials or unrecoverable Supabase auth/config errors.

- [ ] **Step 4: Run tests**

```powershell
npm test -- __tests__/lib/opportunity/pipeline.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib/opportunity/pipeline.ts scripts/fetch-opportunity-news.ts __tests__/lib/opportunity/pipeline.test.ts
git commit -m "feat: add opportunity news pipeline"
```

---

### Task 9: `/api/opportunity` Reads Persisted Decisions First

**Files:**

- Modify: `lib/supabase/opportunity.ts`
- Modify: `app/api/opportunity/route.ts` only if needed
- Modify: `__tests__/api/opportunity.test.ts`

- [ ] **Step 1: Read local Next.js docs before route edits**

Run:

```powershell
Get-ChildItem -Recurse node_modules\next\dist\docs | Select-String -Pattern "Route Handlers","NextResponse","dynamic" -List
```

Expected: identify the relevant local docs if route handler behavior needs updating. If no route file changes are needed, record this in the task notes and leave `app/api/opportunity/route.ts` untouched.

- [ ] **Step 2: Write failing API/helper tests**

Extend `__tests__/api/opportunity.test.ts`:

```ts
it('returns persisted opportunity data when available', async () => {
  jest.resetModules();
  jest.doMock('@/lib/supabase/opportunity-ingestion', () => ({
    getLatestOpportunityDecisionData: jest.fn().mockResolvedValue({
      updated_at: '2026-05-24T01:00:00.000Z',
      summary: { total: 1, strong_watch: 1, pullback_candidate: 0, risk_high: 0, other: 0 },
      groups: {
        strong_watch: [
          {
            symbol: 'MU',
            company_name: 'Micron Technology',
            asset_type: 'stock',
            market: 'US',
            theme: 'HBM / memory cycle',
            decision_level: 'strong_watch',
            decision_label: '寮哄叧娉?,
            total_score: 75,
            news_score: 85,
            price_position_score: 55,
            context_signal_score: 78,
            risk_score: 42,
            summary: 'Persisted decision.',
            watch_conditions: [],
            risk_factors: [],
            evidence_events: [],
            evidence_news: [],
            updated_at: '2026-05-24T01:00:00.000Z',
          },
        ],
        pullback_candidate: [],
        risk_high: [],
        other: [],
      },
    }),
  }));

  const { GET } = await import('@/app/api/opportunity/route');
  const response = await GET();
  const body = await response.json();

  expect(body.summary.total).toBe(1);
  expect(body.groups.strong_watch[0].summary).toBe('Persisted decision.');
});
```

- [ ] **Step 3: Run test to verify it fails**

```powershell
npm test -- __tests__/api/opportunity.test.ts
```

Expected: FAIL because `getOpportunityData` does not read persisted decisions yet.

- [ ] **Step 4: Implement persisted-first fallback**

In `lib/supabase/opportunity.ts`:

```ts
export async function getOpportunityData(): Promise<OpportunityApiResponse> {
  const persisted = await getLatestOpportunityDecisionData();
  return persisted ?? getSeedOpportunityData();
}
```

Keep the existing route-level catch fallback to seed.

- [ ] **Step 5: Run tests**

```powershell
npm test -- __tests__/api/opportunity.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add lib/supabase/opportunity.ts app/api/opportunity/route.ts __tests__/api/opportunity.test.ts
git commit -m "feat: read persisted opportunity decisions"
```

If `app/api/opportunity/route.ts` was not modified, omit it from `git add`.

---

### Task 10: Full Verification

**Files:**

- No new files unless fixes are required.

- [ ] **Step 1: Run focused opportunity tests**

```powershell
npm test -- __tests__/lib/opportunity __tests__/lib/supabase/opportunity-ingestion.test.ts __tests__/api/opportunity.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

```powershell
npm test
```

Expected: PASS.

- [ ] **Step 3: Run TypeScript**

```powershell
npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 4: Run lint**

```powershell
npm run lint
```

Expected: exit code 0.

- [ ] **Step 5: Run production build**

```powershell
npm run build
```

Expected: exit code 0.

- [ ] **Step 6: Final commit for verification fixes**

Only if verification required fixes:

```powershell
git status --short
git add docs/superpowers/plans/2026-05-24-opportunity-live-news-discovery.md
git commit -m "fix: stabilize opportunity live news pipeline"
```

If verification fixes touched implementation files instead of this plan, replace the `git add` path with the exact files shown by `git status --short`.

---

## Plan Self-Review

- Spec coverage: Finnhub ingestion, dedupe, filtering, DeepSeek extraction, JSON repair, candidate auto-confirmation, persisted decisions, dashboard-preserving API behavior, and seed fallback are all mapped to tasks.
- No manual review UI is included.
- No separate `/opportunity` page is included.
- Type names are introduced before downstream tasks use them.
- TDD sequence is explicit for each production module.
- Next.js route docs check is included before possible route handler edits.
