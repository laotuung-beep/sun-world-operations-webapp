import { describe, expect, it } from 'vitest';
import { clockVN, dateKeyVN, hhmmToMinutes, minutesVN } from './time';

describe('Vietnam time', () => {
  it('rolls the date at midnight Vietnam time, not UTC', () => {
    // 2026-11-03 17:30 UTC = 2026-11-04 00:30 giờ VN
    const d = new Date(Date.UTC(2026, 10, 3, 17, 30));
    expect(dateKeyVN(d)).toBe('2026-11-04');
    expect(minutesVN(d)).toBe(30);
    expect(clockVN(d)).toBe('00:30');
  });
  it('parses HH:MM', () => {
    expect(hhmmToMinutes('08:30')).toBe(510);
    expect(hhmmToMinutes('19:00')).toBe(1140);
  });
});
