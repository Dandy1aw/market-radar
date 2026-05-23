import { getRiskLabel } from '@/lib/utils';
import type { DashboardData, IndicatorCard } from '@/types';

export type StrategyTone = 'positive' | 'warning' | 'negative' | 'neutral';

export interface StrategySignal {
  title: string;
  value: string;
  detail: string;
  tone: StrategyTone;
}

export interface StrategySummary {
  title: string;
  label: string;
  detail: string;
  tone: StrategyTone;
  signals: StrategySignal[];
}

function pct(value: number | null) {
  return value == null ? '数据不足' : `${value.toFixed(1)}%`;
}

function isHighRisk(indicator: IndicatorCard) {
  return indicator.risk_level === 'high' || indicator.risk_level === 'extreme';
}

function deriveTrendSignal(indicator: IndicatorCard): StrategySignal {
  if (indicator.ma250 != null && indicator.close < indicator.ma250) {
    return {
      title: '趋势',
      value: '趋势转弱',
      detail: '价格跌破 MA250，先观察能否重新站回中长期均线。',
      tone: 'negative',
    };
  }

  if (indicator.ma60 != null && indicator.close < indicator.ma60) {
    return {
      title: '趋势',
      value: '短线转弱',
      detail: '价格低于 MA60，短期波动压力上升。',
      tone: 'warning',
    };
  }

  return {
    title: '趋势',
    value: '上升趋势',
    detail: '价格保持在主要均线上方，趋势结构仍然健康。',
    tone: 'positive',
  };
}

function derivePullbackSignal(indicator: IndicatorCard): StrategySignal {
  const drawdown = indicator.drawdown_1y;
  if (drawdown == null) {
    return {
      title: '回撤',
      value: '数据不足',
      detail: '缺少年内回撤数据，暂不作为动作依据。',
      tone: 'neutral',
    };
  }

  if (drawdown <= -15) {
    return {
      title: '回撤',
      value: '深度回撤',
      detail: `年内回撤 ${pct(drawdown)}，适合重点检查风险是否可控。`,
      tone: 'warning',
    };
  }

  if (drawdown <= -10) {
    return {
      title: '回撤',
      value: '进入关注区',
      detail: `年内回撤 ${pct(drawdown)}，可开始分批观察加仓条件。`,
      tone: 'positive',
    };
  }

  return {
    title: '回撤',
    value: '回撤温和',
    detail: `年内回撤 ${pct(drawdown)}，暂未给出明显折价机会。`,
    tone: 'neutral',
  };
}

function deriveRiskSignal(indicator: IndicatorCard): StrategySignal {
  if (!indicator.risk_level) {
    return {
      title: '风险',
      value: '未分级',
      detail: '当前标的缺少风险等级，先以均线和回撤信号为主。',
      tone: 'neutral',
    };
  }

  const tone: StrategyTone = isHighRisk(indicator)
    ? 'negative'
    : indicator.risk_level === 'medium'
      ? 'warning'
      : 'positive';

  return {
    title: '风险',
    value: getRiskLabel(indicator.risk_level),
    detail:
      tone === 'negative'
        ? '风险等级偏高，优先保护仓位和现金流。'
        : tone === 'warning'
          ? '风险处于中等区间，适合放慢节奏。'
          : '风险等级较低，可以维持原有计划。',
    tone,
  };
}

function deriveActionSignal(indicator: IndicatorCard): StrategySignal {
  if (isHighRisk(indicator)) {
    return {
      title: '动作',
      value: '控制仓位',
      detail: '风险等级偏高，暂停增强加仓，等待风险回落。',
      tone: 'negative',
    };
  }

  if (
    (indicator.pct_from_ma500 != null && indicator.pct_from_ma500 <= 5) ||
    (indicator.drawdown_1y != null && indicator.drawdown_1y <= -10)
  ) {
    return {
      title: '动作',
      value: '分批关注',
      detail: '价格接近长期均线或回撤进入关注区，可等待确认后分批执行。',
      tone: 'positive',
    };
  }

  if (
    (indicator.pct_from_ma500 != null && indicator.pct_from_ma500 >= 15) ||
    (indicator.pct_change_20d != null && indicator.pct_change_20d >= 3)
  ) {
    return {
      title: '动作',
      value: '避免追高',
      detail: '趋势偏强但离长期均线较远，继续定投即可，不主动追涨。',
      tone: 'warning',
    };
  }

  return {
    title: '动作',
    value: '维持定投',
    detail: '未触发增强或减仓条件，按基础计划执行。',
    tone: 'neutral',
  };
}

export function deriveIndicatorSignals(
  indicator: IndicatorCard,
): StrategySignal[] {
  return [
    deriveTrendSignal(indicator),
    derivePullbackSignal(indicator),
    deriveRiskSignal(indicator),
    deriveActionSignal(indicator),
  ];
}

export function deriveDashboardStrategy(data: DashboardData): StrategySummary {
  const ndx = data.index_cards.find(card => card.symbol === 'NDX');
  const vix = data.index_cards.find(card => card.symbol === 'VIX');
  const source = ndx ?? data.index_cards[0];
  const signals = source ? deriveIndicatorSignals(source) : [];
  const vixClose = vix?.close ?? 0;

  if (vixClose >= 25 || (source && isHighRisk(source))) {
    return {
      title: '今日操作建议',
      label: '风险升高，放慢节奏',
      detail: 'VIX 或核心指数风险偏高，优先控制仓位，暂停增强加仓。',
      tone: 'negative',
      signals,
    };
  }

  if (
    source &&
    ((source.pct_from_ma500 != null && source.pct_from_ma500 <= 5) ||
      (source.drawdown_1y != null && source.drawdown_1y <= -10))
  ) {
    return {
      title: '今日操作建议',
      label: '进入关注区，分批观察',
      detail: '核心指数接近长期均线或回撤扩大，可准备分批关注。',
      tone: 'positive',
      signals,
    };
  }

  if (
    source &&
    ((source.pct_from_ma500 != null && source.pct_from_ma500 >= 15) ||
      (source.pct_change_20d != null && source.pct_change_20d >= 3))
  ) {
    return {
      title: '今日操作建议',
      label: '趋势偏强，避免追高',
      detail: '核心指数趋势健康，但离长期均线较远，适合维持基础定投。',
      tone: 'warning',
      signals,
    };
  }

  return {
    title: '今日操作建议',
    label: '维持基础定投',
    detail: '市场未触发明显增强或降风险条件，按计划执行即可。',
    tone: 'neutral',
    signals,
  };
}
