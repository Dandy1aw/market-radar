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
    <form
      onSubmit={e => { e.preventDefault(); submit(); }}
      className="rounded-lg border border-[var(--border)] p-4 space-y-3"
    >
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
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--muted)]">市场</span>
          <select
            value={market}
            onChange={e => setMarket(e.target.value as Market)}
            className="px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text)]"
          >
            <option value="US">US</option>
            <option value="CN">CN</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--muted)]">类型</span>
          <select
            value={assetType}
            onChange={e => setAssetType(e.target.value as AssetType)}
            className="px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text)]"
          >
            <option value="index">index</option>
            <option value="etf">etf</option>
            <option value="stock">stock</option>
            <option value="sector">sector</option>
          </select>
        </label>
        <input
          placeholder="category (可选)"
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="col-span-2 sm:col-span-1 px-3 py-2 rounded border border-[var(--border)] bg-transparent text-sm"
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 rounded bg-[var(--text)] text-[var(--bg)] text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? '提交中...' : '添加'}
      </button>
    </form>
  );
}
