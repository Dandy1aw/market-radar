'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="text-4xl">⚠️</div>
      <h2 className="text-lg font-semibold text-[var(--text)]">数据加载失败</h2>
      <p className="text-sm text-[var(--muted)] max-w-sm">
        {error.message || '发生了一个未知错误，请稍后重试。'}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded border border-[var(--border)] text-sm text-[var(--text)] hover:bg-[var(--bg-card)] transition-colors"
      >
        重试
      </button>
    </div>
  );
}
