import type {
  OpportunityCompanyEvent,
  OpportunityIndicatorSnapshot,
  OpportunityScores,
} from './types';

interface CalcOpportunityScoresInput {
  indicator: OpportunityIndicatorSnapshot;
  directEvents: OpportunityCompanyEvent[];
  contextEvents: OpportunityCompanyEvent[];
}

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score)));
}

function scoreEvent(event: OpportunityCompanyEvent, mixedMultiplier: number): number {
  if (event.event_direction === 'positive') {
    return event.importance_score;
  }

  if (event.event_direction === 'mixed') {
    return event.importance_score * mixedMultiplier;
  }

  if (event.event_direction === 'negative') {
    return 100 - event.importance_score;
  }

  return 50;
}

function averageScores(scores: number[]): number {
  if (scores.length === 0) {
    return 50;
  }

  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export function calcNewsScore(events: OpportunityCompanyEvent[]): number {
  return clampScore(averageScores(events.map(event => scoreEvent(event, 0.75))));
}

export function calcContextSignalScore(events: OpportunityCompanyEvent[]): number {
  return clampScore(averageScores(events.map(event => scoreEvent(event, 0.65))));
}

export function isPriceOverheated(
  indicator: OpportunityIndicatorSnapshot,
): boolean {
  const pctChange20d = indicator.pct_change_20d;
  const pctFromMa500 = indicator.pct_from_ma500;
  const volumeRatio = indicator.volume_ratio;
  const drawdown1y = indicator.drawdown_1y;

  return (
    (pctChange20d != null && pctChange20d >= 12) ||
    (pctFromMa500 != null && pctFromMa500 >= 25) ||
    (volumeRatio != null &&
      volumeRatio >= 1.5 &&
      drawdown1y != null &&
      drawdown1y > -5)
  );
}

export function calcPricePositionScore(
  indicator: OpportunityIndicatorSnapshot,
): number {
  const pctChange5d = indicator.pct_change_5d;
  const pctChange20d = indicator.pct_change_20d;
  const pctFromMa500 = indicator.pct_from_ma500;
  const drawdown1y = indicator.drawdown_1y;
  const volumeRatio = indicator.volume_ratio;

  let score = 55;

  if (drawdown1y != null && drawdown1y <= -20) {
    score += 20;
  } else if (drawdown1y != null && drawdown1y <= -10) {
    score += 12;
  } else if (drawdown1y != null && drawdown1y <= -5) {
    score += 6;
  } else if (drawdown1y != null && drawdown1y > -3) {
    score -= 8;
  }

  if (pctFromMa500 != null) {
    const maDistance = Math.abs(pctFromMa500);
    if (pctFromMa500 <= -20) {
      score -= 25;
    } else if (maDistance <= 5) {
      score += 15;
    } else if (maDistance <= 12) {
      score += 8;
    } else if (maDistance <= 20) {
      score += 2;
    } else if (pctFromMa500 >= 25) {
      score -= 18;
    } else if (pctFromMa500 >= 20) {
      score -= 8;
    }
  }

  if (pctChange20d != null && pctChange20d >= 15) {
    score -= 18;
  } else if (pctChange20d != null && pctChange20d >= 12) {
    score -= 12;
  } else if (pctChange20d != null && pctChange20d >= 8) {
    score -= 6;
  }

  if (pctChange5d != null && pctChange5d >= 6) {
    score -= 6;
  }

  if (volumeRatio != null && volumeRatio >= 1.5) {
    score -= 6;
  }

  return clampScore(score);
}

export function calcRiskScore(indicator: OpportunityIndicatorSnapshot): number {
  const pctChange20d = indicator.pct_change_20d;
  const pctFromMa500 = indicator.pct_from_ma500;
  const volumeRatio = indicator.volume_ratio;
  const drawdown1y = indicator.drawdown_1y;

  let score = 20;

  if (indicator.risk_level === 'medium') {
    score += 25;
  } else if (indicator.risk_level === 'high') {
    score += 45;
  } else if (indicator.risk_level === 'extreme') {
    score += 60;
  }

  if (pctChange20d != null && pctChange20d >= 15) {
    score += 18;
  } else if (pctChange20d != null && pctChange20d >= 12) {
    score += 14;
  } else if (pctChange20d != null && pctChange20d >= 8) {
    score += 8;
  }

  if (pctFromMa500 != null && pctFromMa500 >= 25) {
    score += 18;
  } else if (pctFromMa500 != null && pctFromMa500 >= 20) {
    score += 12;
  } else if (pctFromMa500 != null && pctFromMa500 >= 15) {
    score += 6;
  }

  if (volumeRatio != null && volumeRatio >= 1.5) {
    score += 12;
  } else if (volumeRatio != null && volumeRatio >= 1.25) {
    score += 6;
  }

  if (drawdown1y != null && drawdown1y > -5) {
    score += 5;
  }

  return clampScore(score);
}

export function calcOpportunityScores({
  indicator,
  directEvents,
  contextEvents,
}: CalcOpportunityScoresInput): OpportunityScores {
  const news_score = calcNewsScore(directEvents);
  const price_position_score = calcPricePositionScore(indicator);
  const context_signal_score = calcContextSignalScore(contextEvents);
  const risk_score = calcRiskScore(indicator);
  const total_score = clampScore(
    0.35 * news_score +
      0.25 * price_position_score +
      0.2 * context_signal_score -
      0.2 * risk_score +
      20,
  );

  return {
    total_score,
    news_score,
    price_position_score,
    context_signal_score,
    risk_score,
  };
}
