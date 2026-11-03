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
  logo: string;
}

export const MANGS: readonly Mang[] = [
  { id: 1, name: 'Alpine Coaster 1', short: 'AC 1', lines: ['line1', 'line2'], color: '#10B981', logo: '/logos/alpine-coaster-1.png' },
  { id: 2, name: 'Alpine Coaster 2', short: 'AC 2', lines: ['line3', 'line4'], color: '#0EA5E9', logo: '/logos/alpine-coaster-2.png' },
  { id: 3, name: 'Alpine Coaster 3', short: 'AC 3', lines: ['line5', 'line6'], color: '#EF4444', logo: '/logos/alpine-coaster-3.png' },
];

export const LINE_LABEL: Record<LineId, string> = {
  line1: 'Line 1',
  line2: 'Line 2',
  line3: 'Line 3',
  line4: 'Line 4',
  line5: 'Line 5',
  line6: 'Line 6',
};

export function mangById(id: MangId): Mang {
  return MANGS.find((m) => m.id === id)!;
}

export function isMangId(value: unknown): value is MangId {
  return value === 1 || value === 2 || value === 3;
}
