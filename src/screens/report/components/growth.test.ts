import { describe, expect, it } from 'vitest';
import { computeSafeGrowthRate, getPreviousDateString } from './useGrowthRates';

describe('computeSafeGrowthRate', () => {
  it('calculates positive growth rate correctly', () => {
    const res = computeSafeGrowthRate(110, 100);
    expect(res.rate).toBe(10);
    expect(res.formatted).toBe('+10.0%');
    expect(res.direction).toBe('up');
    expect(res.isAvailable).toBe(true);
  });

  it('calculates negative growth rate correctly', () => {
    const res = computeSafeGrowthRate(85, 100);
    expect(res.rate).toBe(-15);
    expect(res.formatted).toBe('-15.0%');
    expect(res.direction).toBe('down');
    expect(res.isAvailable).toBe(true);
  });

  it('calculates zero growth rate as neutral', () => {
    const res = computeSafeGrowthRate(100, 100);
    expect(res.rate).toBe(0);
    expect(res.formatted).toBe('0.0%');
    expect(res.direction).toBe('neutral');
    expect(res.isAvailable).toBe(true);
  });

  it('uses fallback rate when previous value is missing, zero, or null', () => {
    const resRevenue = computeSafeGrowthRate(542450000, null, 12.5);
    expect(resRevenue.rate).toBe(12.5);
    expect(resRevenue.formatted).toBe('+12.5%');
    expect(resRevenue.direction).toBe('up');
    expect(resRevenue.isAvailable).toBe(true);

    const resPassengers = computeSafeGrowthRate(5755, undefined, 7.4);
    expect(resPassengers.rate).toBe(7.4);
    expect(resPassengers.formatted).toBe('+7.4%');
    expect(resPassengers.direction).toBe('up');
    expect(resPassengers.isAvailable).toBe(true);

    const resConversion = computeSafeGrowthRate(60.3, 0, 4.2);
    expect(resConversion.rate).toBe(4.2);
    expect(resConversion.formatted).toBe('+4.2%');
    expect(resConversion.direction).toBe('up');
    expect(resConversion.isAvailable).toBe(true);
  });

  it('returns isAvailable: false with null rate when previous value is zero or missing and no fallback provided', () => {
    const resNull = computeSafeGrowthRate(100, null);
    expect(resNull.isAvailable).toBe(false);
    expect(resNull.rate).toBeNull();
    expect(resNull.formatted).toBe('—');
    expect(resNull.direction).toBe('none');

    const resUndefined = computeSafeGrowthRate(100, undefined);
    expect(resUndefined.isAvailable).toBe(false);
    expect(resUndefined.rate).toBeNull();

    const resZero = computeSafeGrowthRate(100, 0);
    expect(resZero.isAvailable).toBe(false);
    expect(resZero.rate).toBeNull();

    const resNegative = computeSafeGrowthRate(100, -50);
    expect(resNegative.isAvailable).toBe(false);
    expect(resNegative.rate).toBeNull();
  });

  it('safely handles non-finite or NaN inputs without crashing or producing NaN%', () => {
    const resNaN = computeSafeGrowthRate(NaN, 100);
    expect(resNaN.isAvailable).toBe(false);
    expect(resNaN.rate).toBeNull();
    expect(resNaN.formatted).toBe('—');

    const resInf = computeSafeGrowthRate(100, Infinity);
    expect(resInf.isAvailable).toBe(false);
    expect(resInf.rate).toBeNull();
  });
});

describe('getPreviousDateString', () => {
  it('returns previous day for standard date', () => {
    expect(getPreviousDateString('2026-11-09')).toBe('2026-11-08');
  });

  it('handles month boundaries correctly', () => {
    expect(getPreviousDateString('2026-03-01')).toBe('2026-02-28');
  });

  it('handles year boundaries correctly', () => {
    expect(getPreviousDateString('2026-01-01')).toBe('2025-12-31');
  });

  it('returns empty string for invalid dates', () => {
    expect(getPreviousDateString('invalid')).toBe('');
  });
});
