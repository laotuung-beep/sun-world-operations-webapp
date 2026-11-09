import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { fetchAllEnteredDays } from './api';
import { upsertDayIntoExcelWorkbook, type DaySyncPayload } from './driveWorkbook';
import { emptyMatrix } from './compute';

describe('fetchAllEnteredDays', () => {
  it('returns sorted DaySyncPayloads including baseline dates (06/11, 07/11, 09/11)', async () => {
    const livePayload: DaySyncPayload = {
      date: '2026-11-09',
      matrix: emptyMatrix(),
      totalPassengers: 0,
      meta: {
        cableCarVisitors: 0,
        paidGateVisitors: 0,
        freeGateVisitors: 0,
        nightComboVisitors: 0,
        counterRevenue: 0,
      },
      schedules: {
        1: { openTime: '08:30', closeTime: '17:00', pausedMinutes: 0, pauseLogs: [] },
        2: { openTime: '08:30', closeTime: '17:00', pausedMinutes: 0, pauseLogs: [] },
        3: { openTime: '08:30', closeTime: '19:00', pausedMinutes: 0, pauseLogs: [] },
      },
      closed: false,
    };

    const days = await fetchAllEnteredDays(livePayload);
    expect(days.length).toBeGreaterThanOrEqual(3);

    const dates = days.map((d) => d.date);
    expect(dates).toContain('2026-11-06');
    expect(dates).toContain('2026-11-07');
    expect(dates).toContain('2026-11-09');

    // Verify chronological order
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]! >= dates[i - 1]!).toBe(true);
    }

    // Verify 07/11/2026 has expected 5,755 passengers
    const d07 = days.find((d) => d.date === '2026-11-07');
    expect(d07).toBeDefined();
    expect(d07!.totalPassengers).toBe(5755);

    // Verify 06/11/2026 has expected 1,847 passengers
    const d06 = days.find((d) => d.date === '2026-11-06');
    expect(d06).toBeDefined();
    expect(d06!.totalPassengers).toBe(1847);
  });
});

describe('Multi-Day Excel Export Integration with public template', () => {
  it('populates all 3 sheets for 06/11, 07/11, 09/11 with zero gap and correct formulas', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile('public/Bao_Cao_van_hanh_Mang_Truot.xlsx');

    const livePayload: DaySyncPayload = {
      date: '2026-11-09',
      matrix: emptyMatrix(),
      totalPassengers: 0,
      meta: {
        cableCarVisitors: 0,
        paidGateVisitors: 0,
        freeGateVisitors: 0,
        nightComboVisitors: 0,
        counterRevenue: 0,
      },
      schedules: {
        1: { openTime: '08:30', closeTime: '17:00', pausedMinutes: 0, pauseLogs: [] },
        2: { openTime: '08:30', closeTime: '17:00', pausedMinutes: 0, pauseLogs: [] },
        3: { openTime: '08:30', closeTime: '19:00', pausedMinutes: 0, pauseLogs: [] },
      },
      closed: false,
    };

    const allDays = await fetchAllEnteredDays(livePayload);
    const sorted = [...allDays].sort((a, b) => a.date.localeCompare(b.date));

    for (const p of sorted) {
      upsertDayIntoExcelWorkbook(wb, p);
    }

    // 1. Check Sheet 'Thời gian vận hành'
    const wsSched = wb.getWorksheet('Thời gian vận hành');
    expect(wsSched).toBeDefined();

    const toDateStr = (val: unknown): string => {
      if (!val) return '';
      if (val instanceof Date) return val.toISOString().slice(0, 10);
      if (typeof val === 'string') return val.slice(0, 10);
      return '';
    };

    // Baseline row 325 is 2026-11-06
    expect(toDateStr(wsSched!.getRow(325).getCell(1).value)).toBe('2026-11-06');

    // Row 326 must be contiguous: 2026-11-07 (NO 675 blank row gap to 1001!)
    expect(toDateStr(wsSched!.getRow(326).getCell(1).value)).toBe('2026-11-07');

    // Row 327 must be contiguous: 2026-11-09
    expect(toDateStr(wsSched!.getRow(327).getCell(1).value)).toBe('2026-11-09');

    // Row 1001 must NOT be used for new dates
    expect(toDateStr(wsSched!.getRow(1001).getCell(1).value)).not.toBe('2026-11-09');

    // 2. Check Sheet 'Báo Cáo Tổng Hợp'
    const wsSummary = wb.getWorksheet('Báo Cáo Tổng Hợp');
    expect(wsSummary).toBeDefined();

    // Find row 312 (2026-11-06)
    const row312 = wsSummary!.getRow(312);
    expect(toDateStr(row312.getCell(1).value)).toBe('2026-11-06');
    expect(row312.getCell(2).value).toBe(1847);
    // Revenue columns 8, 9, 10, 11 must be populated
    expect(row312.getCell(11).value).toBe(122290000);
    expect(typeof row312.getCell(8).value).toBe('number');
    expect(typeof row312.getCell(9).value).toBe('number');
    expect(Number(row312.getCell(8).value) + Number(row312.getCell(9).value) + Number(row312.getCell(10).value)).toBe(122290000);

    // Row 313 (2026-11-07)
    const row313 = wsSummary!.getRow(313);
    expect(toDateStr(row313.getCell(1).value)).toBe('2026-11-07');
    expect(row313.getCell(2).value).toBe(5755);
    expect(row313.getCell(11).value).toBe(388850000);
    expect(Number(row313.getCell(8).value) + Number(row313.getCell(9).value) + Number(row313.getCell(10).value)).toBe(388850000);

    // Row 314 (2026-11-09)
    const row314 = wsSummary!.getRow(314);
    expect(toDateStr(row314.getCell(1).value)).toBe('2026-11-09');
    expect(row314.getCell(2).value).toBe(0);

    // Row 315 (Tổng cộng)
    const row315 = wsSummary!.getRow(315);
    expect(String(row315.getCell(1).value).trim()).toBe('Tổng cộng');

    // SUM formula must encompass all rows up to row 314
    const fTot = row315.getCell(2).value as { formula?: string; result?: number };
    expect(fTot.formula).toBe('SUM(B3:B314)');
    expect(fTot.result).toBeGreaterThan(1925034);

    // 3. Check Sheet 'MA TRẬN GIỜ'
    const wsMatrix = wb.getWorksheet('MA TRẬN GIỜ');
    expect(wsMatrix).toBeDefined();

    // Verify 09/11/2026 has block with operating slots populated
    let found09 = false;
    for (let r = 4; r <= wsMatrix!.rowCount; r += 11) {
      const d = toDateStr(wsMatrix!.getRow(r).getCell(1).value);
      if (d === '2026-11-09') {
        found09 = true;
        // Check slot 08:30 (operating for M1, M2, M3)
        const opRow = wsMatrix!.getRow(r); // slot 08:30
        expect(opRow.getCell(3).value).toBe(0); // single
        expect(opRow.getCell(4).value).toBe(0); // double
        expect(opRow.getCell(5).result).toBe(0); // passengers result is 0 (not empty string)

        // Check Total row of this block (r + 10)
        const sumRow = wsMatrix!.getRow(r + 10);
        expect(sumRow.getCell(2).value).toBe('Tổng');
        expect(sumRow.getCell(3).result).toBe(0); // sum of rides is 0 (not empty string)
        break;
      }
    }
    expect(found09).toBe(true);
  });
});
