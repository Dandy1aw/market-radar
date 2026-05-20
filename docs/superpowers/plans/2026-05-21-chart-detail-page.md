# Chart Detail Page (走势图) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a K-line chart detail page at `/chart/[symbol]` reachable by clicking any IndexCard on the dashboard, showing an ECharts candlestick chart with MA overlays, key indicators, and recent news.

**Architecture:** SSR server component renders the header (latest IndicatorCard) and news instantly; a `'use client'` ChartPageClient fetches OHLCV data from `/api/chart/[symbol]?range=3m` on mount and re-fetches when the range tab changes, keeping chart updates smooth without page reloads.

**Tech Stack:** Next.js 16.2.6 App Router, React 19, TypeScript strict, echarts ^6.0.0, echarts-for-react ^3.0.6, Supabase, Tailwind CSS v4 (CSS variables).

---

## File Map

| File | Action |
|------|--------|
| `types/index.ts` | Modify — add `ChartCandle`, `ChartMa`, `ChartApiResponse` |
| `lib/supabase/chart.ts` | Create — DB helper `getChartData(symbol, limit)` |
| `app/api/chart/[symbol]/route.ts` | Create — public GET endpoint |
| `components/chart/RangeSelector.tsx` | Create — 3M/6M/1Y/3Y tab buttons |
| `components/chart/KLineChart.tsx` | Create — ECharts candlestick + MA + volume |
| `components/chart/NewsSection.tsx` | Create — news list with sentiment badge |
| `components/chart/ChartPageClient.tsx` | Create — client wrapper, owns range + fetch state |
| `app/chart/[symbol]/page.tsx` | Create — SSR server component |
| `components/dashboard/IndexCard.tsx` | Modify — wrap in Link, add hover affordance |
| `__tests__/lib/chart.test.ts` | Create |
| `__tests__/api/chart.test.ts` | Create |
| `__tests__/components/RangeSelector.test.tsx` | Create |
| `__tests__/components/KLineChart.test.tsx` | Create |

---

### Task 1: Add chart types to `types/index.ts`

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Append the three new interfaces after the existing `DashboardData` interface**

Open `types/index.ts` and add at the very end:

```ts
export interface ChartCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartMa {
  date: string;
  ma20: number | null;
  ma60: number | null;
  ma250: number | null;
}

export interface ChartApiResponse {
  symbol: string;
  name: string;
  candles: ChartCandle[];
  ma: ChartMa[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```
git add types/index.ts
git commit -m "feat: add ChartCandle, ChartMa, ChartApiResponse types"
```

---

### Task 2: Create `lib/supabase/chart.ts` + tests

**Files:**
- Create: `lib/supabase/chart.ts`
- Create: `__tests__/lib/chart.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/chart.test.ts`:

```ts
import { getChartData } from '@/lib/supabase/chart';

const mockPriceRows = [
  { trade_date: '2026-05-20', open: 100, high: 110, low: 95, close: 105, volume: 1000000 },
  { trade_date: '2026-05-19', open: 98,  high: 108, low: 93, close: 100, volume: 900000  },
];

const mockMaRows = [
  { trade_date: '2026-05-20', ma20: 102, ma60: 99, ma250: 95 },
  { trade_date: '2026-05-19', ma20: 101, ma60: 98, ma250: 94 },
];

const mockWatchlistRow = { name: '纳斯达克100' };

function makeMockSupabase(priceRows: unknown[], maRows: unknown[], watchlistRow: unknown) {
  const maQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockResolvedValue({ data: maRows, error: null }),
  };
  const priceQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({ data: priceRows, error: null }),
  };
  const watchlistQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: watchlistRow, error: null }),
  };

  return jest.fn().mockReturnValue({
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'market_price_daily') return priceQuery;
      if (table === 'market_indicator_daily') return maQuery;
      return watchlistQuery;
    }),
  });
}

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
import { createClient } from '@supabase/supabase-js';

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  (createClient as jest.Mock).mockImplementation(
    makeMockSupabase(mockPriceRows, mockMaRows, mockWatchlistRow)
  );
});

afterEach(() => { jest.resetAllMocks(); });

