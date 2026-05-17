import type {
  MockDashboardData,
  IndicatorCard,
  RecommendationCard,
} from '@/types';

const TODAY = '2026-05-17';

const indexCards: IndicatorCard[] = [
  {
    symbol: 'NDX', name: '纳斯达克100', trade_date: TODAY,
    close: 19823.45, pct_change_1d: 0.82, pct_change_5d: 2.14, pct_change_20d: 4.37,
    ma20: 19421.0, ma60: 18930.0, ma250: 18100.0, ma500: 16540.0, ma1000: 13200.0,
    pct_from_ma500: 19.9, pct_from_ma1000: 50.2,
    drawdown_1y: -8.3, volume_ratio: 1.05, risk_level: 'low',
  },
  {
    symbol: 'SPX', name: '标普500', trade_date: TODAY,
    close: 5312.18, pct_change_1d: 0.54, pct_change_5d: 1.32, pct_change_20d: 3.11,
    ma20: 5220.0, ma60: 5080.0, ma250: 4900.0, ma500: 4450.0, ma1000: 3600.0,
    pct_from_ma500: 19.4, pct_from_ma1000: 47.6,
    drawdown_1y: -6.1, volume_ratio: 0.98, risk_level: 'low',
  },
  {
    symbol: 'VIX', name: '恐慌指数', trade_date: TODAY,
    close: 14.23, pct_change_1d: -3.12, pct_change_5d: -8.4, pct_change_20d: -12.1,
    ma20: 16.5, ma60: 18.2, ma250: 19.8, ma500: null, ma1000: null,
    pct_from_ma500: null, pct_from_ma1000: null,
    drawdown_1y: null, volume_ratio: null, risk_level: 'low',
  },
];

const etfCards: IndicatorCard[] = [
  {
    symbol: 'QQQ', name: '纳指ETF', trade_date: TODAY,
    close: 482.31, pct_change_1d: 0.79, pct_change_5d: 2.05, pct_change_20d: 4.12,
    ma20: 472.8, ma60: 461.0, ma250: 440.5, ma500: 402.0, ma1000: 320.0,
    pct_from_ma500: 20.0, pct_from_ma1000: 50.7,
    drawdown_1y: -8.9, volume_ratio: 1.12, risk_level: 'low',
  },
  {
    symbol: 'SPY', name: '标普ETF', trade_date: TODAY,
    close: 530.44, pct_change_1d: 0.51, pct_change_5d: 1.28, pct_change_20d: 3.05,
    ma20: 521.0, ma60: 507.0, ma250: 489.0, ma500: 444.0, ma1000: 359.0,
    pct_from_ma500: 19.5, pct_from_ma1000: 47.8,
    drawdown_1y: -6.3, volume_ratio: 0.95, risk_level: 'low',
  },
  {
    symbol: 'SMH', name: '半导体ETF', trade_date: TODAY,
    close: 248.72, pct_change_1d: 1.43, pct_change_5d: 5.21, pct_change_20d: 11.4,
    ma20: 231.0, ma60: 219.5, ma250: 208.0, ma500: 185.0, ma1000: 142.0,
    pct_from_ma500: 34.4, pct_from_ma1000: 75.0,
    drawdown_1y: -14.2, volume_ratio: 1.68, risk_level: 'medium',
  },
  {
    symbol: 'TLT', name: '长期国债ETF', trade_date: TODAY,
    close: 89.12, pct_change_1d: -0.21, pct_change_5d: -1.05, pct_change_20d: -2.3,
    ma20: 90.8, ma60: 92.4, ma250: 96.1, ma500: 102.0, ma1000: 118.0,
    pct_from_ma500: -12.6, pct_from_ma1000: -24.5,
    drawdown_1y: -18.4, volume_ratio: 0.88, risk_level: 'high',
  },
  {
    symbol: 'GLD', name: '黄金ETF', trade_date: TODAY,
    close: 238.45, pct_change_1d: 0.33, pct_change_5d: 0.82, pct_change_20d: 3.75,
    ma20: 234.0, ma60: 226.0, ma250: 210.0, ma500: 192.0, ma1000: 165.0,
    pct_from_ma500: 24.2, pct_from_ma1000: 44.5,
    drawdown_1y: -4.1, volume_ratio: 1.02, risk_level: 'low',
  },
];

