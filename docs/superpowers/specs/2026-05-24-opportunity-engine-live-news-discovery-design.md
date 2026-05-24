# Opportunity Engine Live News and AI Discovery Design

## Goal

Extend the existing opportunity engine from seed/mock data to a real-news pipeline while preserving the current product architecture: opportunity cards remain embedded in the dashboard, and `/api/opportunity` remains the read path for the latest opportunity groups.

This phase should produce a working backend loop:

```text
watchlist_core / watchlist_context
  -> Finnhub news
  -> raw_news
  -> rule filtering
  -> DeepSeek event extraction
  -> company_event
  -> AI-confirmed discovered candidates
  -> opportunity_decision
  -> /api/opportunity
  -> dashboard opportunity cards
```

The design intentionally avoids a separate `/opportunity` page and avoids a manual candidate review UI.

## Current Architecture

Phase 1 already provides the local opportunity card loop:

- `lib/opportunity/types.ts` defines core target, context, raw news, event, score, and card types.
- `lib/opportunity/seed.ts` provides deterministic MU/NVDA/AMD/QQQ/SMH seed data.
- `lib/opportunity/scoring.ts` computes rule-based scores.
- `lib/opportunity/decision.ts` builds grouped opportunity cards.
- `lib/supabase/opportunity.ts` currently returns seed opportunity data.
- `app/api/opportunity/route.ts` returns opportunity groups and falls back to seed data.
- `app/page.tsx` embeds `OpportunitySummaryBar` and grouped `OpportunityGroup` sections directly in the dashboard.

Phase 2 and 3 should extend this flow without moving the UI entry point.

## Scope

### Included

- Use Finnhub as the first real news source.
- Store fetched articles in `raw_news`.
- Deduplicate news before event extraction.
- Filter news with deterministic rules before calling DeepSeek.
- Call DeepSeek only for news that hits a core target, context entity, or core theme.
- Extract structured events into `company_event`.
- Store LLM audit fields:
  - `raw_llm_json`
  - `llm_input_summary`
  - `llm_model`
  - `created_at`
- Parse DeepSeek JSON defensively with retry and safe failure records.
- Generate latest opportunity decisions from real events when Supabase data exists.
- Keep seed fallback for local development and missing Supabase config.
- Use `new_company_mentions` to populate `discovered_candidates`.
- Let DeepSeek plus hard rules automatically decide whether a discovered company should be added to `watchlist_context` or, in rare high-confidence cases, `watchlist_core`.

### Excluded

- Separate `/opportunity` page.
- Manual candidate review page.
- User-facing candidate approval buttons.
- Full market-wide discovery.
- Multiple news providers.
- Earnings estimate ingestion.
- AI-generated buy/sell recommendations.
- Automatic trading.

## Data Model

`supabase/schema.sql` should add the Phase 1 opportunity tables if they are not already present in the database schema file:

- `watchlist_core`
- `watchlist_context`
- `raw_news`
- `company_event`
- `opportunity_decision`
- `discovered_candidates`

### `raw_news`

Stores fetched news before LLM extraction.

Required fields:

- `id`
- `source`
- `source_type`
- `title`
- `summary`
- `content`
- `url`
- `published_at`
- `fetched_at`
- `hash`
- `lang`
- `raw_json`
- `created_at`

`hash` must be unique. It should be generated from normalized title, canonical URL/domain, and published date.

### `company_event`

Stores structured events extracted from news.

Required fields:

- `id`
- `symbol`
- `market`
- `company_name`
- `theme`
- `event_type`
- `event_direction`
- `importance_score`
- `event_summary`
- `evidence_news_ids`
- `published_at`
- `raw_llm_json`
- `llm_input_summary`
- `llm_model`
- `extraction_status`
- `extraction_error`
- `created_at`

`extraction_status` should use values such as `ok`, `irrelevant`, `parse_failed`, and `rejected`.

### `opportunity_decision`

Stores the latest card-level decision for core watchlist targets.

Required fields:

