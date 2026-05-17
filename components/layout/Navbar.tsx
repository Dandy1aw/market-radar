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
          <Link href="/reports" className="hover:text-[var(--text)] transition-colors">复盘</Link>
          <Link href="/sectors" className="hover:text-[var(--text)] transition-colors">A股板块</Link>
          <Link href="/settings" className="hover:text-[var(--text)] transition-colors">设置</Link>
        </div>
      </div>
    </nav>
  );
}
