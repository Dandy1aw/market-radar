'use client';

import { useState, type ReactNode } from 'react';

export function TokenGate({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : localStorage.getItem('adminToken'),
  );
  const [draft, setDraft] = useState('');

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