describe('getChartData', () => {
  it('returns data sorted ascending with candles and ma arrays', async () => {
    const result = await getChartData('NDX', 63);
    expect(result).not.toBeNull();
    expect(result!.symbol).toBe('NDX');
    expect(result!.name).toBe('纳斯达克100');
    // ascending: 5/19 first, 5/20 second
    expect(result!.candles[0].date).toBe('2026-05-19');
    expect(result!.candles[1].date).toBe('2026-05-20');
    expect(result!.candles[0].close).toBe(100);
    expect(result!.ma[1].ma20).toBe(102);
  });

  it('returns null when no price data', async () => {
    (createClient as jest.Mock).mockImplementation(
      makeMockSupabase([], [], null)
    );
    const result = await getChartData('UNKNOWN', 63);
    expect(result).toBeNull();
  });

  it('falls back to symbol as name when watchlist has no entry', async () => {
    (createClient as jest.Mock).mockImplementation(
      makeMockSupabase(mockPriceRows, mockMaRows, null)
    );
    const result = await getChartData('NDX', 63);
    expect(result!.name).toBe('NDX');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx jest __tests__/lib/chart.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/supabase/chart'`

- [ ] **Step 3: Create `lib/supabase/chart.ts`**

```ts
import { createClient } from '@supabase/supabase-js';
import type { ChartApiResponse, ChartCandle, ChartMa } from '@/types';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function getChartData(
  symbol: string,
  limit: number,
): Promise<ChartApiResponse | null> {
  const supabase = adminClient();

  const [priceRes, watchlistRes] = await Promise.all([
    supabase
      .from('market_price_daily')
      .select('trade_date, open, high, low, close, volume')
      .eq('symbol', symbol)
      .order('trade_date', { ascending: false })
      .limit(limit),
    supabase
      .from('watchlist')
      .select('name')
      .eq('symbol', symbol)
      .maybeSingle(),
  ]);

  if (priceRes.error) throw priceRes.error;
  if (!priceRes.data || priceRes.data.length === 0) return null;

  const priceRows = priceRes.data as Record<string, unknown>[];
  const dates = priceRows.map(r => r.trade_date as string);

  const maRes = await supabase
    .from('market_indicator_daily')
    .select('trade_date, ma20, ma60, ma250')
    .eq('symbol', symbol)
    .in('trade_date', dates);

  if (maRes.error) throw maRes.error;

  const maMap = Object.fromEntries(
    ((maRes.data ?? []) as Record<string, unknown>[]).map(r => [r.trade_date, r]),
  );

  const sorted = [...priceRows].reverse();

  const candles: ChartCandle[] = sorted.map(r => ({
    date: r.trade_date as string,
    open: Number(r.open),
    high: Number(r.high),
    low: Number(r.low),
    close: Number(r.close),
    volume: Number(r.volume),
  }));

  const ma: ChartMa[] = sorted.map(r => {
    const m = maMap[r.trade_date as string] as Record<string, unknown> | undefined;
    return {
      date: r.trade_date as string,
      ma20: m?.ma20 != null ? Number(m.ma20) : null,
      ma60: m?.ma60 != null ? Number(m.ma60) : null,
      ma250: m?.ma250 != null ? Number(m.ma250) : null,
    };
  });

  const watchlistRow = watchlistRes.data as { name?: string } | null;

  return {
    symbol,
    name: watchlistRow?.name ?? symbol,
    candles,
    ma,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx jest __tests__/lib/chart.test.ts --no-coverage
```

Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```
git add lib/supabase/chart.ts __tests__/lib/chart.test.ts
git commit -m "feat: add getChartData DB helper with tests"
```

---

### Task 3: Create API route `app/api/chart/[symbol]/route.ts` + tests

**Files:**
- Create: `app/api/chart/[symbol]/route.ts`
- Create: `__tests__/api/chart.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api/chart.test.ts`:

```ts
import { GET } from '@/app/api/chart/[symbol]/route';

const mockData = {
  symbol: 'NDX',
  name: '纳斯达克100',
  candles: [{ date: '2026-05-19', open: 100, high: 110, low: 95, close: 105, volume: 1000000 }],
  ma: [{ date: '2026-05-19', ma20: 102, ma60: 99, ma250: 95 }],
};

jest.mock('@/lib/supabase/chart', () => ({
  getChartData: jest.fn(),
}));
import { getChartData } from '@/lib/supabase/chart';

function makeReq(symbol: string, range?: string): [Request, { params: Promise<{ symbol: string }> }] {
  const url = `http://localhost/api/chart/${symbol}${range ? `?range=${range}` : ''}`;
  return [
    new Request(url),
    { params: Promise.resolve({ symbol }) },
  ];
}

beforeEach(() => { (getChartData as jest.Mock).mockResolvedValue(mockData); });
afterEach(() => { jest.resetAllMocks(); });

describe('GET /api/chart/[symbol]', () => {
  it('returns 200 with chart data for valid symbol and default range', async () => {
    const [req, ctx] = makeReq('NDX');
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.symbol).toBe('NDX');
    expect(getChartData).toHaveBeenCalledWith('NDX', 63);
  });

  it('uses correct limit for each range', async () => {
    const cases: [string, number][] = [['3m', 63], ['6m', 126], ['1y', 252], ['3y', 756]];
    for (const [range, limit] of cases) {
      jest.clearAllMocks();
      (getChartData as jest.Mock).mockResolvedValue(mockData);
      const [req, ctx] = makeReq('NDX', range);
      await GET(req, ctx);
      expect(getChartData).toHaveBeenCalledWith('NDX', limit);
    }
  });

  it('returns 400 for invalid range', async () => {
    const [req, ctx] = makeReq('NDX', 'bad');
    const res = await GET(req, ctx);
    expect(res.status).toBe(400);
  });

  it('returns 404 when getChartData returns null', async () => {
    (getChartData as jest.Mock).mockResolvedValue(null);
    const [req, ctx] = makeReq('UNKNOWN');
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx jest __tests__/api/chart.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/app/api/chart/[symbol]/route'`

- [ ] **Step 3: Create the API route**

Create `app/api/chart/[symbol]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getChartData } from '@/lib/supabase/chart';

export const dynamic = 'force-dynamic';

const RANGE_LIMITS: Record<string, number> = {
  '3m': 63,
  '6m': 126,
  '1y': 252,
  '3y': 756,
};

export async function GET(
  req: Request,
  ctx: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const range = searchParams.get('range') ?? '3m';

  const limit = RANGE_LIMITS[range];
  if (!limit) {
    return NextResponse.json(
      { error: 'range must be 3m, 6m, 1y, or 3y' },
      { status: 400 },
    );
  }

  try {
    const data = await getChartData(symbol.toUpperCase(), limit);
    if (!data) {
      return NextResponse.json({ error: 'No data found for symbol' }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error('[GET /api/chart]', err);
    return NextResponse.json({ error: 'Failed to load chart data' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx jest __tests__/api/chart.test.ts --no-coverage
```

Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```
git add "app/api/chart/[symbol]/route.ts" __tests__/api/chart.test.ts
git commit -m "feat: add /api/chart/[symbol] route with range validation"
```

---

### Task 4: Create `components/chart/RangeSelector.tsx` + tests

**Files:**
- Create: `components/chart/RangeSelector.tsx`
- Create: `__tests__/components/RangeSelector.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/components/RangeSelector.test.tsx`:

```tsx
/** @jest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react';
import { RangeSelector } from '@/components/chart/RangeSelector';

describe('RangeSelector', () => {
  it('renders all four range buttons', () => {
    render(<RangeSelector value="3m" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '3M' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '6M' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1Y' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3Y' })).toBeInTheDocument();
  });

  it('calls onChange with correct value when a button is clicked', () => {
    const onChange = jest.fn();
    render(<RangeSelector value="3m" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '1Y' }));
    expect(onChange).toHaveBeenCalledWith('1y');
  });

  it('calls onChange with 6m when 6M is clicked', () => {
    const onChange = jest.fn();
    render(<RangeSelector value="3m" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '6M' }));
    expect(onChange).toHaveBeenCalledWith('6m');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx jest __tests__/components/RangeSelector.test.tsx --no-coverage
```

Expected: FAIL — `Cannot find module '@/components/chart/RangeSelector'`

- [ ] **Step 3: Create `components/chart/RangeSelector.tsx`**

```tsx
export type ChartRange = '3m' | '6m' | '1y' | '3y';

interface Props {
  value: ChartRange;
  onChange: (r: ChartRange) => void;
}

const RANGES: { label: string; value: ChartRange }[] = [
  { label: '3M', value: '3m' },
  { label: '6M', value: '6m' },
  { label: '1Y', value: '1y' },
  { label: '3Y', value: '3y' },
];

export function RangeSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-1">
      {RANGES.map(r => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            value === r.value
              ? 'bg-[var(--text)] text-[var(--bg)]'
              : 'border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx jest __tests__/components/RangeSelector.test.tsx --no-coverage
```

Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```
git add components/chart/RangeSelector.tsx __tests__/components/RangeSelector.test.tsx
git commit -m "feat: add RangeSelector component"
```

---

### Task 5: Create `components/chart/KLineChart.tsx` + tests

**Files:**
- Create: `components/chart/KLineChart.tsx`
- Create: `__tests__/components/KLineChart.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/components/KLineChart.test.tsx`:

```tsx
/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';

jest.mock('echarts-for-react', () => ({
  __esModule: true,
  default: ({ style }: { style?: React.CSSProperties }) => (
    <div data-testid="echarts" style={style} />
  ),
}));

import { KLineChart } from '@/components/chart/KLineChart';
import type { ChartApiResponse } from '@/types';

const mockData: ChartApiResponse = {
  symbol: 'NDX',
  name: '纳斯达克100',
  candles: [
    { date: '2026-05-19', open: 100, high: 110, low: 95, close: 105, volume: 1000000 },
    { date: '2026-05-20', open: 105, high: 115, low: 100, close: 110, volume: 1200000 },
  ],
  ma: [
    { date: '2026-05-19', ma20: 102, ma60: 99, ma250: 95 },
    { date: '2026-05-20', ma20: 103, ma60: 100, ma250: 96 },
  ],
};

describe('KLineChart', () => {
  it('renders ECharts when data is provided', () => {
    render(<KLineChart data={mockData} loading={false} />);
    expect(screen.getByTestId('echarts')).toBeInTheDocument();
  });

  it('shows skeleton when loading', () => {
    render(<KLineChart data={null} loading={true} />);
    expect(screen.queryByTestId('echarts')).toBeNull();
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows empty state when candles array is empty', () => {
    const empty: ChartApiResponse = { ...mockData, candles: [], ma: [] };
    render(<KLineChart data={empty} loading={false} />);
    expect(screen.getByText('暂无 K 线数据')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx jest __tests__/components/KLineChart.test.tsx --no-coverage
```

Expected: FAIL — `Cannot find module '@/components/chart/KLineChart'`

- [ ] **Step 3: Create `components/chart/KLineChart.tsx`**

```tsx
'use client';

import ReactECharts from 'echarts-for-react';
import type { ChartApiResponse } from '@/types';

interface Props {
  data: ChartApiResponse | null;
  loading: boolean;
}

export function KLineChart({ data, loading }: Props) {
  if (loading) {
    return <div className="w-full h-[500px] bg-[var(--bg-subtle)] rounded-lg animate-pulse" />;
  }

  if (!data || data.candles.length === 0) {
    return (
      <div className="w-full h-[500px] flex items-center justify-center text-sm text-[var(--muted)]">
        暂无 K 线数据
      </div>
    );
  }

  const dates = data.candles.map(c => c.date);
  const candleValues = data.candles.map(c => [c.open, c.close, c.low, c.high]);
  const volumes = data.candles.map(c => ({
    value: c.volume,
    itemStyle: { color: c.close >= c.open ? '#ef4444' : '#22c55e' },
  }));

  const option = {
    backgroundColor: 'transparent',
    animation: false,
    legend: {
      data: ['MA20', 'MA60', 'MA250'],
      textStyle: { color: '#6b7280' },
      top: 4,
      right: 8,
    },
    grid: [
      { left: '2%', right: '5%', top: 36, bottom: 160 },
      { left: '2%', right: '5%', top: '78%', bottom: 60 },
    ],
    xAxis: [
      {
        type: 'category',
        data: dates,
        gridIndex: 0,
        axisLabel: { color: '#6b7280', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      {
        type: 'category',
        data: dates,
        gridIndex: 1,
        axisLabel: { show: false },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      },
    ],
    yAxis: [
      {
        scale: true,
        gridIndex: 0,
        position: 'right',
        axisLabel: { color: '#6b7280', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      {
        scale: true,
        gridIndex: 1,
        axisLabel: { show: false },
        splitLine: { show: false },
      },
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1], start: 0, end: 100 },
      {
        type: 'slider',
        xAxisIndex: [0, 1],
        bottom: 10,
        height: 30,
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#6b7280' },
        fillerColor: 'rgba(99,102,241,0.1)',
        handleStyle: { color: '#6366f1' },
      },
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: 'rgba(17,17,27,0.95)',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
    },
    series: [
      {
        name: 'K线',
        type: 'candlestick',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: candleValues,
        itemStyle: {
          color: '#ef4444',
          color0: '#22c55e',
          borderColor: '#ef4444',
          borderColor0: '#22c55e',
        },
      },
      {
        name: 'MA20',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: data.ma.map(m => m.ma20),
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#818cf8', width: 1.5 },
        itemStyle: { color: '#818cf8' },
      },
      {
        name: 'MA60',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: data.ma.map(m => m.ma60),
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#fbbf24', width: 1.5 },
        itemStyle: { color: '#fbbf24' },
      },
      {
        name: 'MA250',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: data.ma.map(m => m.ma250),
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#38bdf8', width: 1.5 },
        itemStyle: { color: '#38bdf8' },
      },
      {
        name: '成交量',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumes,
        barMaxWidth: 8,
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: '500px', width: '100%' }}
      opts={{ renderer: 'canvas' }}
    />
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx jest __tests__/components/KLineChart.test.tsx --no-coverage
```

Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```
git add components/chart/KLineChart.tsx __tests__/components/KLineChart.test.tsx
git commit -m "feat: add KLineChart ECharts component with MA overlays and volume"
```

---

### Task 6: Create `components/chart/NewsSection.tsx`

**Files:**
- Create: `components/chart/NewsSection.tsx`

No test needed — pure display component with no logic beyond a conditional render.

- [ ] **Step 1: Create `components/chart/NewsSection.tsx`**

```tsx
import type { MarketNews } from '@/types';

const sentimentStyles: Record<string, string> = {
  positive: 'text-green-400 bg-green-400/10',
  negative: 'text-red-400 bg-red-400/10',
  neutral: 'text-[var(--muted)] bg-[var(--bg-subtle)]',
};

const sentimentLabels: Record<string, string> = {
  positive: '利好',
  negative: '利空',
  neutral: '中性',
};

interface Props { news: MarketNews[]; }

export function NewsSection({ news }: Props) {
  if (news.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)] mb-3">
        近期新闻
      </h2>
      <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] overflow-hidden">
        {news.map(item => {
          const sentiment = item.sentiment ?? 'neutral';
          const style = sentimentStyles[sentiment] ?? sentimentStyles.neutral;
          const label = sentimentLabels[sentiment] ?? '中性';
          const dateStr = item.published_at
            ? new Date(item.published_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
            : '';

          return (
            <div key={item.id} className="px-4 py-3 bg-[var(--bg-card)]">
              <div className="flex items-start gap-3">
                <span className={`shrink-0 mt-0.5 text-xs px-1.5 py-0.5 rounded font-medium ${style}`}>
                  {label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-[var(--text)] hover:text-indigo-400 truncate"
                      >
                        {item.title}
                      </a>
                    ) : (
                      <span className="text-sm font-medium text-[var(--text)] truncate">
                        {item.title}
                      </span>
                    )}
                    <span className="shrink-0 text-xs text-[var(--muted)]">{dateStr}</span>
                  </div>
                  {item.summary && (
                    <p className="text-xs text-[var(--muted)] mt-1 line-clamp-2">{item.summary}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Run full test suite to confirm no regressions**

```
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```
git add components/chart/NewsSection.tsx
git commit -m "feat: add NewsSection component with sentiment badge"
```

---

### Task 7: Create `components/chart/ChartPageClient.tsx`

**Files:**
- Create: `components/chart/ChartPageClient.tsx`

No unit test — this is a composition component; covered by E2E behaviour.

- [ ] **Step 1: Create `components/chart/ChartPageClient.tsx`**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RangeSelector } from './RangeSelector';
import type { ChartRange } from './RangeSelector';
import { KLineChart } from './KLineChart';
import { NewsSection } from './NewsSection';
import { formatPrice, formatPct, getPctColor, getRiskLabel } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import type { ChartApiResponse, IndicatorCard, MarketNews, RiskLevel } from '@/types';

const riskVariant: Record<RiskLevel, 'positive' | 'warning' | 'negative'> = {
  low: 'positive',
  medium: 'warning',
  high: 'negative',
  extreme: 'negative',
};

interface Props {
  symbol: string;
  indicator: IndicatorCard;
  news: MarketNews[];
}

export function ChartPageClient({ symbol, indicator, news }: Props) {
  const router = useRouter();
  const [range, setRange] = useState<ChartRange>('3m');
  const [retryCount, setRetryCount] = useState(0);
  const [chartData, setChartData] = useState<ChartApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/chart/${symbol}?range=${range}`, { cache: 'no-store' })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ChartApiResponse>;
      })
      .then(data => setChartData(data))
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [symbol, range, retryCount]);

  const statItems = [
    { label: '5日涨跌', value: indicator.pct_change_5d },
    { label: '20日涨跌', value: indicator.pct_change_20d },
    { label: '距MA500', value: indicator.pct_from_ma500 },
    { label: '年内回撤', value: indicator.drawdown_1y },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.back()}
          aria-label="返回"
          className="mt-2 text-sm text-[var(--muted)] hover:text-[var(--text)] transition-colors shrink-0"
        >
          ← 返回
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <span className="text-sm font-mono text-[var(--muted)]">{symbol}</span>
              <p className="text-lg font-semibold text-[var(--text)]">{indicator.name}</p>
            </div>
            {indicator.risk_level && (
              <Badge
                variant={riskVariant[indicator.risk_level]}
                label={getRiskLabel(indicator.risk_level)}
              />
            )}
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-bold tabular-nums tracking-tight">
              {formatPrice(indicator.close)}
            </span>
            {indicator.pct_change_1d !== null && (
              <span className={`text-base font-semibold tabular-nums ${getPctColor(indicator.pct_change_1d)}`}>
                {formatPct(indicator.pct_change_1d)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Range selector */}
      <RangeSelector value={range} onChange={setRange} />

      {/* Chart or error */}
      {error ? (
        <div className="flex flex-col items-center justify-center h-[500px] gap-3 text-sm text-[var(--muted)]">
          <span>加载失败：{error}</span>
          <button
            onClick={() => setRetryCount(c => c + 1)}
            className="px-3 py-1.5 rounded border border-[var(--border)] text-xs hover:bg-[var(--bg-card)] transition-colors"
          >
            重试
          </button>
        </div>
      ) : (
        <KLineChart data={chartData} loading={loading} />
      )}

      {/* Stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statItems.map(({ label, value }) =>
          value !== null ? (
            <div
              key={label}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3"
            >
              <p className="text-xs text-[var(--muted)] mb-1">{label}</p>
              <p className={`text-sm font-semibold tabular-nums ${getPctColor(value)}`}>
                {formatPct(value)}
              </p>
            </div>
          ) : null,
        )}
      </div>

      {/* News */}
      <NewsSection news={news} />
    </div>
  );
}
```

- [ ] **Step 2: Run full test suite**

```
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```
git add components/chart/ChartPageClient.tsx
git commit -m "feat: add ChartPageClient with range switching and retry"
```

---

### Task 8: Create `app/chart/[symbol]/page.tsx`

**Files:**
- Create: `app/chart/[symbol]/page.tsx`

- [ ] **Step 1: Create the directory and file**

Create `app/chart/[symbol]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { ChartPageClient } from '@/components/chart/ChartPageClient';
import type { IndicatorCard, MarketNews, RiskLevel } from '@/types';

export const dynamic = 'force-dynamic';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export default async function ChartPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const upperSymbol = symbol.toUpperCase();
  const supabase = adminClient();

  const [indicatorRes, nameRes, newsRes] = await Promise.all([
    supabase
      .from('market_indicator_daily')
      .select('*')
      .eq('symbol', upperSymbol)
      .order('trade_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('watchlist')
      .select('name')
      .eq('symbol', upperSymbol)
      .maybeSingle(),
    supabase
      .from('market_news')
      .select('*')
      .eq('symbol', upperSymbol)
      .order('published_at', { ascending: false })
      .limit(5),
  ]);

  if (!indicatorRes.data) notFound();

  const row = indicatorRes.data as Record<string, unknown>;
  const indicator: IndicatorCard = {
    symbol: upperSymbol,
    name: (nameRes.data?.name as string) ?? upperSymbol,
    trade_date: row.trade_date as string,
    close: Number(row.close),
    pct_change_1d: row.pct_change_1d != null ? Number(row.pct_change_1d) : null,
    pct_change_5d: row.pct_change_5d != null ? Number(row.pct_change_5d) : null,
    pct_change_20d: row.pct_change_20d != null ? Number(row.pct_change_20d) : null,
    ma20: row.ma20 != null ? Number(row.ma20) : null,
    ma60: row.ma60 != null ? Number(row.ma60) : null,
    ma250: row.ma250 != null ? Number(row.ma250) : null,
    ma500: row.ma500 != null ? Number(row.ma500) : null,
    ma1000: row.ma1000 != null ? Number(row.ma1000) : null,
    pct_from_ma500: row.pct_from_ma500 != null ? Number(row.pct_from_ma500) : null,
    pct_from_ma1000: row.pct_from_ma1000 != null ? Number(row.pct_from_ma1000) : null,
    drawdown_1y: row.drawdown_1y != null ? Number(row.drawdown_1y) : null,
    volume_ratio: row.volume_ratio != null ? Number(row.volume_ratio) : null,
    risk_level: (row.risk_level as RiskLevel) ?? null,
  };

  const news = (newsRes.data ?? []) as MarketNews[];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <ChartPageClient symbol={upperSymbol} indicator={indicator} news={news} />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```
git add "app/chart/[symbol]/page.tsx"
git commit -m "feat: add /chart/[symbol] server-rendered page"
```

---

### Task 9: Make `IndexCard` clickable — link to detail page

**Files:**
- Modify: `components/dashboard/IndexCard.tsx`

Current file begins with:
```tsx
import { formatPrice, formatPct, getPctColor, getRiskLabel } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { IndicatorCard, RiskLevel } from '@/types';
```

- [ ] **Step 1: Add Link import and wrap Card**

Replace the entire file content with:

```tsx
import Link from 'next/link';
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
    <Link href={`/chart/${data.symbol}`} className="block group">
      <Card hover className="relative">
        <span className="absolute top-3 right-3 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity text-xs">
          ↗
        </span>

        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="text-sm font-mono text-[var(--muted)]">{data.symbol}</span>
            <p className="text-base font-semibold text-[var(--text)]">{data.name}</p>
          </div>
          {data.risk_level && (
            <Badge variant={riskVariant[data.risk_level]} label={getRiskLabel(data.risk_level)} />
          )}
        </div>

        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-2xl font-bold tabular-nums tracking-tight">
            {formatPrice(data.close)}
          </span>
          {data.pct_change_1d !== null && (
            <span className={`text-sm font-semibold tabular-nums ${getPctColor(data.pct_change_1d)}`}>
              {formatPct(data.pct_change_1d)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-[var(--muted)]">
          {data.pct_change_5d !== null && (
            <>
              <span>5日</span>
              <span className={`tabular-nums font-medium ${getPctColor(data.pct_change_5d)}`}>
                {formatPct(data.pct_change_5d)}
              </span>
            </>
          )}
          {data.pct_change_20d !== null && (
            <>
              <span>20日</span>
              <span className={`tabular-nums font-medium ${getPctColor(data.pct_change_20d)}`}>
                {formatPct(data.pct_change_20d)}
              </span>
            </>
          )}
          {data.pct_from_ma500 !== null && (
            <>
              <span>距MA500</span>
              <span className={`tabular-nums font-medium ${getPctColor(data.pct_from_ma500)}`}>
                {formatPct(data.pct_from_ma500)}
              </span>
            </>
          )}
          {data.drawdown_1y !== null && (
            <>
              <span>年内回撤</span>
              <span className="tabular-nums font-medium text-red-400">
                {formatPct(data.drawdown_1y)}
              </span>
            </>
          )}
        </div>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 2: Run full test suite**

```
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 3: Verify TypeScript**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```
git add components/dashboard/IndexCard.tsx
git commit -m "feat: make IndexCard link to /chart/[symbol] detail page"
```

---

## Done

All tasks complete. Run `npx jest` to confirm 68+ tests pass, then use `superpowers:finishing-a-development-branch` to merge or create a PR.