- `id`
- `symbol`
- `market`
- `company_name`
- `asset_type`
- `theme`
- `decision_level`
- `total_score`
- `news_score`
- `price_position_score`
- `context_signal_score`
- `risk_score`
- `summary`
- `watch_conditions`
- `risk_factors`
- `evidence_event_ids`
- `created_at`

The shape should stay compatible with `OpportunityCardData` so `/api/opportunity` can group records using existing card components.

### `discovered_candidates`

Stores companies found by DeepSeek that are not already in `watchlist_core` or `watchlist_context`.

Required fields:

- `id`
- `name`
- `symbol`
- `market`
- `theme`
- `discovered_from`
- `related_to_symbol`
- `relation_type`
- `reason`
- `mention_count`
- `importance_score`
- `confidence`
- `status`
- `ai_decision`
- `raw_llm_json`
- `evidence_news_ids`
- `created_at`
- `updated_at`

Allowed `status` values:

- `auto_added_context`
- `auto_added_core`
- `pending_ai_review`
- `rejected`

`pending_ai_review` means AI did not have enough confidence to add the candidate automatically. It does not imply a manual UI in this phase.

## News Pipeline

### Entry Point

Create a TypeScript script:

```text
scripts/fetch-opportunity-news.ts
```

It should be runnable locally:

