import { describe, expect, it } from 'vitest';
import {
  PAUSE_CATEGORIES,
  calcPauseDurationMinutes,
  calculateCoasterDowntime,
  categoryHasLineScope,
  countTotals,
  countsTowardMangPause,
  currentSlotId,
  emptyLines,
  finalizeSmartTime24h,
  formatDuration,
  formatSmartTime24h,
  lineScopeOptionsForMang,
  linesTotals,
  minutesToHHMM,
  normalizeHHMM,
  runMinutes,
  selectableSlots,
  sortNewestFirst,
  sumAllLoggedPauseMinutes,
  sumPauseRecordsMinutes,
  totalsBySlot,
  validateLines,
  type Entry,
  type PauseRecord,
} from './model';
import { hhmmToMinutes, isMondayVN, mondayExportRemindKey } from '../time';
import { DRIVE_FILE_ID, DRIVE_FILE_NAME, DRIVE_FOLDER_ID } from '../report/driveWorkbook';
import { EMPTY_META, emptyMatrix, legacySheetsPayload, reportMetrics } from '../report/compute';

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
  it('calculates pause durations and sums 6 incident categories with 1-line vs 2-line rules', () => {
    expect(PAUSE_CATEGORIES).toHaveLength(6);
    expect(categoryHasLineScope('maintenance')).toBe(true);
    expect(categoryHasLineScope('technical')).toBe(true);
    expect(categoryHasLineScope('rain')).toBe(false);

    expect(lineScopeOptionsForMang(1).map((o) => o.value)).toEqual(['line1', 'line2', 'both']);
    expect(lineScopeOptionsForMang(2).map((o) => o.value)).toEqual(['line3', 'line4', 'both']);
    expect(lineScopeOptionsForMang(3).map((o) => o.value)).toEqual(['line5', 'line6', 'both']);

    expect(calcPauseDurationMinutes('10:40', '10:55')).toBe(15);
    expect(calcPauseDurationMinutes('11:00', '10:55')).toBeNull();

    const records = [
      // Bảo trì 1 Line (Line 1) -> KHÔNG tính dừng Máng, vẫn lưu lịch sử đối chiếu (30p)
      { id: '1', category: 'maintenance' as const, lineScope: 'line1' as const, startTime: '09:00', endTime: '09:30', durationMinutes: 30, note: '' },
      // Bảo trì Cả 2 Line -> CÓ tính dừng Máng (20p)
      { id: '2', category: 'maintenance' as const, lineScope: 'both' as const, startTime: '10:00', endTime: '10:20', durationMinutes: 20, note: '' },
      // Lỗi kỹ thuật 1 Line (Line 2) -> KHÔNG tính dừng Máng, vẫn lưu lịch sử đối chiếu (15p)
      { id: '3', category: 'technical' as const, lineScope: 'line2' as const, startTime: '10:40', endTime: '10:55', durationMinutes: 15, note: '' },
      // Lỗi kỹ thuật Cả 2 Line -> CÓ tính dừng Máng (25p)
      { id: '4', category: 'technical' as const, lineScope: 'both' as const, startTime: '11:00', endTime: '11:25', durationMinutes: 25, note: '' },
      // Mưa lớn -> CÓ tính dừng Máng (50p)
      { id: '5', category: 'rain' as const, startTime: '14:00', endTime: '14:50', durationMinutes: 50, note: '' },
    ];

    expect(countsTowardMangPause(records[0])).toBe(false);
    expect(countsTowardMangPause(records[1])).toBe(true);
    expect(countsTowardMangPause(records[2])).toBe(false);
    expect(countsTowardMangPause(records[3])).toBe(true);
    expect(countsTowardMangPause(records[4])).toBe(true);

    // Thời gian dừng tính cho Máng = 20 + 25 + 50 = 95 phút (01:35)
    const mangPaused = sumPauseRecordsMinutes(records);
    expect(mangPaused).toBe(95);
    expect(minutesToHHMM(mangPaused)).toBe('01:35');

    // Tổng thời gian lưu lịch sử đối chiếu = 30 + 20 + 15 + 25 + 50 = 140 phút (02:20)
    expect(sumAllLoggedPauseMinutes(records)).toBe(140);

    // Công thức Giờ chạy Máng = Giờ đóng cửa (17:00) - Giờ mở cửa (08:30) - Dừng vận hành Máng (95p) = 510 - 95 = 415p (06:55)
    const run = runMinutes('08:30', '17:00', mangPaused);
    expect(run).toBe(415);
    expect(minutesToHHMM(run)).toBe('06:55');
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

describe('Google Drive single-folder binding & Monday Admin export notification', () => {
  it('enforces Web App VHMT folder and Bao_Cao_van_hanh_Mang_Truot.xlsx file ID', () => {
    expect(DRIVE_FOLDER_ID).toBe('1ZJjwdvmZs9znHacv0z8zLz39KNy4MrZ3');
    expect(DRIVE_FILE_ID).toBe('1V37-wjbXReWENypka8IevraROqNXJk73');
    expect(DRIVE_FILE_NAME).toBe('Bao_Cao_van_hanh_Mang_Truot.xlsx');

    const payload = legacySheetsPayload('2026-11-06', emptyMatrix(), EMPTY_META, {}, false);
    expect(payload.driveFolderId).toBe('1ZJjwdvmZs9znHacv0z8zLz39KNy4MrZ3');
    expect(payload.driveFileId).toBe('1V37-wjbXReWENypka8IevraROqNXJk73');
    expect(payload.strictSingleFolderOnly).toBe(true);
  });

  it('detects Monday in Vietnam timezone for weekly Admin export reminder', () => {
    // 2026-11-02 is Monday, 2026-11-06 is Friday
    expect(isMondayVN(new Date('2026-11-02T09:00:00+07:00'))).toBe(true);
    expect(isMondayVN(new Date('2026-11-06T09:00:00+07:00'))).toBe(false);
    expect(mondayExportRemindKey('2026-11-02')).toBe('mt_monday_export_done:2026-11-02');
  });
});

describe('calculateCoasterDowntime & downtime interval engine (R2)', () => {
  it('07/11/2026 empty pause logs -> strictly 00:00 downtime and 10:30 net operating hours', () => {
    const emptyLogs: PauseRecord[] = [];
    const result = calculateCoasterDowntime(3, emptyLogs);
    expect(result).toEqual({
      coasterDowntimeMinutes: 0,
      lineOverlapMinutes: 0,
      generalDowntimeMinutes: 0,
      line1Minutes: 0,
      line2Minutes: 0,
      totalLoggedMinutes: 0,
    });
    expect(sumPauseRecordsMinutes(emptyLogs, 3)).toBe(0);
    expect(sumPauseRecordsMinutes(emptyLogs)).toBe(0);
    expect(minutesToHHMM(sumPauseRecordsMinutes(emptyLogs, 3))).toBe('00:00');

    // 08:30 to 19:00 with 0 downtime = 10h30m (630 min)
    const run = runMinutes('08:30', '19:00', sumPauseRecordsMinutes(emptyLogs, 3));
    expect(run).toBe(630);
    expect(minutesToHHMM(run)).toBe('10:30');
  });

  it('single line maintenance (Line 1 or Line 2) -> 0 min coaster pause and full operating hours', () => {
    // Mang 3 has lines line5 (Line 1) and line6 (Line 2)
    const logsLine5Only: PauseRecord[] = [
      { id: 'p1', category: 'maintenance', lineScope: 'line5', startTime: '09:00', endTime: '09:45', durationMinutes: 45, note: 'Bảo dưỡng Line 5' },
    ];
    const resLine5 = calculateCoasterDowntime(3, logsLine5Only);
    expect(resLine5.coasterDowntimeMinutes).toBe(0);
    expect(resLine5.lineOverlapMinutes).toBe(0);
    expect(resLine5.line1Minutes).toBe(45);
    expect(resLine5.line2Minutes).toBe(0);
    expect(resLine5.totalLoggedMinutes).toBe(45);
    expect(sumPauseRecordsMinutes(logsLine5Only, 3)).toBe(0);

    const logsLine6Only: PauseRecord[] = [
      { id: 'p2', category: 'technical', lineScope: 'line6', startTime: '10:00', endTime: '10:30', durationMinutes: 30, note: 'Sửa lỗi ray Line 6' },
    ];
    const resLine6 = calculateCoasterDowntime(3, logsLine6Only);
    expect(resLine6.coasterDowntimeMinutes).toBe(0);
    expect(resLine6.lineOverlapMinutes).toBe(0);
    expect(resLine6.line1Minutes).toBe(0);
    expect(resLine6.line2Minutes).toBe(30);
    expect(resLine6.totalLoggedMinutes).toBe(30);
    expect(sumPauseRecordsMinutes(logsLine6Only, 3)).toBe(0);

    // Run hours unaffected (08:30 to 18:30 = 600m)
    expect(runMinutes('08:30', '18:30', sumPauseRecordsMinutes(logsLine5Only, 3))).toBe(600);
  });

  it('Line 1 & Line 2 partial overlap -> exact intersection duration deducted', () => {
    // Line 1 (line1) stops 09:00 - 10:00 (60m), Line 2 (line2) stops 09:30 - 10:30 (60m)
    // Overlap: 09:30 - 10:00 (30m)
    const records: PauseRecord[] = [
      { id: 'm1', category: 'maintenance', lineScope: 'line1', startTime: '09:00', endTime: '10:00', durationMinutes: 60, note: '' },
      { id: 't1', category: 'technical', lineScope: 'line2', startTime: '09:30', endTime: '10:30', durationMinutes: 60, note: '' },
    ];
    const res = calculateCoasterDowntime(1, records);
    expect(res.line1Minutes).toBe(60);
    expect(res.line2Minutes).toBe(60);
    expect(res.lineOverlapMinutes).toBe(30);
    expect(res.generalDowntimeMinutes).toBe(0);
    expect(res.coasterDowntimeMinutes).toBe(30);
    expect(res.totalLoggedMinutes).toBe(120);
    expect(sumPauseRecordsMinutes(records, 1)).toBe(30);

    // 08:30 - 18:30 (600m) - 30m = 570m (09:30)
    expect(runMinutes('08:30', '18:30', sumPauseRecordsMinutes(records, 1))).toBe(570);
  });

  it('Line 1 & Line 2 exact overlap (both) -> exact duration deducted', () => {
    const records: PauseRecord[] = [
      { id: 'b1', category: 'technical', lineScope: 'both', startTime: '10:00', endTime: '10:40', durationMinutes: 40, note: '' },
    ];
    const res = calculateCoasterDowntime(1, records);
    expect(res.line1Minutes).toBe(40);
    expect(res.line2Minutes).toBe(40);
    expect(res.lineOverlapMinutes).toBe(40);
    expect(res.coasterDowntimeMinutes).toBe(40);
    expect(res.totalLoggedMinutes).toBe(40);
    expect(sumPauseRecordsMinutes(records, 1)).toBe(40);
  });

  it('weather and customer general stops -> full duration deducted directly', () => {
    const records: PauseRecord[] = [
      { id: 'r1', category: 'rain', startTime: '14:00', endTime: '15:15', durationMinutes: 75, note: 'Mưa lớn' },
      { id: 'c1', category: 'customer', startTime: '16:00', endTime: '16:20', durationMinutes: 20, note: 'Khách ngất' },
    ];
    const res = calculateCoasterDowntime(2, records);
    expect(res.generalDowntimeMinutes).toBe(95);
    expect(res.coasterDowntimeMinutes).toBe(95);
    expect(res.lineOverlapMinutes).toBe(0);
    expect(res.totalLoggedMinutes).toBe(95);
    expect(sumPauseRecordsMinutes(records, 2)).toBe(95);
  });

  it('overlapping weather and maintenance -> guaranteed no double-counting', () => {
    // Rain 14:00 - 15:00 (60m)
    // Maintenance on Line 1 14:15 - 14:45 (30m)
    const records1: PauseRecord[] = [
      { id: 'r', category: 'rain', startTime: '14:00', endTime: '15:00', durationMinutes: 60, note: '' },
      { id: 'm', category: 'maintenance', lineScope: 'line5', startTime: '14:15', endTime: '14:45', durationMinutes: 30, note: '' },
    ];
    const res1 = calculateCoasterDowntime(3, records1);
    expect(res1.generalDowntimeMinutes).toBe(60);
    expect(res1.line1Minutes).toBe(30);
    expect(res1.line2Minutes).toBe(0);
    expect(res1.coasterDowntimeMinutes).toBe(60); // strictly 60, not 90
    expect(res1.totalLoggedMinutes).toBe(90);

    // Rain 14:00 - 15:00 (60m) AND both lines stopped 14:15 - 14:45 (30m)
    const records2: PauseRecord[] = [
      { id: 'r2', category: 'rain', startTime: '14:00', endTime: '15:00', durationMinutes: 60, note: '' },
      { id: 'b2', category: 'technical', lineScope: 'both', startTime: '14:15', endTime: '14:45', durationMinutes: 30, note: '' },
    ];
    const res2 = calculateCoasterDowntime(3, records2);
    expect(res2.generalDowntimeMinutes).toBe(60);
    expect(res2.lineOverlapMinutes).toBe(30);
    expect(res2.coasterDowntimeMinutes).toBe(60); // union is 60m, no double counting
  });

  it('multiple overlapping general weather tickets -> union duration without double-counting', () => {
    // Rain 13:00 - 14:00 (60m) and Lightning 13:30 - 14:30 (60m)
    // Combined span is 13:00 - 14:30 (90m), NOT 120m!
    const records: PauseRecord[] = [
      { id: 'r', category: 'rain', startTime: '13:00', endTime: '14:00', durationMinutes: 60, note: '' },
      { id: 'l', category: 'lightning', startTime: '13:30', endTime: '14:30', durationMinutes: 60, note: '' },
    ];
    const res = calculateCoasterDowntime(1, records);
    expect(res.generalDowntimeMinutes).toBe(90);
    expect(res.coasterDowntimeMinutes).toBe(90);
    expect(res.totalLoggedMinutes).toBe(120);
    expect(sumPauseRecordsMinutes(records, 1)).toBe(90);
  });

  it('supports overloaded call signatures calculateCoasterDowntime(mang, records) and calculateCoasterDowntime(records, mang)', () => {
    const records: PauseRecord[] = [
      { id: 'x', category: 'fog', startTime: '08:00', endTime: '08:30', durationMinutes: 30, note: '' },
    ];
    const res1 = calculateCoasterDowntime(2, records);
    const res2 = calculateCoasterDowntime(records, 2);
    const res3 = calculateCoasterDowntime(records);
    expect(res1.coasterDowntimeMinutes).toBe(30);
    expect(res2.coasterDowntimeMinutes).toBe(30);
    expect(res3.coasterDowntimeMinutes).toBe(30);
  });

  it('handles multiple Mang line mappings correctly (Mang 1: line1/line2, Mang 2: line3/line4, Mang 3: line5/line6)', () => {
    const recM1: PauseRecord[] = [
      { id: '1', category: 'maintenance', lineScope: 'line1', startTime: '09:00', endTime: '10:00', durationMinutes: 60, note: '' },
      { id: '2', category: 'technical', lineScope: 'line2', startTime: '09:30', endTime: '10:30', durationMinutes: 60, note: '' },
    ];
    expect(calculateCoasterDowntime(1, recM1).lineOverlapMinutes).toBe(30);

    const recM2: PauseRecord[] = [
      { id: '3', category: 'maintenance', lineScope: 'line3', startTime: '09:00', endTime: '10:00', durationMinutes: 60, note: '' },
      { id: '4', category: 'technical', lineScope: 'line4', startTime: '09:30', endTime: '10:30', durationMinutes: 60, note: '' },
    ];
    expect(calculateCoasterDowntime(2, recM2).lineOverlapMinutes).toBe(30);

    const recM3: PauseRecord[] = [
      { id: '5', category: 'maintenance', lineScope: 'line5', startTime: '09:00', endTime: '10:00', durationMinutes: 60, note: '' },
      { id: '6', category: 'technical', lineScope: 'line6', startTime: '09:30', endTime: '10:30', durationMinutes: 60, note: '' },
    ];
    expect(calculateCoasterDowntime(3, recM3).lineOverlapMinutes).toBe(30);
  });
});

describe('07/11/2026 bug fix verification (UI & Report consistency)', () => {
  it('reportMetrics computes 10:30 operating hours when pauseLogs is empty even if legacy pausedMinutes is 50', () => {
    const m = emptyMatrix();
    // Simulating Firestore data for 07/11/2026 on Mang 3: open 08:30, close 19:00, pausedMinutes: 50, pauseLogs: []
    const schedules = {
      3: { openTime: '08:30', closeTime: '19:00', pausedMinutes: 50, pauseLogs: [] },
    };
    const metrics = reportMetrics(m, EMPTY_META, schedules);
    const m3 = metrics.mangs.find((x) => x.mang === 3)!;
    // With fix: actualPaused is 0 (from pauseLogs: []), runMinutes is 630 (10:30)
    expect(m3.runMinutes).toBe(630);
    expect(minutesToHHMM(m3.runMinutes)).toBe('10:30');
  });

  it('legacySheetsPayload exports 0 pausedMinutes when pauseLogs is empty even if legacy pausedMinutes is 50', () => {
    const m = emptyMatrix();
    const schedules = {
      3: { openTime: '08:30', closeTime: '19:00', pausedMinutes: 50, pauseLogs: [] },
    };
    const payload = legacySheetsPayload('2026-11-07', m, EMPTY_META, schedules, false);
    expect(payload.metrics.mang3Summary.pausedMinutes).toBe(0);
    expect(payload.metrics.mang3Summary.operatingHours).toBe('10:30');
    expect(payload.report.schedules.mang3.pausedMinutes).toBe(0);
  });
});
