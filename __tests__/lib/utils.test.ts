import { formatPct, formatPrice, getPctColor, getRiskLabel } from '@/lib/utils';

describe('formatPct', () => {
  it('formats positive number with + sign and 2 decimals', () => {
    expect(formatPct(1.234)).toBe('+1.23%');
  });
  it('formats negative number with - sign', () => {
    expect(formatPct(-2.5)).toBe('-2.50%');
  });
  it('formats zero as 0.00%', () => {
    expect(formatPct(0)).toBe('0.00%');
  });
});

describe('formatPrice', () => {
  it('formats number with comma separators and 2 decimals', () => {
    expect(formatPrice(12345.678)).toBe('12,345.68');
  });
  it('formats number below 1000 without commas', () => {
    expect(formatPrice(99.5)).toBe('99.50');
  });
});

describe('getPctColor', () => {
  it('returns positive class for positive value', () => {
    expect(getPctColor(1)).toBe('text-green-400');
  });
  it('returns negative class for negative value', () => {
    expect(getPctColor(-1)).toBe('text-red-400');
  });
  it('returns muted class for zero', () => {
    expect(getPctColor(0)).toBe('text-gray-400');
  });
});

describe('getRiskLabel', () => {
  it('maps risk levels to Chinese labels', () => {
    expect(getRiskLabel('low')).toBe('低风险');
    expect(getRiskLabel('medium')).toBe('中等');
    expect(getRiskLabel('high')).toBe('高风险');
    expect(getRiskLabel('extreme')).toBe('极端');
  });
});
