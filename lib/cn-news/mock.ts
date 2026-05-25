// lib/cn-news/mock.ts
import type { CnNewsApiResponse } from './types';

export const mockCnNewsData: CnNewsApiResponse = {
  updated_at: '2026-05-26T08:00:00.000Z',
  summary: {
    total: 4,
    positive: 2,
    negative: 1,
    high_confidence: 2,
  },
  cards: [
    {
      symbol: '688981',
      company_name: '中芯国际',
      theme: '半导体 / 国产替代',
      event_direction: 'positive',
      confidence_level: 'high',
      source_type: 'announcement',
      source_label: '巨潮资讯',
      event_type: '业绩快报',
      importance_score: 8.5,
      event_summary:
        '公司发布 Q1 业绩快报，营收同比增长 18%，28nm 制程满产，国产替代订单持续增加。属于 high_confidence 公告级别。',
      watch_points: [
        '板块是否持续放量配合',
        '年报是否验证 Q1 数据',
        '设备端订单是否落地',
      ],
      risk_notes: [
        '单条公告不能单独触发买入判断',
        '出口管制政策风险持续存在',
      ],
      evidence: [
        '2026-05-20 巨潮公告：中芯国际 Q1 业绩快报，营收 208 亿元',
        '2026-05-18 东方财富：28nm 满产相关报道',
      ],
      updated_at: '2026-05-26T08:00:00.000Z',
    },
    {
      symbol: '002371',
      company_name: '北方华创',
      theme: '半导体设备 / 国产替代',
      event_direction: 'positive',
      confidence_level: 'high',
      source_type: 'announcement',
      source_label: '巨潮资讯',
      event_type: '重大合同',
      importance_score: 7.8,
      event_summary:
        '公司公告与国内晶圆厂签订刻蚀设备采购合同，金额超 10 亿元，国产设备替代进程加速。',
      watch_points: [
        '合同执行进度与交货周期',
        '后续是否有追加订单公告',
      ],
      risk_notes: [
        '客户集中度风险',
        '技术迭代竞争压力',
      ],
      evidence: [
        '2026-05-22 巨潮公告：重大合同公告，客户某晶圆厂',
      ],
      updated_at: '2026-05-26T08:00:00.000Z',
    },
    {
      symbol: '688008',
      company_name: '澜起科技',
      theme: '存储接口 / AI服务器',
      event_direction: 'neutral',
      confidence_level: 'medium',
      source_type: 'company_news',
      source_label: '东方财富',
      event_type: '产业政策',
      importance_score: 5.2,
      event_summary:
        '东方财富报道显示 AI 服务器需求回升，存储接口芯片受益，但尚无公司公告验证订单层面变化。',
      watch_points: [
        '是否有订单或业绩预告验证',
        'DDR5 内存接口芯片放量进度',
      ],
      risk_notes: [
        '资讯为 medium_confidence，不能单独触发判断',
        '竞争对手也在同步布局',
      ],
      evidence: [
        '2026-05-24 东方财富：AI服务器复苏相关行业报道',
      ],
      updated_at: '2026-05-26T08:00:00.000Z',
    },
    {
      symbol: '300274',
      company_name: '阳光电源',
      theme: '光伏逆变器 / 新能源',
      event_direction: 'negative',
      confidence_level: 'medium',
      source_type: 'company_news',
      source_label: '东方财富',
      event_type: '监管风险',
      importance_score: 6.1,
      event_summary:
        '行业报道显示海外市场关税政策收紧，光伏逆变器出口面临压力，公司海外收入占比约 60%。',
      watch_points: [
        '关税政策最终落地细节',
        '公司是否发布应对公告',
        '国内市场能否对冲影响',
      ],
      risk_notes: [
        '关税风险可能持续 2-3 个季度',
        '当前为新闻级别，需等待公司公告确认',
      ],
      evidence: [
        '2026-05-23 东方财富：光伏逆变器出口关税风险报道',
      ],
      updated_at: '2026-05-26T08:00:00.000Z',
    },
  ],
};
