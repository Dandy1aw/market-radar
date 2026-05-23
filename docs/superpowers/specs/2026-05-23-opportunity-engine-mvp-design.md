# Opportunity Engine MVP Design

## Goal

Build the first usable vertical slice of the opportunity engine for user-selected watchlist targets. The MVP should prove the product loop before connecting live news APIs or DeepSeek:

```text
core watchlist -> seed news/events -> scoring -> decision level -> opportunity card -> evidence review
```

The feature should help the user answer:

1. Which watched targets deserve attention today?
2. Is the reason price action, news, context signals, or risk?
3. What conditions would make the target more actionable?
4. Which evidence supports the conclusion?

## Product Positioning

The engine is not a stock picker and must not recommend unknown stocks. It only produces full opportunity judgments for `watchlist_core` items explicitly selected by the user.

Related companies in `watchlist_context` can affect a core target as background evidence, but they must not appear as direct buy candidates.

Discovered companies are out of scope for this MVP. They will be handled later through a review queue before entering core or context watchlists.

## MVP Scope

### Included

- Seed data for a small technology watchlist:
  - `MU`, `NVDA`, `AMD`, `QQQ`, `SMH`
- Context entities for validating the relationship model:
  - `Samsung Memory`, `SK Hynix`, `CXMT`, `TSMC`, `ASML`
- Structured seed news/events checked into the repo.
- Rule-based filtering and scoring.
- Opportunity decision generation.
- `/opportunity` page with grouped opportunity cards.
- Evidence expansion on each card.
- Read-only API for latest opportunity data.
- Tests for scoring, grouping, and rendering.

### Excluded

- Live news APIs.
- DeepSeek / LLM calls.
- GitHub Actions scheduled jobs.
- Candidate discovery and approval UI.
- A-share data ingestion.
- Analyst estimates, options implied moves, and earnings surprise automation.
- Trade execution or direct buy/sell commands.

## Decision Levels

The MVP uses six decision levels:

| Level | Meaning |
| --- | --- |
| `small_probe` | Can be watched for a small starter position if risk remains controlled. |
| `pullback_candidate` | Fundamentals or narrative are strong, but current price is not attractive enough. |
| `strong_watch` | The story is strengthening; keep close watch but wait for trigger conditions. |
| `breakout_confirm` | Momentum is improving, but confirmation is still needed. |
| `post_earnings_wait` | Event risk is high; reassess after earnings or guidance. |
| `risk_high` | Risk or overheating dominates; avoid adding exposure for now. |

UI labels should be Chinese and action-safe:

```text
可小仓试探
回调买入候选
继续强关注
突破确认观察
财报后再判断
风险过高
```

## Data Model

The MVP should use a compact subset of the larger idea document.

### `watchlist_core`

Core targets selected by the user.

Required fields:

- `id`
- `symbol`
- `name`
- `market`
- `asset_type`
- `theme`
- `priority`
- `is_active`
- `notes`
- `created_at`
- `updated_at`

### `watchlist_context`

Related entities that provide context for core targets.

Required fields:

- `id`
- `core_symbol`
- `related_symbol`
- `related_name`
- `market`
- `relation_type`
- `relation_strength`
- `reason`
- `is_active`
- `created_at`
- `updated_at`

### `raw_news`

Seed or future fetched news before event extraction.

Required fields:

- `id`
- `source`
- `title`
- `summary`
- `url`
- `published_at`
- `hash`
- `raw_json`
- `created_at`

### `company_event`

Structured event derived from seed news in the MVP.

Required fields:

- `id`
- `symbol`
- `company_name`
- `theme`
- `event_type`
- `event_direction`
- `importance_score`
- `event_summary`
- `evidence_news_ids`
- `published_at`
- `raw_payload`
- `created_at`

### `opportunity_decision`

Latest opportunity judgment for a core target.

Required fields:

- `id`
- `symbol`
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

### Reused Existing Data

The MVP should reuse existing market data tables and helpers where possible:

- `market_price_daily`
- `market_indicator_daily`
- existing chart/detail indicator helpers

Do not add a separate `market_snapshot` table in the MVP unless the current schema cannot provide the needed indicator fields.

## Scoring Model

The MVP scoring model should be intentionally simple and explainable:

```text
total_score =
  0.35 * news_score
+ 0.25 * price_position_score
+ 0.20 * context_signal_score
- 0.20 * risk_score
```

All component scores use `0..100`.

### `news_score`

Based on direct events for the core target.

Examples:

- Major positive product, demand, guidance, or supply signal: high score.
- Mixed event: medium score.
- Legal, regulatory, demand weakness, or guidance cut: low score.

### `price_position_score`

Based on existing indicator fields:

- distance from `MA500`
- `20d` return
- `1y` drawdown
- risk level

The score should reward constructive pullbacks and penalize obvious overheating.

### `context_signal_score`

Based on related-company events that map back to a core target.

Example:

Samsung HBM certification delay should increase MU context signal strength because it may improve Micron's competitive setup.

### `risk_score`

Risk is a deduction.

Inputs:

- high or extreme risk level
- large recent run-up
- price near 52-week high after heavy news flow
- earnings/event risk if represented in seed data

## Decision Rules

