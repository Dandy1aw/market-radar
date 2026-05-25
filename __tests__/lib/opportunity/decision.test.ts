import {
  buildOpportunityCards,
  deriveDecisionLevel,
  groupOpportunityCards,
  opportunityDecisionLabels,
} from '@/lib/opportunity/decision';
import {
  seedCompanyEvents,
  seedContext,
  seedCoreWatchlist,
  seedIndicators,
  seedRawNews,
} from '@/lib/opportunity/seed';
import type {
  OpportunityCardData,
  OpportunityCompanyEvent,
  OpportunityContextEntity,
} from '@/lib/opportunity/types';

describe('opportunity decisions', () => {
  it('high risk overrides positive news', () => {
    expect(
      deriveDecisionLevel({
        total_score: 78,
        news_score: 88,
        price_position_score: 30,
        context_signal_score: 70,
        risk_score: 82,
      }),
    ).toBe('risk_high');
  });

  it('overheated strong news becomes a pullback candidate', () => {
    expect(
      deriveDecisionLevel({
        total_score: 72,
        news_score: 86,
        price_position_score: 35,
        context_signal_score: 78,
        risk_score: 58,
      }),
    ).toBe('pullback_candidate');
  });

  it('balanced strong setups can become small probe candidates', () => {
    expect(
      deriveDecisionLevel({
        total_score: 78,
        news_score: 84,
        price_position_score: 72,
        context_signal_score: 68,
        risk_score: 38,
      }),
    ).toBe('small_probe');
  });

  it('does not make extended price positions small probe candidates', () => {
    expect(
      deriveDecisionLevel({
        total_score: 75,
        news_score: 69,
        price_position_score: 44,
        context_signal_score: 100,
        risk_score: 0,
      }),
    ).toBe('strong_watch');
  });

  it('provides Chinese labels for each decision level', () => {
    expect(opportunityDecisionLabels.risk_high).toBe('风险过高');
    expect(opportunityDecisionLabels.pullback_candidate).toBe('回调买入候选');
  });

  it('builds one card per core target and excludes context entities as cards', () => {
    const cards = buildOpportunityCards({
      coreTargets: seedCoreWatchlist,
      context: seedContext,
      events: seedCompanyEvents,
      indicators: seedIndicators,
      rawNews: seedRawNews,
    });

    expect(cards.map(card => card.symbol).sort()).toEqual([
      'AMD',
      'MU',
      'NVDA',
      'QQQ',
      'SMH',
    ]);
    expect(cards.some(card => card.symbol === 'Samsung Memory')).toBe(false);
  });

  it('maps context events by company name when related symbol is absent', () => {
    const samsungEvent = seedCompanyEvents.find(
      event => event.symbol === 'Samsung Memory',
    )!;
    const samsungSymbolEvent: OpportunityCompanyEvent = {
      ...samsungEvent,
      id: 200,
      symbol: 'SSNLF',
      company_name: 'Samsung Memory',
    };

    const cards = buildOpportunityCards({
      coreTargets: seedCoreWatchlist,
      context: seedContext,
      events: [samsungSymbolEvent],
      indicators: seedIndicators,
      rawNews: seedRawNews,
    });
    const muCard = cards.find(card => card.symbol === 'MU');

    expect(muCard?.evidence_events).toEqual([samsungSymbolEvent]);
    expect(muCard?.context_signal_score).toBe(78);
  });

  it('deduplicates evidence events that match directly and through context', () => {
    const muEvent = seedCompanyEvents.find(event => event.symbol === 'MU')!;
    const muSelfContext: OpportunityContextEntity = {
      id: 200,
      core_symbol: 'MU',
      related_symbol: 'MU',
      related_name: 'Micron Technology',
      market: 'US',
      relation_type: 'industry_signal',
      relation_strength: 1,
      reason: 'Synthetic duplicate-match context.',
      is_active: true,
      created_at: '2026-05-23T08:00:00.000Z',
      updated_at: '2026-05-23T08:00:00.000Z',
    };

    const cards = buildOpportunityCards({
      coreTargets: seedCoreWatchlist,
      context: [muSelfContext],
      events: [muEvent],
      indicators: seedIndicators,
      rawNews: seedRawNews,
    });
    const muCard = cards.find(card => card.symbol === 'MU');

    expect(muCard?.evidence_events).toEqual([muEvent]);
  });

  it('groups cards by decision level', () => {
    const cards = buildOpportunityCards({
      coreTargets: seedCoreWatchlist,
      context: seedContext,
      events: seedCompanyEvents,
      indicators: seedIndicators,
      rawNews: seedRawNews,
    });
    const grouped = groupOpportunityCards(cards);

    expect(grouped.summary.total).toBe(cards.length);
    expect(grouped.groups.risk_high.length).toBeGreaterThanOrEqual(1);
    expect(
      grouped.groups.strong_watch.every(
        card => card.decision_level === 'strong_watch',
      ),
    ).toBe(true);
    expect(
      grouped.groups.pullback_candidate.every(
        card => card.decision_level === 'pullback_candidate',
      ),
    ).toBe(true);
    expect(
      grouped.groups.risk_high.every(card => card.decision_level === 'risk_high'),
    ).toBe(true);
    expect(
      grouped.groups.other.every(
        card =>
          !['strong_watch', 'pullback_candidate', 'risk_high'].includes(
            card.decision_level,
          ),
      ),
    ).toBe(true);
  });

  it('uses synthesized watch_conditions and risk_factors when provided', () => {
    const synthesizedBySymbol = new Map([
      [
        'MU',
        {
          watch_conditions: ['关注三星认证进展对HBM供需格局的影响'],
          risk_factors: ['20日已涨15%，短期存在获利回吐风险'],
        },
      ],
    ]);

    const cards = buildOpportunityCards({
      coreTargets: seedCoreWatchlist,
      context: seedContext,
      events: seedCompanyEvents,
      indicators: seedIndicators,
      rawNews: seedRawNews,
      synthesizedBySymbol,
    });
    const muCard = cards.find(card => card.symbol === 'MU');

    expect(muCard?.watch_conditions).toEqual(['关注三星认证进展对HBM供需格局的影响']);
    expect(muCard?.risk_factors).toEqual(['20日已涨15%，短期存在获利回吐风险']);
  });

  it('returns empty watch_conditions when synthesizedBySymbol is absent', () => {
    const cards = buildOpportunityCards({
      coreTargets: seedCoreWatchlist,
      context: seedContext,
      events: seedCompanyEvents,
      indicators: seedIndicators,
      rawNews: seedRawNews,
    });
    const muCard = cards.find(card => card.symbol === 'MU');

    expect(muCard?.watch_conditions).toEqual([]);
  });

  it('does not place risk-high pullback-like cards in pullback candidates', () => {
    const riskHighPullbackLikeCard: OpportunityCardData = {
      symbol: 'RISK',
      company_name: 'Risk High Candidate',
      asset_type: 'stock',
      market: 'US',
      theme: 'synthetic regression',
      notes: null,
      decision_level: 'risk_high',
      decision_label: opportunityDecisionLabels.risk_high,
      total_score: 78,
      news_score: 88,
      price_position_score: 30,
      context_signal_score: 70,
      risk_score: 82,
      summary: 'Synthetic risk-high card.',
      watch_conditions: [],
      risk_factors: ['综合风险分过高'],
      evidence_events: [],
      evidence_news: [],
      updated_at: '2026-05-23T08:00:00.000Z',
    };

    const grouped = groupOpportunityCards([riskHighPullbackLikeCard]);

    expect(grouped.groups.risk_high).toEqual([riskHighPullbackLikeCard]);
    expect(grouped.groups.pullback_candidate).toEqual([]);
    expect(grouped.groups.other).toEqual([]);
  });
});
