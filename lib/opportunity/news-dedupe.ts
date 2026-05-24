import { createHash } from 'crypto';

export interface NewsLike {
  source: string;
  source_type: string | null;
  title: string;
  summary: string | null;
  content: string | null;
  url: string | null;
  published_at: string;
  lang: string | null;
  raw_json: Record<string, unknown>;
}

export interface NewsWithHash extends NewsLike {
  hash: string;
}

export function normalizeNewsTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalUrl(url: string | null): string {
  if (!url) return '';

  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`.toLowerCase();
  } catch {
    return url.toLowerCase().split('?')[0] ?? '';
  }
}

function publishedDay(publishedAt: string): string {
  return publishedAt.slice(0, 10);
}

export function createNewsHash(
  news: Pick<NewsLike, 'title' | 'url' | 'published_at'>,
): string {
  const input = [
    normalizeNewsTitle(news.title),
    canonicalUrl(news.url),
    publishedDay(news.published_at),
  ].join('|');

  return createHash('sha256').update(input).digest('hex');
}

export function dedupeNews<T extends NewsLike>(news: T[]): Array<T & { hash: string }> {
  const seen = new Set<string>();
  const result: Array<T & { hash: string }> = [];

  for (const item of news) {
    const hash = createNewsHash(item);
    if (seen.has(hash)) continue;
    seen.add(hash);
    result.push({ ...item, hash });
  }

  return result;
}
