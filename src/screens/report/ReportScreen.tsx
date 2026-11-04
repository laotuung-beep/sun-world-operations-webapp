import { useMemo, useRef, useState } from 'react';
import { Copy, Download, LoaderCircle, Lock, LockOpen, Moon, Mountain, Pen, Printer, Send, Ticket, TriangleAlert, UserCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { MANGS } from '../../config';
import { useActor, useAuth } from '../../auth/AuthProvider';
import { canReopenDay } from '../../auth/access';
import { clockVN } from '../../time';
import { useDayEntries, writeErrorMessage } from '../../entries/api';
import { isActive } from '../../entries/model';
import { META_LABEL, buildMatrix, computeFreeGate, legacySheetsPayload, matrixTotal, reportMetrics, type DayMeta } from '../../report/compute';
import { markSheetsSynced, postToSheets, saveMeta, setDayClosed, useDay, useSchedules, useSheetsWebhook } from '../../report/api';
import { CoasterMark } from '../../components/brand';

const fmt = new Intl.NumberFormat('vi-VN');
const n = (v: number) => fmt.format(v);
const hhmm = (min: number | null) => (min === null ? '00:00' : `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`);

const META_ICON = { cableCarVisitors: Mountain, paidGateVisitors: Ticket, freeGateVisitors: UserCheck, nightComboVisitors: Moon } as const;

/** Tab "Báo Cáo Ca": giao diện như app cũ, chỉ tính phiếu đã duyệt. */
export function ReportScreen({ date, onGoMatrix }: { date: string; onGoMatrix: () => void }) {
  const { access } = useAuth();
  const actor = useActor();
  const day = useDay(date);
  const schedules = useSchedules(date);
  const { entries } = useDayEntries(date);
  const webhook = useSheetsWebhook();
  const captureRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'close' | 'excel' | 'image' | 'sheets' | null>(null);
  const [editMeta, setEditMeta] = useState(false);

  const all = entries ?? [];
  const matrix = useMemo(() => buildMatrix(all, (s) => isActive(s)), [all]);
  const rawMeta = day?.meta;
  const totalCoasterPassengers = useMemo(() => matrixTotal(matrix).passengers, [matrix]);
  const meta = useMemo<DayMeta | undefined>(() => {
    if (!rawMeta) return undefined;
    return {
      ...rawMeta,
      freeGateVisitors: computeFreeGate(totalCoasterPassengers, rawMeta.paidGateVisitors),
    };
  }, [rawMeta, totalCoasterPassengers]);
  const metrics = useMemo(() => (meta ? reportMetrics(matrix, meta, schedules) : null), [matrix, meta, schedules]);
  const pendingCount = 0;
  const closed = day?.closed ?? false;
  const [y, mo, d] = date.split('-');

  if (!day || !metrics || !meta || entries === null) {
    return (
      <div className="grid place-items-center py-20 text-slate-400">
        <LoaderCircle className="w-6 h-6 animate-spin" />
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
        if (!window.confirm(`Chốt báo cáo ngày ${d}/${mo}/${y}? Sau khi chốt không gửi / duyệt thêm phiếu được.${warn}`)) return;
        if (meta) {
          await saveMeta(date, meta, actor);
        }
      } else if (!window.confirm(`Mở lại ngày ${d}/${mo}/${y} để sửa?`)) return;
      await setDayClosed(date, !closed, actor);
      toast.success(closed ? 'Đã mở lại ngày.' : 'Đã chốt ngày.');
    });

  const image = () =>
    run('image', async () => {
      if (!captureRef.current) return;
      const { shareReportImage } = await import('../../report/exporters');
      const how = await shareReportImage(captureRef.current, date);
      if (how === 'copied') toast.success('Đã chép ảnh báo cáo. Mở Viber và dán (Ctrl+V).');
      else if (how === 'downloaded') toast.success('Đã tải ảnh báo cáo về máy.');
    });

  const excel = () =>
    run('excel', async () => {
      const { exportExcel } = await import('../../report/exporters');
      await exportExcel({ date, matrix, metrics, meta, entries: all, closed });
      toast.success('Đã tải file Excel.');
    });

  const sheets = () =>
    run('sheets', async () => {
      if (!webhook) {
        toast.error('Chưa cấu hình Google Sheets. Super Admin vào menu tài khoản → Google Sheets để dán URL Apps Script.');
        return;
      }
      await postToSheets(webhook, legacySheetsPayload(date, matrix, meta, schedules, closed));
      await markSheetsSynced(date, actor);
      toast.success('Đã gửi báo cáo sang Google Sheets.');
    });

  const btn = 'h-10 px-3 sm:px-3.5 rounded-lg font-semibold text-xs bg-white hover:bg-[#F5F6F8] active:scale-[0.98] border border-[#E5E7EB] text-[#20242B] flex items-center gap-1.5 transition-all shrink-0 disabled:opacity-50';

  return (
    <div className="max-w-4xl mx-auto space-y-3 pb-16">
      <div data-no-print className="bg-white p-2.5 sm:p-3 rounded-xl border border-[#E5E7EB] flex items-center gap-2">
        <button
          type="button"
          onClick={image}
          disabled={busy === 'image'}
          className="flex-1 min-w-0 h-10 px-3.5 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-[0.98] bg-brand hover:bg-brand-dark text-white border border-brand disabled:opacity-75"
        >
          {busy === 'image' ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4 shrink-0" />}
          <span className="truncate">Chép gửi Viber</span>
        </button>
        <button type="button" onClick={sheets} disabled={busy === 'sheets'} className={btn} title="Gửi Google Sheets">
          {busy === 'sheets' ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-[#6B7280]" />}
          <span className="hidden xs:inline">Gửi báo cáo</span>
        </button>
        <button type="button" onClick={excel} disabled={busy === 'excel'} className={btn} title="Tải file Excel">
          {busy === 'excel' ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-[#6B7280]" />}
          <span className="hidden xs:inline">Tải xuống</span>
        </button>
        <button type="button" onClick={() => window.print()} className="h-10 w-10 rounded-lg bg-white hover:bg-[#F5F6F8] border border-[#E5E7EB] text-[#6B7280] hover:text-[#20242B] flex items-center justify-center shrink-0" aria-label="In báo cáo">
          <Printer className="w-4 h-4" />
        </button>
      </div>

      <div data-no-print className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={toggleClose}
          disabled={busy === 'close' || (closed && !canReopenDay(access!))}
          className={`h-9 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 active:scale-[0.98] disabled:opacity-50 ${
            closed ? 'bg-white border border-[#E5E7EB] text-slate-700' : 'bg-slate-900 text-white hover:bg-black'
          }`}
        >
          {busy === 'close' ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : closed ? <LockOpen className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
          {closed ? 'Mở lại ngày' : 'Chốt ngày'}
        </button>
        <p className="text-[11px] text-slate-500">
          {closed ? `Đã chốt${day.closedByName ? ` bởi ${day.closedByName}` : ''}${day.closedAt ? ` lúc ${clockVN(day.closedAt)}` : ''}.` : 'Chưa chốt ngày.'}
          {day.sheetsSyncedAt && ` Đã gửi Sheets lúc ${clockVN(day.sheetsSyncedAt)}.`}
        </p>
      </div>

      {pendingCount > 0 && (
        <button
          data-no-print
          type="button"
          onClick={onGoMatrix}
          className="w-full text-left flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2.5 text-xs font-semibold"
        >
          <TriangleAlert className="w-4 h-4 shrink-0" /> Còn {pendingCount} phiếu chờ duyệt, chưa tính vào báo cáo. Bấm để sang Ma Trận Giờ duyệt.
        </button>
      )}

      {/* Khối được chụp gửi Viber */}
      <div ref={captureRef} className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        <div className="px-4 py-3 sm:py-3.5 bg-white border-b border-[#E5E7EB] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center shrink-0">
              <CoasterMark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold tracking-wide uppercase text-[#20242B] leading-tight">Báo cáo vận hành máng trượt</h2>
              <p className="text-[11px] font-medium text-[#6B7280] mt-0.5">
                Ngày {d}/{mo}/{y}
              </p>
            </div>
          </div>
        </div>

        <div className="p-3.5 sm:p-5 space-y-3.5">
          <div className="bg-brand text-white rounded-xl py-4 px-4 sm:px-5 text-center">
            <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-red-100">Khách chơi máng</p>
            <div className="text-5xl sm:text-6xl font-bold tracking-tight font-numeric tabular-nums my-0.5 sm:my-1 leading-none">{n(metrics.total.passengers)}</div>
            <div className="grid grid-cols-3 gap-1 sm:gap-2 max-w-md mx-auto mt-2.5 pt-2.5 border-t border-white/20">
              {metrics.mangs.map((x) => {
                const m = MANGS.find((y) => y.id === x.mang)!;
                return (
                  <div key={x.mang} className="bg-white/10 border border-white/20 py-1.5 px-0.5 rounded-lg text-center">
                    <div className="flex items-center justify-center gap-1 text-[9px] sm:text-[10.5px] text-red-100 font-bold whitespace-nowrap leading-none">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: m.dot }} />
                      <span>{m.name}</span>
                    </div>
                    <div className="text-xs sm:text-sm font-semibold font-numeric tabular-nums mt-1">{n(x.totals.passengers)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="bg-white rounded-xl p-3 sm:p-4 border border-[#E5E7EB] flex flex-col justify-between min-h-[105px] sm:min-h-[125px]">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#6B7280]">Doanh thu</span>
              <div className="text-[17px] xs:text-xl sm:text-2xl font-bold font-numeric tabular-nums text-[#D97706] tracking-tight flex items-baseline gap-1 whitespace-nowrap overflow-hidden my-1">
                <span>{n(meta.counterRevenue)}</span>
                <span className="text-[12px] sm:text-sm text-[#D97706]/90">đ</span>
              </div>
              <div className="text-[10.5px] sm:text-[11px] text-[#16A34A] font-semibold flex items-center gap-1 truncate">✓ Doanh thu vé quầy</div>
            </div>
            <div className="bg-white rounded-xl p-3 sm:p-4 border border-[#E5E7EB] flex flex-col justify-between min-h-[105px] sm:min-h-[125px]">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#6B7280]">Tỷ lệ lên cáp</span>
              <div className="text-[17px] xs:text-xl sm:text-2xl font-bold font-numeric tabular-nums text-[#20242B] tracking-tight my-1">
                {(metrics.conversionRate ?? 0).toFixed(1)}%
              </div>
              <div className="space-y-1">
                <div className="w-full bg-[#F5F6F8] h-1.5 rounded-full overflow-hidden border border-[#E5E7EB]">
                  <div className="h-full bg-brand rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, metrics.conversionRate ?? 0))}%` }} />
                </div>
                <div className="text-[10px] sm:text-[10.5px] font-medium tabular-nums text-[#6B7280]">
                  {n(metrics.total.passengers)} / {n(meta.cableCarVisitors)} khách
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="text-xs font-extrabold tracking-wide text-slate-800 whitespace-nowrap">ĐỐI SOÁT CÁP TREO &amp; CỔNG</span>
              {!closed && (
                <button
                  type="button"
                  data-no-capture
                  onClick={() => setEditMeta((v) => !v)}
                  className="text-xs font-semibold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl whitespace-nowrap shrink-0 border border-[#E5E7EB] bg-white hover:bg-[#F5F6F8] text-[#20242B] inline-flex items-center gap-1.5 shadow-2xs"
                >
                  {editMeta ? <X className="w-3.5 h-3.5 text-[#6B7280]" /> : <Pen className="w-3.5 h-3.5 text-[#6B7280]" />}
                  <span>{editMeta ? 'Đóng' : 'Chỉnh sửa số liệu'}</span>
                </button>
              )}
            </div>
            {editMeta && !closed ? (
              <MetaForm date={date} meta={meta} totalPassengers={totalCoasterPassengers} onDone={() => setEditMeta(false)} />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
                {(Object.keys(META_ICON) as (keyof typeof META_ICON)[]).map((k) => {
                  const Icon = META_ICON[k];
                  return (
                    <div key={k} className="bg-[#FAFAFA] border border-[#EAECEF] rounded-xl p-3 sm:p-3.5 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-[#6B7280]">{META_LABEL[k]}</span>
                        <Icon className="w-4 h-4 text-[#6B7280] shrink-0" />
                      </div>
                      <div className="text-xl sm:text-2xl font-bold font-numeric tabular-nums text-[#20242B] leading-none mt-1">{n(meta[k])}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        <h3 className="text-xs sm:text-sm font-bold text-[#20242B] tracking-wider uppercase">Vận hành máng trượt (6 line)</h3>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2.5">
          <div className="lg:col-span-3 space-y-2">
            {metrics.mangs.map((x) => {
              const m = MANGS.find((y) => y.id === x.mang)!;
              return (
                <div key={x.mang} className="grid grid-cols-3 gap-2 bg-[#F5F6F8] p-2 rounded-xl border border-[#E5E7EB]">
                  <div className="bg-white p-2.5 rounded-lg border border-[#E5E7EB] text-center flex flex-col items-center justify-center">
                    <img src={m.badge} alt={m.name} className="h-6 object-contain mb-1" />
                    <div className="font-numeric font-bold tabular-nums text-[#20242B] text-sm">{n(x.totals.rides)} xe</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-[#E5E7EB] text-center">
                    <p className="text-[10px] text-[#6B7280] font-medium">Khách {m.short}</p>
                    <div className="mt-0.5 font-numeric font-bold tabular-nums text-sm" style={{ color: m.id === 3 ? '#D71920' : m.color }}>
                      {n(x.totals.passengers)}
                    </div>
                    <p className="text-[9.5px] text-[#6B7280] tabular-nums">
                      {n(x.totals.single)} đơn · {n(x.totals.double)} đôi
                    </p>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-[#E5E7EB] text-center">
                    <p className="text-[10px] text-[#6B7280] font-medium">Giờ chạy {m.short}</p>
                    <div className="mt-0.5 font-numeric font-bold tabular-nums text-[#20242B] text-sm">{hhmm(x.runMinutes)}</div>
                    <p className="text-[9.5px] text-[#6B7280] tabular-nums">
                      {x.schedule?.openTime ? `${x.schedule.openTime}–${x.schedule.closeTime || '…'}` : 'Chưa nhập'}
                      {x.schedule?.pausedMinutes ? ` · dừng ${x.schedule.pausedMinutes}p` : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="lg:col-span-1 bg-white p-4 rounded-xl border border-[#E5E7EB] flex flex-col items-center justify-center text-center">
            <span className="text-xs font-semibold text-[#6B7280]">TB chuyến giờ cao điểm:</span>
            <div className="mt-1 font-extrabold tabular-nums text-2xl text-[#20242B]">{n(metrics.peakAvgRides)}</div>
            <span className="text-[10px] text-[#6B7280] mt-0.5">chuyến / giờ (11h-15h)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaForm({
  date,
  meta,
  totalPassengers,
  onDone,
}: {
  date: string;
  meta: DayMeta;
  totalPassengers: number;
  onDone: () => void;
}) {
  const actor = useActor();
  const [draft, setDraft] = useState<DayMeta>(meta);
  const [busy, setBusy] = useState(false);

  const autoFreeGate = computeFreeGate(totalPassengers, draft.paidGateVisitors);

  async function save() {
    setBusy(true);
    try {
      await saveMeta(date, { ...draft, freeGateVisitors: autoFreeGate }, actor);
      toast.success('Đã lưu thông số đối soát.');
      onDone();
    } catch (e) {
      toast.error(`Không lưu được: ${writeErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-no-capture className="bg-[#FAFAFA] border border-[#EAECEF] rounded-xl p-3 space-y-3">
      <p className="text-xs font-bold text-slate-700">Cập nhật số liệu đối soát &amp; doanh thu:</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {(Object.keys(META_LABEL) as (keyof DayMeta)[]).map((k) => {
          if (k === 'freeGateVisitors') {
            return (
              <label key={k} className="block">
                <span className="text-[11px] font-semibold text-slate-600 flex items-center justify-between">
                  <span>{META_LABEL[k]}:</span>
                  <span className="text-[9.5px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    Tự động
                  </span>
                </span>
                <input
                  type="text"
                  readOnly
                  value={fmt.format(autoFreeGate)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 font-bold tabular-nums text-slate-700 cursor-not-allowed outline-none select-none"
                  title="Khách miễn phí = Khách chơi máng - Cổng tính phí"
                />
                <span className="text-[10px] text-slate-400 mt-1 block leading-tight">
                  = Khách chơi máng ({fmt.format(totalPassengers)}) − Cổng tính phí ({fmt.format(draft.paidGateVisitors)})
                </span>
              </label>
            );
          }
          return (
            <label key={k} className="block">
              <span className="text-[11px] font-semibold text-slate-600">{META_LABEL[k]}:</span>
              <input
                type="text"
                inputMode="numeric"
                value={draft[k] ? fmt.format(draft[k]) : ''}
                placeholder="0"
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '');
                  setDraft((d) => ({ ...d, [k]: digits ? Math.min(Number(digits), 99_999_999_999) : 0 }));
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-bold tabular-nums outline-none focus:border-slate-900"
              />
            </label>
          );
        })}
      </div>
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 text-white px-3.5 py-2 text-xs font-bold disabled:opacity-50"
      >
        {busy && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />} Lưu thông số
      </button>
    </div>
  );
}
