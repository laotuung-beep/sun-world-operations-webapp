import { MANGS, TIME_SLOTS, type LineId, type MangId, type SlotId } from '../config';
import { ZERO_TOTALS, addTotals, countTotals, runMinutes, type Entry, type EntryStatus, type PauseRecord, type Totals } from '../entries/model';
import { DRIVE_FILE_ID, DRIVE_FILE_NAME, DRIVE_FOLDER_ID } from './driveWorkbook';

export const ALL_LINES: readonly LineId[] = ['line1', 'line2', 'line3', 'line4', 'line5', 'line6'];

export type LineTotals = Record<LineId, Totals>;
export type Matrix = Record<SlotId, LineTotals>;

/** Thông số nhập tay của ngày (đối soát cáp treo & cổng, doanh thu). */
export interface DayMeta {
  cableCarVisitors: number;
  paidGateVisitors: number;
  freeGateVisitors: number;
  nightComboVisitors: number;
  counterRevenue: number;
}

export const EMPTY_META: DayMeta = {
  cableCarVisitors: 0,
  paidGateVisitors: 0,
  freeGateVisitors: 0,
  nightComboVisitors: 0,
  counterRevenue: 0,
};

export const META_LABEL: Record<keyof DayMeta, string> = {
  cableCarVisitors: 'Khách lên cáp',
  paidGateVisitors: 'Khách tính phí',
  freeGateVisitors: 'Khách miễn phí',
  nightComboVisitors: 'Khách combo đêm',
  counterRevenue: 'Doanh thu vé quầy (đ)',
};

/** Ngày bắt đầu áp dụng công thức tự động Khách miễn phí = Khách chơi máng - Khách tính phí (12/02/2026). */
export const FREE_GATE_FORMULA_START_DATE = '2026-02-12';

/**
 * Tự động tính Khách miễn phí = Math.max(0, Khách chơi máng - Khách tính phí).
 */
export function computeFreeGate(coasterPassengers: number, paidGateVisitors: number): number {
  return Math.max(0, Math.round((coasterPassengers || 0) - (paidGateVisitors || 0)));
}

/**
 * Xác định số liệu Khách miễn phí hiển thị & đồng bộ:
 * - Trước ngày 12/02/2026: giữ nguyên số liệu gốc trên Google Drive / Firestore.
 * - Bắt đầu từ ngày 12/02/2026 trở đi: áp dụng công thức Khách miễn phí = Khách chơi máng - Khách tính phí
 *   khi đã có số liệu Khách tính phí (> 0); nếu Khách tính phí đang thiếu (= 0) thì giữ số liệu gốc trên Drive.
 */
export function resolveFreeGate(
  coasterPassengers: number,
  paidGateVisitors: number,
  storedFreeGateVisitors: number,
  date?: string,
): number {
  if (date && date < FREE_GATE_FORMULA_START_DATE) {
    return Math.max(0, Math.round(storedFreeGateVisitors || 0));
  }
  if ((paidGateVisitors || 0) > 0 && (coasterPassengers || 0) > 0) {
    return computeFreeGate(coasterPassengers, paidGateVisitors);
  }
  return Math.max(0, Math.round(storedFreeGateVisitors || 0));
}

export interface MangSchedule {
  openTime: string;
  closeTime: string;
  pausedMinutes: number;
  pauseLogs?: PauseRecord[];
}

export type Schedules = Partial<Record<MangId, MangSchedule>>;

function emptyRow(): LineTotals {
  return Object.fromEntries(ALL_LINES.map((l) => [l, ZERO_TOTALS])) as LineTotals;
}

export function emptyMatrix(): Matrix {
  return Object.fromEntries(TIME_SLOTS.map((s) => [s.id, emptyRow()])) as Matrix;
}

/** Cộng dồn các phiếu (lọc theo trạng thái) vào ma trận khung giờ × line. */
export function buildMatrix(entries: Entry[], include: (s: EntryStatus) => boolean): Matrix {
  const m = emptyMatrix();
  for (const e of entries) {
    if (!include(e.status) || !m[e.slotId]) continue;
    for (const line of Object.keys(e.lines) as LineId[]) {
      if (!ALL_LINES.includes(line)) continue;
      m[e.slotId][line] = addTotals(m[e.slotId][line], countTotals(e.lines[line]));
    }
  }
  return m;
}

export function sumLines(row: LineTotals, lines: readonly LineId[] = ALL_LINES): Totals {
  return lines.reduce<Totals>((acc, l) => addTotals(acc, row[l]), ZERO_TOTALS);
}

export function lineTotal(m: Matrix, line: LineId): Totals {
  return TIME_SLOTS.reduce<Totals>((acc, s) => addTotals(acc, m[s.id][line]), ZERO_TOTALS);
}

