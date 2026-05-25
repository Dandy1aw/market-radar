# scripts/fetch_cn_eastmoney_news.py
"""
Fetch stock news from 东方财富 (East Money) via AkShare.
Returns a list of normalized news dicts ready to insert into raw_cn_news.
"""
import hashlib
from typing import Any

import akshare as ak
import pandas as pd


def _str_or_none(val: Any) -> str | None:
    if val is None:
        return None
    try:
        import pandas as pd
        if pd.isna(val):
            return None
    except (TypeError, ValueError):
        pass
    s = str(val).strip()
    return s if s else None


def normalize_news_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    result = []
    for row in rows:
        title = str(row.get('title', ''))
        source_str = str(row.get('source', '东方财富'))
        symbol_str = str(row.get('symbol', ''))
        h = hashlib.md5(f"{symbol_str}:{source_str}:{title}".encode()).hexdigest()
        if h in seen:
            continue
        seen.add(h)
        result.append({
            'source': str(row.get('source', '东方财富')),
            'source_type': 'company_news',
            'title': title,
            'summary': None,
            'content': str(row.get('content', '')) or None,
            'url': str(row.get('url', '')) or None,
            'published_at': str(row.get('published_at', '')) or None,
            'hash': h,
            'related_symbol': str(row.get('symbol', '')),
            'related_theme': None,
            'confidence_level': 'medium',
            'raw_json': row,
        })
    return result


def fetch_eastmoney_news(symbol: str) -> list[dict[str, Any]]:
    """Fetch news for a single CN stock symbol from 东方财富."""
    try:
        df: pd.DataFrame = ak.stock_news_em(symbol=symbol)
    except Exception as exc:
        print(f"[eastmoney] Failed to fetch news for {symbol}: {exc}")
        return []

    rows = []
    for _, r in df.iterrows():
        rows.append({
            'title': str(r.get('新闻标题', r.get('title', ''))),
            'content': _str_or_none(r.get('新闻内容', r.get('content', ''))),
            'published_at': _str_or_none(r.get('发布时间', r.get('published_at', ''))),
            'source': str(r.get('文章来源', r.get('source', '东方财富'))),
            'url': _str_or_none(r.get('新闻链接', r.get('url', ''))),
            'symbol': symbol,
        })
    return rows
