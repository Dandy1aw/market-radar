import {
  calcContextSignalScore,
  calcNewsScore,
  calcOpportunityScores,
  calcPricePositionScore,
  calcRiskScore,
  isPriceOverheated,
} from '@/lib/opportunity/scoring';
import { seedCompanyEvents, seedIndicators } from '@/lib/opportunity/seed';

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
});
