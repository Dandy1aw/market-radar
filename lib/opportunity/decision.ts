import { calcOpportunityScores } from './scoring';
import type { SynthesizedDecision } from './decision-synthesis';
import type {
  OpportunityApiResponse,
  OpportunityCardData,
  OpportunityCompanyEvent,
  OpportunityContextEntity,
  OpportunityCoreTarget,
  OpportunityDecisionLevel,
  OpportunityIndicatorSnapshot,
  OpportunityRawNews,
  OpportunityScores,
} from './types';

export const opportunityDecisionLabels: Record<
  OpportunityDecisionLevel,
  string
> = {
  small_probe: '小仓试探',
  pullback_candidate: '回调买入候选',
  strong_watch: '强关注',
  breakout_confirm: '突破确认',
  post_earnings_wait: '财报后等待',
  risk_high: '风险过高',
};

interface BuildOpportunityCardsInput {
  coreTargets: OpportunityCoreTarget[];
  context: OpportunityContextEntity[];
  events: OpportunityCompanyEvent[];
  indicators: OpportunityIndicatorSnapshot[];
  rawNews: OpportunityRawNews[];
  synthesizedBySymbol?: Map<string, SynthesizedDecision>;
}

export function deriveDecisionLevel(
  scores: OpportunityScores,
): OpportunityDecisionLevel {
  if (scores.risk_score >= 75) {
    return 'risk_high';
  }

  if (scores.news_score >= 70 && scores.price_position_score < 45) {
    return 'pullback_candidate';
  }

  if (
    scores.total_score >= 75 &&
    scores.risk_score < 50 &&
    scores.price_position_score >= 55
  ) {
    return 'small_probe';
  }

  if (scores.news_score >= 70 || scores.context_signal_score >= 70) {
    return 'strong_watch';
  }

  if (scores.total_score >= 55) {
    return 'breakout_confirm';
  }

  return 'post_earnings_wait';
}

