import { useMemo, useRef, useState, type ReactNode } from 'react';
import { FileSpreadsheet, Image as ImageIcon, LoaderCircle, Lock, LockOpen, Pencil, Send, Settings, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { LINE_LABEL, MANGS, TIME_SLOTS } from '../../config';
import { useActor, useAuth } from '../../auth/AuthProvider';
import { canReopenDay } from '../../auth/access';
import { clockVN, longDateVN } from '../../time';
import { formatDuration } from '../../entries/model';
import { useDayEntries, writeErrorMessage } from '../../entries/api';
import {
  ALL_LINES,
  META_LABEL,
  buildMatrix,
  legacySheetsPayload,
  lineTotal,
  reportMetrics,
  sumLines,
  type DayMeta,
} from '../../report/compute';
import {
  markSheetsSynced,
  postToSheets,
  saveMeta,
  saveSheetsWebhook,
  setDayClosed,
  useDay,
  useSchedules,
  useSheetsWebhook,
} from '../../report/api';
import { DateBar } from '../../components/DateBar';

const fmt = new Intl.NumberFormat('vi-VN');
const n = (v: number) => fmt.format(v);

export function ReportScreen({
  date,
  onDateChange,
  onGoReview,
}: {
  date: string;
  onDateChange: (d: string) => void;
  onGoReview: () => void;
}) {
  const { access } = useAuth();
  const actor = useActor();
  const day = useDay(date);
  const schedules = useSchedules(date);
  const { entries } = useDayEntries(date);
  const webhook = useSheetsWebhook();
  const reportRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'close' | 'excel' | 'image' | 'sheets' | null>(null);
  const [editMeta, setEditMeta] = useState(false);

  const all = entries ?? [];
  const matrix = useMemo(() => buildMatrix(all, (s) => s === 'approved'), [all]);
  const meta = day?.meta;
  const metrics = useMemo(() => (meta ? reportMetrics(matrix, meta, schedules) : null), [matrix, meta, schedules]);
  const pendingCount = all.filter((e) => e.status === 'pending').length;
  const closed = day?.closed ?? false;

  if (!day || !metrics || !meta || entries === null) {
    return (
      <div className="space-y-4">
        <DateBar date={date} onChange={onDateChange} />
        <div className="grid place-items-center py-16 text-slate-400">
          <LoaderCircle className="w-6 h-6 animate-spin" />
        </div>
      </div>
    );
  }

  async function run(kind: NonNullable<typeof busy>, fn: () => Promise<void>) {
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      console.warn(e);
      toast.error(`Lỗi: ${writeErrorMessage(e)}`);
    } finally {
      setBusy(null);
    }
  }

  const toggleClose = () =>
    run('close', async () => {
      if (!closed) {
        const warn = pendingCount ? `\n\nCòn ${pendingCount} phiếu chờ duyệt sẽ KHÔNG được tính.` : '';
        if (!window.confirm(`Chốt báo cáo ngày ${date}? Sau khi chốt không gửi / duyệt thêm phiếu được.${warn}`)) return;
      } else if (!window.confirm(`Mở lại ngày ${date} để sửa?`)) return;
      await setDayClosed(date, !closed, actor);
      toast.success(closed ? 'Đã mở lại ngày.' : 'Đã chốt ngày.');
    });

  const excel = () =>
    run('excel', async () => {
      const { exportExcel } = await import('../../report/exporters');
      await exportExcel({ date, matrix, metrics, meta, entries: all, closed });
      toast.success('Đã tải file Excel.');
    });

  const image = () =>
    run('image', async () => {
      if (!reportRef.current) return;
      const { shareReportImage } = await import('../../report/exporters');
      const how = await shareReportImage(reportRef.current, date);
      if (how === 'copied') toast.success('Đã chép ảnh báo cáo. Mở Viber và dán (Ctrl+V).');
      else if (how === 'downloaded') toast.success('Đã tải ảnh báo cáo về máy.');
    });

  const sheets = () =>
    run('sheets', async () => {
      if (!webhook) {
        toast.error('Chưa cấu hình Google Sheets. Super Admin bấm nút bánh răng để dán URL Apps Script.');
        return;
      }
      await postToSheets(webhook, legacySheetsPayload(date, matrix, meta, schedules, closed));
      await markSheetsSynced(date, actor);
      toast.success('Đã gửi báo cáo sang Google Sheets.');
    });

  const configureSheets = () => {
    const url = window.prompt('URL Web App của Google Apps Script (giống URL đã dùng ở app cũ):', webhook ?? '');
    if (url === null) return;
    if (url && !/^https:\/\/script\.google\.com\//.test(url.trim())) {
      toast.error('URL phải bắt đầu bằng https://script.google.com/');
      return;
    }
    saveSheetsWebhook(url, actor).then(
      () => toast.success('Đã lưu URL Google Sheets cho mọi máy.'),
      (e) => toast.error(`Không lưu được: ${writeErrorMessage(e)}`),
    );
  };

  return (
    <div className="space-y-4">
      <DateBar date={date} onChange={onDateChange} closed={closed} />

      <div className="flex flex-wrap gap-2">
        <ActionButton onClick={toggleClose} busy={busy === 'close'} disabled={closed && !canReopenDay(access!)} dark={!closed}>
          {closed ? <LockOpen className="w-4 h-4" /> : <Lock className="w-4 h-4" />} {closed ? 'Mở lại ngày' : 'Chốt ngày'}
        </ActionButton>
        <ActionButton onClick={excel} busy={busy === 'excel'}>
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Xuất Excel
        </ActionButton>
        <ActionButton onClick={image} busy={busy === 'image'}>
          <ImageIcon className="w-4 h-4 text-violet-600" /> Ảnh gửi Viber
        </ActionButton>
        <ActionButton onClick={sheets} busy={busy === 'sheets'}>
          <Send className="w-4 h-4 text-sky-600" /> Gửi Google Sheets
        </ActionButton>
        {canReopenDay(access!) && (
          <button type="button" onClick={configureSheets} title="Cấu hình Google Sheets" className="w-10 h-10 grid place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-900">
            <Settings className="w-4 h-4" />
          </button>
        )}
      </div>
      {(closed || day.sheetsSyncedAt) && (
        <p className="text-xs text-slate-500 -mt-2">
          {closed && day.closedByName && `Chốt bởi ${day.closedByName}${day.closedAt ? ` lúc ${clockVN(day.closedAt)}` : ''}. `}
          {day.sheetsSyncedAt && `Đã gửi Google Sheets lúc ${clockVN(day.sheetsSyncedAt)}.`}
        </p>
      )}

      {pendingCount > 0 && (
        <button
          type="button"
          onClick={onGoReview}
          className="w-full text-left flex items-center gap-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm font-semibold"
        >
          <TriangleAlert className="w-4 h-4 shrink-0" /> Còn {pendingCount} phiếu chờ duyệt, chưa được tính vào báo cáo. Bấm để duyệt.
        </button>
      )}

      {/* Khối được chụp thành ảnh gửi Viber */}
      <div ref={reportRef} className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-extrabold text-lg leading-tight">BÁO CÁO VẬN HÀNH MÁNG TRƯỢT</h2>
            <p className="text-sm text-slate-500">
              Sun World Ba Na Hills · {longDateVN(new Date(`${date}T12:00:00+07:00`))}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${closed ? 'bg-slate-900 text-white' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
            {closed ? 'ĐÃ CHỐT' : 'CHƯA CHỐT'}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi label="Khách chơi máng" value={n(metrics.total.passengers)} sub={`${n(metrics.total.rides)} lượt xe`} accent />
          <Kpi label="Doanh thu vé quầy" value={`${n(meta.counterRevenue)} đ`} />
          <Kpi
            label="Tỷ lệ lên cáp"
            value={metrics.conversionRate === null ? '–' : `${metrics.conversionRate.toFixed(1)}%`}
            sub={`${n(metrics.total.passengers)} / ${n(meta.cableCarVisitors)} khách`}
          />
          <Kpi label="TB chuyến giờ cao điểm" value={n(metrics.peakAvgRides)} sub="lượt / giờ (11h–15h)" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {metrics.mangs.map((x) => {
            const m = MANGS.find((y) => y.id === x.mang)!;
            return (
              <div key={x.mang} className="rounded-2xl border border-slate-200 p-3" style={{ borderTopColor: m.color, borderTopWidth: 3 }}>
                <p className="text-xs font-extrabold" style={{ color: m.color }}>
                  <span className="sm:hidden">{m.short}</span>
                  <span className="hidden sm:inline">{m.name}</span>
                </p>
                <p className="tabular text-xl font-extrabold">{n(x.totals.passengers)}</p>
                <p className="text-[11px] text-slate-500 tabular">
                  {n(x.totals.rides)} lượt · {n(x.totals.single)} đơn / {n(x.totals.double)} đôi
                </p>
                <p className="mt-1 text-[11px] text-slate-500 tabular">
                  {x.schedule?.openTime ? `${x.schedule.openTime}–${x.schedule.closeTime || '…'}` : 'Chưa nhập giờ chạy'}
                  {x.schedule?.pausedMinutes ? ` · dừng ${x.schedule.pausedMinutes}p` : ''}
                </p>
                {x.runMinutes !== null && <p className="text-[11px] font-bold text-slate-700">Chạy {formatDuration(x.runMinutes)}</p>}
              </div>
            );
          })}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-600">Đối soát cáp treo & cổng</h3>
            {!closed && (
              <button type="button" data-no-capture onClick={() => setEditMeta((v) => !v)} className="inline-flex items-center gap-1 text-xs font-bold text-brand">
                <Pencil className="w-3.5 h-3.5" /> {editMeta ? 'Đóng' : 'Sửa số liệu'}
              </button>
            )}
          </div>
          {editMeta && !closed ? (
            <MetaForm date={date} meta={meta} onDone={() => setEditMeta(false)} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['cableCarVisitors', 'paidGateVisitors', 'freeGateVisitors', 'nightComboVisitors'] as const).map((k) => (
                <div key={k} className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[11px] text-slate-500">{META_LABEL[k]}</p>
                  <p className="tabular font-extrabold">{n(meta[k])}</p>
                </div>
              ))}
            </div>
          )}
          {day.metaUpdatedByName && !editMeta && <p className="mt-1 text-[11px] text-slate-400">Nhập bởi {day.metaUpdatedByName}</p>}
        </div>

        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-600 mb-2">Ma trận giờ · lượt xe đã duyệt</h3>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-sm tabular min-w-[600px]">
              <thead>
                <tr className="text-[11px] uppercase text-slate-500 border-b border-slate-200">
                  <th className="text-left font-bold py-2 pr-2">Khung giờ</th>
                  {ALL_LINES.map((l) => (
                    <th key={l} className="font-bold py-2 px-1 text-center" style={{ color: MANGS.find((m) => m.lines.includes(l))!.color }}>
                      {LINE_LABEL[l].replace('Line ', 'L')}
                    </th>
                  ))}
                  <th className="font-bold py-2 px-1 text-center">Lượt</th>
                  <th className="font-bold py-2 pl-1 text-center">Khách</th>
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((s) => {
                  const row = matrix[s.id];
                  const t = sumLines(row);
                  return (
                    <tr key={s.id} className={`border-b border-slate-100 ${s.peak ? 'bg-amber-50/40' : ''}`}>
                      <td className="py-1.5 pr-2 whitespace-nowrap font-semibold">{s.label}</td>
                      {ALL_LINES.map((l) => (
                        <td key={l} className={`py-1.5 px-1 text-center ${row[l].rides ? '' : 'text-slate-300'}`}>
                          {row[l].rides || '–'}
                        </td>
                      ))}
                      <td className="py-1.5 px-1 text-center font-extrabold">{t.rides || ''}</td>
                      <td className="py-1.5 pl-1 text-center font-bold text-slate-600">{t.passengers || ''}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="font-extrabold">
                  <td className="py-2 pr-2">Tổng</td>
                  {ALL_LINES.map((l) => (
                    <td key={l} className="py-2 px-1 text-center">
                      {lineTotal(matrix, l).rides}
                    </td>
                  ))}
                  <td className="py-2 px-1 text-center">{metrics.total.rides}</td>
                  <td className="py-2 pl-1 text-center">{metrics.total.passengers}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Nền vàng: giờ cao điểm. Khách = xe đơn × 1 + xe đôi × 2.</p>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 ${accent ? 'bg-brand text-white' : 'bg-slate-50'}`}>
      <p className={`text-[11px] font-bold uppercase tracking-wide ${accent ? 'text-white/80' : 'text-slate-500'}`}>{label}</p>
      <p className="tabular text-xl sm:text-2xl font-extrabold leading-tight mt-1">{value}</p>
      {sub && <p className={`text-[11px] tabular ${accent ? 'text-white/80' : 'text-slate-500'}`}>{sub}</p>}
    </div>
  );
}

function ActionButton({
  onClick,
  busy,
  disabled,
  dark,
  children,
}: {
  onClick: () => void;
  busy: boolean;
  disabled?: boolean;
  dark?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold transition disabled:opacity-50 ${
        dark ? 'bg-slate-900 text-white hover:bg-slate-700' : 'bg-white border border-slate-200 text-slate-800 hover:bg-slate-50'
      }`}
    >
      {busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

function MetaForm({ date, meta, onDone }: { date: string; meta: DayMeta; onDone: () => void }) {
  const actor = useActor();
  const [draft, setDraft] = useState<DayMeta>(meta);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await saveMeta(date, draft, actor);
      toast.success('Đã lưu số liệu đối soát.');
      onDone();
    } catch (e) {
      toast.error(`Không lưu được: ${writeErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-no-capture className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {(Object.keys(META_LABEL) as (keyof DayMeta)[]).map((k) => (
          <label key={k} className="block">
            <span className="text-xs font-bold text-slate-600">{META_LABEL[k]}</span>
            <input
              type="text"
              inputMode="numeric"
              value={draft[k] ? fmt.format(draft[k]) : ''}
              placeholder="0"
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                setDraft((d) => ({ ...d, [k]: digits ? Math.min(Number(digits), 99_999_999_999) : 0 }));
              }}
              className="tabular mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-bold outline-none focus:ring-2 focus:ring-brand/30"
            />
          </label>
        ))}
      </div>
      <button type="button" onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-bold disabled:opacity-50">
        {busy && <LoaderCircle className="w-4 h-4 animate-spin" />} Lưu số liệu
      </button>
    </div>
  );
}
