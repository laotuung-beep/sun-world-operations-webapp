import { LINE_LABEL, MAX_CARTS, TIME_SLOTS, mangById, type LineId, type MangId, type SlotId, type TimeSlot } from '../config';
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

export type PauseCategoryId = 'maintenance' | 'technical' | 'customer' | 'lightning' | 'fog' | 'rain';

/** Phạm vi Line dừng vận hành: 1 Line cụ thể (line1..line6) hoặc Cả 2 Line của Máng ('both'). */
export type PauseLineScope = LineId | 'both';

export interface PauseCategoryDef {
  id: PauseCategoryId;
  label: string;
  hasLineScope?: boolean;
}

/** 6 danh mục sự cố dừng vận hành chuẩn nghiệp vụ. */
export const PAUSE_CATEGORIES: readonly PauseCategoryDef[] = [
  { id: 'maintenance', label: 'Bảo trì', hasLineScope: true },
  { id: 'technical', label: 'Lỗi kỹ thuật', hasLineScope: true },
  { id: 'customer', label: 'Sự cố khách hàng' },
  { id: 'lightning', label: 'Dông sét' },
  { id: 'fog', label: 'Sương mù' },
  { id: 'rain', label: 'Mưa lớn' },
];

export interface PauseRecord {
  id: string;
  category: PauseCategoryId;
  /** Áp dụng cho Bảo trì & Lỗi kỹ thuật: 'line1'..'line6' (1 line) hoặc 'both' (Cả 2 Line). */
  lineScope?: PauseLineScope;
  startTime: string; // HH:mm (24h)
  endTime: string;   // HH:mm (24h)
  durationMinutes: number;
  note: string;
  createdAt?: number;
  createdByName?: string;
}

/** Kiểm tra danh mục có yêu cầu chọn Line (Line A, Line B, Cả 2 Line) hay không. */
export function categoryHasLineScope(cat: PauseCategoryId): boolean {
  return cat === 'maintenance' || cat === 'technical';
}

/** Trả về 3 ô chọn Line tương ứng với từng Máng (vd Máng 1: Line 1, Line 2, Cả 2 Line). */
export function lineScopeOptionsForMang(mang: MangId): readonly { value: PauseLineScope; label: string }[] {
  const [l1, l2] = mangById(mang).lines;
  return [
    { value: l1, label: LINE_LABEL[l1] },
    { value: l2, label: LINE_LABEL[l2] },
    { value: 'both', label: 'Cả 2 Line' },
  ];
}

/** Nhãn hiển thị cho phạm vi Line của phiếu dừng. */
export function formatLineScopeLabel(scope: PauseLineScope | undefined): string {
  if (!scope || scope === 'both') return 'Cả 2 Line';
  return LINE_LABEL[scope] ?? scope;
}

/**
 * Kiểm tra lượt dừng có tính vào thời gian dừng của cả Máng hay không:
 * - Bảo trì / Lỗi kỹ thuật:
 *   + Cả 2 Line ('both') -> CÓ tính thời gian dừng cho cả Máng.
 *   + 1 Line ('line1'..'line6') -> KHÔNG tính thời gian dừng của Máng (vẫn lưu lịch sử đối chiếu).
 * - Các danh mục còn lại -> CÓ tính thời gian dừng cho cả Máng.
 */
export function countsTowardMangPause(record: Pick<PauseRecord, 'category' | 'lineScope'>): boolean {
  if (categoryHasLineScope(record.category)) {
    return !record.lineScope || record.lineScope === 'both';
  }
  return true;
}

/** Chuyển số phút sang định dạng HH:mm hệ 24h (ví dụ: 0 -> "00:00", 15 -> "00:15", 65 -> "01:05", 445 -> "07:25"). */
export function minutesToHHMM(minutes: number | null | undefined): string {
  const v = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(v / 60);
  const m = v % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Ô nhập số thông minh hệ 24h:
 * - Gõ 4 chữ số liên tiếp (vd: 1015 -> 10:15, 1435 -> 14:35) không cần gõ dấu hai chấm (:).
 * - Tự động giới hạn hợp lệ từ 00:00 đến 23:59.
 */
export function formatSmartTime24h(raw: string): string {
  if (/^\d:$/.test(raw)) {
    return `0${raw}`;
  }
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return digits;
  const hRaw = parseInt(digits.slice(0, 2), 10) || 0;
  const h = Math.min(23, Math.max(0, hRaw));
  const mRawStr = digits.slice(2);
  if (mRawStr.length === 2) {
    const mRaw = parseInt(mRawStr, 10) || 0;
    const m = Math.min(59, Math.max(0, mRaw));
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return `${String(h).padStart(2, '0')}:${mRawStr}`;
}

/** Chuẩn hóa giá trị ô nhập giờ 24h khi rời ô (onBlur) hoặc khi lưu. Trả về '' nếu trống. */
export function finalizeSmartTime24h(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (!digits) return '';
  let h = 0;
  let m = 0;
  if (digits.length === 4) {
    h = parseInt(digits.slice(0, 2), 10) || 0;
    m = parseInt(digits.slice(2, 4), 10) || 0;
  } else if (digits.length === 3) {
    h = parseInt(digits.slice(0, 1), 10) || 0;
    m = parseInt(digits.slice(1, 3), 10) || 0;
  } else {
    h = parseInt(digits, 10) || 0;
    m = 0;
  }
  h = Math.min(23, Math.max(0, h));
  m = Math.min(59, Math.max(0, m));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Tính số phút dừng giữa startTime và endTime (HH:mm). Trả về null nếu không hợp lệ hoặc endTime <= startTime. */
export function calcPauseDurationMinutes(startTime: string, endTime: string): number | null {
  const s = finalizeSmartTime24h(startTime);
  const e = finalizeSmartTime24h(endTime);
  if (!s || !e) return null;
  const sMin = hhmmToMinutes(s);
  const eMin = hhmmToMinutes(e);
  if (eMin <= sMin) return null;
  return eMin - sMin;
}

/**
 * Tính tổng số phút dừng TÍNH CHO CẢ MÁNG (dùng để trừ vào Giờ chạy Máng).
 * Nếu Bảo trì hoặc Lỗi kỹ thuật chỉ dừng 1 Line thì không tính vào tổng thời gian dừng của Máng.
 */
export function sumPauseRecordsMinutes(records: readonly PauseRecord[]): number {
  return records.reduce((acc, r) => {
    if (!countsTowardMangPause(r)) return acc;
    return acc + Math.max(0, Math.round(Number(r.durationMinutes) || 0));
  }, 0);
}

/**
 * Tính tổng số phút của TẤT CẢ các phiếu dừng đã lưu trong lịch sử (bao gồm cả phiếu 1 Line lưu để đối chiếu).
 */
export function sumAllLoggedPauseMinutes(records: readonly PauseRecord[]): number {
  return records.reduce((acc, r) => acc + Math.max(0, Math.round(Number(r.durationMinutes) || 0)), 0);
}

/** Mới nhất trước. Phiếu chưa có giờ server (đang chờ mạng) lấy giờ trên máy. */
export function sortNewestFirst(entries: Entry[]): Entry[] {
  const t = (e: Entry) => e.createdAt?.getTime() ?? e.clientCreatedAt;
  return [...entries].sort((a, b) => t(b) - t(a));
}
