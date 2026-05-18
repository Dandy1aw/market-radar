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
      const res = await fetch(`/api/watchlist/${row.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ enabled: !row.enabled }),
      });
      if (res.ok) onChange();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(row: Watchlist) {
    if (!confirm(`删除 ${row.symbol}?`)) return;
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/watchlist/${row.id}`, { method: 'DELETE', headers: authHeaders() });
      if (res.ok) onChange();
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
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-sm text-[var(--muted)]">
                暂无自选股，请使用上方表单添加
              </td>
            </tr>
          )}
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
                  className="text-xs text-red-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
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
