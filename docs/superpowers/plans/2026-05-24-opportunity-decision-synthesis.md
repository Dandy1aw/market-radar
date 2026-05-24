# Opportunity Decision Synthesis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static template watch_conditions/risk_factors with per-symbol LLM synthesis, and simplify the evidence display to one-line event summaries.

**Architecture:** A new `decision-synthesis.ts` module provides `synthesizeOpportunityDecision`; the pipeline calls it per active symbol after inserting events, then passes results as overrides to `buildOpportunityCards`; the UI evidence area reads `event_summary` directly.

**Tech Stack:** TypeScript, Jest, Next.js 16, existing `chatCompletion`/`parseJsonWithRepair` utilities, `lib/opportunity/` module pattern.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `lib/opportunity/decision-synthesis.ts` | Prompt builder + `synthesizeOpportunityDecision` |
| Create | `__tests__/lib/opportunity/decision-synthesis.test.ts` | Unit tests for synthesis |
| Modify | `lib/opportunity/decision.ts` | Export `collectEventsForTarget` helper; accept `synthesizedBySymbol` in `buildOpportunityCards` |
| Modify | `__tests__/lib/opportunity/decision.test.ts` | Test synthesized override path |
| Modify | `lib/opportunity/pipeline.ts` | Add `synthesizeDecision?` input; synthesis step; `decisionsSynthesized` in summary |
| Modify | `__tests__/lib/opportunity/pipeline.test.ts` | Test synthesis step |
| Modify | `lib/opportunity/event-extraction.ts` | Add Chinese instruction for `summary` field; update schema example |
| Modify | `scripts/fetch-opportunity-news.ts` | Wire `synthesizeDecision` into pipeline call |
| Modify | `components/opportunity/OpportunityCard.tsx` | Evidence area: `event_summary` bullet list |

---

## Task 1: `decision-synthesis.ts` — types, prompt, function

**Files:**
- Create: `lib/opportunity/decision-synthesis.ts`
- Create: `__tests__/lib/opportunity/decision-synthesis.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/opportunity/decision-synthesis.test.ts`:

```typescript
import { synthesizeOpportunityDecision } from '@/lib/opportunity/decision-synthesis';
import { seedCoreWatchlist, seedIndicators } from '@/lib/opportunity/seed';
import type { OpportunityCompanyEvent } from '@/lib/opportunity/types';

const mockEvent: OpportunityCompanyEvent = {
  id: 1,
  symbol: 'MU',
  company_name: 'Micron Technology',
  theme: 'HBM / memory cycle',
  event_type: 'competition',
  event_direction: 'positive',
  importance_score: 78,
  event_summary: 'Samsung HBM delay tightens supply.',
  evidence_news_ids: [1],
  published_at: '2026-05-24T00:00:00Z',
  raw_payload: {
    positive_factors: ['Supply tightens near-term'],
    negative_factors: [],
    uncertainty: ['Certification timing unclear'],
  },
  created_at: '2026-05-24T00:00:00Z',
};

describe('synthesizeOpportunityDecision', () => {
  it('calls chat once and returns parsed watch_conditions and risk_factors', async () => {
    const chat = jest.fn().mockResolvedValue(JSON.stringify({
      watch_conditions: ['关注三星认证进展是否改变HBM供需格局'],
      risk_factors: ['20日已涨18%，短期获利了结压力大'],
    }));
    const muTarget = seedCoreWatchlist.find(t => t.symbol === 'MU')!;
    const muIndicator = seedIndicators.find(i => i.symbol === 'MU')!;

    const result = await synthesizeOpportunityDecision(
      { target: muTarget, events: [mockEvent], indicator: muIndicator },
      chat,
    );

    expect(chat).toHaveBeenCalledTimes(1);
    expect(result?.watch_conditions).toEqual(['关注三星认证进展是否改变HBM供需格局']);
    expect(result?.risk_factors).toEqual(['20日已涨18%，短期获利了结压力大']);
  });

  it('returns null when chat returns unparseable JSON', async () => {
    const chat = jest.fn().mockResolvedValue('not json at all ###');
    const muTarget = seedCoreWatchlist.find(t => t.symbol === 'MU')!;
    const muIndicator = seedIndicators.find(i => i.symbol === 'MU')!;

    const result = await synthesizeOpportunityDecision(
      { target: muTarget, events: [], indicator: muIndicator },
      chat,
    );

    expect(result).toBeNull();
  });

  it('prompt includes target symbol and event summary', async () => {
    const chat = jest.fn().mockResolvedValue(JSON.stringify({
      watch_conditions: ['条件'],
      risk_factors: ['风险'],
    }));
    const muTarget = seedCoreWatchlist.find(t => t.symbol === 'MU')!;
    const muIndicator = seedIndicators.find(i => i.symbol === 'MU')!;

    await synthesizeOpportunityDecision(
      { target: muTarget, events: [mockEvent], indicator: muIndicator },
      chat,
    );

    const promptContent: string = chat.mock.calls[0][0][0].content;
    expect(promptContent).toContain('MU');
    expect(promptContent).toContain('Samsung HBM delay tightens supply.');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npx jest __tests__/lib/opportunity/decision-synthesis.test.ts --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `decision-synthesis.ts`**

Create `lib/opportunity/decision-synthesis.ts`:

```typescript
import { parseJsonWithRepair } from './llm-json';
import type {
  OpportunityCompanyEvent,
  OpportunityCoreTarget,
  OpportunityIndicatorSnapshot,
} from './types';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

