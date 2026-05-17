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
    <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${s.bg}`}>
      <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
      <div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${s.text}`}>今日市场：{status.label}</span>
          <span className="text-xs text-[var(--muted)]">{tradeDate}</span>
        </div>
        <p className="mt-0.5 text-xs text-[var(--muted)]">{status.description}</p>
      </div>
    </div>
  );
}
