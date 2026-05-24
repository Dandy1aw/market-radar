# Watchlist Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded symbol arrays in fetch/recommendation scripts with reads from the existing `watchlist` table, and add an admin-protected `/watchlist` page with CRUD UI so the user can edit the symbol universe without redeploying.

**Architecture:** A single shared helper `getEnabledSymbols(market)` reads `watchlist` and replaces three hardcoded arrays. A second helper `requireAdmin(req)` validates a `Bearer <ADMIN_TOKEN>` header for write endpoints. The frontend route `/watchlist` reads via a public GET and writes via authenticated POST/PATCH/DELETE; the token is stored in `localStorage` after the user enters it once. The `app/api/dashboard` `INDEX_SYMBOLS` / `ETF_SYMBOLS` literals are also replaced by `asset_type` lookups so adding a new index/ETF in the table reflects immediately on the dashboard.

**Tech Stack:** Next.js 16.2.6 (App Router, `dynamic = 'force-dynamic'`), TypeScript, Supabase JS, Jest + @testing-library/react, Tailwind v4.

---

## File Structure

**Created:**
- `lib/auth.ts` — `requireAdmin(req: Request): { ok: true } | { ok: false; status: 401 | 500; message: string }`
- `lib/supabase/watchlist.ts` — `getEnabledSymbols(market?: 'US' | 'CN')` and `getWatchlistRows(market?)`
- `app/api/watchlist/route.ts` — GET (public), POST (admin)
- `app/api/watchlist/[id]/route.ts` — PATCH, DELETE (admin)
- `app/watchlist/page.tsx` — server component, fetches list and renders client UI
- `components/watchlist/TokenGate.tsx` — client, manages `localStorage.adminToken`
- `components/watchlist/AddSymbolForm.tsx` — client, POST form
- `components/watchlist/WatchlistTable.tsx` — client, list with toggle + delete
- `__tests__/lib/auth.test.ts`
- `__tests__/lib/supabase/watchlist.test.ts`
- `__tests__/components/AddSymbolForm.test.tsx`
- `__tests__/components/WatchlistTable.test.tsx`

**Modified:**
- `lib/supabase/queries.ts` — replace `INDEX_SYMBOLS`/`ETF_SYMBOLS` literals (lines 19-20) with a watchlist lookup
- `scripts/fetch-us-market.ts` — remove hardcoded `US_SYMBOLS` (line 22), use `getEnabledSymbols('US')`
- `scripts/fetch-us-news.ts` — same swap
- `scripts/generate-recommendations.ts` — same swap if it has a hardcoded list
- `components/layout/Navbar.tsx` — add `/watchlist` link (line 13-14 region)
- `.env.local` — add `ADMIN_TOKEN=<generated>`
- `.env.local.example` — add `ADMIN_TOKEN=` placeholder line

---

## Open Decision Locked In

- Watchlist list view is **flat** (no grouping by category). Category is displayed as a sortable/filterable column; grouping can be added later if the table grows past ~50 rows.
- Token is stored client-side in `localStorage` and sent as `Authorization: Bearer <token>` on each write. No login page, no rotation flow — it is a personal-use guard rail, not a real auth system.
- Adding a symbol does **not** trigger an immediate data fetch. The next scheduled GitHub Actions run picks it up. A `workflow_dispatch` button is out of scope for this plan.

---

## Task 1: Add `getEnabledSymbols` helper (TDD)

**Files:**
- Create: `lib/supabase/watchlist.ts`
- Test: `__tests__/lib/supabase/watchlist.test.ts`

- [ ] **Step 1.1: Write the failing test**

Create `__tests__/lib/supabase/watchlist.test.ts`:

```typescript
import { filterEnabledSymbols, type WatchlistRow } from '@/lib/supabase/watchlist';

describe('filterEnabledSymbols', () => {
  const rows: WatchlistRow[] = [
    { id: 1, symbol: 'QQQ', name: 'NDX ETF', market: 'US', asset_type: 'etf', category: 'tech', enabled: true },
    { id: 2, symbol: 'AAPL', name: 'Apple', market: 'US', asset_type: 'stock', category: 'tech', enabled: true },
    { id: 3, symbol: 'OLD', name: 'Disabled', market: 'US', asset_type: 'stock', category: null, enabled: false },
    { id: 4, symbol: '510300', name: '沪深300ETF', market: 'CN', asset_type: 'etf', category: 'broad', enabled: true },
  ];

  it('returns only enabled rows when market is omitted', () => {
    expect(filterEnabledSymbols(rows).map(r => r.symbol)).toEqual(['QQQ', 'AAPL', '510300']);
  });

  it('filters by market when provided', () => {
    expect(filterEnabledSymbols(rows, 'US').map(r => r.symbol)).toEqual(['QQQ', 'AAPL']);
    expect(filterEnabledSymbols(rows, 'CN').map(r => r.symbol)).toEqual(['510300']);
  });

  it('excludes disabled rows even when market matches', () => {
    const disabledOnly: WatchlistRow[] = [{ ...rows[2] }];
    expect(filterEnabledSymbols(disabledOnly, 'US')).toEqual([]);
  });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `npx jest __tests__/lib/supabase/watchlist.test.ts`
Expected: FAIL — `Cannot find module '@/lib/supabase/watchlist'`.

- [ ] **Step 1.3: Create the module with the pure filter + DB fetch wrapper**

Create `lib/supabase/watchlist.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Market } from '@/types';

