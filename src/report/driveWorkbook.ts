import type ExcelJS from 'exceljs';
import type { PauseRecord } from '../entries/model';
import type { DayMeta, Matrix, Schedules } from './compute';

/**
 * RÀNG BUỘC LƯU TRỮ DUY NHẤT TRÊN GOOGLE DRIVE:
 * Chỉ lưu trữ và đồng bộ vào đúng file Bao_Cao_van_hanh_Mang_Truot.xlsx
 * nằm trong Folder "Web App VHMT" (1ZJjwdvmZs9znHacv0z8zLz39KNy4MrZ3).
 * Tuyệt đối không tạo hay lưu ở bất kỳ folder nào khác.
 */
export const DRIVE_FOLDER_ID = '1ZJjwdvmZs9znHacv0z8zLz39KNy4MrZ3';
export const DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/1ZJjwdvmZs9znHacv0z8zLz39KNy4MrZ3';
export const DRIVE_FILE_ID = '1V37-wjbXReWENypka8IevraROqNXJk73';
export const DRIVE_FILE_NAME = 'Bao_Cao_van_hanh_Mang_Truot.xlsx';

export interface ScheduleWithLogs {
  openTime: string;
  closeTime: string;
  pausedMinutes: number;
  pauseLogs?: PauseRecord[];
}

export type SchedulesWithLogs = Partial<Record<1 | 2 | 3, ScheduleWithLogs>>;

export interface DaySyncPayload {
  date: string;
  matrix: Matrix;
  totalPassengers: number;
  meta: DayMeta;
  schedules: Schedules | SchedulesWithLogs;
  closed: boolean;
}

const SLOTS_EXCEL = [
  { id: '0830', label: '08:30 - 10:00' },
  { id: '1000', label: '10:00 - 11:00' },
  { id: '1100', label: '11:00 - 12:00 (Cao điểm)' },
  { id: '1200', label: '12:00 - 13:00 (Cao điểm)' },
  { id: '1300', label: '13:00 - 14:00 (Cao điểm)' },
  { id: '1400', label: '14:00 - 15:00 (Cao điểm)' },
  { id: '1500', label: '15:00 - 16:00' },
  { id: '1600', label: '16:00 - 17:00' },
  { id: '1700', label: '17:00 - 18:00' },
  { id: '1800', label: '18:00 - 19:00' },
] as const;

const COL_LETTERS = [
  '', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN',
];

function parseExcelDate(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'object' && val !== null && 'result' in val) {
    return parseExcelDate((val as { result: unknown }).result);
  }
  if (typeof val === 'string') {
    const m = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return null;
}

function hhmmToExcelDate(hhmm: string | undefined): Date | null {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(1899, 11, 30, h ?? 0, m ?? 0, 0));
}

function minToExcelDate(min: number): Date | null {
  const v = Math.max(0, Math.round(Number(min) || 0));
  if (v <= 0) return null;
  const h = Math.floor(v / 60);
  const m = v % 60;
  return new Date(Date.UTC(1899, 11, 30, h, m, 0));
}

function copyRowStyle(srcRow: ExcelJS.Row, dstRow: ExcelJS.Row, maxCol: number) {
  dstRow.height = srcRow.height;
  for (let c = 1; c <= maxCol; c++) {
    const sc = srcRow.getCell(c);
    const dc = dstRow.getCell(c);
    if (sc.style) {
      dc.style = JSON.parse(JSON.stringify(sc.style)) as ExcelJS.Style;
    }
  }
}

function isCoasterOperatingInSlot(
  sch: ScheduleWithLogs | undefined,
  slotId: string,
): boolean {
  if (!sch || !sch.openTime || !sch.closeTime) return false;
  const slotDef = SLOTS_EXCEL.find((s) => s.id === slotId);
  if (!slotDef) return false;
  const m = slotDef.label.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
  if (!m) return false;
  const slotStart = m[1]!;
  const slotEnd = m[2]!;

  const toMin = (t: string) => {
    const [h, min] = t.split(':').map(Number);
    return (h ?? 0) * 60 + (min ?? 0);
  };

  const oMin = toMin(sch.openTime);
  const cMin = toMin(sch.closeTime);
  const sStartMin = toMin(slotStart);
  const sEndMin = toMin(slotEnd);

  if (cMin <= oMin) return false;
  return oMin < sEndMin && cMin > sStartMin;
}

