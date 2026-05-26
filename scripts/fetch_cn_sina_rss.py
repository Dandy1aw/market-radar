# scripts/fetch_cn_sina_rss.py
"""
Fetch finance news from 新浪财经 RSS feeds.
"""
import hashlib
from typing import Any

import feedparser

SINA_STOCK_RSS = 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&num=50&format=rss'


def filter_by_keywords(
    entries: list[dict[str, Any]],
    keywords: list[str],
) -> list[dict[str, Any]]:
    result = []
    for entry in entries:
        text = f"{entry.get('title', '')} {entry.get('summary', '')}".lower()
        if any(kw.lower() in text for kw in keywords):
            result.append(entry)
    return result


def normalize_rss_entries(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    result = []
    for entry in entries:
        title = str(entry.get('title', ''))
        link = str(entry.get('link', ''))
        pub = str(entry.get('published', ''))
        h = hashlib.md5(f"rss:{link or pub}:{title}".encode()).hexdigest()
        if h in seen:
            continue
        seen.add(h)
        result.append({
            'source': '新浪财经',
            'source_type': 'rss',
            'title': title,
            'summary': str(entry.get('summary', '')) or None,
            'content': None,
            'url': link or None,
            'published_at': str(entry.get('published', '')) or None,
            'hash': h,
            'related_symbol': None,
            'related_theme': None,
            'confidence_level': 'low',
            'raw_json': entry,
        })
    return result


def fetch_sina_rss(keywords: list[str]) -> list[dict[str, Any]]:
    """Fetch and filter 新浪财经 RSS feed by keywords."""
    try:
        feed = feedparser.parse(SINA_STOCK_RSS)
        raw_entries = [
            {
                'title': e.get('title', ''),
                'summary': e.get('summary', ''),
                'link': e.get('link', ''),
                'published': e.get('published', ''),
            }
            for e in feed.entries
        ]
    except Exception as exc:
        print(f"[sina_rss] Failed to fetch RSS: {exc}")
        return []

    filtered = filter_by_keywords(raw_entries, keywords)
    return normalize_rss_entries(filtered)