export function collectEventsForTarget(
  target: OpportunityCoreTarget,
  context: OpportunityContextEntity[],
  activeTargetSymbols: Set<string>,
  events: OpportunityCompanyEvent[],
): OpportunityCompanyEvent[] {
  const activeContext = context.filter(
    entity => entity.is_active && activeTargetSymbols.has(entity.core_symbol),
  );
  const directEvents = events.filter(event => event.symbol === target.symbol);
  const contextEvents = events.filter(event =>
    activeContext.some(
      entity =>
        entity.core_symbol === target.symbol &&
        (event.symbol === entity.related_name ||
          event.symbol === entity.related_symbol ||
          event.company_name === entity.related_name),
    ),
  );
  const seen = new Set<number>();
  return [...directEvents, ...contextEvents].filter(event => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

export function buildOpportunityCards({
  coreTargets,
  context,
  events,
  indicators,
  rawNews,
  synthesizedBySymbol,
}: BuildOpportunityCardsInput): OpportunityCardData[] {
  const indicatorBySymbol = new Map(
    indicators.map(indicator => [indicator.symbol, indicator]),
  );
  const newsById = new Map(rawNews.map(news => [news.id, news]));
  const activeTargets = coreTargets.filter(target => target.is_active);
  const activeTargetSymbols = new Set(activeTargets.map(target => target.symbol));
  const activeContext = context.filter(
    entity => entity.is_active && activeTargetSymbols.has(entity.core_symbol),
  );

  return activeTargets.flatMap(target => {
    const indicator = indicatorBySymbol.get(target.symbol);

    if (!indicator) {
      return [];
    }

    // Keep original split for scoring (calcOpportunityScores weights them differently)
    const directEvents = events.filter(event => event.symbol === target.symbol);
    const contextEvents = events.filter(event =>
      activeContext.some(
        entity =>
          entity.core_symbol === target.symbol &&
          (event.symbol === entity.related_name ||
            event.symbol === entity.related_symbol ||
            event.company_name === entity.related_name),
      ),
    );
    // Deduped union for display and synthesis
    const evidenceEvents = collectEventsForTarget(
      target,
      context,
      activeTargetSymbols,
      events,
    );
    const evidenceNews = collectEvidenceNews(evidenceEvents, newsById);
    const scores = calcOpportunityScores({
      indicator,
      directEvents,
      contextEvents,
    });
    const decision_level = deriveDecisionLevel(scores);
    const synthesized = synthesizedBySymbol?.get(target.symbol);

    return [
      {
        symbol: target.symbol,
        company_name: target.name,
        asset_type: target.asset_type,
        market: target.market,
        theme: target.theme,
        decision_level,
        decision_label: opportunityDecisionLabels[decision_level],
        ...scores,
        summary: buildSummary(target, decision_level, scores),
        watch_conditions: synthesized?.watch_conditions ?? buildWatchConditions(indicator, evidenceEvents),
        risk_factors: synthesized?.risk_factors ?? buildRiskFactors(indicator, evidenceEvents, scores),
        evidence_events: evidenceEvents,
        evidence_news: evidenceNews,
        updated_at: getLatestTimestamp(target, evidenceEvents, evidenceNews),
      },
    ];
  });
}

export function groupOpportunityCards(
  cards: OpportunityCardData[],
): OpportunityApiResponse {
  const groups: OpportunityApiResponse['groups'] = {
    strong_watch: [],
    pullback_candidate: [],
    risk_high: [],
    other: [],
  };

  for (const card of cards) {
    switch (card.decision_level) {
      case 'strong_watch':
        groups.strong_watch.push(card);
        break;
      case 'pullback_candidate':
        groups.pullback_candidate.push(card);
        break;
      case 'risk_high':
        groups.risk_high.push(card);
        break;
      default:
        groups.other.push(card);
    }
  }

  return {
    updated_at: getLatestCardTimestamp(cards),
    summary: {
      total: cards.length,
      strong_watch: groups.strong_watch.length,
      pullback_candidate: groups.pullback_candidate.length,
      risk_high: groups.risk_high.length,
      other: groups.other.length,
    },
    groups,
  };
}

function collectEvidenceNews(
  events: OpportunityCompanyEvent[],
  newsById: Map<number, OpportunityRawNews>,
): OpportunityRawNews[] {
  const seen = new Set<number>();
  const news: OpportunityRawNews[] = [];

  for (const event of events) {
    for (const newsId of event.evidence_news_ids) {
      if (seen.has(newsId)) {
        continue;
      }

      const item = newsById.get(newsId);
      if (item) {
        seen.add(newsId);
        news.push(item);
      }
    }
  }

  return news;
}

function buildSummary(
  target: OpportunityCoreTarget,
  decisionLevel: OpportunityDecisionLevel,
  scores: OpportunityScores,
): string {
  return `${target.symbol} ${opportunityDecisionLabels[decisionLevel]}：新闻 ${scores.news_score}，位置 ${scores.price_position_score}，风险 ${scores.risk_score}。`;
}

function buildWatchConditions(
  indicator: OpportunityIndicatorSnapshot,
  events: OpportunityCompanyEvent[],
): string[] {
  const conditions = [
    '跟踪后续新闻是否强化当前主题',
    '观察价格能否维持在关键均线附近',
  ];

  if (indicator.volume_ratio != null && indicator.volume_ratio >= 1.25) {
    conditions.push('确认放量后是否继续承接');
  }

  if (events.length > 0) {
    conditions.push('复核事件证据是否出现反向变化');
  }

  return conditions;
}

function buildRiskFactors(
  indicator: OpportunityIndicatorSnapshot,
  events: OpportunityCompanyEvent[],
  scores: OpportunityScores,
): string[] {
  const risks: string[] = [];

  if (scores.risk_score >= 75) {
    risks.push('综合风险分过高');
  }

  if (
    indicator.pct_change_20d != null &&
    indicator.pct_change_20d >= 12
  ) {
    risks.push('20日涨幅偏高');
  }

  if (
    indicator.pct_from_ma500 != null &&
    indicator.pct_from_ma500 >= 25
  ) {
    risks.push('距离500日均线偏远');
  }

  if (events.some(event => event.event_direction === 'negative')) {
    risks.push('存在负向事件');
  }

  return risks.length > 0 ? risks : ['暂无突出风险，继续观察'];
}

function getLatestTimestamp(
  target: OpportunityCoreTarget,
  events: OpportunityCompanyEvent[],
  news: OpportunityRawNews[],
): string {
  const timestamps = [
    target.updated_at,
    ...events.map(event => event.published_at),
    ...news.map(item => item.published_at),
  ];

  return timestamps.sort().at(-1) ?? target.updated_at;
}

function getLatestCardTimestamp(cards: OpportunityCardData[]): string {
  return (
    cards.map(card => card.updated_at).sort().at(-1) ??
    new Date().toISOString()
  );
}