const strongWatch: RecommendationCard[] = [
  {
    symbol: 'NVDA', name: '英伟达', market: 'US', asset_type: 'stock',
    recommendation_type: 'strong_watch', score: 88,
    reason: '半导体板块强势，AI 芯片需求新闻密集，价格位于 MA60 上方，趋势健康。',
    risk: '短期涨幅较高，追高风险需关注。',
    action_suggestion: '等待回调至 MA20 附近后关注买入机会。',
  },
  {
    symbol: 'META', name: 'Meta', market: 'US', asset_type: 'stock',
    recommendation_type: 'strong_watch', score: 82,
    reason: 'AI 广告效率提升，财报超预期，价格创52周新高附近。',
    risk: '估值偏高，宏观利率敏感。',
    action_suggestion: '维持关注，不追高，等待整理后入场。',
  },
];

const pullbackWatch: RecommendationCard[] = [
  {
    symbol: 'QQQ', name: '纳指ETF', market: 'US', asset_type: 'etf',
    recommendation_type: 'pullback_watch', score: 74,
    reason: '长期趋势仍在 MA500 上方，短期接近 MA20，未出现明显利空。',
    risk: '若跌破 MA60，需要降低短期风险偏好。',
    action_suggestion: '维持基础定投，暂不增强加仓。',
  },
];

const riskWatch: RecommendationCard[] = [
  {
    symbol: 'SMH', name: '半导体ETF', market: 'US', asset_type: 'etf',
    recommendation_type: 'risk_watch', score: 45,
    reason: '短期涨幅明显高于 QQQ，成交量放大 1.68 倍，存在追高风险。',
    risk: '若新闻驱动减弱，可能出现快速回撤。',
    action_suggestion: '不追涨，等待回调后评估。',
  },
];

const cnSectors: RecommendationCard[] = [
  {
    symbol: 'CN_SEMI', name: 'A股半导体', market: 'CN', asset_type: 'sector',
    recommendation_type: 'sector_watch', score: 71,
    reason: '板块涨幅 +2.3%，中芯国际、北方华创放量上涨，受国产替代政策驱动。',
    risk: '政策博弈风险，短期情绪化波动大。',
    action_suggestion: '仅观察，不作为直接买入信号。',
  },
  {
    symbol: 'CN_AI', name: 'A股AI应用', market: 'CN', asset_type: 'sector',
    recommendation_type: 'sector_watch', score: 65,
    reason: '板块涨幅 +1.8%，AI 算力主题持续活跃，科大讯飞、商汤表现领先。',
    risk: '估值较高，需关注业绩兑现。',
    action_suggestion: '观察为主，关注回调后龙头机会。',
  },
];

export const mockDashboard: MockDashboardData = {
  trade_date: TODAY,
  market_status: {
    label: '正常偏强',
    level: 'normal',
    description: '纳指100 和标普500 均位于 MA500 上方，VIX 处于低位，整体市场情绪偏乐观。',
  },
  index_cards: indexCards,
  etf_cards: etfCards,
  strong_watch: strongWatch,
  pullback_watch: pullbackWatch,
  risk_watch: riskWatch,
  cn_sectors: cnSectors,
  dca: {
    base: [
      { symbol: 'QQQ', name: '纳指100ETF', amount: 1000 },
      { symbol: 'SPY', name: '标普500ETF', amount: 200 },
    ],
    enhanced_triggered: false,
    reason: '纳指100 仍在 MA500 上方，回撤未进入中度区间（< 10%），维持基础定投。',
  },
  daily_report: {
    trade_date: TODAY,
    market_summary: '今日美股市场整体偏强，纳指100 继续位于 MA500 上方，VIX 下行至 14.23。',
    us_summary: '科技板块领涨，NVDA 和 META 表现突出，半导体 ETF（SMH）单日涨幅 1.43%，但成交量放大需注意追高风险。',
    etf_summary: 'QQQ 稳健，TLT 弱势延续，GLD 小幅上涨，防御资产整体偏弱。',
    cn_sector_summary: 'A股半导体和 AI 应用板块今日强势，受政策预期驱动，建议观察为主。',
    dca_suggestion: '今日基础定投建议维持：纳指100 1000 元，标普500 200 元。未触发增强加仓条件。',
    risk_summary: '主要风险：SMH 短期追高风险、TLT 长债继续承压、宏观利率预期变化。',
  },
};