type ChatFn = (messages: ChatMessage[]) => Promise<string>;

export interface SynthesizeDecisionInput {
  target: OpportunityCoreTarget;
  events: OpportunityCompanyEvent[];
  indicator: OpportunityIndicatorSnapshot;
}

export interface SynthesizedDecision {
  watch_conditions: string[];
  risk_factors: string[];
}

const SYNTHESIS_JSON_SCHEMA = `{
  "watch_conditions": [
    "三星HBM认证若获批将直接压缩MU份额，需持续追踪认证进度",
    "关注本季度存储价格环比变化，确认需求回升是否持续"
  ],
  "risk_factors": [
    "20日已涨18%，短期获利了结压力大",
    "供应链存在负向事件，需观察影响是否扩散"
  ]
}`;

function formatEventsForPrompt(events: OpportunityCompanyEvent[]): string {
  if (events.length === 0) return '(no events this run)';
  return events
    .map((e, i) => {
      const p = e.raw_payload;
      const positive = Array.isArray(p?.positive_factors)
        ? (p.positive_factors as string[]).join('; ')
        : '';
      const negative = Array.isArray(p?.negative_factors)
        ? (p.negative_factors as string[]).join('; ')
        : '';
      const uncertainty = Array.isArray(p?.uncertainty)
        ? (p.uncertainty as string[]).join('; ')
        : '';
      return [
        `Event ${i + 1}: [${e.event_type}/${e.event_direction}] importance=${e.importance_score}`,
        `  Summary: ${e.event_summary}`,
        positive && `  Positive: ${positive}`,
        negative && `  Negative: ${negative}`,
        uncertainty && `  Uncertainty: ${uncertainty}`,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
}

function buildSynthesisPrompt({ target, events, indicator }: SynthesizeDecisionInput): string {
  return `You are a technology investing analyst generating monitoring conditions and risk warnings in Simplified Chinese.

Return strict JSON only. Do not wrap in markdown. Base your output on the provided evidence — do not use generic templates.

Target:
- Symbol: ${target.symbol} | ${target.name}
- Theme: ${target.theme}
- Notes: ${target.notes || 'none'}

Current indicators:
- 20-day price change: ${indicator.pct_change_20d != null ? `${indicator.pct_change_20d.toFixed(1)}%` : 'n/a'}
- Distance from 500-day MA: ${indicator.pct_from_ma500 != null ? `${indicator.pct_from_ma500.toFixed(1)}%` : 'n/a'}
- Volume ratio: ${indicator.volume_ratio != null ? indicator.volume_ratio.toFixed(2) : 'n/a'}
- Risk level: ${indicator.risk_level ?? 'n/a'}

Evidence events this run:
${formatEventsForPrompt(events)}

Output rules:
- watch_conditions: 3-4 items, each ≤35 Chinese characters, concrete and specific to the above evidence
- risk_factors: 2-4 items, each ≤35 Chinese characters, concrete and specific to the above indicators/events
- Simplified Chinese only
- No generic phrases without a specific subject from the evidence above

Return JSON with exactly this shape:
${SYNTHESIS_JSON_SCHEMA}`;
}

export async function synthesizeOpportunityDecision(
  input: SynthesizeDecisionInput,
  chat: ChatFn,
): Promise<SynthesizedDecision | null> {
  const prompt = buildSynthesisPrompt(input);
  try {
    const response = await chat([{ role: 'user', content: prompt }]);
    const result = await parseJsonWithRepair<SynthesizedDecision>({
      rawText: response,
      repair: (invalidJson) =>
        chat([
          {
            role: 'system',
            content: 'Repair this into valid strict JSON only. Do not add prose.',
          },
          { role: 'user', content: invalidJson },
        ]),
    });
    if (!Array.isArray(result?.watch_conditions) || !Array.isArray(result?.risk_factors)) {
      return null;
    }
    return {
      watch_conditions: result.watch_conditions,
      risk_factors: result.risk_factors,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
npx jest __tests__/lib/opportunity/decision-synthesis.test.ts --no-coverage
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```
git add lib/opportunity/decision-synthesis.ts __tests__/lib/opportunity/decision-synthesis.test.ts
git commit -m "feat: add decision synthesis LLM module"
```

---

## Task 2: Update `decision.ts` — export helper, accept synthesized

**Files:**
- Modify: `lib/opportunity/decision.ts`
- Modify: `__tests__/lib/opportunity/decision.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `__tests__/lib/opportunity/decision.test.ts` (inside the existing `describe` block):

```typescript
  it('uses synthesized watch_conditions and risk_factors when provided', () => {
    const synthesizedBySymbol = new Map([
      [
        'MU',
        {
          watch_conditions: ['关注三星认证进展对HBM供需格局的影响'],
          risk_factors: ['20日已涨15%，短期存在获利回吐风险'],
        },
      ],
    ]);

    const cards = buildOpportunityCards({
      coreTargets: seedCoreWatchlist,
      context: seedContext,
      events: seedCompanyEvents,
      indicators: seedIndicators,
      rawNews: seedRawNews,
      synthesizedBySymbol,
    });
    const muCard = cards.find(card => card.symbol === 'MU');

    expect(muCard?.watch_conditions).toEqual(['关注三星认证进展对HBM供需格局的影响']);
    expect(muCard?.risk_factors).toEqual(['20日已涨15%，短期存在获利回吐风险']);
  });

  it('falls back to template watch_conditions when synthesizedBySymbol is absent', () => {
    const cards = buildOpportunityCards({
      coreTargets: seedCoreWatchlist,
      context: seedContext,
      events: seedCompanyEvents,
      indicators: seedIndicators,
      rawNews: seedRawNews,
    });
    const muCard = cards.find(card => card.symbol === 'MU');

    expect(muCard?.watch_conditions.length).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run test to confirm it fails**

```
npx jest __tests__/lib/opportunity/decision.test.ts --no-coverage
```

Expected: FAIL — `synthesizedBySymbol` is not an accepted parameter.

- [ ] **Step 3: Update `decision.ts`**

At the top of `lib/opportunity/decision.ts`, add the import:

```typescript
import type { SynthesizedDecision } from './decision-synthesis';
```

Replace the `BuildOpportunityCardsInput` interface:

```typescript
interface BuildOpportunityCardsInput {
  coreTargets: OpportunityCoreTarget[];
  context: OpportunityContextEntity[];
  events: OpportunityCompanyEvent[];
  indicators: OpportunityIndicatorSnapshot[];
  rawNews: OpportunityRawNews[];
  synthesizedBySymbol?: Map<string, SynthesizedDecision>;
}
```

Extract and export the event-collection helper. Add this function **before** `buildOpportunityCards` and **after** the imports:

```typescript
export function collectEventsForTarget(
  target: OpportunityCoreTarget,
  context: OpportunityContextEntity[],
  activeTargetSymbols: Set<string>,
  events: OpportunityCompanyEvent[],
): OpportunityCompanyEvent[] {
  const activeContext = context.filter(
    entity => entity.is_active && activeTargetSymbols.has(entity.core_symbol),
  );
  const directEvents = events.filter(event => event.symbol === target.symbol);
  const contextEvents = events.filter(event =>
    activeContext.some(
      entity =>
        entity.core_symbol === target.symbol &&
        (event.symbol === entity.related_name ||
          event.symbol === entity.related_symbol ||
          event.company_name === entity.related_name),
    ),
  );
  const seen = new Set<number>();
  return [...directEvents, ...contextEvents].filter(event => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}
```

Update `buildOpportunityCards` to use the new helper for deduped `evidenceEvents`, while keeping the original `directEvents`/`contextEvents` split for scoring. Replace the body of the `return activeTargets.flatMap(target => { ... })` block:

```typescript
  return activeTargets.flatMap(target => {
    const indicator = indicatorBySymbol.get(target.symbol);

    if (!indicator) {
      return [];
    }

    // Keep original split for scoring (calcOpportunityScores weights them differently)
    const directEvents = events.filter(event => event.symbol === target.symbol);
    const contextEvents = events.filter(event =>
      activeContext.some(
        entity =>
          entity.core_symbol === target.symbol &&
          (event.symbol === entity.related_name ||
            event.symbol === entity.related_symbol ||
            event.company_name === entity.related_name),
      ),
    );
    // Deduped union for display and synthesis
    const evidenceEvents = collectEventsForTarget(
      target,
      context,
      activeTargetSymbols,
      events,
    );
    const evidenceNews = collectEvidenceNews(evidenceEvents, newsById);
    const scores = calcOpportunityScores({
      indicator,
      directEvents,
      contextEvents,
    });
    const decision_level = deriveDecisionLevel(scores);
    const synthesized = synthesizedBySymbol?.get(target.symbol);

    return [
      {
        symbol: target.symbol,
        company_name: target.name,
        asset_type: target.asset_type,
        market: target.market,
        theme: target.theme,
        decision_level,
        decision_label: opportunityDecisionLabels[decision_level],
        ...scores,
        summary: buildSummary(target, decision_level, scores),
        watch_conditions: synthesized?.watch_conditions ?? buildWatchConditions(indicator, evidenceEvents),
        risk_factors: synthesized?.risk_factors ?? buildRiskFactors(indicator, evidenceEvents, scores),
        evidence_events: evidenceEvents,
        evidence_news: evidenceNews,
        updated_at: getLatestTimestamp(target, evidenceEvents, evidenceNews),
      },
    ];
  });
```

Also remove the now-unused private `dedupeEventsById` function from `decision.ts` (it was used only for the old dedup call, now handled inside `collectEventsForTarget`).

- [ ] **Step 4: Run tests to confirm they pass**

```
npx jest __tests__/lib/opportunity/decision.test.ts --no-coverage
```

Expected: PASS (all tests including the 2 new ones).

- [ ] **Step 5: Commit**

```
git add lib/opportunity/decision.ts __tests__/lib/opportunity/decision.test.ts
git commit -m "feat: export collectEventsForTarget, accept synthesized decisions in buildOpportunityCards"
```

---

## Task 3: Update `pipeline.ts` — synthesis step

**Files:**
- Modify: `lib/opportunity/pipeline.ts`
- Modify: `__tests__/lib/opportunity/pipeline.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `__tests__/lib/opportunity/pipeline.test.ts` (new `it` block inside the existing `describe`):

```typescript
  it('calls synthesizeDecision per symbol with events and passes results to decisions', async () => {
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
    ]);
    const extractEvent = jest.fn().mockResolvedValue({
      is_relevant: true,
      related_core_symbols: ['MU'],
      related_context_entities: ['Samsung Memory'],
      theme: 'HBM / memory cycle',
      event_type: 'competition',
      event_direction: 'positive',
      importance_score: 78,
      summary: '三星延迟支撑MU竞争优势。',
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
      upsertRawNews: jest.fn(async (news: OpportunityPipelineRawNews[]) =>
        news.map((item: OpportunityPipelineRawNews, index: number) => ({
          ...item,
          id: index + 1,
          created_at: 'now',
        })),
      ),
      insertCompanyEvents: jest.fn(async () => [
        {
          id: 1,
          symbol: 'Samsung Memory',
          company_name: 'Samsung Memory',
          theme: 'HBM / memory cycle',
          event_type: 'competition' as const,
          event_direction: 'positive' as const,
          importance_score: 78,
          event_summary: '三星延迟支撑MU竞争优势。',
          evidence_news_ids: [1],
          published_at: '2026-05-24T01:00:00.000Z',
          raw_payload: {},
          created_at: '2026-05-24T01:00:00.000Z',
        },
      ]),
      replaceLatestOpportunityDecisions: jest.fn(),
      upsertDiscoveredCandidate: jest.fn(),
      upsertContextFromCandidate: jest.fn(),
      upsertCoreFromCandidate: jest.fn(),
    };
    const synthesizeDecision = jest.fn().mockResolvedValue({
      watch_conditions: ['关注三星认证进展'],
      risk_factors: ['供应链存在不确定性'],
    });

    const summary = await runOpportunityNewsPipeline({
      coreTargets: seedCoreWatchlist,
      contextEntities: seedContext,
      indicators: seedIndicators,
      fetchNews,
      extractEvent,
      validateCandidate: jest.fn(),
      synthesizeDecision,
      persist,
      limits: { maxNewsPerRun: 50, maxLlmCallsPerRun: 20 },
    });

    expect(synthesizeDecision).toHaveBeenCalledTimes(1);
    expect(synthesizeDecision).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.objectContaining({ symbol: 'MU' }) }),
    );
    expect(summary.decisionsSynthesized).toBe(1);

    const decisionsCall = persist.replaceLatestOpportunityDecisions.mock.calls[0][0];
    const muCard = decisionsCall.find((c: { symbol: string }) => c.symbol === 'MU');
    expect(muCard?.watch_conditions).toEqual(['关注三星认证进展']);
    expect(muCard?.risk_factors).toEqual(['供应链存在不确定性']);
  });
```

- [ ] **Step 2: Run test to confirm it fails**

```
npx jest __tests__/lib/opportunity/pipeline.test.ts --no-coverage
```

Expected: FAIL — `synthesizeDecision` not in input type, `decisionsSynthesized` not in summary.

- [ ] **Step 3: Update `pipeline.ts`**

Add imports at the top of `lib/opportunity/pipeline.ts`:

```typescript
import { collectEventsForTarget } from './decision';
import type { SynthesizeDecisionInput, SynthesizedDecision } from './decision-synthesis';
```

Update `RunOpportunityNewsPipelineInput` to add the optional field:

```typescript
export interface RunOpportunityNewsPipelineInput {
  coreTargets: OpportunityCoreTarget[];
  contextEntities: OpportunityContextEntity[];
  indicators: OpportunityIndicatorSnapshot[];
  fetchNews: () => Promise<NewsLike[]>;
  extractEvent: (
    input: Omit<ExtractOpportunityEventInput, 'chat' | 'model'>,
  ) => Promise<ExtractedOpportunityEvent | null>;
  validateCandidate: (
    input: CandidateValidationInput,
  ) => Promise<CandidateValidationOutput | null>;
  synthesizeDecision?: (input: SynthesizeDecisionInput) => Promise<SynthesizedDecision | null>;
  persist: PipelinePersistence;
  limits: PipelineLimits;
}
```

Update `PipelineSummary` to add the count:

```typescript
export interface PipelineSummary {
  fetched: number;
  deduped: number;
  filtered: number;
  llmCalls: number;
  eventsInserted: number;
  candidatesProcessed: number;
  decisionsGenerated: number;
  decisionsSynthesized: number;
}
```

Update `runOpportunityNewsPipeline` function signature to destructure `synthesizeDecision`:

```typescript
export async function runOpportunityNewsPipeline({
  coreTargets,
  contextEntities,
  indicators,
  fetchNews,
  extractEvent,
  validateCandidate,
  synthesizeDecision,
  persist,
  limits,
}: RunOpportunityNewsPipelineInput): Promise<PipelineSummary> {
```

Add the synthesis step between `insertCompanyEvents` and `buildOpportunityCards`. Replace these lines:

```typescript
  const opportunityEvents = await persist.insertCompanyEvents(eventInserts);

  const cards = buildOpportunityCards({
```

With:

```typescript
  const opportunityEvents = await persist.insertCompanyEvents(eventInserts);

  const synthesizedBySymbol = new Map<string, SynthesizedDecision>();
  let decisionsSynthesized = 0;

  if (synthesizeDecision) {
    const indicatorBySymbol = new Map(indicators.map(i => [i.symbol, i]));
    const activeTargets = coreTargets.filter(t => t.is_active);
    const activeTargetSymbols = new Set(activeTargets.map(t => t.symbol));

    for (const target of activeTargets) {
      const evidenceEvents = collectEventsForTarget(
        target,
        contextEntities,
        activeTargetSymbols,
        opportunityEvents,
      );
      if (evidenceEvents.length === 0) continue;

      const indicator = indicatorBySymbol.get(target.symbol);
      if (!indicator) continue;

      const result = await synthesizeDecision({ target, events: evidenceEvents, indicator });
      if (result) {
        synthesizedBySymbol.set(target.symbol, result);
        decisionsSynthesized++;
      }
    }
  }

  const cards = buildOpportunityCards({
```

Update the `buildOpportunityCards` call to pass `synthesizedBySymbol`:

```typescript
  const cards = buildOpportunityCards({
    coreTargets,
    context: contextEntities,
    events: opportunityEvents,
    indicators,
    rawNews: persistedNews.map(toOpportunityRawNews),
    synthesizedBySymbol,
  });
```

Update the return statement to include `decisionsSynthesized`:

```typescript
  return {
    fetched: fetchedNews.length,
    deduped: dedupedNews.length,
    filtered: filtered.length,
    llmCalls: Math.min(filtered.length, limits.maxLlmCallsPerRun),
    eventsInserted: eventInserts.length,
    candidatesProcessed,
    decisionsGenerated: cards.length,
    decisionsSynthesized,
  };
```

- [ ] **Step 4: Run all pipeline and decision tests**

```
npx jest __tests__/lib/opportunity/pipeline.test.ts __tests__/lib/opportunity/decision.test.ts --no-coverage
```

Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```
git add lib/opportunity/pipeline.ts __tests__/lib/opportunity/pipeline.test.ts
git commit -m "feat: add synthesis step to opportunity pipeline"
```

---

## Task 4: Update `event-extraction.ts` — Chinese `summary`

**Files:**
- Modify: `lib/opportunity/event-extraction.ts`

No new tests needed — the prompt change only affects LLM output content, not the function's behaviour with mocked responses.

- [ ] **Step 1: Add Chinese instruction for `summary`**

In `lib/opportunity/event-extraction.ts`, update the existing Chinese instruction block. Replace:

```
Write evidence[].text and evidence[].reason in Simplified Chinese (简体中文). Keep each text under 25 characters and each reason under 40 characters.
```

With:

```
Write the "summary" field in Simplified Chinese (简体中文), under 30 characters.
Write evidence[].text and evidence[].reason in Simplified Chinese (简体中文). Keep each text under 25 characters and each reason under 40 characters.
```

- [ ] **Step 2: Update `EVENT_JSON_SCHEMA` example**

Replace the `summary` line in `EVENT_JSON_SCHEMA`:

```
  "summary": "Samsung HBM certification delay may keep near-term HBM supply tight.",
```

With:

```
  "summary": "三星HBM认证延迟，供给偏紧支撑MU",
```

- [ ] **Step 3: Type-check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```
git add lib/opportunity/event-extraction.ts
git commit -m "feat: output event summary in Chinese from extraction prompt"
```

---

## Task 5: Wire synthesis into `fetch-opportunity-news.ts`

**Files:**
- Modify: `scripts/fetch-opportunity-news.ts`

- [ ] **Step 1: Add import**

At the top of `scripts/fetch-opportunity-news.ts`, after existing imports, add:

```typescript
import { synthesizeOpportunityDecision } from '../lib/opportunity/decision-synthesis';
```

- [ ] **Step 2: Add `synthesizeDecision` to the pipeline call**

Inside `main()`, in the `runOpportunityNewsPipeline` call, add after `validateCandidate`:

```typescript
    synthesizeDecision: ({ target, events, indicator }) =>
      synthesizeOpportunityDecision(
        { target, events, indicator },
        (messages) => chatCompletion(messages, { temperature: 0.1, maxTokens: 600 }),
      ),
```

- [ ] **Step 3: Type-check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```
git add scripts/fetch-opportunity-news.ts
git commit -m "feat: wire synthesizeDecision into fetch-opportunity-news pipeline"
```

---

## Task 6: Update `OpportunityCard.tsx` — evidence as event summaries

**Files:**
- Modify: `components/opportunity/OpportunityCard.tsx`

- [ ] **Step 1: Replace the evidence block**

In `components/opportunity/OpportunityCard.tsx`, replace the entire evidence section (the `{(() => { ... })()}` block added previously) with:

```tsx
      {(() => {
        const items = card.evidence_events.length > 0
          ? card.evidence_events.map(e => e.event_summary).filter(Boolean)
          : card.evidence_news.map(n => n.title);
        if (items.length === 0) return null;
        return (
          <div className="mt-4 border-t border-[var(--border)] pt-3">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded(value => !value)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)]"
            >
              <ChevronDown
                size={14}
                className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'}
                aria-hidden="true"
              />
              证据 {items.length}
            </button>
            {expanded && (
              <ul className="mt-3 space-y-1">
                {items.map((item, i) => (
                  <li key={i} className="text-sm text-[var(--muted)]">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })()}
```

- [ ] **Step 2: Type-check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run full test suite**

```
npx jest --no-coverage
```

Expected: PASS (all tests).

- [ ] **Step 4: Commit**

```
git add components/opportunity/OpportunityCard.tsx
git commit -m "feat: show event summaries in evidence section"
```

---

## Done

All tasks complete. Run a final type-check and full test suite:

```
npx tsc --noEmit && npx jest --no-coverage
```

Expected: 0 type errors, all tests green.