/**
 * Cập nhật hoặc chèn dữ liệu của một ngày vào đúng 3 Sheet chuẩn của file Bao_Cao_van_hanh_Mang_Truot.xlsx:
 * 1. MA TRẬN GIỜ
 * 2. Báo Cáo Tổng Hợp
 * 3. Thời gian vận hành
 */
export function upsertDayIntoExcelWorkbook(wb: ExcelJS.Workbook, payload: DaySyncPayload): void {
  const { date, matrix, totalPassengers, meta, schedules } = payload;
  const dateObj = new Date(`${date}T00:00:00.000Z`);

  // 1. Sheet: MA TRẬN GIỜ
  const wsMatrix = wb.getWorksheet('MA TRẬN GIỜ');
  if (wsMatrix) {
    let matrixStartRow = -1;
    let insertStartRow = -1;
    for (let r = 4; r <= wsMatrix.rowCount; r += 11) {
      const d = parseExcelDate(wsMatrix.getRow(r).getCell(1).value);
      if (d === date) {
        matrixStartRow = r;
        break;
      }
      if (d !== null && d > date && insertStartRow === -1) {
        insertStartRow = r;
      }
    }
    if (matrixStartRow === -1) {
      if (insertStartRow !== -1) {
        wsMatrix.spliceRows(insertStartRow, 0, ...new Array(11).fill([]));
        matrixStartRow = insertStartRow;
      } else {
        matrixStartRow = wsMatrix.rowCount + 1;
      }
      const prevStart = matrixStartRow > 14 ? matrixStartRow - 11 : 4;
      for (let i = 0; i < 11; i++) {
        const newRow = wsMatrix.getRow(matrixStartRow + i);
        if (prevStart >= 4) {
          copyRowStyle(wsMatrix.getRow(prevStart + i), newRow, 20);
        }
      }
    }

    const lineCols = [
      { key: 'line1' as const, mang: 1 as const, s: 3, d: 4, p: 5 },
      { key: 'line2' as const, mang: 1 as const, s: 6, d: 7, p: 8 },
      { key: 'line3' as const, mang: 2 as const, s: 9, d: 10, p: 11 },
      { key: 'line4' as const, mang: 2 as const, s: 12, d: 13, p: 14 },
      { key: 'line5' as const, mang: 3 as const, s: 15, d: 16, p: 17 },
      { key: 'line6' as const, mang: 3 as const, s: 18, d: 19, p: 20 },
    ];

    for (let i = 0; i < SLOTS_EXCEL.length; i++) {
      const r = matrixStartRow + i;
      const row = wsMatrix.getRow(r);
      const slot = SLOTS_EXCEL[i]!;
      row.getCell(1).value = dateObj;
      row.getCell(1).numFmt = 'dd/mm/yyyy';
      row.getCell(2).value = slot.label;

      const slotRow = matrix[slot.id];
      for (const lc of lineCols) {
        const cellData = slotRow?.[lc.key] ?? { single: 0, double: 0, rides: 0, passengers: 0 };
        const sColLet = COL_LETTERS[lc.s]!;
        const dColLet = COL_LETTERS[lc.d]!;
        const sch = (schedules as SchedulesWithLogs)[lc.mang];
        const isOperating = isCoasterOperatingInSlot(sch, slot.id);

        if (cellData.rides > 0) {
          row.getCell(lc.s).value = cellData.single;
          row.getCell(lc.d).value = cellData.double;
          row.getCell(lc.p).value = {
            formula: `IF(COUNT(${sColLet}${r}:${dColLet}${r})>0, ${sColLet}${r}+${dColLet}${r}*2, "")`,
            result: cellData.passengers,
          };
        } else if (isOperating) {
          row.getCell(lc.s).value = 0;
          row.getCell(lc.d).value = 0;
          row.getCell(lc.p).value = {
            formula: `IF(COUNT(${sColLet}${r}:${dColLet}${r})>0, ${sColLet}${r}+${dColLet}${r}*2, "")`,
            result: 0,
          };
        } else {
          row.getCell(lc.s).value = null;
          row.getCell(lc.d).value = null;
          row.getCell(lc.p).value = {
            formula: `IF(COUNT(${sColLet}${r}:${dColLet}${r})>0, ${sColLet}${r}+${dColLet}${r}*2, "")`,
            result: '',
          };
        }
      }
    }

    const sumR = matrixStartRow + 10;
    const sumRow = wsMatrix.getRow(sumR);
    sumRow.getCell(1).value = dateObj;
    sumRow.getCell(1).numFmt = 'dd/mm/yyyy';
    sumRow.getCell(2).value = 'Tổng';
    for (let c = 3; c <= 20; c++) {
      const colLet = COL_LETTERS[c]!;
      let colSum = 0;
      let hasAny = false;
      for (let rr = matrixStartRow; rr < sumR; rr++) {
        const v = wsMatrix.getRow(rr).getCell(c).value;
        const num =
          typeof v === 'number'
            ? v
            : v && typeof v === 'object' && 'result' in v && typeof v.result === 'number'
              ? v.result
              : null;
        if (num !== null) {
          colSum += num;
          hasAny = true;
        }
      }
      sumRow.getCell(c).value = {
        formula: `IF(COUNT(${colLet}${matrixStartRow}:${colLet}${sumR - 1})>0, SUM(${colLet}${matrixStartRow}:${colLet}${sumR - 1}), "")`,
        result: hasAny ? colSum : '',
      };
    }
  }

  // 2. Sheet: Báo Cáo Tổng Hợp
  const wsSummary = wb.getWorksheet('Báo Cáo Tổng Hợp');
  if (wsSummary) {
    let summaryRowIdx = -1;
    let totalRowIdx = wsSummary.rowCount;
    let insertIdx = -1;
    for (let r = 3; r <= wsSummary.rowCount; r++) {
      const v1 = wsSummary.getRow(r).getCell(1).value;
      if (String(v1 ?? '').trim() === 'Tổng cộng') {
        totalRowIdx = r;
        break;
      }
      const d = parseExcelDate(v1);
      if (d === date) {
        summaryRowIdx = r;
        break;
      }
      if (d !== null && d > date && insertIdx === -1) {
        insertIdx = r;
      }
    }

    if (summaryRowIdx === -1) {
      const targetIdx = insertIdx !== -1 ? insertIdx : totalRowIdx;
      wsSummary.spliceRows(targetIdx, 0, []);
      summaryRowIdx = targetIdx;
      totalRowIdx++;
      if (summaryRowIdx > 3) {
        copyRowStyle(wsSummary.getRow(summaryRowIdx - 1), wsSummary.getRow(summaryRowIdx), 11);
      }
    }

    const sRow = wsSummary.getRow(summaryRowIdx);
    sRow.getCell(1).value = dateObj;
    sRow.getCell(1).numFmt = 'dd/mm/yyyy';
    sRow.getCell(2).value = totalPassengers;
    sRow.getCell(3).value = meta.cableCarVisitors > 0 ? meta.cableCarVisitors : null;
    sRow.getCell(4).value = {
      formula: `IF(AND(ISNUMBER(B${summaryRowIdx}), ISNUMBER(C${summaryRowIdx}), C${summaryRowIdx}>0), B${summaryRowIdx}/C${summaryRowIdx}, "")`,
      result: meta.cableCarVisitors > 0 ? totalPassengers / meta.cableCarVisitors : '',
    };
    sRow.getCell(5).value = meta.paidGateVisitors > 0 ? meta.paidGateVisitors : null;
    if (date >= '2026-02-12') {
      const fResult =
        meta.paidGateVisitors > 0
          ? Math.max(0, totalPassengers - meta.paidGateVisitors)
          : meta.freeGateVisitors > 0
            ? meta.freeGateVisitors
            : '';
      const fallbackExpr = meta.freeGateVisitors > 0 && meta.paidGateVisitors <= 0 ? String(meta.freeGateVisitors) : '""';
      sRow.getCell(6).value = {
        formula: `IF(AND(ISNUMBER(B${summaryRowIdx}), ISNUMBER(E${summaryRowIdx})), MAX(0, B${summaryRowIdx}-E${summaryRowIdx}), ${fallbackExpr})`,
        result: fResult,
      };
    } else {
      sRow.getCell(6).value = meta.freeGateVisitors > 0 ? meta.freeGateVisitors : null;
    }
    sRow.getCell(7).value = meta.nightComboVisitors > 0 ? meta.nightComboVisitors : null;

    // Doanh thu máng 1 (Cột 8), máng 2 (Cột 9), máng 3 (Cột 10) & Tổng doanh thu (Cột 11)
    let p1 = 0;
    let p2 = 0;
    let p3 = 0;
    for (const slot of SLOTS_EXCEL) {
      const sr = matrix[slot.id];
      if (sr) {
        p1 += (sr.line1?.passengers ?? 0) + (sr.line2?.passengers ?? 0);
        p2 += (sr.line3?.passengers ?? 0) + (sr.line4?.passengers ?? 0);
        p3 += (sr.line5?.passengers ?? 0) + (sr.line6?.passengers ?? 0);
      }
    }
    const pSum = p1 + p2 + p3 > 0 ? p1 + p2 + p3 : totalPassengers;

    if (meta.counterRevenue > 0) {
      if (pSum > 0) {
        const rev1 = Math.round((meta.counterRevenue * p1) / pSum);
        const rev2 = Math.round((meta.counterRevenue * p2) / pSum);
        const rev3 = Math.max(0, meta.counterRevenue - rev1 - rev2);
        sRow.getCell(8).value = p1 > 0 ? rev1 : 0;
        sRow.getCell(9).value = p2 > 0 ? rev2 : 0;
        sRow.getCell(10).value = p3 > 0 ? rev3 : 0;
      } else {
        sRow.getCell(8).value = 0;
        sRow.getCell(9).value = 0;
        sRow.getCell(10).value = 0;
      }
      sRow.getCell(11).value = meta.counterRevenue;
    } else {
      sRow.getCell(8).value = null;
      sRow.getCell(9).value = null;
      sRow.getCell(10).value = null;
      sRow.getCell(11).value = null;
    }

    const lastDataRow = totalRowIdx - 1;
    const totRow = wsSummary.getRow(totalRowIdx);
    totRow.getCell(1).value = 'Tổng cộng';

    const calcSum = (col: number) => {
      let sum = 0;
      for (let r = 3; r <= lastDataRow; r++) {
        const v = wsSummary.getRow(r).getCell(col).value;
        const val =
          typeof v === 'number'
            ? v
            : v && typeof v === 'object' && 'result' in v && typeof v.result === 'number'
              ? v.result
              : 0;
        sum += val;
      }
      return sum;
    };

    const sumB = calcSum(2);
    const sumC = calcSum(3);

    totRow.getCell(2).value = { formula: `SUM(B3:B${lastDataRow})`, result: sumB };
    totRow.getCell(3).value = { formula: `SUM(C3:C${lastDataRow})`, result: sumC };
    totRow.getCell(4).value = {
      formula: `IF(C${totalRowIdx}>0, B${totalRowIdx}/C${totalRowIdx}, 0)`,
      result: sumC > 0 ? sumB / sumC : 0,
    };
    for (let c = 5; c <= 11; c++) {
      const cl = COL_LETTERS[c]!;
      totRow.getCell(c).value = { formula: `SUM(${cl}3:${cl}${lastDataRow})`, result: calcSum(c) };
    }
  }

  // 3. Sheet: Thời gian vận hành
  const wsSched = wb.getWorksheet('Thời gian vận hành');
  if (wsSched) {
    let schedRowIdx = -1;
    let lastDateRow = 4;
    for (let r = 5; r <= wsSched.rowCount; r++) {
      const d = parseExcelDate(wsSched.getRow(r).getCell(1).value);
      if (d === date) {
        schedRowIdx = r;
        break;
      }
      if (d !== null) {
        lastDateRow = r;
      }
    }
    if (schedRowIdx === -1) {
      schedRowIdx = lastDateRow + 1;
      if (schedRowIdx > 5) {
        copyRowStyle(wsSched.getRow(schedRowIdx - 1), wsSched.getRow(schedRowIdx), 40);
      }
    }

    const scRow = wsSched.getRow(schedRowIdx);
    scRow.getCell(1).value = dateObj;
    scRow.getCell(1).numFmt = 'dd/mm/yyyy';

    const mangOffsets = [
      { mang: 1 as const, base: 0, line1: 'line1', line2: 'line2' },
      { mang: 2 as const, base: 13, line1: 'line3', line2: 'line4' },
      { mang: 3 as const, base: 26, line1: 'line5', line2: 'line6' },
    ];

    for (const mo of mangOffsets) {
      const b = mo.base;
      const sch = (schedules as SchedulesWithLogs)[mo.mang] ?? { openTime: '', closeTime: '', pausedMinutes: 0, pauseLogs: [] };
      scRow.getCell(b + 2).value = hhmmToExcelDate(sch.openTime);
      scRow.getCell(b + 3).value = hhmmToExcelDate(sch.closeTime);

      const logs = sch.pauseLogs ?? [];
      const sumCat = (cat: string, scope?: string) =>
        logs
          .filter(
            (l) =>
              l.category === cat &&
              (scope === undefined ? true : scope === 'both' ? !l.lineScope || l.lineScope === 'both' : l.lineScope === scope),
          )
          .reduce((acc, l) => acc + (Number(l.durationMinutes) || 0), 0);

      scRow.getCell(b + 4).value = minToExcelDate(sumCat('technical', mo.line1));
      scRow.getCell(b + 5).value = minToExcelDate(sumCat('technical', mo.line2));
      scRow.getCell(b + 6).value = minToExcelDate(sumCat('technical', 'both'));
      scRow.getCell(b + 7).value = minToExcelDate(sumCat('maintenance', mo.line1));
      scRow.getCell(b + 8).value = minToExcelDate(sumCat('maintenance', mo.line2));
      scRow.getCell(b + 9).value = minToExcelDate(sumCat('maintenance', 'both'));
      scRow.getCell(b + 10).value = minToExcelDate(sumCat('customer', undefined));
      scRow.getCell(b + 11).value = minToExcelDate(sumCat('lightning', undefined));
      scRow.getCell(b + 12).value = minToExcelDate(sumCat('fog', undefined));
      scRow.getCell(b + 13).value = minToExcelDate(sumCat('rain', undefined));

      const cOpen = COL_LETTERS[b + 2]!;
      const cClose = COL_LETTERS[b + 3]!;
      const cTechBoth = COL_LETTERS[b + 6]!;
      const cMaintBoth = COL_LETTERS[b + 9]!;
      const cCust = COL_LETTERS[b + 10]!;
      const cLight = COL_LETTERS[b + 11]!;
      const cFog = COL_LETTERS[b + 12]!;
      const cRain = COL_LETTERS[b + 13]!;
      const r = schedRowIdx;

      scRow.getCell(b + 14).value = {
        formula: `IF(AND(ISNUMBER(${cOpen}${r}), ISNUMBER(${cClose}${r}), ${cClose}${r}>${cOpen}${r}), MAX(0, ${cClose}${r}-${cOpen}${r}-(${cTechBoth}${r}+${cMaintBoth}${r}+${cCust}${r}+${cLight}${r}+${cFog}${r}+${cRain}${r})), "")`,
      };
    }
  }
}
