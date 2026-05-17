import { calcMA, calcDrawdown1y, calcVolumeRatio, calcRiskLevel } from '@/lib/indicators';

describe('calcMA', () => {
  it('returns null when prices array is shorter than period', () => {
    expect(calcMA([100, 200], 5)).toBeNull();
  });

  it('calculates average of last N prices', () => {
    const prices = [10, 20, 30, 40, 50];
    expect(calcMA(prices, 3)).toBeCloseTo(40);
  });

  it('returns exact value when prices length equals period', () => {
    expect(calcMA([1, 2, 3], 3)).toBeCloseTo(2);
  });
});

describe('calcDrawdown1y', () => {
  it('returns null for empty array', () => {
    expect(calcDrawdown1y([])).toBeNull();
  });

  it('calculates drawdown from 1-year high', () => {
    expect(calcDrawdown1y([100, 120, 80, 90])).toBeCloseTo(-0.25);
  });

  it('returns 0 when current price equals the high', () => {
    expect(calcDrawdown1y([80, 90, 100])).toBeCloseTo(0);
  });
});

describe('calcVolumeRatio', () => {
  it('returns null when ma20 volume is 0', () => {
    expect(calcVolumeRatio(1000, 0)).toBeNull();
  });

  it('calculates today / ma20 ratio', () => {
    expect(calcVolumeRatio(1500, 1000)).toBeCloseTo(1.5);
  });
});

describe('calcRiskLevel', () => {
  it('returns extreme when price below MA1000', () => {
    expect(calcRiskLevel({ close: 50, ma500: 120, ma1000: 100, drawdown1y: -0.5 })).toBe('extreme');
  });

  it('returns high when price below MA500 but above MA1000', () => {
    expect(calcRiskLevel({ close: 90, ma500: 100, ma1000: 80, drawdown1y: -0.25 })).toBe('high');
  });

  it('returns medium when drawdown exceeds 15%', () => {
    expect(calcRiskLevel({ close: 110, ma500: 100, ma1000: 80, drawdown1y: -0.16 })).toBe('medium');
  });

  it('returns low for healthy indicators', () => {
    expect(calcRiskLevel({ close: 110, ma500: 100, ma1000: 80, drawdown1y: -0.05 })).toBe('low');
  });
});
