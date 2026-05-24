export type ChartRange = '3m' | '6m' | '1y' | '3y';

interface RangeSelectorProps {
  value: ChartRange;
  onChange: (range: ChartRange) => void;
}

const RANGES: { label: string; value: ChartRange }[] = [
  { label: '3M', value: '3m' },
  { label: '6M', value: '6m' },
  { label: '1Y', value: '1y' },
  { label: '3Y', value: '3y' },
];

export function RangeSelector({ value, onChange }: RangeSelectorProps) {
  return (
    <div className="inline-flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-1">
      {RANGES.map(range => {
        const selected = range.value === value;

        return (
          <button
            key={range.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(range.value)}
            className={`min-h-10 min-w-12 rounded-md px-3 text-xs font-semibold tabular-nums transition-colors ${
              selected
                ? 'bg-[var(--text)] text-[var(--bg)]'
                : 'text-[var(--muted)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text)]'
            }`}
          >
            {range.label}
          </button>
        );
      })}
    </div>
  );
}
