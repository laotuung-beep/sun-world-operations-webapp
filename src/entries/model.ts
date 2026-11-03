import { MAX_CARTS, TIME_SLOTS, mangById, type LineId, type MangId, type SlotId, type TimeSlot } from '../config';
import { hhmmToMinutes } from '../time';

export type EntryStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LineCount {
  single: number;
  double: number;
}

export type EntryLines = Partial<Record<LineId, LineCount>>;

/** Một phiếu báo số xe của một máng (2 line) trong một khung giờ. */
export interface Entry {
  id: string;
  date: string;
  slotId: SlotId;
  mang: MangId;
  lines: EntryLines;
  status: EntryStatus;
  createdBy: string;
  createdByName: string;
  createdByEmail?: string;
  createdAt: Date | null;
  clientCreatedAt: number;
  rejectReason?: string;
  reviewedByName?: string;
  reviewedAt?: Date | null;
  /** Đã lưu trên máy nhưng chưa lên tới Cloud (mất mạng). */
  pendingSync: boolean;
}

export interface Totals {
  single: number;
  double: number;
  rides: number;
  passengers: number;
}

export const ZERO_TOTALS: Totals = { single: 0, double: 0, rides: 0, passengers: 0 };

export const STATUS_LABEL: Record<EntryStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Bị trả lại',
  cancelled: 'Đã huỷ',
};

/** Phiếu còn được tính vào số liệu (chưa bị huỷ / trả lại). */
export function isActive(status: EntryStatus): boolean {
  return status === 'pending' || status === 'approved';
}

/** Xe đơn chở 1 khách, xe đôi chở 2 khách. */
export function countTotals(c: LineCount | undefined): Totals {
  const single = c?.single ?? 0;
  const double = c?.double ?? 0;
  return { single, double, rides: single + double, passengers: single + double * 2 };
}

export function addTotals(a: Totals, b: Totals): Totals {
  return {
    single: a.single + b.single,
    double: a.double + b.double,
    rides: a.rides + b.rides,
    passengers: a.passengers + b.passengers,
  };
}

export function linesTotals(lines: EntryLines): Totals {
  return Object.values(lines).reduce<Totals>((acc, c) => addTotals(acc, countTotals(c)), ZERO_TOTALS);
}

export function emptyLines(mang: MangId): EntryLines {
  const [a, b] = mangById(mang).lines;
  return { [a]: { single: 0, double: 0 }, [b]: { single: 0, double: 0 } };
}

function validCount(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n <= MAX_CARTS;
}

/** Trả về lỗi tiếng Việt, hoặc null nếu phiếu hợp lệ. */
export function validateLines(mang: MangId, lines: EntryLines): string | null {
  const expected = mangById(mang).lines;
  const keys = Object.keys(lines);
  if (keys.length !== 2 || !expected.every((l) => keys.includes(l))) return 'Phiếu không đúng line của máng.';
  for (const l of expected) {
    const c = lines[l]!;
    if (!validCount(c.single) || !validCount(c.double)) return `Số xe phải là số nguyên từ 0 đến ${MAX_CARTS}.`;
  }
  if (linesTotals(lines).rides === 0) return 'Phiếu đang toàn số 0.';
  return null;
}

/** Khung giờ đang diễn ra. Trước giờ mở cửa → khung đầu, sau giờ đóng → khung cuối. */
export function currentSlotId(minutes: number): SlotId {
  let current = TIME_SLOTS[0]!;
  for (const s of TIME_SLOTS) if (hhmmToMinutes(s.start) <= minutes) current = s;
  return current.id;
}

/** Nhân viên chỉ được báo cho khung đang diễn ra hoặc các khung đã qua (báo trễ). */
export function selectableSlots(minutes: number): TimeSlot[] {
  const current = currentSlotId(minutes);
  const idx = TIME_SLOTS.findIndex((s) => s.id === current);
  return TIME_SLOTS.slice(0, idx + 1);
}

/** Tổng các phiếu còn hiệu lực theo từng khung giờ. */
export function totalsBySlot(entries: Entry[]): Map<SlotId, Totals> {
  const out = new Map<SlotId, Totals>();
  for (const e of entries) {
    if (!isActive(e.status)) continue;
    out.set(e.slotId, addTotals(out.get(e.slotId) ?? ZERO_TOTALS, linesTotals(e.lines)));
  }
  return out;
}

/** Chuẩn hoá giờ gõ tay: '830' / '0830' / '8:30' / '08:30' → '08:30'. null nếu không hợp lệ. */
export function normalizeHHMM(raw: string): string | null {
  const s = raw.trim();
  let h: number;
  let m: number;
  const colon = s.match(/^(\d{1,2}):(\d{2})$/);
  if (colon) {
    h = Number(colon[1]);
    m = Number(colon[2]);
  } else if (/^\d{3,4}$/.test(s)) {
    h = Number(s.slice(0, s.length - 2));
    m = Number(s.slice(-2));
  } else if (/^\d{1,2}$/.test(s)) {
    h = Number(s);
    m = 0;
  } else return null;
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Thời gian chạy máng (phút) = giờ đóng − giờ mở − phút tạm dừng. 0 khi máng nghỉ. null khi chưa đủ giờ mở / đóng. */
export function runMinutes(openTime: string, closeTime: string, pausedMinutes: number): number | null {
  if (!openTime || !closeTime) return null;
  const openMin = hhmmToMinutes(openTime);
  const closeMin = hhmmToMinutes(closeTime);
  if (openMin === 0 && closeMin === 0) return 0;
  const span = closeMin - openMin;
  if (span <= 0) return null;
  const paused = Math.max(0, Number(pausedMinutes) || 0);
  return Math.max(0, span - paused);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} giờ${m ? ` ${m} phút` : ''}` : `${m} phút`;
}

/** Mới nhất trước. Phiếu chưa có giờ server (đang chờ mạng) lấy giờ trên máy. */
export function sortNewestFirst(entries: Entry[]): Entry[] {
  const t = (e: Entry) => e.createdAt?.getTime() ?? e.clientCreatedAt;
  return [...entries].sort((a, b) => t(b) - t(a));
}
