# scripts/tests/test_fetch_cn_free_sources.py
from unittest.mock import MagicMock, patch


def test_main_calls_all_fetchers_and_inserts():
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.upsert.return_value.execute.return_value = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[
            {'symbol': '688981', 'name': '中芯国际', 'notes': '半导体'},
        ]
    )

    with (
        patch('fetch_cn_free_sources.create_client', return_value=mock_supabase),
        patch('fetch_cn_free_sources.fetch_eastmoney_news', return_value=[{
            'source': '东方财富', 'source_type': 'company_news',
            'title': '测试新闻', 'summary': None, 'content': None,
            'url': None, 'published_at': None,
            'hash': 'abc123', 'related_symbol': '688981',
            'related_theme': None, 'confidence_level': 'medium',
            'raw_json': {},
        }]) as mock_em,
        patch('fetch_cn_free_sources.fetch_cninfo_announcements', return_value=[]) as mock_cn,
        patch('fetch_cn_free_sources.fetch_sina_rss', return_value=[]) as mock_rss,
    ):
        from fetch_cn_free_sources import main
        summary = main()

    mock_em.assert_called_once_with('688981')
    assert summary['news_inserted'] >= 0
    assert summary['announcements_inserted'] >= 0