```bash
npx tsx scripts/fetch-opportunity-news.ts
```

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FINNHUB_API_KEY`
- `LLM_API_KEY`

Optional environment variables:

- `LLM_BASE_URL`
- `LLM_MODEL`
- `OPPORTUNITY_NEWS_LOOKBACK_DAYS`
- `OPPORTUNITY_MAX_NEWS_PER_RUN`
- `OPPORTUNITY_MAX_LLM_CALLS_PER_RUN`

Default cost guards:

- News lookback: 1 day.
- Max fetched/processed news per run: 50.
- Max DeepSeek calls per run: 20.
- Per-symbol Finnhub delay: at least 1 second.

### Fetching

Use the existing `lib/data-sources/finnhub.ts` module and keep provider-specific logic there.

Fetch company news for active `watchlist_core` symbols. For context entities with a usable ticker, fetch context news only when their relation strength is high enough, initially `>= 0.7`.

### Deduplication

Add deterministic dedupe helpers:

```ts
normalizeNewsTitle(title: string): string
createNewsHash(news: NewsLike): string
dedupeNews(news: NewsLike[]): NewsLike[]
```

Deduping should happen before database writes and rely on the unique `raw_news.hash` constraint as a second line of defense.

### Rule Filtering

Add `lib/opportunity/news-filter.ts`.

Implement:

```ts
filter_news_by_watchlist(news, coreTargets, contextEntities): FilteredNews[]
extract_context_matches(news, coreTargets, contextEntities): ContextMatch[]
```

A news item is eligible for DeepSeek if it matches at least one of:

- Core target symbol.
- Core target company name.
- Core target theme keyword.
- Active context `related_symbol`.
- Active context `related_name`.
- Strong context-to-core phrase match such as HBM, DRAM, AI accelerator, semiconductor capex, data center, advanced packaging, or memory supply.

The filter should return why the article was kept:

- matched core symbols
- matched context entities
- matched themes
- confidence from rules

News that does not pass this filter must not call DeepSeek.

## DeepSeek Event Extraction

Use the existing LLM adapter style:

- `LLM_API_KEY`
- `LLM_BASE_URL`
- `LLM_MODEL`

This keeps DeepSeek compatible with the current `chatCompletion` wrapper.

### Prompt: Event Extraction

The event extraction prompt must output strict JSON and no prose outside JSON.

Required JSON shape:

```json
{
  "is_relevant": true,
  "related_core_symbols": ["MU"],
  "related_context_entities": ["Samsung Memory"],
  "theme": "HBM / memory cycle",
  "event_type": "competition",
  "event_direction": "positive",
  "importance_score": 78,
  "summary": "Samsung HBM certification delay may keep near-term HBM supply tight.",
  "key_facts": ["Samsung HBM certification timeline reportedly slipped again."],
  "positive_factors": ["Tighter HBM supply may support MU's competitive setup."],
  "negative_factors": [],
  "supply_chain_mentions": ["Samsung Memory"],
  "new_company_mentions": [
    {
      "name": "Samsung Electronics",
      "symbol": "005930.KS",
      "market": "KR",
      "theme": "HBM / memory cycle",
      "relation_to_core": "competitor",
      "related_core_symbol": "MU",
      "reason": "Samsung is a direct HBM competitor whose certification delay affects MU context.",
      "confidence": 0.86
    }
  ],
  "uncertainty": [],
  "evidence": [
    {
      "text": "Samsung HBM certification timeline reportedly slips again",
      "reason": "This directly supports the extracted event."
    }
  ]
}
```

Allowed event types:

- `demand`
- `competition`
- `product`
- `supply_chain`
- `earnings_risk`
- `macro`
- `price_action`

Allowed directions:

- `positive`
- `neutral`
- `negative`
- `mixed`

The prompt must forbid buy/sell instructions and must state that rule code owns `decision_level`.

### JSON Protection

Add `lib/llm/json.ts` or `lib/opportunity/llm-json.ts`.

Parsing behavior:

1. Try parsing direct JSON.
2. If the model returned fenced JSON, extract the fenced body.
3. If parsing fails, retry once with a repair prompt that includes the invalid output.
4. If retry fails, write an extraction failure record with `extraction_status = parse_failed`.
5. Do not throw in a way that aborts the entire pipeline unless Supabase or provider auth is invalid.

## Candidate Auto Confirmation

Stage 3 does not include a manual review UI. DeepSeek and hard rules decide what happens to `new_company_mentions`.

### Prompt: Candidate Validation

The candidate validation prompt receives:

- current core watchlist
- current context watchlist
- candidate mention
- source news summary
- extracted event JSON

It must output strict JSON:

```json
{
  "decision": "add_context",
  "confidence": 0.86,
  "name": "Samsung Electronics",
  "symbol": "005930.KS",
  "market": "KR",
  "theme": "HBM / memory cycle",
  "related_core_symbol": "MU",
  "relation_type": "competitor",
  "reason": "Samsung HBM progress is a recurring competitive signal for MU.",
  "evidence_news_ids": [2],
  "risk_notes": ["Foreign ticker may not be supported by current market data pipeline."]
}
```

Allowed decisions:

- `add_context`
- `add_core`
- `keep_candidate`
- `reject`

### Hard Rules

The model decision is necessary but not sufficient. Code must enforce these hard rules.

#### Auto-add to `watchlist_context`

Allowed when all conditions are true:

- `decision = add_context`
- confidence `>= 0.75`
- `related_core_symbol` exists in active `watchlist_core`
- relation type is one of:
  - `competitor`
  - `supplier`
  - `customer`
  - `peer`
  - `industry_signal`
  - `policy_signal`
- evidence news ids are present
- candidate is not already in context for that core symbol

#### Auto-add to `watchlist_core`

Allowed only when all conditions are true:

- `decision = add_core`
- confidence `>= 0.9`
- candidate has non-empty `symbol`, `market`, and `name`
- mention count for the same candidate is `>= 2`
- candidate maps to a supported market or asset type
- prompt reason explicitly explains why it should become a core tracking object, not merely a background signal
- candidate is not already in `watchlist_core`

Even after auto-adding to core, the candidate should not immediately appear as an opportunity card unless the next scoring pass has enough event and indicator inputs.

#### Keep or Reject

Use `keep_candidate` when evidence is plausible but insufficient.

Use `reject` when:

- relation to core pool is unclear
- confidence is below `0.6`
- entity is not a company/security/theme source
- evidence is too vague

## Opportunity Decision Generation

After event extraction, recompute opportunity decisions for active `watchlist_core`.

Use existing rule functions where possible:

- `calcOpportunityScores`
- `deriveDecisionLevel`
- `buildOpportunityCards`
- `groupOpportunityCards`

The Supabase read/write layer should translate database rows into existing `OpportunityCardData` shape.

Decision generation must remain rule-owned:

- DeepSeek can extract facts and candidate relationships.
- DeepSeek must not set `decision_level`.
- DeepSeek must not override scores.
- Summary text may use extracted event summaries, but final level comes from rules.

## API Design

### `GET /api/opportunity`

Continue using the existing endpoint.

Behavior:

1. Try reading latest persisted opportunity decisions from Supabase.
2. If Supabase is not configured, return seed data.
3. If Supabase is configured but no persisted decisions exist, return seed data for local/development continuity.
4. If a database read fails, log the error and return seed data.

The response shape remains `OpportunityApiResponse`.

No route change is required for the dashboard.

## Frontend Design

No new opportunity landing page is needed.

Dashboard remains the primary surface:

- `OpportunitySummaryBar`
- Pullback candidates
- Strong watch
- Risk high
- Other observation group

Future candidate visibility can be added to the dashboard as a compact operational section, but it is not part of this phase.

## Error Handling

- Missing Finnhub key should stop the script with a clear error.
- Missing LLM key should skip extraction and mark eligible news as not extracted, rather than corrupting event output.
- LLM parse failures should create auditable failure records.
- One bad article must not stop the whole run.
- Duplicate raw news should be ignored through upsert or conflict handling.
- Candidate validation failures should keep the candidate out of core/context and record the failed decision payload.
- `/api/opportunity` should always be able to return seed data locally.

## Testing

Required tests:

- News filtering:
  - core symbol hit keeps article.
  - context entity hit maps back to the correct core symbol.
  - unrelated article is filtered out.
- News dedupe:
  - repeated title/url/date produces one raw news item.
- LLM JSON parsing:
  - parses strict JSON.
  - parses fenced JSON.
  - returns controlled failure after invalid JSON and failed retry.
- Event extraction mapping:
  - Samsung HBM delay maps to MU context signal.
  - irrelevant article does not create `company_event`.
- Candidate validation:
  - high-confidence competitor can auto-add to context.
  - low-confidence mention remains `pending_ai_review`.
  - add-core requires high confidence, ticker, market, and repeated mentions.
- Opportunity persistence:
  - persisted events generate grouped opportunity cards.
  - seed fallback still works when Supabase is absent.

## Acceptance Criteria

1. Running `npx tsx scripts/fetch-opportunity-news.ts` fetches Finnhub news for active core watchlist symbols.
2. Duplicate news does not create duplicate `raw_news` rows.
3. Only rule-relevant news calls DeepSeek.
4. DeepSeek extraction writes auditable `company_event` rows.
5. A Samsung HBM certification delay style article can become a MU context event.
6. DeepSeek `new_company_mentions` can auto-populate `discovered_candidates`.
7. High-confidence candidates can auto-add to `watchlist_context` under hard rule protection.
8. Auto-add to `watchlist_core` is rare and guarded by repeated mention and high confidence rules.
9. `/api/opportunity` returns latest persisted opportunity decisions when available.
10. Dashboard opportunity cards continue to render without a separate `/opportunity` page.
11. Local development still shows seed MU/NVDA/AMD/QQQ/SMH cards without external keys.
12. `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass after implementation.

## Implementation Notes

Prefer small focused modules:

```text
lib/opportunity/news-filter.ts
lib/opportunity/news-dedupe.ts
lib/opportunity/event-extraction.ts
lib/opportunity/candidate-validation.ts
lib/opportunity/pipeline.ts
lib/supabase/opportunity-ingestion.ts
scripts/fetch-opportunity-news.ts
```

Keep provider code in `lib/data-sources/finnhub.ts`.

Keep LLM transport in `lib/llm/client.ts`; add JSON-specific helpers near either `lib/llm` or `lib/opportunity` depending on implementation ergonomics.

Before modifying Next.js route files, check `node_modules/next/dist/docs/` because this project uses Next.js 16.2.6 and local `AGENTS.md` warns that this version has breaking changes.