export interface WatchlistRow {
  id: number;
  symbol: string;
  name: string | null;
  market: Market;
  asset_type: 'index' | 'etf' | 'stock' | 'sector';
  category: string | null;
  enabled: boolean;
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export function filterEnabledSymbols(rows: WatchlistRow[], market?: Market): WatchlistRow[] {
  return rows.filter(r => r.enabled && (market ? r.market === market : true));
}

export async function getWatchlistRows(market?: Market): Promise<WatchlistRow[]> {
  const supabase = adminClient();
  let query = supabase
    .from('watchlist')
    .select('id, symbol, name, market, asset_type, category, enabled')
    .order('market', { ascending: true })
    .order('asset_type', { ascending: true })
    .order('symbol', { ascending: true });
  if (market) query = query.eq('market', market);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as WatchlistRow[];
}

export async function getEnabledSymbols(market?: Market): Promise<string[]> {
  const rows = await getWatchlistRows(market);
  return filterEnabledSymbols(rows, market).map(r => r.symbol);
}
```

- [ ] **Step 1.4: Run test to verify it passes**

Run: `npx jest __tests__/lib/supabase/watchlist.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 1.5: Commit**

```bash
git add lib/supabase/watchlist.ts __tests__/lib/supabase/watchlist.test.ts
git commit -m "feat: add watchlist DB helper with filterEnabledSymbols"
```

---

## Task 2: Add `requireAdmin` helper (TDD)

**Files:**
- Create: `lib/auth.ts`
- Test: `__tests__/lib/auth.test.ts`

- [ ] **Step 2.1: Write the failing test**

Create `__tests__/lib/auth.test.ts`:

```typescript
import { requireAdmin } from '@/lib/auth';

function makeReq(authHeader: string | undefined): Request {
  const headers = new Headers();
  if (authHeader !== undefined) headers.set('authorization', authHeader);
  return new Request('http://localhost/api/x', { method: 'POST', headers });
}

describe('requireAdmin', () => {
  const ORIGINAL = process.env.ADMIN_TOKEN;
  afterEach(() => { process.env.ADMIN_TOKEN = ORIGINAL; });

  it('returns 500 when ADMIN_TOKEN is not configured', () => {
    delete process.env.ADMIN_TOKEN;
    const res = requireAdmin(makeReq('Bearer anything'));
    expect(res).toEqual({ ok: false, status: 500, message: 'ADMIN_TOKEN not configured' });
  });

  it('returns 401 when Authorization header is missing', () => {
    process.env.ADMIN_TOKEN = 'secret';
    const res = requireAdmin(makeReq(undefined));
    expect(res).toEqual({ ok: false, status: 401, message: 'Missing or invalid authorization' });
  });

  it('returns 401 when header is not Bearer scheme', () => {
    process.env.ADMIN_TOKEN = 'secret';
    const res = requireAdmin(makeReq('Basic secret'));
    expect(res).toEqual({ ok: false, status: 401, message: 'Missing or invalid authorization' });
  });

  it('returns 401 when token does not match', () => {
    process.env.ADMIN_TOKEN = 'secret';
    const res = requireAdmin(makeReq('Bearer wrong'));
    expect(res).toEqual({ ok: false, status: 401, message: 'Invalid token' });
  });

  it('returns ok when token matches', () => {
    process.env.ADMIN_TOKEN = 'secret';
    const res = requireAdmin(makeReq('Bearer secret'));
    expect(res).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `npx jest __tests__/lib/auth.test.ts`
Expected: FAIL — `Cannot find module '@/lib/auth'`.

- [ ] **Step 2.3: Implement**

Create `lib/auth.ts`:

```typescript
export type AdminAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 500; message: string };

export function requireAdmin(req: Request): AdminAuthResult {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return { ok: false, status: 500, message: 'ADMIN_TOKEN not configured' };

  const header = req.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return { ok: false, status: 401, message: 'Missing or invalid authorization' };
  }
  const provided = header.slice('Bearer '.length).trim();
  if (provided !== expected) return { ok: false, status: 401, message: 'Invalid token' };
  return { ok: true };
}
```

- [ ] **Step 2.4: Run test to verify it passes**

Run: `npx jest __tests__/lib/auth.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 2.5: Commit**

```bash
git add lib/auth.ts __tests__/lib/auth.test.ts
git commit -m "feat: add requireAdmin helper for bearer-token guarded routes"
```

---

## Task 3: Refactor `fetch-us-market.ts` to read symbols from DB

**Files:**
- Modify: `scripts/fetch-us-market.ts` (replace lines 19-25)

- [ ] **Step 3.1: Replace hardcoded array with DB read**

Open `scripts/fetch-us-market.ts`. Change the top imports section so it imports `getEnabledSymbols`, then remove the comment block and `US_SYMBOLS` literal, then change `main()` to fetch the list at start.

