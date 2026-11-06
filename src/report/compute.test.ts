import { describe, expect, it } from 'vitest';
import type { Entry } from '../entries/model';
import { EMPTY_META, FREE_GATE_FORMULA_START_DATE, buildMatrix, computeFreeGate, legacySheetsPayload, lineTotal, matrixTotal, reportMetrics, resolveFreeGate } from './compute';

function entry(p: Partial<Entry>): Entry {
  return {
    id: 'x',
    date: '2026-11-03',
    slotId: '1000',
    mang: 1,
    lines: {},
    status: 'approved',
    createdBy: 'u',
    createdByName: 'NV',
    createdAt: null,
    clientCreatedAt: 0,
    pendingSync: false,
    ...p,
  };
}

const entries: Entry[] = [
  entry({ slotId: '1000', mang: 1, lines: { line1: { single: 10, double: 5 }, line2: { single: 2, double: 0 } } }),
  entry({ slotId: '1000', mang: 1, lines: { line1: { single: 1, double: 1 }, line2: { single: 0, double: 0 } } }),
  entry({ slotId: '1100', mang: 2, lines: { line3: { single: 4, double: 4 }, line4: { single: 0, double: 2 } } }),
  entry({ slotId: '1200', mang: 3, lines: { line5: { single: 3, double: 0 }, line6: { single: 0, double: 1 } } }),
  entry({ slotId: '1200', mang: 3, status: 'pending', lines: { line5: { single: 99, double: 0 }, line6: { single: 0, double: 0 } } }),
  entry({ slotId: '1300', mang: 1, status: 'rejected', lines: { line1: { single: 50, double: 0 }, line2: { single: 0, double: 0 } } }),
];

const approvedOnly = (s: Entry['status']) => s === 'approved';

describe('buildMatrix', () => {
  it('adds up phiếu per slot and line, cumulative', () => {
    const m = buildMatrix(entries, approvedOnly);
    expect(m['1000'].line1).toEqual({ single: 11, double: 6, rides: 17, passengers: 23 });
    expect(m['1000'].line2.rides).toBe(2);
    expect(m['1100'].line4).toEqual({ single: 0, double: 2, rides: 2, passengers: 4 });
  });
  it('leaves out pending / rejected when asked', () => {
    const m = buildMatrix(entries, approvedOnly);
    expect(m['1200'].line5.single).toBe(3);
    expect(m['1300'].line1.rides).toBe(0);
    const withPending = buildMatrix(entries, (s) => s === 'approved' || s === 'pending');
    expect(withPending['1200'].line5.single).toBe(102);
  });
  it('totals by line and overall', () => {
    const m = buildMatrix(entries, approvedOnly);
    expect(lineTotal(m, 'line1').rides).toBe(17);
    expect(matrixTotal(m).rides).toBe(17 + 2 + 8 + 2 + 3 + 1);
  });
});

describe('reportMetrics (same formulas as the old app)', () => {
  const m = buildMatrix(entries, approvedOnly);
  it('per máng totals and run time', () => {
    const r = reportMetrics(m, EMPTY_META, { 1: { openTime: '08:30', closeTime: '18:30', pausedMinutes: 30 } });
    expect(r.mangs[0]!.totals.rides).toBe(19);
    expect(r.mangs[0]!.runMinutes).toBe(570);
    expect(r.mangs[1]!.runMinutes).toBeNull();
  });
  it('conversion = máng passengers / cable car visitors', () => {
    const r = reportMetrics(m, { ...EMPTY_META, cableCarVisitors: 100 }, {});
    expect(r.total.passengers).toBe(23 + 2 + 12 + 4 + 3 + 2);
    expect(r.conversionRate).toBeCloseTo(46);
    expect(reportMetrics(m, EMPTY_META, {}).conversionRate).toBeNull();
  });
  it('peak average = rides in 11h–15h slots / 4', () => {
    // 1100: 8+2 = 10, 1200: 3+1 = 4, 1300: 0, 1400: 0
    expect(reportMetrics(m, EMPTY_META, {}).peakAvgRides).toBe(4);
  });
});

describe('computeFreeGate & resolveFreeGate', () => {
  it('calculates khách chơi máng - cổng tính phí when paidGate > 0', () => {
    expect(computeFreeGate(4351, 4220)).toBe(131);
    expect(computeFreeGate(1000, 1000)).toBe(0);
    expect(computeFreeGate(1000, 1200)).toBe(0); // không âm
    expect(computeFreeGate(0, 0)).toBe(0);
  });

  it('applies formula starting from 12/02/2026 and preserves Drive values when paidGate is missing', () => {
    expect(FREE_GATE_FORMULA_START_DATE).toBe('2026-02-12');
    // Trước 12/02/2026 (ví dụ 10/02/2026): không áp dụng công thức, giữ nguyên số gốc (0)
    expect(resolveFreeGate(5405, 5000, 0, '2026-02-10')).toBe(0);
    // Từ 12/02/2026 trở đi: khi có Khách tính phí -> Khách chơi máng - Khách tính phí
    expect(resolveFreeGate(5470, 5100, 0, '2026-02-12')).toBe(370);
    // 10/07/2026: Khách chơi máng = 10.054, Khách tính phí = 0 (đang thiếu), Khách miễn phí trên Drive = 669
    expect(resolveFreeGate(10054, 0, 669, '2026-07-10')).toBe(669);
    // 07/09/2026: Khách chơi máng = 6.832, Khách tính phí = 0 (đang thiếu), Khách miễn phí trên Drive = 361
    expect(resolveFreeGate(6832, 0, 361, '2026-09-07')).toBe(361);
    // 01/01/2026: Khách chơi máng = 6.012, Khách tính phí = 0, Khách miễn phí trên Drive = 0
    expect(resolveFreeGate(6012, 0, 0, '2026-01-01')).toBe(0);
    // 08/09/2026: Khách chơi máng = 5.867, Khách tính phí = 5.769 -> Khách miễn phí = 98
    expect(resolveFreeGate(5867, 5769, 98, '2026-09-08')).toBe(98);
  });
});

describe('legacySheetsPayload', () => {
  it('keeps the old Apps Script shape', () => {
    const m = buildMatrix(entries, approvedOnly);
    const p = legacySheetsPayload('2026-11-03', m, EMPTY_META, {}, true);
    expect(p.action).toBe('syncDailyReport6Line');
    expect(p.report.hourSlots).toHaveLength(10);
    expect(p.report.hourSlots[1]).toMatchObject({
      timeSlot: '10:00 - 11:00',
      mang1: { line1: { singleCarts: 11, doubleCarts: 6 } },
    });
    expect(p.metrics.mang1Summary.mangName).toBe('Alpine Coaster 1 (Line 1, Line 2)');
    expect(p.metrics.mang1Summary.openTime).toBe('00:00');
    expect(p.report.status).toBe('closed');
  });
});