export function matrixTotal(m: Matrix, lines: readonly LineId[] = ALL_LINES): Totals {
  return TIME_SLOTS.reduce<Totals>((acc, s) => addTotals(acc, sumLines(m[s.id], lines)), ZERO_TOTALS);
}

export interface MangMetrics {
  mang: MangId;
  totals: Totals;
  schedule: MangSchedule | undefined;
  runMinutes: number | null;
}

export interface ReportMetrics {
  mangs: MangMetrics[];
  total: Totals;
  /** Khách chơi máng / khách lên cáp × 100. null khi chưa nhập khách lên cáp. */
  conversionRate: number | null;
  /** Trung bình lượt xe mỗi khung giờ cao điểm (11h–15h), cả 6 line. */
  peakAvgRides: number;
}

export function reportMetrics(m: Matrix, meta: DayMeta, schedules: Schedules): ReportMetrics {
  const mangs = MANGS.map((x) => {
    const s = schedules[x.id];
    return {
      mang: x.id,
      totals: matrixTotal(m, x.lines),
      schedule: s,
      runMinutes: s ? runMinutes(s.openTime, s.closeTime, s.pausedMinutes) : null,
    };
  });
  const total = matrixTotal(m);
  const peak = TIME_SLOTS.filter((s) => s.peak);
  const peakRides = peak.reduce((acc, s) => acc + sumLines(m[s.id]).rides, 0);
  return {
    mangs,
    total,
    conversionRate: meta.cableCarVisitors > 0 ? (total.passengers / meta.cableCarVisitors) * 100 : null,
    peakAvgRides: peak.length ? Math.round(peakRides / peak.length) : 0,
  };
}

function hhmm(minutes: number | null): string {
  const v = minutes ?? 0;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
}

/**
 * Dữ liệu gửi Google Drive / Google Sheets, GIỮ ĐÚNG khuôn của app cũ (action "syncDailyReport6Line")
 * kèm ràng buộc lưu trữ duy nhất tại Folder Web App VHMT (1ZJjwdvmZs9znHacv0z8zLz39KNy4MrZ3).
 */
export function legacySheetsPayload(date: string, m: Matrix, meta: DayMeta, schedules: Schedules, closed: boolean) {
  const metrics = reportMetrics(m, meta, schedules);
  const sched = (id: MangId) => {
    const s = schedules[id];
    return {
      openTime: s?.openTime || '00:00',
      closeTime: s?.closeTime || '00:00',
      pausedMinutes: s?.pausedMinutes ?? 0,
      pauseLogs: s?.pauseLogs ?? [],
    };
  };
  const cell = (slot: SlotId, line: LineId) => ({ singleCarts: m[slot][line].single, doubleCarts: m[slot][line].double });
  const summary = (x: MangMetrics) => {
    const def = MANGS.find((y) => y.id === x.mang)!;
    return {
      mangId: x.mang,
      mangName: `${def.name} (${def.lines.map((l) => l.replace('line', 'Line ')).join(', ')})`,
      totalCarts: x.totals.rides,
      totalPassengers: x.totals.passengers,
      operatingHours: hhmm(x.runMinutes),
      ...sched(x.mang),
    };
  };
  return {
    action: 'syncDailyReport6Line',
    date,
    driveFolderId: DRIVE_FOLDER_ID,
    driveFileId: DRIVE_FILE_ID,
    driveFileName: DRIVE_FILE_NAME,
    strictSingleFolderOnly: true,
    metrics: {
      mang1Summary: summary(metrics.mangs[0]!),
      mang2Summary: summary(metrics.mangs[1]!),
      mang3Summary: summary(metrics.mangs[2]!),
      totalAlpineVisitors: metrics.total.passengers,
      totalCartsAllMangs: metrics.total.rides,
      conversionRate: metrics.conversionRate ?? 0,
      peakHourAvgRides: metrics.peakAvgRides,
    },
    report: {
      date,
      ...meta,
      ticketPriceDefault: 70000,
      schedules: { mang1: sched(1), mang2: sched(2), mang3: sched(3) },
      hourSlots: TIME_SLOTS.map((s) => ({
        timeSlot: `${s.start} - ${s.end}`,
        isPeakHour: s.peak,
        mang1: { openTime: s.start, closeTime: s.end, line1: cell(s.id, 'line1'), line2: cell(s.id, 'line2') },
        mang2: { openTime: s.start, closeTime: s.end, line3: cell(s.id, 'line3'), line4: cell(s.id, 'line4') },
        mang3: { openTime: s.start, closeTime: s.end, line5: cell(s.id, 'line5'), line6: cell(s.id, 'line6') },
      })),
      status: closed ? 'closed' : 'open',
    },
    syncedAt: new Date().toISOString(),
  };
}
