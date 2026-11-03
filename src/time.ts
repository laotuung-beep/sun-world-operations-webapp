/** Mọi ngày giờ nghiệp vụ tính theo giờ Việt Nam, bất kể máy đang đặt múi giờ nào. */
export const TIME_ZONE = 'Asia/Ho_Chi_Minh';

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function parts(d: Date): Record<string, string> {
  return Object.fromEntries(partsFmt.formatToParts(d).map((p) => [p.type, p.value]));
}

/** 'YYYY-MM-DD' theo giờ Việt Nam. */
export function dateKeyVN(d: Date = new Date()): string {
  const p = parts(d);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Số phút tính từ 00:00 theo giờ Việt Nam. */
export function minutesVN(d: Date = new Date()): number {
  const p = parts(d);
  return Number(p.hour) * 60 + Number(p.minute);
}

/** '08:30' -> 510 */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

const clockFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** '14:05' theo giờ Việt Nam. */
export function clockVN(d: Date): string {
  return clockFmt.format(d);
}

const dayFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: TIME_ZONE, weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

/** 'Thứ Ba, 03/11/2026' */
export function longDateVN(d: Date): string {
  const s = dayFmt.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
