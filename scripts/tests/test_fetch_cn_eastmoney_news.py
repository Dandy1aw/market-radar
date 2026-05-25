# scripts/tests/test_fetch_cn_eastmoney_news.py
import hashlib
from unittest.mock import MagicMock, patch

import pandas as pd


def test_normalize_eastmoney_news_deduplicates_by_hash():
    from fetch_cn_eastmoney_news import normalize_news_rows

    rows = [
        {
            'title': '中芯国际 Q1 业绩增长',
            'content': '正文内容',
            'published_at': '2026-05-20 10:00:00',
            'source': '东方财富',
            'url': 'https://example.com/1',
            'symbol': '688981',
        },
        # duplicate
        {
            'title': '中芯国际 Q1 业绩增长',
            'content': '正文内容',
            'published_at': '2026-05-20 10:00:00',
            'source': '东方财富',
            'url': 'https://example.com/1',
            'symbol': '688981',
        },
    ]
    result = normalize_news_rows(rows)
    assert len(result) == 1
    expected_hash = hashlib.md5('688981:东方财富:中芯国际 Q1 业绩增长'.encode()).hexdigest()
    assert result[0]['hash'] == expected_hash
    assert result[0]['related_symbol'] == '688981'
    assert result[0]['confidence_level'] == 'medium'
    assert result[0]['source_type'] == 'company_news'


def test_fetch_eastmoney_news_calls_akshare():
    with patch('fetch_cn_eastmoney_news.ak') as mock_ak:
        mock_ak.stock_news_em.return_value = pd.DataFrame({
            '新闻标题': ['标题A'],
            '新闻内容': ['内容A'],
            '发布时间': ['2026-05-20 10:00:00'],
            '文章来源': ['财联社'],
            '新闻链接': ['https://example.com/a'],
        })

        from fetch_cn_eastmoney_news import fetch_eastmoney_news
        result = fetch_eastmoney_news('688981')

    mock_ak.stock_news_em.assert_called_once_with(symbol='688981')
    assert len(result) == 1
    assert result[0]['title'] == '标题A'
    assert result[0]['symbol'] == '688981'