Replace lines 1-4 with:

```typescript
// Run via: npx tsx scripts/fetch-us-market.ts
import { createClient } from '@supabase/supabase-js';
import { fetchDailyFull, type OhlcvRecord } from '../lib/data-sources/alpha-vantage';
import { calcMA, calcDrawdown1y, calcVolumeRatio, calcRiskLevel } from '../lib/indicators';
import { getEnabledSymbols } from '../lib/supabase/watchlist';
```

Delete lines 19-25 (the `US_SYMBOLS` block and its leading comment).

Replace the `for (const symbol of US_SYMBOLS) {` line in `main()` with:

```typescript
async function main() {
  const symbols = await getEnabledSymbols('US');
  if (symbols.length === 0) {
    console.error('No enabled US symbols in watchlist. Aborting.');
    process.exit(1);
  }
  console.log(`Fetching ${symbols.length} US symbols...`);
  for (const symbol of symbols) {
```

- [ ] **Step 3.2: Smoke-test the script compiles**

Run: `npx tsc --noEmit scripts/fetch-us-market.ts`
Expected: no output (clean). If TS complains about the unused import or missing semicolon, fix.

(Do **not** actually run the script — it would consume Alpha Vantage rate-limit budget. The end-to-end run is covered in Task 16.)

- [ ] **Step 3.3: Commit**

```bash
git add scripts/fetch-us-market.ts
git commit -m "refactor: read US symbols from watchlist table instead of hardcoded array"
```

---

## Task 4: Refactor `fetch-us-news.ts` to read symbols from DB

**Files:**
- Modify: `scripts/fetch-us-news.ts`

- [ ] **Step 4.1: Read the current file to find the hardcoded list**

Run: `npx jest --listTests 2>/dev/null; cat scripts/fetch-us-news.ts | head -40`
(Pattern: there is a `const NEWS_SYMBOLS = [...]` or similar. Locate it.)

- [ ] **Step 4.2: Replace it the same way as Task 3**

Add the import: `import { getEnabledSymbols } from '../lib/supabase/watchlist';`

Delete the hardcoded `NEWS_SYMBOLS` literal.

At the top of `main()` (just inside the function, before any other work):

```typescript
const symbols = await getEnabledSymbols('US');
if (symbols.length === 0) {
  console.error('No enabled US symbols in watchlist. Aborting.');
  process.exit(1);
}
```

Replace any `for (const symbol of NEWS_SYMBOLS)` with `for (const symbol of symbols)`.

- [ ] **Step 4.3: Type-check**

Run: `npx tsc --noEmit scripts/fetch-us-news.ts`
Expected: clean.

- [ ] **Step 4.4: Commit**

```bash
git add scripts/fetch-us-news.ts
git commit -m "refactor: read US news symbols from watchlist"
```

---

## Task 5: Refactor `generate-recommendations.ts` to read symbols from DB

**Files:**
- Modify: `scripts/generate-recommendations.ts` (only if a hardcoded symbol list exists; if it reads from `market_indicator_daily` already, this task is a no-op — verify and skip.)

- [ ] **Step 5.1: Read the current script to determine if any change is needed**

Run: `Get-Content scripts/generate-recommendations.ts | Select-String -Pattern "const.*SYMBOLS\s*="`
Expected: either matches an array literal (→ continue) or no output (→ this task is a no-op; jump to commit a doc note in Step 5.4).

- [ ] **Step 5.2: If a hardcoded list exists, swap it like Task 3/4**

Add `import { getEnabledSymbols } from '../lib/supabase/watchlist';` at the top, replace the literal with a runtime fetch, abort with a clear error if empty.

- [ ] **Step 5.3: Type-check**

Run: `npx tsc --noEmit scripts/generate-recommendations.ts`
Expected: clean.

- [ ] **Step 5.4: Commit**

If a real change was made:

```bash
git add scripts/generate-recommendations.ts
git commit -m "refactor: read symbols from watchlist in recommendation generator"
```

If nothing changed, skip this commit.

---

## Task 6: Refactor `lib/supabase/queries.ts` to derive index/etf cards from `asset_type` instead of literal arrays

**Files:**
- Modify: `lib/supabase/queries.ts` lines 19-20 and 140-141

- [ ] **Step 6.1: Replace the literal arrays with a derived map**

In `lib/supabase/queries.ts`, delete lines 19-20:

```typescript
const INDEX_SYMBOLS = ['NDX', 'SPX', 'VIX'];
const ETF_SYMBOLS = ['QQQ', 'SPY', 'VOO', 'XLK', 'SMH', 'SOXX', 'TLT', 'GLD'];
```

In the `getDashboardData()` function, after the existing `watchlistRes` fetch (line 77-80), expand the `select` so it also returns `asset_type`:

```typescript
supabase
  .from('watchlist')
  .select('symbol, name, market, asset_type')
  .eq('enabled', true),
```

(It already selects those fields — confirm and leave as is.)

After computing `nameMap`, also build:

```typescript
const assetTypeMap = Object.fromEntries(
  ((watchlistRes.data ?? []) as { symbol: string; asset_type: string }[])
    .map(w => [w.symbol, w.asset_type]),
);
```

