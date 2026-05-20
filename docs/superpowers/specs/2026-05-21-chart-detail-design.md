# Chart Detail Page (走势图) Design Spec

## Goal

Add a clickable K-line detail page for each index/ETF. Clicking an `IndexCard` on the dashboard navigates to `/chart/[symbol]`, which shows a full ECharts candlestick chart with MA overlays, key indicators, and recent news.

## Architecture

**Approach: SSR header + client-side chart (hybrid)**

The page server-renders the header (current indicators) and news section for instant display. The ECharts chart is a `'use client'` component that fetches OHLCV data from a dedicated API route, enabling smooth time-range switching without full-page reloads.

### Files

| File | Action | Responsibility |
|------|--------|---------------|
| `app/chart/[symbol]/page.tsx` | Create | Server component: fetch IndicatorCard + news, render layout |
| `components/chart/ChartPageClient.tsx` | Create | `'use client'` wrapper: owns `range` state, composes sub-components |
| `components/chart/KLineChart.tsx` | Create | `'use client'` ECharts candlestick + MA overlay + volume sub-chart |
| `components/chart/RangeSelector.tsx` | Create | 3M / 6M / 1Y / 3Y tab buttons |
| `components/chart/NewsSection.tsx` | Create | Pure display: list of news items with sentiment badge |
| `app/api/chart/[symbol]/route.ts` | Create | GET: query OHLCV + MA data, return merged JSON |
| `components/dashboard/IndexCard.tsx` | Modify | Wrap with `<Link href="/chart/{symbol}">`, add hover affordance |
| `lib/supabase/chart.ts` | Create | DB helpers: `getChartData(symbol, limit)` |

---

## API

### `GET /api/chart/[symbol]?range=3m`

**Query params:**
- `range`: `3m` | `6m` | `1y` | `3y` (default: `3m`)

**Range → row limit mapping:**
| range | trading days |
|-------|-------------|
| 3m | 63 |
| 6m | 126 |
| 1y | 252 |
| 3y | 756 |

**Response `200`:**
```ts
{
  symbol: string;
  name: string;
  candles: {
    date: string;      // "YYYY-MM-DD"
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
  ma: {
    date: string;
    ma20: number | null;
    ma60: number | null;
    ma250: number | null;
  }[];
}
```

Both `candles` and `ma` are sorted ascending by `trade_date` (left-to-right for ECharts x-axis).

**Error responses:**
- `400` — invalid `range` value
- `404` — symbol has no data in DB

**Auth:** Public (read-only price data, no admin token required).

**DB queries:**
1. `market_price_daily` WHERE symbol = ? ORDER BY trade_date DESC LIMIT {n} → reverse
2. `market_indicator_daily` WHERE symbol = ? AND trade_date IN (dates from step 1) → join by date
3. `watchlist` WHERE symbol = ? → fetch `name` field

---

## Page Layout

```
/chart/[symbol]

← 返回                     NDX · 纳斯达克100
                           18,234.56  +1.23%  [低风险]

[3M] [6M] [1Y] [3Y]

┌──────────────────────────────────────────────────┐
│  K 线图 candlestick (~400px)                      │
│  Overlay: MA20 (indigo-400) / MA60 (amber-400)   │
│            MA250 (sky-400)                        │
│  Legend: clickable to toggle each MA line         │
├──────────────────────────────────────────────────┤
│  Volume 柱状子图 (~100px)                         │
└──────────────────────────────────────────────────┘

5日 +2.1%   20日 -0.8%   距MA500 +12.3%   年内回撤 -18.4%

── 近期新闻 ───────────────────────────────────────
[情绪] 标题                                    日期
       摘要 (truncated to 2 lines)
(up to 5 items)
```

---

## Component Details

### `app/chart/[symbol]/page.tsx`
- `export const dynamic = 'force-dynamic'`
- `params: Promise<{ symbol: string }>` — await before use (Next.js 16 pattern)
- Fetch `market_indicator_daily` for latest trade date → build `IndicatorCard`
- Fetch `market_news` WHERE symbol = ? ORDER BY published_at DESC LIMIT 5
- If no indicator data → call `notFound()`
- Pass `indicatorCard` and `news` as props to `ChartPageClient`

### `components/chart/ChartPageClient.tsx`
- `'use client'`
- State: `range: '3m' | '6m' | '1y' | '3y'` (default `'3m'`)
- State: `chartData: ChartApiResponse | null`, `loading: boolean`, `error: string | null`
- `useEffect` on `range` change → fetch `/api/chart/${symbol}?range=${range}`
- Renders: back button (`useRouter().back()`, fallback `/`) + header + `RangeSelector` + `KLineChart` + indicator row + `NewsSection`

### `components/chart/KLineChart.tsx`
- `'use client'`
- Uses `echarts-for-react` (`ReactECharts`)
- ECharts config:
  - `xAxis`: time axis from `candles[].date`
  - `yAxis[0]`: price (right side), `yAxis[1]`: volume (hidden labels)
  - Series: candlestick on yAxis[0]; MA20/60/250 line series on yAxis[0]; volume bar on yAxis[1]
  - `dataZoom`: inside + slider for pan/zoom
  - Background transparent, colors from project theme
  - Candlestick: up `#ef4444` (red), down `#22c55e` (green) — Chinese convention
- Loading state: skeleton placeholder (same height as chart)
- Empty state: centered "暂无 K 线数据" text

### `components/chart/RangeSelector.tsx`
- Pure UI: 4 buttons `3M | 6M | 1Y | 3Y`
- Active button: `bg-[var(--text)] text-[var(--bg)]`; inactive: `border border-[var(--border)] text-[var(--muted)]`

### `components/chart/NewsSection.tsx`
- Pure display component (no state)
- Props: `news: MarketNews[]`
- Sentiment badge colors: positive=green, negative=red, neutral=muted
- Each item: badge + title (truncate) + date | summary (line-clamp-2)
- Empty: render nothing (section hidden when no news)

### `lib/supabase/chart.ts`
- `getChartData(symbol: string, limit: number): Promise<ChartApiResponse>`
- Uses `SUPABASE_SERVICE_ROLE_KEY` (server-only)

### `components/dashboard/IndexCard.tsx`
- Wrap entire card in `<Link href={`/chart/${data.symbol}`}>`
- Add `group` class to Card, small `↗` icon top-right on hover

---

## ECharts Theme Config

| Element | Color |
|---------|-------|
| Candle up | `#ef4444` |
| Candle down | `#22c55e` |
| MA20 | `#818cf8` (indigo-400) |
| MA60 | `#fbbf24` (amber-400) |
| MA250 | `#38bdf8` (sky-400) |
| Axis / labels | `#6b7280` (matches `--muted`) |
| Background | transparent |
| Grid lines | `rgba(255,255,255,0.05)` |

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Symbol not in DB | Server calls `notFound()` → Next.js 404 |
| OHLCV data empty | KLineChart shows "暂无 K 线数据" placeholder |
| API fetch error | ChartPageClient shows error message + retry button |
| News empty | NewsSection renders nothing |

---

## Testing

- `__tests__/api/chart.test.ts` — unit tests for range validation (400), missing symbol (404), valid response shape
- `__tests__/lib/chart.test.ts` — unit tests for `getChartData` with mocked Supabase
- `__tests__/components/KLineChart.test.tsx` — renders without crash with mock data; shows placeholder when candles=[]
- `__tests__/components/RangeSelector.test.tsx` — clicking each button calls `onChange` with correct value
