'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import type { OpportunityCardData, OpportunityDecisionLevel } from '@/lib/opportunity/types';

interface OpportunityCardProps {
  card: OpportunityCardData;
}

const decisionTone: Record<OpportunityDecisionLevel, string> = {
  small_probe: 'border-green-400/20 bg-green-400/10 text-green-400',
  pullback_candidate: 'border-amber-400/20 bg-amber-400/10 text-amber-400',
  strong_watch: 'border-sky-400/20 bg-sky-400/10 text-sky-400',
  breakout_confirm: 'border-indigo-400/20 bg-indigo-400/10 text-indigo-400',
  post_earnings_wait: 'border-gray-400/20 bg-gray-400/10 text-gray-400',
  risk_high: 'border-red-400/20 bg-red-400/10 text-red-400',
};

function ScoreChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)]">
      {label}
      <span className="font-semibold text-[var(--text)]">{value}</span>
    </span>
  );
}

export function OpportunityCard({ card }: OpportunityCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-[var(--text)]">
              {card.symbol}
            </h3>
            <span className="text-sm text-[var(--muted)]">
              {card.company_name}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${decisionTone[card.decision_level] ?? 'border-gray-400/20 bg-gray-400/10 text-gray-400'}`}
            >
              {card.decision_label}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">{card.theme}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs text-[var(--muted)]">总分</p>
          <p className="text-2xl font-semibold tabular-nums text-[var(--text)]">
            {card.total_score}
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
        {card.summary}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <ScoreChip label="新闻" value={card.news_score} />
        <ScoreChip label="位置" value={card.price_position_score} />
        <ScoreChip label="关联" value={card.context_signal_score} />
        <ScoreChip label="风险" value={card.risk_score} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
            观察条件
          </p>
          <ul className="space-y-1 text-sm text-[var(--text)]">
            {card.watch_conditions.map((condition, i) => (
              <li key={i}>{condition}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
            风险因素
          </p>
          <ul className="space-y-1 text-sm text-[var(--text)]">
            {card.risk_factors.map((factor, i) => (
              <li key={i}>{factor}</li>
            ))}
          </ul>
        </div>
      </div>

      {card.evidence_news.length > 0 && (
        <div className="mt-4 border-t border-[var(--border)] pt-3">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded(value => !value)}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)]"
          >
            <ChevronDown
              size={14}
              className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'}
              aria-hidden="true"
            />
            证据 {card.evidence_news.length}
          </button>
          {expanded && (
            <ul className="mt-3 space-y-2">
              {card.evidence_news.map(news => (
                <li key={news.id}>
                  <p className="text-sm font-medium text-[var(--text)]">
                    {news.title}
                  </p>
                  <p className="text-xs text-[var(--muted)]">{news.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
