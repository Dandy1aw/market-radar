# scripts/fetch_cn_cninfo_announcements.py
"""
Fetch company announcements from 巨潮资讯 via AkShare.
"""
import hashlib
from typing import Any

import akshare as ak
import pandas as pd


def normalize_announcement_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    result = []
    for row in rows:
        title = str(row.get('title', ''))
        symbol = str(row.get('symbol', ''))
        h = hashlib.md5(f"{symbol}:{title}".encode()).hexdigest()
        if h in seen:
            continue
        seen.add(h)
        result.append({
            'symbol': symbol,
            'name': str(row.get('name', '')),
            'market': 'CN',
            'title': title,
            'announcement_type': str(row.get('type', '')),
            'url': str(row.get('url', '')) or None,
            'published_at': str(row.get('published_at', '')) or None,
            'hash': h,
            'confidence_level': 'high',
            'raw_json': row,
        })
    return result


def fetch_cninfo_announcements(
    symbol: str,
    start_date: str,
    end_date: str,
) -> list[dict[str, Any]]:
    """Fetch announcements for a CN stock from 巨潮资讯."""
    try:
        df: pd.DataFrame = ak.stock_zh_a_disclosure_report_cninfo(
            symbol=symbol,
            market='沪深京',
            category='',
            start_date=start_date,
            end_date=end_date,
        )
    except Exception as exc:
        print(f"[cninfo] Failed to fetch announcements for {symbol}: {exc}")
        return []

    rows = []
    for _, r in df.iterrows():
        rows.append({
            'symbol': str(r.get('代码', r.get('symbol', symbol))),
            'name': str(r.get('简称', r.get('name', ''))),
            'title': str(r.get('公告标题', r.get('title', ''))),
            'type': str(r.get('公告类型', r.get('type', ''))),
            'url': str(r.get('链接', r.get('url', ''))),
            'published_at': str(r.get('公告日期', r.get('date', ''))),
        })
    return rows