Then replace lines 140-141:

```typescript
const indexCards = indicators.filter(i => assetTypeMap[i.symbol] === 'index');
const etfCards = indicators.filter(i => assetTypeMap[i.symbol] === 'etf');
```

- [ ] **Step 6.2: Verify the dashboard still type-checks and the dev server renders**

Run: `npx tsc --noEmit`
Expected: clean (or at most pre-existing warnings, no new errors).

Run: `npm run dev` in a background terminal, then open `http://localhost:3000`. The index row and ETF row should still populate. Stop the dev server.

- [ ] **Step 6.3: Commit**

```bash
git add lib/supabase/queries.ts
git commit -m "refactor: derive index/etf cards from watchlist asset_type"
```

---

## Task 7: `GET /api/watchlist` route (public read)

**Files:**
- Create: `app/api/watchlist/route.ts`

- [ ] **Step 7.1: Implement the GET handler**

Create `app/api/watchlist/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getWatchlistRows } from '@/lib/supabase/watchlist';
import { requireAdmin } from '@/lib/auth';
import type { Market } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const market = searchParams.get('market') as Market | null;
  try {
    const rows = await getWatchlistRows(market ?? undefined);
    return NextResponse.json({ rows });
  } catch (err) {
    console.error('[GET /api/watchlist]', err);
    return NextResponse.json({ error: 'Failed to load watchlist' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  let body: { symbol?: string; name?: string; market?: Market; asset_type?: string; category?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const symbol = body.symbol?.trim().toUpperCase();
  const market = body.market;
  const asset_type = body.asset_type;
  if (!symbol || !market || !asset_type) {
    return NextResponse.json({ error: 'symbol, market, asset_type are required' }, { status: 400 });
  }
  if (!['US', 'CN'].includes(market)) {
    return NextResponse.json({ error: 'market must be US or CN' }, { status: 400 });
  }
  if (!['index', 'etf', 'stock', 'sector'].includes(asset_type)) {
    return NextResponse.json({ error: 'invalid asset_type' }, { status: 400 });
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase
    .from('watchlist')
    .insert({
      symbol,
      name: body.name ?? null,
      market,
      asset_type,
      category: body.category ?? null,
      enabled: true,
    })
    .select()
    .single();

  if (error) {
    console.error('[POST /api/watchlist]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ row: data }, { status: 201 });
}
```

- [ ] **Step 7.2: Smoke test with curl against the dev server**

Run `npm run dev` in a background terminal.

Run: `curl -s http://localhost:3000/api/watchlist | head -c 200`
Expected: JSON with a `rows` array containing at least the seeded symbols (QQQ, SPY, etc.).

Stop the dev server.

- [ ] **Step 7.3: Commit**

```bash
git add app/api/watchlist/route.ts
git commit -m "feat: add GET and admin-guarded POST for /api/watchlist"
```

---

## Task 8: `PATCH` and `DELETE` on `/api/watchlist/[id]` (admin)

**Files:**
- Create: `app/api/watchlist/[id]/route.ts`

- [ ] **Step 8.1: Implement the handlers**

In Next.js 16 dynamic route handlers, the `params` argument is a Promise. Create `app/api/watchlist/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { id } = await ctx.params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  let body: { enabled?: boolean; name?: string; category?: string | null };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;
  if (typeof body.name === 'string') patch.name = body.name;
  if ('category' in body) patch.category = body.category;

  const { data, error } = await supabase()
    .from('watchlist')
    .update(patch)
    .eq('id', numericId)
    .select()
    .single();

  if (error) {
    console.error('[PATCH /api/watchlist/:id]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ row: data });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { id } = await ctx.params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const { error } = await supabase().from('watchlist').delete().eq('id', numericId);
  if (error) {
    console.error('[DELETE /api/watchlist/:id]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 8.2: Confirm Next.js 16 promise-params syntax against docs**

Run: `Get-ChildItem node_modules/next/dist/docs -Recurse -Filter "*params*" | Select-Object -First 5`
Read the most relevant matching doc. Confirm the signature `ctx: { params: Promise<{ id: string }> }` and `const { id } = await ctx.params;` matches Next 16's app-router contract. If the docs show a different shape, update both PATCH and DELETE accordingly.

- [ ] **Step 8.3: Commit**

```bash
git add app/api/watchlist/[id]/route.ts
git commit -m "feat: add PATCH and DELETE on /api/watchlist/:id (admin)"
```

---

## Task 9: `TokenGate` client component (TDD)

**Files:**
- Create: `components/watchlist/TokenGate.tsx`
- Test: `__tests__/components/TokenGate.test.tsx`

- [ ] **Step 9.1: Write the failing test**

Create `__tests__/components/TokenGate.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { TokenGate } from '@/components/watchlist/TokenGate';

beforeEach(() => { localStorage.clear(); });

