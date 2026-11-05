import { describe, expect, it } from 'vitest';
import {
  PAUSE_CATEGORIES,
  calcPauseDurationMinutes,
  countTotals,
  currentSlotId,
  emptyLines,
  finalizeSmartTime24h,
  formatDuration,
  formatSmartTime24h,
  linesTotals,
  minutesToHHMM,
  normalizeHHMM,
  runMinutes,
  selectableSlots,
  sortNewestFirst,
  sumPauseRecordsMinutes,
  totalsBySlot,
  validateLines,
  type Entry,
} from './model';
import { hhmmToMinutes } from '../time';

const at = (hhmm: string) => hhmmToMinutes(hhmm);

function entry(p: Partial<Entry>): Entry {
  return {
    id: 'x',
    date: '2026-11-03',
    slotId: '1000',
    mang: 1,
    lines: { line1: { single: 0, double: 0 }, line2: { single: 0, double: 0 } },
    status: 'pending',
    createdBy: 'u',
    createdByName: 'NV',
    createdAt: null,
    clientCreatedAt: 0,
    pendingSync: false,
    ...p,
  };
}

describe('totals', () => {
  it('single carries 1, double carries 2', () => {
    expect(countTotals({ single: 3, double: 4 })).toEqual({ single: 3, double: 4, rides: 7, passengers: 11 });
  });
  it('sums both lines', () => {
    expect(linesTotals({ line1: { single: 1, double: 1 }, line2: { single: 2, double: 0 } })).toEqual({
      single: 3,
      double: 1,
      rides: 4,
      passengers: 5,
    });
  });
});

describe('validateLines', () => {
  it('accepts the 2 lines of the máng', () => {
    expect(validateLines(2, { line3: { single: 1, double: 0 }, line4: { single: 0, double: 0 } })).toBeNull();
  });
  it('rejects all zero', () => {
    expect(validateLines(1, emptyLines(1))).toMatch(/số 0/);
  });
  it('rejects lines of another máng', () => {
    expect(validateLines(1, { line3: { single: 1, double: 0 }, line4: { single: 0, double: 0 } })).not.toBeNull();
  });
  it('rejects negative, fractional and huge counts', () => {
    expect(validateLines(1, { line1: { single: -1, double: 0 }, line2: { single: 1, double: 0 } })).not.toBeNull();
    expect(validateLines(1, { line1: { single: 1.5, double: 0 }, line2: { single: 1, double: 0 } })).not.toBeNull();
    expect(validateLines(1, { line1: { single: 501, double: 0 }, line2: { single: 1, double: 0 } })).not.toBeNull();
  });
});

describe('time slots', () => {
  it('picks the running slot', () => {
    expect(currentSlotId(at('07:00'))).toBe('0830');
    expect(currentSlotId(at('09:59'))).toBe('0830');
    expect(currentSlotId(at('10:00'))).toBe('1000');
    expect(currentSlotId(at('14:30'))).toBe('1400');
    expect(currentSlotId(at('22:00'))).toBe('1800');
  });
  it('allows only current and past slots', () => {
    expect(selectableSlots(at('08:00')).map((s) => s.id)).toEqual(['0830']);
    expect(selectableSlots(at('11:15')).map((s) => s.id)).toEqual(['0830', '1000', '1100']);
    expect(selectableSlots(at('20:00'))).toHaveLength(10);
  });
});

describe('totalsBySlot', () => {
  it('adds up active phiếu only', () => {
    const lines = { line1: { single: 2, double: 1 }, line2: { single: 0, double: 0 } };
    const map = totalsBySlot([
      entry({ slotId: '1000', lines }),
      entry({ slotId: '1000', lines, status: 'approved' }),
      entry({ slotId: '1000', lines, status: 'cancelled' }),
      entry({ slotId: '1000', lines, status: 'rejected' }),
      entry({ slotId: '1100', lines }),
    ]);
    expect(map.get('1000')).toEqual({ single: 4, double: 2, rides: 6, passengers: 8 });
    expect(map.get('1100')?.rides).toBe(3);
    expect(map.has('1200')).toBe(false);
  });
});

describe('normalizeHHMM', () => {
  it('accepts the ways people type a time', () => {
    expect(normalizeHHMM('08:30')).toBe('08:30');
    expect(normalizeHHMM('8:30')).toBe('08:30');
    expect(normalizeHHMM('0830')).toBe('08:30');
    expect(normalizeHHMM('830')).toBe('08:30');
    expect(normalizeHHMM('19')).toBe('19:00');
  });
  it('rejects nonsense', () => {
    expect(normalizeHHMM('25:00')).toBeNull();
    expect(normalizeHHMM('0860')).toBeNull();
    expect(normalizeHHMM('abc')).toBeNull();
  });
});

describe('runMinutes', () => {
  it('close − open − paused', () => {
    expect(runMinutes('08:30', '19:00', 30)).toBe(600);
    expect(formatDuration(600)).toBe('10 giờ');
    expect(formatDuration(95)).toBe('1 giờ 35 phút');
    expect(formatDuration(40)).toBe('40 phút');
  });
  it('needs both times in order', () => {
    expect(runMinutes('08:30', '', 0)).toBeNull();
    expect(runMinutes('19:00', '08:30', 0)).toBeNull();
  });
});

describe('24h time formatting and pause records', () => {
  it('formats minutes strictly as HH:mm', () => {
    expect(minutesToHHMM(0)).toBe('00:00');
    expect(minutesToHHMM(15)).toBe('00:15');
    expect(minutesToHHMM(65)).toBe('01:05');
    expect(minutesToHHMM(445)).toBe('07:25');
  });
  it('smart 24h input auto-inserts colon and clamps 00:00-23:59', () => {
    expect(formatSmartTime24h('1015')).toBe('10:15');
    expect(formatSmartTime24h('1435')).toBe('14:35');
    expect(formatSmartTime24h('2975')).toBe('23:59');
    expect(finalizeSmartTime24h('830')).toBe('08:30');
    expect(finalizeSmartTime24h('19')).toBe('19:00');
  });
  it('calculates pause durations and sums 5 incident categories', () => {
    expect(PAUSE_CATEGORIES).toHaveLength(5);
    expect(calcPauseDurationMinutes('10:40', '10:55')).toBe(15);
    expect(calcPauseDurationMinutes('11:00', '10:55')).toBeNull();
    expect(
      sumPauseRecordsMinutes([
        { id: '1', category: 'technical', startTime: '10:40', endTime: '10:55', durationMinutes: 15, note: '' },
        { id: '2', category: 'rain', startTime: '14:00', endTime: '14:50', durationMinutes: 50, note: '' },
      ]),
    ).toBe(65);
  });
});

describe('sortNewestFirst', () => {
  it('uses server time, falls back to device time', () => {
    const sorted = sortNewestFirst([
      entry({ id: 'a', createdAt: new Date(1000) }),
      entry({ id: 'b', createdAt: null, clientCreatedAt: 5000 }),
      entry({ id: 'c', createdAt: new Date(3000) }),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });
});
