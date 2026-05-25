// components/cn-news/CnNewsCard.tsx
'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import type { CnNewsCardData, CnConfidenceLevel, CnEventDirection } from '@/lib/cn-news/types';

const directionStyle: Record<CnEventDirection, string> = {
  positive: 'border-green-400/30 bg-green-400/10 text-green-400',
  negative: 'border-red-400/30 bg-red-400/10 text-red-400',
  neutral: 'border-gray-400/30 bg-gray-400/10 text-gray-400',
  mixed: 'border-amber-400/30 bg-amber-400/10 text-amber-400',
};

const directionLabel: Record<CnEventDirection, string> = {
  positive: '正面信号',
  negative: '负面信号',
  neutral: '中性信号',
  mixed: '混合信号',
};

const confidenceStyle: Record<CnConfidenceLevel, string> = {
  high: 'border-amber-400/30 bg-amber-400/10 text-amber-400',
  medium: 'border-sky-400/30 bg-sky-400/10 text-sky-400',
  low: 'border-gray-400/30 bg-gray-400/10 text-gray-400',
};

const sourceTypeLabel: Record<string, string> = {
  announcement: '公告',
  company_news: '新闻',
  rss: 'RSS',
};

const sourceTypeStyle: Record<string, string> = {
  announcement: 'border-amber-400/30 bg-amber-400/10 text-amber-400',
  company_news: 'border-sky-400/30 bg-sky-400/10 text-sky-400',
  rss: 'border-gray-400/30 bg-gray-400/10 text-gray-400',
};

const confidenceTextStyle: Record<CnConfidenceLevel, string> = {
  high: 'text-amber-400',
  medium: 'text-sky-400',
  low: 'text-gray-400',
};

const confidenceLabel: Record<CnConfidenceLevel, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

interface CnNewsCardProps {
  card: CnNewsCardData;
}

function Chip({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)]">
      {label}
      <span className="font-semibold text-[var(--text)]">{value}</span>
    </span>
  );
}

export function CnNewsCard({ card }: CnNewsCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-[var(--text)]">{card.symbol}</h3>
            <span className="text-sm text-[var(--muted)]">{card.company_name}</span>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${directionStyle[card.event_direction]}`}
            >
              {directionLabel[card.event_direction]}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${sourceTypeStyle[card.source_type] ?? confidenceStyle[card.confidence_level]}`}
            >
              {sourceTypeLabel[card.source_type] ?? card.source_type}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">{card.theme}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs text-[var(--muted)]">可信度</p>
          <p className={`text-xl font-semibold ${confidenceTextStyle[card.confidence_level]}`}>
            {confidenceLabel[card.confidence_level]}
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{card.event_summary}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Chip label="来源" value={card.source_label} />
        <Chip label="事件" value={card.event_type} />
        <Chip label="重要性" value={card.importance_score.toFixed(1)} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">后续观察</p>
          <ul className="space-y-1 text-sm text-[var(--text)]">
            {card.watch_points.map((p) => <li key={p}>• {p}</li>)}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">风险提示</p>
          <ul className="space-y-1 text-sm text-[var(--text)]">
            {card.risk_notes.map((r) => <li key={r}>• {r}</li>)}
          </ul>
        </div>
      </div>

      {card.evidence.length > 0 && (
        <div className="mt-4 border-t border-[var(--border)] pt-3">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded(v => !v)}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)]"
          >
            <ChevronDown
              size={14}
              className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'}
              aria-hidden="true"
            />
            证据 {card.evidence.length}
          </button>
          {expanded && (
            <ul className="mt-3 space-y-1">
              {card.evidence.map((e) => (
                <li key={e} className="text-sm text-[var(--muted)]">{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