describe('TokenGate', () => {
  it('shows the token prompt when no token is stored', () => {
    render(<TokenGate><div>secret content</div></TokenGate>);
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ADMIN_TOKEN/i)).toBeInTheDocument();
  });

  it('renders children once a token is saved', () => {
    render(<TokenGate><div>secret content</div></TokenGate>);
    const input = screen.getByPlaceholderText(/ADMIN_TOKEN/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'my-token' } });
    fireEvent.click(screen.getByRole('button', { name: /保存/ }));
    expect(localStorage.getItem('adminToken')).toBe('my-token');
    expect(screen.getByText('secret content')).toBeInTheDocument();
  });

  it('renders children immediately if a token is already in localStorage', () => {
    localStorage.setItem('adminToken', 'preset');
    render(<TokenGate><div>secret content</div></TokenGate>);
    expect(screen.getByText('secret content')).toBeInTheDocument();
  });
});
```

- [ ] **Step 9.2: Run the test to verify it fails**

Run: `npx jest __tests__/components/TokenGate.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 9.3: Implement the component**

Create `components/watchlist/TokenGate.tsx`:

```typescript
'use client';

import { useEffect, useState, type ReactNode } from 'react';

export function TokenGate({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const existing = typeof window === 'undefined' ? null : localStorage.getItem('adminToken');
    setToken(existing);
  }, []);

  if (token) return <>{children}</>;

  return (
    <div className="rounded-lg border border-[var(--border)] p-6 max-w-md mx-auto">
      <h2 className="text-base font-semibold mb-2 text-[var(--text)]">需要 ADMIN_TOKEN</h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        写操作（增删改）需要管理员 token。token 仅保存在本设备的 localStorage。
      </p>
      <input
        type="password"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        placeholder="ADMIN_TOKEN"
        className="w-full px-3 py-2 rounded border border-[var(--border)] bg-transparent text-sm text-[var(--text)] mb-3"
      />
      <button
        onClick={() => {
          if (!draft) return;
          localStorage.setItem('adminToken', draft);
          setToken(draft);
        }}
        className="w-full px-4 py-2 rounded bg-[var(--text)] text-[var(--bg)] text-sm font-medium"
      >
        保存
      </button>
    </div>
  );
}
```

- [ ] **Step 9.4: Run the test to verify it passes**

Run: `npx jest __tests__/components/TokenGate.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 9.5: Commit**

```bash
git add components/watchlist/TokenGate.tsx __tests__/components/TokenGate.test.tsx
git commit -m "feat: add TokenGate component for admin-only watchlist UI"
```

---

## Task 10: `AddSymbolForm` client component (TDD)

**Files:**
- Create: `components/watchlist/AddSymbolForm.tsx`
- Test: `__tests__/components/AddSymbolForm.test.tsx`

- [ ] **Step 10.1: Write the failing test**

Create `__tests__/components/AddSymbolForm.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddSymbolForm } from '@/components/watchlist/AddSymbolForm';

beforeEach(() => {
  localStorage.setItem('adminToken', 'test-token');
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 201,
    json: async () => ({ row: { id: 99, symbol: 'AVGO', name: 'Broadcom', market: 'US', asset_type: 'stock', enabled: true } }),
  })) as unknown as typeof fetch;
});

afterEach(() => { localStorage.clear(); jest.resetAllMocks(); });

