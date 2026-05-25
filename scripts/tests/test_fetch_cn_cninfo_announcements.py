# scripts/tests/test_fetch_cn_cninfo_announcements.py
from unittest.mock import patch
import pandas as pd


def test_normalize_announcement_sets_high_confidence():
    from fetch_cn_cninfo_announcements import normalize_announcement_rows

    rows = [
        {
            'symbol': '688981',
            'name': '中芯国际',
            'title': '业绩快报',
            'type': '业绩报告',
            'url': 'https://cninfo.com.cn/1',
            'published_at': '2026-05-20',
        }
    ]
    result = normalize_announcement_rows(rows)
    assert len(result) == 1
    assert result[0]['confidence_level'] == 'high'
    assert result[0]['symbol'] == '688981'
    assert result[0]['announcement_type'] == '业绩报告'


def test_fetch_cninfo_announcements_calls_akshare():
    with patch('fetch_cn_cninfo_announcements.ak') as mock_ak:
        mock_ak.stock_zh_a_disclosure_report_cninfo.return_value = pd.DataFrame({
            '代码': ['688981'],
            '简称': ['中芯国际'],
            '公告标题': ['2026年一季报'],
            '公告类型': ['季报'],
            '公告日期': ['2026-05-20'],
            '链接': ['https://cninfo.com.cn/abc'],
        })
        from fetch_cn_cninfo_announcements import fetch_cninfo_announcements
        result = fetch_cninfo_announcements('688981', '20260501', '20260526')

    assert len(result) == 1
    assert result[0]['title'] == '2026年一季报'
