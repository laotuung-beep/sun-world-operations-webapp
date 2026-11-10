import { useMemo, useRef, useState } from 'react';
import {
  BellRing,
  Download,
  LoaderCircle,
  Lock,
  LockOpen,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { MANGS } from '../../config';
import { useActor, useAuth } from '../../auth/AuthProvider';
import { canManageUsers, canReopenDay } from '../../auth/access';
import { clockVN } from '../../time';
import { useDayEntries, writeErrorMessage } from '../../entries/api';
import { isActive, minutesToHHMM, sumPauseRecordsMinutes } from '../../entries/model';
import {
  buildMatrix,
  matrixTotal,
  reportMetrics,
  resolveFreeGate,
  type DayMeta,
} from '../../report/compute';
import {
  saveMeta,
  setDayClosed,
  syncDayToGoogleDrive,
  useDay,
  useSchedules,
  useSheetsWebhook,
} from '../../report/api';
import { DRIVE_FILE_NAME, DRIVE_FOLDER_URL } from '../../report/driveWorkbook';
import { ReportHeaderCard } from './components/ReportHeaderCard';
import { RevenueHeroCard } from './components/RevenueHeroCard';
import { OperationalKpiCard } from './components/OperationalKpiCard';
import { ReconciliationGrid } from './components/ReconciliationGrid';
import { useGrowthRates } from './components/useGrowthRates';

const fmt = new Intl.NumberFormat('vi-VN');
const n = (v: number) => fmt.format(v);
const hhmm = (min: number | null) =>
  min === null
    ? '00:00'
    : `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/**
 * Tab "Báo Cáo Ca": Executive Dashboard Vận Hành Máng Trượt (Alpine Coaster Sun World Ba Na Hills)
 */
export function ReportScreen({
  date,
  onGoMatrix,
  showMondayExportAlert = false,
  onMondayExportCompleted,
}: {
  date: string;
  onGoMatrix: () => void;
  showMondayExportAlert?: boolean;
  onMondayExportCompleted?: () => void;
}) {
  const { access } = useAuth();
  const actor = useActor();
  const day = useDay(date);
  const schedules = useSchedules(date);
  const webhookUrl = useSheetsWebhook();
  const { entries } = useDayEntries(date);
  const captureRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'close' | 'excel' | 'image' | null>(null);

  const isAdmin = access ? canManageUsers(access) : false;
  const all = entries ?? [];
  const matrix = useMemo(() => buildMatrix(all, (s) => isActive(s)), [all]);
  const rawMeta = day?.meta;
  const totalCoasterPassengers = useMemo(() => matrixTotal(matrix).passengers, [matrix]);

  const meta = useMemo<DayMeta | undefined>(() => {
    if (!rawMeta) return undefined;
    const freeGateVisitors = resolveFreeGate(
      totalCoasterPassengers,
      rawMeta.paidGateVisitors,
      rawMeta.freeGateVisitors,
      date
    );
    return {
      ...rawMeta,
      freeGateVisitors,
    };
  }, [rawMeta, totalCoasterPassengers, date]);

  const metrics = useMemo(
    () => (meta ? reportMetrics(matrix, meta, schedules) : null),
    [matrix, meta, schedules]
  );
  const pendingCount = 0;
  const closed = day?.closed ?? false;
  const [y, mo, d] = date.split('-');

  const displayTotalPassengers =
    (metrics?.total.passengers ?? 0) > 0
      ? metrics!.total.passengers
      : (meta?.paidGateVisitors ?? 0) + (meta?.freeGateVisitors ?? 0) > 0
        ? meta!.paidGateVisitors + meta!.freeGateVisitors
        : 0;

  const displayConversionRate =
    (meta?.cableCarVisitors ?? 0) > 0 ? (displayTotalPassengers / meta!.cableCarVisitors) * 100 : 0;

  const { revenueGrowth, passengersGrowth, conversionGrowth } = useGrowthRates({
    date,
    currentRevenue: meta?.counterRevenue ?? 0,
    currentPassengers: displayTotalPassengers,
    currentConversionRate: displayConversionRate,
  });

  const activeLinesCount = useMemo(() => {
    if (!metrics) return 3;
    const active = metrics.mangs.filter((m) => m.totals.rides > 0 || (m.runMinutes ?? 0) > 0);
    return active.length > 0 ? active.length : 3;
  }, [metrics]);

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
        if (
          !window.confirm(
            `Chốt báo cáo ngày ${d}/${mo}/${y}? Sau khi chốt không gửi / duyệt thêm phiếu được.${warn}`
          )
        )
          return;
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
      const { fetchAllEnteredDays } = await import('../../report/api');
      const livePayload = {
        date,
        matrix,
        totalPassengers: metrics.total.passengers,
        meta,
        schedules,
        closed,
      };
      const allDays = await fetchAllEnteredDays(livePayload);
      await exportExcel({
        date,
        matrix,
        metrics,
        meta,
        schedules,
        entries: all,
        closed,
        allDaysPayloads: allDays,
      });
      void syncDayToGoogleDrive(livePayload, webhookUrl, actor);
      onMondayExportCompleted?.();
      toast.success(`Đã xuất dữ liệu (${DRIVE_FILE_NAME}) về máy.`);
    });

  return (
    <div className="max-w-4xl mx-auto space-y-3.5 pb-16">
      {/* Alert banner Thứ 2 hàng tuần (Admin) */}
      {isAdmin && showMondayExportAlert && (
        <div
          data-no-print
          data-no-capture
          className="rounded-2xl border border-emerald-300 bg-emerald-50/95 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs"
        >
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
              <BellRing className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-emerald-950">
                Thông báo Thứ 2 hàng tuần (Admin): Tải file báo cáo về máy
              </p>
              <p className="text-[11px] font-medium text-emerald-800 mt-0.5 leading-snug">
                Nhấn nút <strong>Xuất Excel</strong> để tải file <strong>{DRIVE_FILE_NAME}</strong> (đồng bộ từ Folder Web App VHMT) về máy lưu trữ định kỳ đầu tuần.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={excel}
            disabled={busy === 'excel'}
            className="h-9 px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 shrink-0 active:scale-[0.98] transition shadow-2xs cursor-pointer"
          >
            {busy === 'excel' ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Tải về máy ngay</span>
          </button>
        </div>
      )}

      {/* Thanh tiện ích quản trị: Chốt ngày, Realtime Drive Sync status, Drive link */}
      <div data-no-print data-no-capture className="flex items-center justify-between gap-2 flex-wrap px-1">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={toggleClose}
            disabled={busy === 'close' || (closed && !canReopenDay(access!))}
            className={`h-9 px-3.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-2xs transition-all ${
              closed ? 'bg-white border border-[#E5E7EB] text-slate-700 hover:bg-[#F5F6F8]' : 'bg-slate-900 text-white hover:bg-black'
            }`}
          >
            {busy === 'close' ? (
              <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
            ) : closed ? (
              <LockOpen className="w-3.5 h-3.5" />
            ) : (
              <Lock className="w-3.5 h-3.5" />
            )}
            {closed ? 'Mở lại ngày' : 'Chốt ngày'}
          </button>
          {day.sheetsSyncedAt && (
            <p className="text-[11px] text-slate-500 font-medium">
              Đã đồng bộ Drive lúc {clockVN(day.sheetsSyncedAt)}.
            </p>
          )}
        </div>
        {isAdmin && (
          <a
            href={DRIVE_FOLDER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-2.5 py-1.5 inline-flex items-center gap-1.5 shadow-2xs transition-colors"
            title="Chỉ lưu trữ duy nhất tại Folder Web App VHMT trên Google Drive"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Google Drive: Web App VHMT (Realtime)</span>
          </a>
        )}
      </div>

      {pendingCount > 0 && (
        <button
          data-no-print
          data-no-capture
          type="button"
          onClick={onGoMatrix}
          className="w-full text-left flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2.5 text-xs font-semibold cursor-pointer"
        >
          <TriangleAlert className="w-4 h-4 shrink-0" /> Còn {pendingCount} phiếu chờ duyệt, chưa tính vào báo cáo. Bấm để sang Ma Trận Giờ duyệt.
        </button>
      )}

      {/* Khối được chụp gửi Viber (Executive Report View) */}
      <div ref={captureRef} className="space-y-3 sm:space-y-3.5">
        {/* TẦNG 0: BÁO CÁO VẬN HÀNH HEADER CARD */}
        <ReportHeaderCard
          date={date}
          onShareReport={image}
          onExportExcel={excel}
          busy={busy}
          showMondayExportAlert={showMondayExportAlert}
        />

        {/* TẦNG 1: DOANH THU PREMIER RED HERO CARD */}
        <RevenueHeroCard revenue={meta.counterRevenue} growth={revenueGrowth} />

        {/* TẦNG 2: CHỈ SỐ VẬN HÀNH (KHÁCH CHƠI MÁNG & TỶ LỆ CHƠI / CÁP) */}
        <OperationalKpiCard
          passengers={displayTotalPassengers}
          passengersGrowth={passengersGrowth}
          activeLinesCount={activeLinesCount}
          conversionRate={displayConversionRate}
          conversionGrowth={conversionGrowth}
          cableCarVisitors={meta.cableCarVisitors}
        />

        {/* TẦNG 3: ĐỐI SOÁT CÁP TREO & CỔNG (LƯỚI 2X2) */}
        <ReconciliationGrid
          date={date}
          meta={meta}
          displayTotalPassengers={displayTotalPassengers}
          closed={closed}
        />
      </div>

      {/* Bảng chi tiết 6 line máng trượt (Bảo toàn không hồi quy) */}
      <div className="space-y-2.5 pt-2">
        <h3 className="text-xs sm:text-sm font-bold text-[#20242B] tracking-wider uppercase px-1">
          Vận hành máng trượt (6 line)
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2.5">
          <div className="lg:col-span-3 space-y-2">
            {metrics.mangs.map((x) => {
              const m = MANGS.find((y) => y.id === x.mang)!;
              return (
                <div
                  key={x.mang}
                  className="grid grid-cols-3 gap-2 bg-[#F5F6F8] p-2 rounded-xl border border-[#E5E7EB]"
                >
                  <div className="bg-white p-2.5 rounded-lg border border-[#E5E7EB] text-center flex flex-col items-center justify-center">
                    <img src={m.badge} alt={m.name} className="h-6 object-contain mb-1" />
                    <div className="font-numeric font-bold tabular-nums text-[#20242B] text-sm">
                      {n(x.totals.rides)} xe
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-[#E5E7EB] text-center">
                    <p className="text-[10px] text-[#6B7280] font-medium">Khách {m.short}</p>
                    <div
                      className="mt-0.5 font-numeric font-bold tabular-nums text-sm"
                      style={{ color: m.id === 3 ? '#D71920' : m.color }}
                    >
                      {n(x.totals.passengers)}
                    </div>
                    <p className="text-[9.5px] text-[#6B7280] tabular-nums">
                      {n(x.totals.single)} đơn · {n(x.totals.double)} đôi
                    </p>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-[#E5E7EB] text-center">
                    <p className="text-[10px] text-[#6B7280] font-medium">Giờ chạy {m.short}</p>
                    <div className="mt-0.5 font-numeric font-bold tabular-nums text-[#20242B] text-sm">
                      {hhmm(x.runMinutes)}
                    </div>
                    {(() => {
                      const pausedVal =
                        x.schedule?.pauseLogs !== undefined
                          ? sumPauseRecordsMinutes(x.schedule.pauseLogs, x.mang)
                          : (x.schedule?.pausedMinutes ?? 0);
                      return (
                        <p className="text-[9.5px] text-[#6B7280] tabular-nums">
                          {x.schedule?.openTime
                            ? `${x.schedule.openTime}–${x.schedule.closeTime || '…'}`
                            : 'Chưa nhập'}
                          {pausedVal > 0 ? ` · dừng ${minutesToHHMM(pausedVal)}` : ''}
                        </p>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="lg:col-span-1 bg-white p-4 rounded-xl border border-[#E5E7EB] flex flex-col items-center justify-center text-center">
            <span className="text-xs font-semibold text-[#6B7280]">TB chuyến giờ cao điểm:</span>
            <div className="mt-1 font-extrabold tabular-nums text-2xl text-[#20242B]">
              {n(metrics.peakAvgRides)}
            </div>
            <span className="text-[10px] text-[#6B7280] mt-0.5">chuyến / giờ (11h-15h)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