describe('AddSymbolForm', () => {
  it('submits a POST with Bearer token and calls onAdded', async () => {
    const onAdded = jest.fn();
    render(<AddSymbolForm onAdded={onAdded} />);

    fireEvent.change(screen.getByPlaceholderText(/symbol/i), { target: { value: 'avgo' } });
    fireEvent.change(screen.getByPlaceholderText(/名称/), { target: { value: 'Broadcom' } });
    fireEvent.change(screen.getByLabelText(/market/i), { target: { value: 'US' } });
    fireEvent.change(screen.getByLabelText(/asset/i), { target: { value: 'stock' } });
    fireEvent.click(screen.getByRole('button', { name: /添加/ }));

    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    expect(callArgs[0]).toBe('/api/watchlist');
    expect(callArgs[1].method).toBe('POST');
    expect(callArgs[1].headers.Authorization).toBe('Bearer test-token');
    const body = JSON.parse(callArgs[1].body);
    expect(body.symbol).toBe('avgo'); // backend uppercases; frontend can send as-is
  });

  it('does not submit when symbol is empty', () => {
    render(<AddSymbolForm onAdded={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /添加/ }));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 10.2: Run the test to verify it fails**

Run: `npx jest __tests__/components/AddSymbolForm.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 10.3: Implement**

Create `components/watchlist/AddSymbolForm.tsx`:

```typescript
'use client';

import { useState } from 'react';
import type { Market, AssetType, Watchlist } from '@/types';

export function AddSymbolForm({ onAdded }: { onAdded: (row: Watchlist) => void }) {
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [market, setMarket] = useState<Market>('US');
  const [assetType, setAssetType] = useState<AssetType>('stock');
  const [category, setCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!symbol.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = localStorage.getItem('adminToken') ?? '';
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ symbol, name: name || null, market, asset_type: assetType, category: category || null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const j = await res.json();
      onAdded(j.row);
      setSymbol(''); setName(''); setCategory('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] p-4 space-y-3">
      <h3 className="text-sm font-semibold text-[var(--text)]">添加 symbol</h3>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <input
          placeholder="Symbol (例 AAPL)"
          value={symbol}
          onChange={e => setSymbol(e.target.value)}
          className="col-span-2 sm:col-span-1 px-3 py-2 rounded border border-[var(--border)] bg-transparent text-sm"
        />
        <input
          placeholder="名称 (可选)"
          value={name}
          onChange={e => setName(e.target.value)}
          className="col-span-2 sm:col-span-1 px-3 py-2 rounded border border-[var(--border)] bg-transparent text-sm"
        />
        <select
          aria-label="market"
          value={market}
          onChange={e => setMarket(e.target.value as Market)}
          className="px-3 py-2 rounded border border-[var(--border)] bg-transparent text-sm"
        >
          <option value="US">US</option>
          <option value="CN">CN</option>
        </select>
        <select
          aria-label="asset_type"
          value={assetType}
          onChange={e => setAssetType(e.target.value as AssetType)}
          className="px-3 py-2 rounded border border-[var(--border)] bg-transparent text-sm"
        >
          <option value="index">index</option>
          <option value="etf">etf</option>
          <option value="stock">stock</option>
          <option value="sector">sector</option>
        </select>
        <input
          placeholder="category (可选)"
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="col-span-2 sm:col-span-1 px-3 py-2 rounded border border-[var(--border)] bg-transparent text-sm"
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        onClick={submit}
        disabled={submitting}
        className="px-4 py-2 rounded bg-[var(--text)] text-[var(--bg)] text-sm font-medium disabled:opacity-50"
      >
        {submitting ? '提交中...' : '添加'}
      </button>
    </div>
  );
}
```

- [ ] **Step 10.4: Run the test to verify it passes**

Run: `npx jest __tests__/components/AddSymbolForm.test.tsx`
Expected: PASS — 2 tests.

- [ ] **Step 10.5: Commit**

```bash
git add components/watchlist/AddSymbolForm.tsx __tests__/components/AddSymbolForm.test.tsx
git commit -m "feat: add AddSymbolForm component for inserting watchlist rows"
```

---

## Task 11: `WatchlistTable` client component (TDD)

**Files:**
- Create: `components/watchlist/WatchlistTable.tsx`
- Test: `__tests__/components/WatchlistTable.test.tsx`

- [ ] **Step 11.1: Write the failing test**

Create `__tests__/components/WatchlistTable.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WatchlistTable } from '@/components/watchlist/WatchlistTable';
import type { Watchlist } from '@/types';

const rows: Watchlist[] = [
  { id: 1, symbol: 'QQQ', name: '纳指ETF', market: 'US', asset_type: 'etf', category: 'tech', enabled: true, created_at: '', updated_at: '' },
  { id: 2, symbol: 'TSLA', name: '特斯拉', market: 'US', asset_type: 'stock', category: 'ev', enabled: false, created_at: '', updated_at: '' },
];

beforeEach(() => {
  localStorage.setItem('adminToken', 't');
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) })) as unknown as typeof fetch;
});
afterEach(() => { localStorage.clear(); jest.resetAllMocks(); });

describe('WatchlistTable', () => {
  it('renders one row per item', () => {
    render(<WatchlistTable rows={rows} onChange={() => {}} />);
    expect(screen.getByText('QQQ')).toBeInTheDocument();
    expect(screen.getByText('TSLA')).toBeInTheDocument();
  });

  it('toggling enabled sends PATCH with Bearer token', async () => {
    const onChange = jest.fn();
    render(<WatchlistTable rows={rows} onChange={onChange} />);
    const toggles = screen.getAllByRole('switch');
    fireEvent.click(toggles[0]); // toggle QQQ (currently enabled → flip to false)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/watchlist/1');
    expect(init.method).toBe('PATCH');
    expect(init.headers.Authorization).toBe('Bearer t');
    expect(JSON.parse(init.body)).toEqual({ enabled: false });
    expect(onChange).toHaveBeenCalled();
  });

  it('clicking 删除 sends DELETE', async () => {
    const onChange = jest.fn();
    render(<WatchlistTable rows={rows} onChange={onChange} />);
    const buttons = screen.getAllByRole('button', { name: /删除/ });
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/watchlist/1');
    expect(init.method).toBe('DELETE');
    expect(onChange).toHaveBeenCalled();
  });
});
```

- [ ] **Step 11.2: Run the test to verify it fails**

Run: `npx jest __tests__/components/WatchlistTable.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 11.3: Implement**

Create `components/watchlist/WatchlistTable.tsx`:

```typescript
'use client';

import { useState } from 'react';
import type { Watchlist } from '@/types';

function authHeaders(): Record<string, string> {
  const t = typeof window === 'undefined' ? '' : localStorage.getItem('adminToken') ?? '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` };
}

