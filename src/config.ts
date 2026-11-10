// Cấu hình nghiệp vụ dùng chung cho cả app.

/** Toàn quyền, không cần duyệt. PHẢI KHỚP với hàm isSuperAdmin() trong firestore.rules. */
export const SUPER_ADMINS: readonly string[] = [
  'phongbanana96@gmail.com',
  'laotuung@gmail.com',
  'laoung1996@gmail.com',
  'dieuhanh.mangtruot@gmail.com',
];

export type MangId = 1 | 2 | 3;
export type LineId = 'line1' | 'line2' | 'line3' | 'line4' | 'line5' | 'line6';

export interface Mang {
  id: MangId;
  name: string;
  short: string;
  lines: readonly [LineId, LineId];
  color: string;
  /** Logo to (thẻ tài khoản, báo cáo). */
  logo: string;
  /** Logo nhỏ trên nền màu (nút chọn máng, ma trận) - như app cũ. */
  badge: string;
  /** Màu chấm của máng trong khối báo cáo đỏ. */
  dot: string;
}

export const MANGS: readonly Mang[] = [
  { id: 1, name: 'Alpine Coaster 1', short: 'AC 1', lines: ['line1', 'line2'], color: '#10B981', logo: '/logos/alpine-coaster-1.png', badge: '/assets/alpine_1_logo.png', dot: '#10B981' },
  { id: 2, name: 'Alpine Coaster 2', short: 'AC 2', lines: ['line3', 'line4'], color: '#0EA5E9', logo: '/logos/alpine-coaster-2.png', badge: '/assets/alpine_2_logo.png', dot: '#0EA5E9' },
  { id: 3, name: 'Alpine Coaster 3', short: 'AC 3', lines: ['line5', 'line6'], color: '#EF4444', logo: '/logos/alpine-coaster-3.png', badge: '/assets/alpine_3_logo.png', dot: '#D71920' },
];

export const LINE_LABEL: Record<LineId, string> = {
  line1: 'Line 1',
  line2: 'Line 2',
  line3: 'Line 3',
  line4: 'Line 4',
  line5: 'Line 5',
  line6: 'Line 6',
};

export type SlotId = '0830' | '1000' | '1100' | '1200' | '1300' | '1400' | '1500' | '1600' | '1700' | '1800';

export interface TimeSlot {
  id: SlotId;
  label: string;
  start: string;
  end: string;
  peak: boolean;
}

/** 10 khung giờ trong ngày. Giờ cao điểm 11h–15h. PHẢI KHỚP với slotIds() trong firestore.rules. */
export const TIME_SLOTS: readonly TimeSlot[] = [
  { id: '0830', label: '08:30 – 10:00', start: '08:30', end: '10:00', peak: false },
  { id: '1000', label: '10:00 – 11:00', start: '10:00', end: '11:00', peak: false },
  { id: '1100', label: '11:00 – 12:00', start: '11:00', end: '12:00', peak: true },
  { id: '1200', label: '12:00 – 13:00', start: '12:00', end: '13:00', peak: true },
  { id: '1300', label: '13:00 – 14:00', start: '13:00', end: '14:00', peak: true },
  { id: '1400', label: '14:00 – 15:00', start: '14:00', end: '15:00', peak: true },
  { id: '1500', label: '15:00 – 16:00', start: '15:00', end: '16:00', peak: false },
  { id: '1600', label: '16:00 – 17:00', start: '16:00', end: '17:00', peak: false },
  { id: '1700', label: '17:00 – 18:00', start: '17:00', end: '18:00', peak: false },
  { id: '1800', label: '18:00 – 19:00', start: '18:00', end: '19:00', peak: false },
];

export function slotById(id: SlotId): TimeSlot {
  return TIME_SLOTS.find((s) => s.id === id)!;
}

/** Số cart tối đa cho một ô (xe đơn hoặc xe đôi) trong một phiếu. PHẢI KHỚP với firestore.rules. */
export const MAX_CARTS = 500;

export function mangById(id: MangId): Mang {
  return MANGS.find((m) => m.id === id)!;
}

export function isMangId(value: unknown): value is MangId {
  return value === 1 || value === 2 || value === 3;
}
