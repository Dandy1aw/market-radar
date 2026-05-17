import type { MarketStatus } from '@/types';

const levelStyles = {
  normal:  { bg: 'bg-green-500/10 border-green-500/20', dot: 'bg-green-400', text: 'text-green-400' },
  caution: { bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400', text: 'text-amber-400' },
  risk:    { bg: 'bg-red-500/10 border-red-500/20',     dot: 'bg-red-400',   text: 'text-red-400' },
};

interface Props { status: MarketStatus; tradeDate: string; }

export function MarketStatusBanner({ status, tradeDate }: Props) {
  const s = levelStyles[status.level];
  return (
    <div className={`rounded-xl border px-5 py-4 flex items-start gap-4 ${s.bg}`}>
      <span className={`mt-2 w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} style={{ boxShadow: `0 0 8px currentColor` }} />
      <div>
        <div className="flex items-center gap-3">
          <span className={`text-base font-bold ${s.text}`}>今日市场：{status.label}</span>
          <span className="text-sm text-[var(--muted)]">{tradeDate}</span>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">{status.description}</p>
      </div>
    </div>
  );
}
