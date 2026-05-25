# scripts/fetch_cn_free_sources.py
"""
Main orchestrator for CN free data sources.
Reads watchlist_core (market=CN), fetches news + announcements + RSS,
deduplicates, and upserts into raw_cn_news / raw_cn_announcement.
"""
import os
import time
from datetime import datetime, timedelta
from typing import Any

from dotenv import load_dotenv
from supabase import create_client, Client

from fetch_cn_eastmoney_news import fetch_eastmoney_news, normalize_news_rows
from fetch_cn_cninfo_announcements import fetch_cninfo_announcements, normalize_announcement_rows
from fetch_cn_sina_rss import fetch_sina_rss

load_dotenv()

THEME_KEYWORDS = [
    '半导体', '存储芯片', '国产替代', '光模块', 'AI服务器',
    '液冷', 'PCB', '算力', '人工智能', '机器人',
    '新能源', '券商', '银行', 'HBM', 'DRAM', 'NAND', 'CPO',
    '长鑫存储', '中芯国际', '北方华创',
]

MAX_NEWS_PER_RUN = int(os.getenv('MAX_CN_NEWS_PER_RUN', '100'))


def get_supabase_client() -> Client:
    url = os.getenv('SUPABASE_URL', '')
    key = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
    return create_client(url, key)


def load_cn_watchlist(client: Client) -> list[dict[str, Any]]:
    resp = (
        client.table('watchlist_core')
        .select('symbol,name,notes,theme')
        .eq('market', 'CN')
        .eq('is_active', True)
        .execute()
    )
    return resp.data or []


def upsert_raw_cn_news(client: Client, rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0
    result = (
        client.table('raw_cn_news')
        .upsert(rows, on_conflict='hash')
        .execute()
    )
    return len(result.data) if result.data else 0


def upsert_raw_cn_announcements(client: Client, rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0
    result = (
        client.table('raw_cn_announcement')
        .upsert(rows, on_conflict='hash')
        .execute()
    )
    return len(result.data) if result.data else 0


def get_date_range() -> tuple[str, str]:
    today = datetime.now()
    yesterday = today - timedelta(days=1)
    return yesterday.strftime('%Y%m%d'), today.strftime('%Y%m%d')


def main() -> dict[str, int]:
    client = get_supabase_client()
    cn_targets = load_cn_watchlist(client)
    print(f"[main] Loaded {len(cn_targets)} CN watchlist targets")

    start_date, end_date = get_date_range()

    all_news_rows: list[dict[str, Any]] = []
    all_announcement_rows: list[dict[str, Any]] = []

    for target in cn_targets:
        symbol = target.get('symbol', '')
        if not symbol:
            continue

        raw_news = fetch_eastmoney_news(symbol)
        all_news_rows.extend(normalize_news_rows(raw_news))
        time.sleep(0.5)

        raw_ann = fetch_cninfo_announcements(symbol, start_date, end_date)
        all_announcement_rows.extend(normalize_announcement_rows(raw_ann))
        time.sleep(0.5)

    rss_rows = fetch_sina_rss(THEME_KEYWORDS)
    all_news_rows.extend(rss_rows)

    seen: set[str] = set()
    deduped_news = []
    for row in all_news_rows:
        h = row.get('hash', '')
        if h and h not in seen:
            seen.add(h)
            deduped_news.append(row)

    deduped_news = deduped_news[:MAX_NEWS_PER_RUN]

    news_inserted = upsert_raw_cn_news(client, deduped_news)
    ann_inserted = upsert_raw_cn_announcements(client, all_announcement_rows)

    summary = {
        'news_fetched': len(deduped_news),
        'news_inserted': news_inserted,
        'announcements_fetched': len(all_announcement_rows),
        'announcements_inserted': ann_inserted,
    }
    print(f"[main] Done: {summary}")
    return summary


if __name__ == '__main__':
    main()