Rules should convert scores into decision levels deterministically.

Suggested first-pass thresholds:

| Condition | Decision |
| --- | --- |
| `risk_score >= 75` | `risk_high` |
| event risk flag is active | `post_earnings_wait` |
| `total_score >= 75` and `risk_score < 50` and price is not overheated | `small_probe` |
| `news_score >= 70` and price is overheated | `pullback_candidate` |
| `news_score >= 70` or `context_signal_score >= 70` | `strong_watch` |
| momentum improves but evidence is not enough for `strong_watch` | `breakout_confirm` |
| otherwise | `strong_watch` only if the target remains relevant; otherwise omit from opportunity groups |

The rule layer owns `decision_level`. AI or summary text must not change it in later phases.

## Seed Scenario

The MVP should include a seed scenario that makes the product value obvious:

### MU

- Direct event: HBM demand remains strong.
- Context event: Samsung HBM certification delay.
- Decision should likely be `pullback_candidate` or `strong_watch` if price is extended.

### NVDA

- Direct event: data center demand remains strong.
- Risk: expectations and price position are elevated.
- Decision should likely be `strong_watch` or `risk_high` depending on seed indicators.

### AMD

- Direct event: AI accelerator competition remains intense.
- Context: NVDA demand strength raises competitive pressure.
- Decision should likely be `breakout_confirm` or lower-confidence `strong_watch`.

### QQQ / SMH

- Use them to validate ETF cards and overheating/risk handling.
- SMH can demonstrate a strong theme with price-position risk.

## API Design

### `GET /api/opportunity`

Returns latest opportunity groups.

Response shape:

```ts
{
  updated_at: string;
  summary: {
    total: number;
    strong_watch: number;
    pullback_candidate: number;
    risk_high: number;
  };
  groups: {
    strong_watch: OpportunityCard[];
    pullback_candidate: OpportunityCard[];
    risk_high: OpportunityCard[];
    other: OpportunityCard[];
  };
}
```

### `GET /api/opportunity/[symbol]`

Returns one target's latest decision, events, and evidence news.

This can be implemented after the page-level API if the first page does not need deep linking yet.

## Frontend Design

### Route

```text
/opportunity
```

### Page Sections

1. Header row
   - Last update time
   - Number of targets with active opportunities
   - Most important risk note

2. Today's focus
   - Top 1-3 cards sorted by `total_score`

3. Pullback candidates
   - Targets where the narrative is strong but price is not attractive enough.

4. Strong watch
   - Targets with improving events or context signals.

5. Risk high
   - Targets where risk dominates.

6. Context signals
   - Read-only list of related-company events mapped to core symbols.

### Opportunity Card

Each card shows:

- symbol / name
- theme
- decision label
- total score
- component score chips
- one-paragraph summary
- watch conditions
- risk factors
- evidence events
- evidence news titles in an expandable area

Cards should stay dense and scannable. This is an operational dashboard, not a marketing page.

## File Structure

Suggested implementation files:

```text
app/opportunity/page.tsx
app/api/opportunity/route.ts
components/opportunity/OpportunityCard.tsx
components/opportunity/OpportunityGroup.tsx
components/opportunity/OpportunitySummaryBar.tsx
lib/opportunity/types.ts
lib/opportunity/scoring.ts
lib/opportunity/decision.ts
lib/opportunity/seed.ts
lib/supabase/opportunity.ts
```

## Error Handling

- If no opportunity decisions exist, show an empty state explaining that no active watchlist opportunities are available.
- If Supabase is not configured, return deterministic seed/mock opportunity data so local development remains usable.
- If evidence news is missing, still render the decision card but show no evidence expansion.
- If a score input is missing, use neutral defaults and lower confidence in the summary text.

## Testing

Required test coverage:

- `lib/opportunity/scoring.ts`
  - positive direct event raises `news_score`
  - context event maps to a core symbol
  - high risk reduces final attractiveness

- `lib/opportunity/decision.ts`
  - high risk overrides positive news
  - overheated strong news becomes `pullback_candidate`
  - balanced strong setup becomes `small_probe` or `strong_watch`

- `app/api/opportunity/route.ts`
  - returns grouped opportunity data
  - falls back to seed data when Supabase config is absent

- UI components
  - renders decision labels
  - renders score chips
  - expands evidence
  - handles empty groups

## Acceptance Criteria

The MVP is complete when:

1. `/opportunity` renders locally without external API keys.
2. Seed data produces meaningful cards for `MU`, `NVDA`, `AMD`, `QQQ`, and `SMH`.
3. Context signals can influence a core target without becoming direct recommendations.
4. Each opportunity card shows a decision, scores, watch conditions, risk factors, and evidence.
5. No unknown company appears as a buy/watch candidate unless it is in `watchlist_core`.
6. Tests cover scoring, decision rules, API grouping, and core UI rendering.
7. `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass.

## Later Phases

After this MVP is useful in the browser:

1. Replace seed news with one live US news provider.
2. Add DeepSeek event extraction with strict JSON validation and cost limits.
3. Add GitHub Actions scheduled ingestion.
4. Add discovered candidate review.
5. Add earnings expectations and surprise scoring.
6. Add A-share and private-company support.