export function WatchlistTable({ rows, onChange }: { rows: Watchlist[]; onChange: () => void }) {
  const [busyId, setBusyId] = useState<number | null>(null);

  async function toggle(row: Watchlist) {
    setBusyId(row.id);
    try {
      await fetch(`/api/watchlist/${row.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ enabled: !row.enabled }),
      });
      onChange();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(row: Watchlist) {
    if (!confirm(`删除 ${row.symbol}?`)) return;
    setBusyId(row.id);
    try {
      await fetch(`/api/watchlist/${row.id}`, { method: 'DELETE', headers: authHeaders() });
      onChange();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--bg-subtle)] text-[var(--muted)]">
          <tr>
            <th className="text-left px-3 py-2">Symbol</th>
            <th className="text-left px-3 py-2">名称</th>
            <th className="text-left px-3 py-2">市场</th>
            <th className="text-left px-3 py-2">类型</th>
            <th className="text-left px-3 py-2">分类</th>
            <th className="text-left px-3 py-2">启用</th>
            <th className="text-right px-3 py-2">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="border-t border-[var(--border)]">
              <td className="px-3 py-2 font-medium text-[var(--text)]">{row.symbol}</td>
              <td className="px-3 py-2">{row.name ?? '-'}</td>
              <td className="px-3 py-2">{row.market}</td>
              <td className="px-3 py-2">{row.asset_type}</td>
              <td className="px-3 py-2">{row.category ?? '-'}</td>
              <td className="px-3 py-2">
                <button
                  role="switch"
                  aria-checked={row.enabled}
                  disabled={busyId === row.id}
                  onClick={() => toggle(row)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${row.enabled ? 'bg-green-600' : 'bg-gray-400'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${row.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  onClick={() => remove(row)}
                  disabled={busyId === row.id}
                  className="text-xs text-red-500 hover:underline disabled:opacity-50"
                >
                  删除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 11.4: Run the test to verify it passes**

Run: `npx jest __tests__/components/WatchlistTable.test.tsx`
Expected: PASS — 3 tests.

(The `confirm()` call in `remove()` is `window.confirm`. In jsdom it returns `true` by default — the test relies on this. If the test fails on the confirm step, mock it: `jest.spyOn(window, 'confirm').mockReturnValue(true);` inside `beforeEach`.)

- [ ] **Step 11.5: Commit**

```bash
git add components/watchlist/WatchlistTable.tsx __tests__/components/WatchlistTable.test.tsx
git commit -m "feat: add WatchlistTable with enable toggle and delete"
```

---

## Task 12: `/watchlist` page wires it all together

**Files:**
- Create: `app/watchlist/page.tsx`
- Create: `components/watchlist/WatchlistClient.tsx`

- [ ] **Step 12.1: Implement the server-component page**

Create `app/watchlist/page.tsx`:

```typescript
import { getWatchlistRows } from '@/lib/supabase/watchlist';
import { WatchlistClient } from '@/components/watchlist/WatchlistClient';

export const dynamic = 'force-dynamic';

export default async function WatchlistPage() {
  const rows = await getWatchlistRows();
  const initial = rows.map(r => ({
    ...r,
    name: r.name ?? '',
    category: r.category,
    created_at: '',
    updated_at: '',
  }));
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-[var(--text)]">自选股管理</h1>
      <WatchlistClient initial={initial} />
    </div>
  );
}
```

- [ ] **Step 12.2: Implement the client wrapper**

Create `components/watchlist/WatchlistClient.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { TokenGate } from './TokenGate';
import { AddSymbolForm } from './AddSymbolForm';
import { WatchlistTable } from './WatchlistTable';
import type { Watchlist } from '@/types';

export function WatchlistClient({ initial }: { initial: Watchlist[] }) {
  const [rows, setRows] = useState<Watchlist[]>(initial);

  async function reload() {
    const res = await fetch('/api/watchlist', { cache: 'no-store' });
    if (!res.ok) return;
    const j = await res.json();
    setRows(j.rows ?? []);
  }

  return (
    <TokenGate>
      <div className="space-y-4">
        <AddSymbolForm onAdded={() => reload()} />
        <WatchlistTable rows={rows} onChange={reload} />
      </div>
    </TokenGate>
  );
}
```

- [ ] **Step 12.3: Confirm Next.js 16 dynamic-page conventions**

Run: `Get-ChildItem node_modules/next/dist/docs -Recurse -Filter "*server-component*","*page*" | Select-Object -First 8`
Skim the most relevant doc; confirm `export const dynamic = 'force-dynamic';` and the async server-component page signature are still correct in Next 16. Adjust if anything has been deprecated.

- [ ] **Step 12.4: Visit the page in the browser**

Run `npm run dev` in a background terminal. Open `http://localhost:3000/watchlist`. Expected:
- A "需要 ADMIN_TOKEN" gate appears.
- Type any non-empty string and click 保存 — the table appears with the existing 21 rows (assuming the seed data is loaded).
- Try adding a fake symbol — it should fail with 401 because the token is wrong (good!).
- Stop the dev server.

- [ ] **Step 12.5: Commit**

```bash
git add app/watchlist/page.tsx components/watchlist/WatchlistClient.tsx
git commit -m "feat: add /watchlist page composing TokenGate + AddSymbolForm + WatchlistTable"
```

---

## Task 13: Add `/watchlist` link to the Navbar

**Files:**
- Modify: `components/layout/Navbar.tsx` line 13

- [ ] **Step 13.1: Insert the nav link**

Open `components/layout/Navbar.tsx`. Between the `复盘` and `A股板块` links, add:

```typescript
<Link href="/watchlist" className="hover:text-[var(--text)] transition-colors">自选股</Link>
```

The full middle section should read:

```typescript
<Link href="/" className="hover:text-[var(--text)] transition-colors">Dashboard</Link>
<Link href="/watchlist" className="hover:text-[var(--text)] transition-colors">自选股</Link>
<Link href="/reports" className="hover:text-[var(--text)] transition-colors">复盘</Link>
<Link href="/sectors" className="hover:text-[var(--text)] transition-colors">A股板块</Link>
<Link href="/settings" className="hover:text-[var(--text)] transition-colors">设置</Link>
```

- [ ] **Step 13.2: Commit**

```bash
git add components/layout/Navbar.tsx
git commit -m "feat: add 自选股 link to navbar"
```

---

## Task 14: Generate `ADMIN_TOKEN` and document setup

**Files:**
- Modify: `.env.local` (gitignored)
- Modify: `.env.local.example` (may or may not exist — create if missing)
- Modify: `README.md` if it has a setup section

- [ ] **Step 14.1: Generate a token**

Run: `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`
Copy the output (a ~32-char base64url string).

- [ ] **Step 14.2: Add to `.env.local`**

Open `.env.local` (gitignored). Append:

```
ADMIN_TOKEN=<paste-the-generated-token>
```

- [ ] **Step 14.3: Add a placeholder to `.env.local.example`**

If `.env.local.example` exists, append `ADMIN_TOKEN=` at the bottom. If it doesn't exist, **don't create it** — the project doesn't use one (see `.gitignore` line 34 `.env*` — examples should be hand-rolled if the user wants them; this plan skips it to avoid scope creep).

- [ ] **Step 14.4: Restart the dev server, re-test /watchlist**

Run `npm run dev`. Open `http://localhost:3000/watchlist`. Enter the **real** ADMIN_TOKEN this time. Add a test symbol (e.g. `TEST`, market `US`, asset_type `stock`). Confirm the new row appears. Then delete it. Both should succeed.

Stop the dev server.

- [ ] **Step 14.5: Add the same token to Vercel and to GitHub Actions secrets**

These are manual external steps the user must do:

1. Vercel → Project → Settings → Environment Variables → add `ADMIN_TOKEN` (same value), apply to Production + Preview + Development → Save → trigger a redeploy.
2. GitHub → repo → Settings → Secrets and variables → Actions → add `ADMIN_TOKEN` (only needed if any workflow uses it; currently none do, but add it anyway for symmetry).

(No commit for this step — secrets must never be committed.)

- [ ] **Step 14.6: Run the full test suite as a smoke test**

Run: `npm test`
Expected: all tests pass — the new auth, watchlist, TokenGate, AddSymbolForm, and WatchlistTable tests, plus the existing ~30 tests, total ≈ 50.

If anything fails, fix it before proceeding.

---

## Task 15: End-to-end verification + production deploy

- [ ] **Step 15.1: Final dev smoke test**

Run `npm run dev`. Visit:
- `http://localhost:3000` — dashboard still renders (Task 6 refactor didn't break it).
- `http://localhost:3000/watchlist` — list + add + toggle + delete all work.

- [ ] **Step 15.2: Push to GitHub**

```bash
git push origin master
```

Wait for Vercel to redeploy. Verify the live site at `https://market-radar-five.vercel.app/watchlist` works the same way.

- [ ] **Step 15.3: Manually trigger a GitHub Actions run to confirm the scripts still work after the refactor**

Open https://github.com/Dandy1aw/market-radar/actions, manually run `Fetch US Market Data` (workflow_dispatch). Watch the logs. Expected: `Fetching <N> US symbols...` where N matches the count of enabled US rows in your watchlist.

- [ ] **Step 15.4: Update memory**

Append to `C:\Users\syw\.claude\projects\D--claudeCode-market-radar\memory\project_market_radar.md` under "Completed Milestones":
- M2.1 (watchlist DB-driven + admin UI): scripts now read symbols from watchlist; `/watchlist` page with TokenGate.

Run: `git status` — should be clean. Done.

---

## Self-Review Notes

**Spec coverage check:** The original brainstorm enumerated 5 backend tasks + 5 frontend tasks + env/secret setup. This plan has Tasks 1-6 (backend + refactors), 7-8 (API routes), 9-12 (frontend), 13 (navbar), 14 (env), 15 (deploy + memory). All ✓.

**Type-consistency check:**
- `WatchlistRow` (in `lib/supabase/watchlist.ts`) and `Watchlist` (in `types/index.ts`) overlap but are distinct. The page passes server-fetched `WatchlistRow[]` into the client by widening with `created_at: ''` and `updated_at: ''` placeholders. This is intentional — the table doesn't need those columns. Don't try to unify them in this plan.
- `requireAdmin` always returns `{ ok: true } | { ok: false; status; message }` — never throws. All call sites must check `.ok`.

**Placeholder scan:** No "TBD" or "implement later" remain.
