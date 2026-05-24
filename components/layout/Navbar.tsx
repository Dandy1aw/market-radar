import Link from 'next/link';

export function Navbar() {
  return (
    <nav className="border-b border-[var(--border)] bg-[var(--bg)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <Link href="/" className="text-sm font-semibold text-[var(--text)]">
          Market Radar
        </Link>
        <div className="flex items-center gap-6 text-sm text-[var(--muted)]">
          <Link href="/" className="hover:text-[var(--text)] transition-colors">Dashboard</Link>
          <Link href="/watchlist" className="hover:text-[var(--text)] transition-colors">自选股</Link>
<span className="opacity-30 cursor-not-allowed" title="即将上线">复盘</span>
          <span className="opacity-30 cursor-not-allowed" title="即将上线">A股板块</span>
          <span className="opacity-30 cursor-not-allowed" title="即将上线">设置</span>
        </div>
      </div>
    </nav>
  );
}
