# scripts/tests/test_fetch_cn_sina_rss.py
from unittest.mock import MagicMock, patch


def test_filter_rss_entries_by_keywords():
    from fetch_cn_sina_rss import filter_by_keywords

    entries = [
        {'title': '半导体国产替代加速', 'summary': '相关政策出台'},
        {'title': '今日天气预报', 'summary': '晴天'},
        {'title': '存储芯片价格上涨', 'summary': 'DRAM 需求回升'},
    ]
    keywords = ['半导体', '存储芯片', 'DRAM', 'HBM']
    result = filter_by_keywords(entries, keywords)
    assert len(result) == 2
    assert all('半导体' in e['title'] or '存储芯片' in e['title'] for e in result)


def test_normalize_rss_sets_low_confidence():
    from fetch_cn_sina_rss import normalize_rss_entries

    entries = [
        {
            'title': '半导体板块上涨',
            'summary': '市场情绪回暖',
            'link': 'https://finance.sina.com.cn/1',
            'published': 'Mon, 20 May 2026 10:00:00 +0800',
        }
    ]
    result = normalize_rss_entries(entries)
    assert result[0]['confidence_level'] == 'low'
    assert result[0]['source_type'] == 'rss'
