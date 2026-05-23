import {
  calcContextSignalScore,
  calcNewsScore,
  calcOpportunityScores,
  calcPricePositionScore,
  calcRiskScore,
  isPriceOverheated,
} from '@/lib/opportunity/scoring';
import { seedCompanyEvents, seedIndicators } from '@/lib/opportunity/seed';
import type {
  OpportunityCompanyEvent,
  OpportunityIndicatorSnapshot,
} from '@/lib/opportunity/types';

const baseIndicator: OpportunityIndicatorSnapshot = {
  symbol: 'TEST',
  close: 100,
  pct_change_5d: null,
  pct_change_20d: null,
  pct_from_ma500: null,
  drawdown_1y: null,
  volume_ratio: null,
  risk_level: 'low',
};

const baseEvent: OpportunityCompanyEvent = {
  id: 100,
  symbol: 'TEST',
  company_name: 'Test Company',
  theme: 'test theme',
  event_type: 'demand',
  event_direction: 'positive',
  importance_score: 80,
  event_summary: 'Synthetic scoring event.',
  evidence_news_ids: [100],
  published_at: '2026-05-23T00:00:00.000Z',
  raw_payload: {},
  created_at: '2026-05-23T00:00:00.000Z',
};

describe('opportunity scoring', () => {
  it('positive direct events raise the news score', () => {
    const muEvent = seedCompanyEvents.find(event => event.symbol === 'MU');

    expect(calcNewsScore(muEvent ? [muEvent] : [])).toBeGreaterThanOrEqual(80);
  });

  it('context events can map back to a core target', () => {
    const samsungEvent = seedCompanyEvents.find(
      event => event.symbol === 'Samsung Memory',
    );

    expect(calcContextSignalScore(samsungEvent ? [samsungEvent] : [])).toBe(78);
  });

  it('high recent returns and distance from MA500 make price overheated', () => {
    const nvda = seedIndicators.find(indicator => indicator.symbol === 'NVDA');

    expect(nvda).toBeDefined();
    expect(isPriceOverheated(nvda!)).toBe(true);
    expect(calcPricePositionScore(nvda!)).toBeLessThan(50);
  });

  it('risk score is high for high-risk indicators', () => {
    const smh = seedIndicators.find(indicator => indicator.symbol === 'SMH');

    expect(smh).toBeDefined();
    expect(calcRiskScore(smh!)).toBeGreaterThanOrEqual(75);
  });

  it('high risk level alone raises the risk score', () => {
    expect(calcRiskScore({ ...baseIndicator, risk_level: 'high' })).toBeGreaterThanOrEqual(
      65,
    );
  });

  it('missing nullable indicator fields remain neutral', () => {
    const highVolumeWithoutDrawdown = {
      ...baseIndicator,
      volume_ratio: 1.6,
    };

    expect(calcPricePositionScore(baseIndicator)).toBe(55);
    expect(isPriceOverheated(highVolumeWithoutDrawdown)).toBe(false);
  });

  it('penalizes deep downside distance from MA500', () => {
    expect(
      calcPricePositionScore({
        ...baseIndicator,
        pct_from_ma500: -25,
        drawdown_1y: -25,
      }),
    ).toBeLessThan(55);
  });

  it('combines component scores into a rounded total', () => {
    const mu = seedIndicators.find(indicator => indicator.symbol === 'MU');
    const directEvents = seedCompanyEvents.filter(event => event.symbol === 'MU');
    const contextEvents = seedCompanyEvents.filter(
      event => event.symbol === 'Samsung Memory',
    );

    const scores = calcOpportunityScores({
      indicator: mu!,
      directEvents,
      contextEvents,
    });

    expect(scores.news_score).toBeGreaterThan(80);
    expect(scores.context_signal_score).toBeGreaterThan(70);
    expect(Number.isInteger(scores.total_score)).toBe(true);
  });

  it('combines synthetic component scores with the documented weights and offset', () => {
    const scores = calcOpportunityScores({
      indicator: { ...baseIndicator, risk_level: 'low' },
      directEvents: [{ ...baseEvent, importance_score: 80 }],
      contextEvents: [
        {
          ...baseEvent,
          id: 101,
          event_direction: 'mixed',
          importance_score: 60,
        },
      ],
    });

    expect(scores).toEqual({
      news_score: 80,
      price_position_score: 55,
      context_signal_score: 39,
      risk_score: 20,
      total_score: 66,
    });
  });
});
