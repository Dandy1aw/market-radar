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
    expect(grouped.groups.pullback_candidate.length).toBeGreaterThanOrEqual(1);
    expect(grouped.groups.risk_high.length).toBeGreaterThanOrEqual(1);
  });
});
