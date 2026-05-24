import type { MarketNews, Sentiment } from '@/types';

const sentimentStyles: Record<Sentiment, string> = {
  positive: 'text-green-400 bg-green-400/10 border-green-400/20',
  negative: 'text-red-400 bg-red-400/10 border-red-400/20',
  neutral: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
};

const sentimentLabels: Record<Sentiment, string> = {
  positive: '利好',
  negative: '利空',
  neutral: '中性',
};

interface NewsSectionProps {
  news: MarketNews[];
}

function formatNewsDate(value: string | null) {
  if (!value) return '';

  return new Date(value).toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  });
}

export function NewsSection({ news }: NewsSectionProps) {
  if (news.length === 0) return null;

  return (
    <section aria-labelledby="recent-news-title">
      <h2
        id="recent-news-title"
        className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]"
      >
        近期新闻
      </h2>
      <div className="overflow-hidden rounded-lg border border-[var(--border)]">
        {news.map(item => {
          const sentiment = item.sentiment ?? 'neutral';

          return (
            <article
              key={item.id}
              className="border-b border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 last:border-b-0"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${sentimentStyles[sentiment]}`}
                >
                  {sentimentLabels[sentiment]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-sm font-medium text-[var(--text)] hover:text-indigo-400"
                      >
                        {item.title}
                      </a>
                    ) : (
                      <span className="truncate text-sm font-medium text-[var(--text)]">
                        {item.title}
                      </span>
                    )}
                    <time className="shrink-0 text-xs text-[var(--muted)]">
                      {formatNewsDate(item.published_at)}
                    </time>
                  </div>
                  {item.summary && (
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">
                      {item.summary}
                    </p>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
