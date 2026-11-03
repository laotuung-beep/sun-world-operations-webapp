import { LINE_LABEL, MANGS, TIME_SLOTS, mangById } from '../config';
import { STATUS_LABEL, formatDuration, linesTotals, sortNewestFirst, type Entry } from '../entries/model';
import { clockVN } from '../time';
import { ALL_LINES, META_LABEL, sumLines, type DayMeta, type Matrix, type ReportMetrics } from './compute';

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** File Excel 2 sheet: "Báo cáo" (số đã duyệt) và "Phiếu" (mọi phiếu, để đối chiếu). */
export async function exportExcel(opts: {
  date: string;
  matrix: Matrix;
  metrics: ReportMetrics;
  meta: DayMeta;
  entries: Entry[];
  closed: boolean;
}): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Vận Hành Máng Trượt';
  const bold = { bold: true };

  const ws = wb.addWorksheet('Báo cáo');
  ws.addRow([`BÁO CÁO VẬN HÀNH MÁNG TRƯỢT - ${opts.date.split('-').reverse().join('/')}`]).font = { bold: true, size: 14 };
  ws.addRow([opts.closed ? 'Đã chốt ngày' : 'Chưa chốt ngày - số liệu có thể còn thay đổi']);
  ws.addRow([]);

  ws.addRow(['Tổng khách chơi máng', opts.metrics.total.passengers]).font = bold;
  ws.addRow(['Tổng lượt xe', opts.metrics.total.rides]);
  ws.addRow(['Tỷ lệ lên cáp (%)', opts.metrics.conversionRate === null ? '' : Number(opts.metrics.conversionRate.toFixed(1))]);
  ws.addRow(['TB chuyến / giờ cao điểm (11h-15h)', opts.metrics.peakAvgRides]);
  for (const k of Object.keys(META_LABEL) as (keyof DayMeta)[]) ws.addRow([META_LABEL[k], opts.meta[k]]);
  ws.addRow([]);

  ws.addRow(['Máng', 'Khách', 'Lượt xe', 'Xe đơn', 'Xe đôi', 'Giờ mở', 'Giờ đóng', 'Tạm dừng (phút)', 'Giờ chạy']).font = bold;
  for (const x of opts.metrics.mangs) {
    ws.addRow([
      mangById(x.mang).name,
      x.totals.passengers,
      x.totals.rides,
      x.totals.single,
      x.totals.double,
      x.schedule?.openTime ?? '',
      x.schedule?.closeTime ?? '',
      x.schedule?.pausedMinutes ?? 0,
      x.runMinutes === null ? '' : formatDuration(x.runMinutes),
    ]);
  }
  ws.addRow([]);

  ws.addRow(['MA TRẬN GIỜ (lượt xe; đơn/đôi)']).font = bold;
  ws.addRow(['Khung giờ', ...ALL_LINES.map((l) => LINE_LABEL[l]), 'Tổng lượt', 'Tổng khách']).font = bold;
  for (const s of TIME_SLOTS) {
    const row = opts.matrix[s.id];
    const t = sumLines(row);
    ws.addRow([s.label, ...ALL_LINES.map((l) => `${row[l].rides} (${row[l].single}/${row[l].double})`), t.rides, t.passengers]);
  }
  ws.getColumn(1).width = 34;
  for (let c = 2; c <= 9; c++) ws.getColumn(c).width = 13;

  const ws2 = wb.addWorksheet('Phiếu');
  ws2.addRow(['Giờ gửi', 'Khung giờ', 'Máng', ...ALL_LINES.flatMap((l) => [`${LINE_LABEL[l]} đơn`, `${LINE_LABEL[l]} đôi`]), 'Lượt xe', 'Khách', 'Trạng thái', 'Người gửi', 'Người duyệt', 'Lý do trả lại']).font = bold;
  for (const e of sortNewestFirst(opts.entries).reverse()) {
    const t = linesTotals(e.lines);
    ws2.addRow([
      clockVN(e.createdAt ?? new Date(e.clientCreatedAt)),
      TIME_SLOTS.find((s) => s.id === e.slotId)?.label ?? e.slotId,
      MANGS.find((m) => m.id === e.mang)?.short ?? e.mang,
      ...ALL_LINES.flatMap<number | string>((l) => (e.lines[l] ? [e.lines[l]!.single, e.lines[l]!.double] : ['', ''])),
      t.rides,
      t.passengers,
      STATUS_LABEL[e.status],
      e.createdByName,
      e.reviewedByName ?? '',
      e.rejectReason ?? '',
    ]);
  }
  ws2.getColumn(1).width = 9;
  ws2.getColumn(2).width = 15;

  const buf = await wb.xlsx.writeBuffer();
  saveBlob(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `bao-cao-mang-truot-${opts.date}.xlsx`,
  );
}

/**
 * Chụp khối báo cáo thành ảnh PNG. Điện thoại: mở bảng chia sẻ (chọn Viber).
 * Máy tính: chép vào clipboard để dán vào Viber; không được thì tải ảnh về.
 */
export async function shareReportImage(node: HTMLElement, date: string): Promise<'shared' | 'copied' | 'downloaded'> {
  const { toBlob } = await import('html-to-image');
  const blob = await Promise.race([
    toBlob(node, { pixelRatio: 2, backgroundColor: '#ffffff', filter: (n) => !(n instanceof HTMLElement && n.dataset.noCapture !== undefined) }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Chụp ảnh quá lâu, thử lại.')), 20_000)),
  ]);
  if (!blob) throw new Error('Không tạo được ảnh');
  const file = new File([blob], `bao-cao-mang-truot-${date}.png`, { type: 'image/png' });

  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  if (isTouch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Báo cáo máng trượt ${date}` });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'shared';
    }
  }
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return 'copied';
    } catch {
      /* rơi xuống tải về */
    }
  }
  saveBlob(blob, file.name);
  return 'downloaded';
}
