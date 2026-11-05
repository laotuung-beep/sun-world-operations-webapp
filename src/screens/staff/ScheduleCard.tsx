import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  CircleCheck,
  CirclePause,
  Clock,
  CloudFog,
  CloudLightning,
  CloudRain,
  DoorClosed,
  DoorOpen,
  FileText,
  LoaderCircle,
  Plus,
  Save,
  Timer,
  Trash2,
  UserX,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { mangById, type MangId } from '../../config';
import { useActor } from '../../auth/AuthProvider';
import { clockVN, hhmmToMinutes } from '../../time';
import {
  PAUSE_CATEGORIES,
  calcPauseDurationMinutes,
  finalizeSmartTime24h,
  formatSmartTime24h,
  minutesToHHMM,
  normalizeHHMM,
  runMinutes,
  sumPauseRecordsMinutes,
  type PauseCategoryId,
  type PauseRecord,
} from '../../entries/model';
import { saveSchedule, useSchedule, writeErrorMessage, type Schedule } from '../../entries/api';

/**
 * Hệ màu thương hiệu chuẩn của 3 Máng trượt & Quy tắc ánh xạ 6 Line:
 * - Máng 1: Line 1 (Trong) -> Line 1 | Line 2 (Ngoài) -> Line 2. Xanh lá (#009966 / #ecfdf5 / #a7f3d0 / #047857)
 * - Máng 2: Line 1 (Trong) -> Line 3 | Line 2 (Ngoài) -> Line 4. Xanh dương (#0084d1 / #f0f9ff / #bae6fd / #0369a1)
 * - Máng 3: Line 1 (Trong) -> Line 5 | Line 2 (Ngoài) -> Line 6. Đỏ (#e7000b / #fef2f2 / #fecaca / #b91c1c)
 */
export interface MangBrandPalette {
  primary: string;
  lightBg: string;
  border: string;
  accentText: string;
  lineMapping: string;
}

export const MANG_BRAND_PALETTE: Record<MangId, MangBrandPalette> = {
  1: {
    primary: '#009966',
    lightBg: '#ecfdf5',
    border: '#a7f3d0',
    accentText: '#047857',
    lineMapping: 'Line 1 (Trong) → Line 1 · Line 2 (Ngoài) → Line 2',
  },
  2: {
    primary: '#0084d1',
    lightBg: '#f0f9ff',
    border: '#bae6fd',
    accentText: '#0369a1',
    lineMapping: 'Line 1 (Trong) → Line 3 · Line 2 (Ngoài) → Line 4',
  },
  3: {
    primary: '#e7000b',
    lightBg: '#fef2f2',
    border: '#fecaca',
    accentText: '#b91c1c',
    lineMapping: 'Line 1 (Trong) → Line 5 · Line 2 (Ngoài) → Line 6',
  },
};

const CATEGORY_META: Record<
  PauseCategoryId,
  { icon: LucideIcon; iconBg: string; iconColor: string }
> = {
  technical: {
    icon: Wrench,
    iconBg: '#fef3c7',
    iconColor: '#b45309',
  },
  customer: {
    icon: UserX,
    iconBg: '#fce7f3',
    iconColor: '#be185d',
  },
  lightning: {
    icon: CloudLightning,
    iconBg: '#ede9fe',
    iconColor: '#6d28d9',
  },
  fog: {
    icon: CloudFog,
    iconBg: '#f1f5f9',
    iconColor: '#475569',
  },
  rain: {
    icon: CloudRain,
    iconBg: '#e0f2fe',
    iconColor: '#0369a1',
  },
};

interface CategoryDraft {
  startTime: string;
  endTime: string;
  note: string;
}

const EMPTY_DRAFTS: Record<PauseCategoryId, CategoryDraft> = {
  technical: { startTime: '', endTime: '', note: '' },
  customer: { startTime: '', endTime: '', note: '' },
  lightning: { startTime: '', endTime: '', note: '' },
  fog: { startTime: '', endTime: '', note: '' },
  rain: { startTime: '', endTime: '', note: '' },
};

/** Khung "Thời gian vận hành" & Module "Dừng Vận Hành" chuẩn hệ 24h (HH:mm). */
export function ScheduleCard({ date, mang, closed }: { date: string; mang: MangId; closed: boolean }) {
  const saved = useSchedule(date, mang);
  if (!saved) {
    return (
      <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-sm grid place-items-center text-slate-400 h-28">
        <LoaderCircle className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  return <ScheduleForm key={`${date}:${mang}`} date={date} mang={mang} closed={closed} saved={saved} />;
}

function ScheduleForm({ date, mang, closed, saved }: { date: string; mang: MangId; closed: boolean; saved: Schedule }) {
  const actor = useActor();
  const palette = MANG_BRAND_PALETTE[mang];
  const dialogTitleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [open, setOpen] = useState(saved.openTime === '00:00' && !saved.closeTime ? '' : saved.openTime);
  const [close, setClose] = useState(saved.closeTime === '00:00' && !saved.openTime ? '' : saved.closeTime);
  const [pauseLogs, setPauseLogs] = useState<PauseRecord[]>(() => saved.pauseLogs ?? []);
  const [paused, setPaused] = useState<number>(() => {
    const logs = saved.pauseLogs ?? [];
    return logs.length > 0 ? sumPauseRecordsMinutes(logs) : saved.pausedMinutes;
  });

  const [saving, setSaving] = useState(false);
  const [showDailyLog, setShowDailyLog] = useState(false);
  const modalOpenRef = useRef(false);

  // State bên trong Modal "DỪNG VẬN HÀNH"
  const [modalLogs, setModalLogs] = useState<PauseRecord[]>([]);
  const [expandedCat, setExpandedCat] = useState<PauseCategoryId | null>(null);
  const [drafts, setDrafts] = useState<Record<PauseCategoryId, CategoryDraft>>(EMPTY_DRAFTS);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDailyDeleteId, setConfirmDailyDeleteId] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Đồng bộ từ Cloud khi máy khác cập nhật
  useEffect(() => {
    if (timer.current || modalOpenRef.current) return;
    setOpen(saved.openTime);
    setClose(saved.closeTime);
    const nextLogs = saved.pauseLogs ?? [];
    setPauseLogs(nextLogs);
    setPaused(nextLogs.length > 0 ? sumPauseRecordsMinutes(nextLogs) : saved.pausedMinutes);
  }, [saved.openTime, saved.closeTime, saved.pausedMinutes, saved.pauseLogs]);

  function persist(next: { openTime: string; closeTime: string; pausedMinutes: number; pauseLogs: PauseRecord[] }) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      timer.current = null;
      if (next.openTime && next.closeTime) {
        const o = hhmmToMinutes(next.openTime);
        const c = hhmmToMinutes(next.closeTime);
        if ((o > 0 || c > 0) && c <= o) {
          toast.error('Giờ đóng cửa phải sau giờ mở cửa.');
          return;
        }
      }
      setSaving(true);
      try {
        const pending = saveSchedule(date, mang, next, actor.uid, actor.name);
        pending.catch((e) => toast.error(`Giờ chạy bị từ chối: ${writeErrorMessage(e)}`));
        if (navigator.onLine) {
          await Promise.race([pending, new Promise((r) => setTimeout(r, 1200))]);
        }
      } catch (e) {
        toast.error(`Không lưu được giờ chạy: ${writeErrorMessage(e)}`);
      } finally {
        setSaving(false);
      }
    }, 500);
  }

  function handleTimeChange(which: 'open' | 'close', rawValue: string) {
    const formatted = formatSmartTime24h(rawValue);
    if (which === 'open') {
      setOpen(formatted);
      if (formatted.length === 5) {
        persist({ openTime: formatted, closeTime: close, pausedMinutes: paused, pauseLogs });
      }
    } else {
      setClose(formatted);
      if (formatted.length === 5) {
        persist({ openTime: open, closeTime: formatted, pausedMinutes: paused, pauseLogs });
      }
    }
  }

  function commitTime(which: 'open' | 'close', raw: string) {
    const v = raw.trim() ? finalizeSmartTime24h(raw) : '';
    if (raw.trim() && !normalizeHHMM(v)) {
      toast.error('Giờ không hợp lệ. Gõ 4 chữ số hệ 24h (ví dụ 0830 → 08:30).');
      which === 'open' ? setOpen(saved.openTime) : setClose(saved.closeTime);
      return;
    }
    const nextOpen = which === 'open' ? v : open;
    const nextClose = which === 'close' ? v : close;
    which === 'open' ? setOpen(v) : setClose(v);
    persist({ openTime: nextOpen, closeTime: nextClose, pausedMinutes: paused, pauseLogs });
  }

  function openPauseModal() {
    setModalLogs([...pauseLogs]);
    setDrafts(EMPTY_DRAFTS);
    setConfirmDeleteId(null);
    setExpandedCat(null);
    modalOpenRef.current = true;
    const dlg = dialogRef.current;
    if (dlg && !dlg.open) {
      dlg.showModal();
    }
  }

  function closePauseModal() {
    const dlg = dialogRef.current;
    if (dlg && dlg.open) {
      dlg.close();
    }
    modalOpenRef.current = false;
    setConfirmDeleteId(null);
  }

  function updateCategoryDraft(cat: PauseCategoryId, patch: Partial<CategoryDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [cat]: { ...prev[cat], ...patch },
    }));
  }

  function addPauseRecordForCategory(cat: PauseCategoryId): boolean {
    const d = drafts[cat];
    const s = finalizeSmartTime24h(d.startTime);
    const e = finalizeSmartTime24h(d.endTime);
    if (!s || !e) {
      toast.error('Vui lòng nhập đầy đủ Thời gian bắt đầu và Thời gian kết thúc (ví dụ: 1040 và 1055).');
      return false;
    }
    const dur = calcPauseDurationMinutes(s, e);
    if (dur === null || dur <= 0) {
      toast.error('Thời gian kết thúc phải lớn hơn Thời gian bắt đầu.');
      return false;
    }
    const record: PauseRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      category: cat,
      startTime: s,
      endTime: e,
      durationMinutes: dur,
      note: d.note.trim(),
      createdAt: Date.now(),
      createdByName: actor.name,
    };
    setModalLogs((prev) => [...prev, record]);
    updateCategoryDraft(cat, { startTime: '', endTime: '', note: '' });
    return true;
  }

  function handleDeleteModalRecord(id: string) {
    setModalLogs((prev) => prev.filter((r) => r.id !== id));
    setConfirmDeleteId(null);
  }

  async function handleSaveAndSyncModal() {
    if (closed) {
      closePauseModal();
      return;
    }
    // Kiểm tra các ô đang nhập dở trong bất kỳ danh mục nào
    const nextLogs = [...modalLogs];
    for (const cat of PAUSE_CATEGORIES) {
      const d = drafts[cat.id];
      const hasStart = d.startTime.trim().length > 0;
      const hasEnd = d.endTime.trim().length > 0;
      if (hasStart || hasEnd) {
        const s = finalizeSmartTime24h(d.startTime);
        const e = finalizeSmartTime24h(d.endTime);
        const dur = calcPauseDurationMinutes(s, e);
        if (!s || !e || dur === null || dur <= 0) {
          toast.error(`Mục "${cat.label}": Thời gian kết thúc phải sau Thời gian bắt đầu (hệ 24h HH:mm).`);
          setExpandedCat(cat.id);
          return;
        }
        nextLogs.push({
          id: `${Date.now()}-${cat.id}-${Math.random().toString(36).slice(2, 6)}`,
          category: cat.id,
          startTime: s,
          endTime: e,
          durationMinutes: dur,
          note: d.note.trim(),
          createdAt: Date.now(),
          createdByName: actor.name,
        });
      }
    }

    const totalPausedMin = Math.min(720, sumPauseRecordsMinutes(nextLogs));
    setPauseLogs(nextLogs);
    setPaused(totalPausedMin);
    setDrafts(EMPTY_DRAFTS);
    closePauseModal();
    toast.success(`Đã lưu & đồng bộ dừng vận hành (${minutesToHHMM(totalPausedMin)})`);

    setSaving(true);
    try {
      const pending = saveSchedule(
        date,
        mang,
        {
          openTime: open,
          closeTime: close,
          pausedMinutes: totalPausedMin,
          pauseLogs: nextLogs,
        },
        actor.uid,
        actor.name,
      );
      if (navigator.onLine) {
        await Promise.race([pending, new Promise((r) => setTimeout(r, 2500))]);
      } else {
        pending.catch((e) => toast.error(`Không lưu được dừng vận hành: ${writeErrorMessage(e)}`));
      }
    } catch (e) {
      toast.error(`Không lưu được dừng vận hành: ${writeErrorMessage(e)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDailyRecord(id: string) {
    if (closed) return;
    const nextLogs = pauseLogs.filter((r) => r.id !== id);
    const totalPausedMin = Math.min(720, sumPauseRecordsMinutes(nextLogs));
    setPauseLogs(nextLogs);
    setPaused(totalPausedMin);
    setConfirmDailyDeleteId(null);
    setSaving(true);
    try {
      await saveSchedule(
        date,
        mang,
        {
          openTime: open,
          closeTime: close,
          pausedMinutes: totalPausedMin,
          pauseLogs: nextLogs,
        },
        actor.uid,
        actor.name,
      );
      toast.success('Đã xóa phiếu dừng vận hành.');
    } catch (e) {
      toast.error(`Không xóa được: ${writeErrorMessage(e)}`);
    } finally {
      setSaving(false);
    }
  }

  // Tính toán thời gian hiển thị chuẩn hệ 24h (HH:mm)
  const totalPausedMinutes = pauseLogs.length > 0 ? sumPauseRecordsMinutes(pauseLogs) : paused;
  const pausedHHMM = minutesToHHMM(totalPausedMinutes);
  const run = runMinutes(normalizeHHMM(open) ?? '', normalizeHHMM(close) ?? '', totalPausedMinutes);
  const runHHMM = run === null ? '00:00' : minutesToHHMM(run);

  // Tổng thời gian theo từng danh mục bên ngoài màn hình chính
  const summaryByCategory = useMemo(() => {
    const map: Record<PauseCategoryId, { minutes: number; count: number }> = {
      technical: { minutes: 0, count: 0 },
      customer: { minutes: 0, count: 0 },
      lightning: { minutes: 0, count: 0 },
      fog: { minutes: 0, count: 0 },
      rain: { minutes: 0, count: 0 },
    };
    for (const r of pauseLogs) {
      if (map[r.category]) {
        map[r.category].minutes += r.durationMinutes;
        map[r.category].count += 1;
      }
    }
    return map;
  }, [pauseLogs]);

  // Tổng thời gian tạm tính trong Modal (gồm cả các lượt đã thêm trong Modal)
  const modalTotalMinutes = useMemo(() => sumPauseRecordsMinutes(modalLogs), [modalLogs]);

  const timeInputCls =
    'w-full h-10 text-center font-semibold text-base bg-white border border-slate-300 focus:border-slate-900 text-slate-900 placeholder:text-slate-400 rounded-lg px-2 outline-none shadow-2xs tabular-nums disabled:bg-slate-100 transition-colors';

  return (
    <section aria-label="Thời gian vận hành" className="space-y-2.5">
      {/* KHUNG "THỜI GIAN VẬN HÀNH" BÊN NGOÀI MÀN HÌNH CHÍNH (LƯỚI 2x2 ĐỐI XỨNG) */}
      <div
        className="bg-white rounded-xl p-3 sm:p-3.5 shadow-sm border space-y-2.5 transition-colors"
        style={{ borderColor: palette.border }}
      >
        {/* Header Khung Thời Gian Vận Hành */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: palette.lightBg, border: `1px solid ${palette.border}` }}
            >
              <Timer className="w-3.5 h-3.5" style={{ color: palette.primary }} />
            </div>
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider truncate">
              Thời Gian Vận Hành • {mangById(mang).name}
            </span>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-md border"
              style={{
                backgroundColor: palette.lightBg,
                borderColor: palette.border,
                color: palette.accentText,
              }}
            >
              {palette.lineMapping}
            </span>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
            <span className="text-[10px] text-slate-500 font-medium tracking-tight bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
              Giờ chạy Máng = Giờ đóng cửa – Giờ mở cửa – Dừng vận hành
            </span>
            <span className="text-[10px] text-slate-400 flex items-center gap-1 shrink-0">
              {saving ? (
                <>
                  <LoaderCircle className="w-3 h-3 animate-spin" /> Đang lưu
                </>
              ) : saved.updatedByName && saved.updatedAt ? (
                <>
                  <CircleCheck className="w-3 h-3 text-emerald-500" /> {clockVN(saved.updatedAt)} · {saved.updatedByName}
                </>
              ) : null}
            </span>
          </div>
        </div>

        {/* LƯỚI 2x2 ĐỐI XỨNG CÂN ĐỐI CHIỀU CAO */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {/* Ô 1: Giờ Mở Cửa */}
          <div className="bg-slate-50/80 border border-slate-200/90 focus-within:border-slate-800 focus-within:bg-white rounded-xl p-2.5 flex flex-col justify-between min-h-[82px]">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                <DoorOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>Giờ Mở Cửa</span>
              </span>
              <span className="text-[10px] font-semibold text-slate-400 tabular-nums">24h</span>
            </div>
            <input
              type="text"
              inputMode="numeric"
              enterKeyHint="done"
              maxLength={5}
              placeholder="--:--"
              disabled={closed}
              value={open}
              onChange={(e) => handleTimeChange('open', e.target.value)}
              onBlur={(e) => commitTime('open', e.target.value)}
              aria-label="Giờ mở cửa"
              className={timeInputCls}
            />
          </div>

          {/* Ô 2: Giờ Đóng Cửa */}
          <div className="bg-slate-50/80 border border-slate-200/90 focus-within:border-slate-800 focus-within:bg-white rounded-xl p-2.5 flex flex-col justify-between min-h-[82px]">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                <DoorClosed className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>Giờ Đóng Cửa</span>
              </span>
              <span className="text-[10px] font-semibold text-slate-400 tabular-nums">24h</span>
            </div>
            <input
              type="text"
              inputMode="numeric"
              enterKeyHint="done"
              maxLength={5}
              placeholder="--:--"
              disabled={closed}
              value={close}
              onChange={(e) => handleTimeChange('close', e.target.value)}
              onBlur={(e) => commitTime('close', e.target.value)}
              aria-label="Giờ đóng cửa"
              className={timeInputCls}
            />
          </div>

          {/* Ô 3: Dừng Vận Hành (Không có nút -15/+15, click mở trực tiếp Modal Chi Tiết Dừng Vận Hành) */}
          <button
            type="button"
            onClick={openPauseModal}
            aria-label="Mở bảng Chi Tiết Dừng Vận Hành"
            className="text-left rounded-xl p-2.5 flex flex-col justify-between min-h-[82px] border outline-none focus-visible:ring-2 focus-visible:ring-slate-300 transition-all active:scale-[0.99] cursor-pointer group"
            style={{
              backgroundColor: totalPausedMinutes > 0 ? palette.lightBg : 'rgba(248, 250, 252, 0.8)',
              borderColor: totalPausedMinutes > 0 ? palette.border : 'rgba(226, 232, 240, 0.9)',
            }}
          >
            <div className="flex items-center justify-between gap-1 text-[11px] mb-1.5 w-full">
              <span className="flex items-center gap-1.5 font-semibold text-slate-700 min-w-0">
                <CirclePause className="w-3.5 h-3.5 shrink-0" style={{ color: palette.primary }} />
                <span className="truncate">Dừng Vận Hành</span>
              </span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded border font-semibold tabular-nums shrink-0"
                style={{
                  backgroundColor: totalPausedMinutes > 0 ? '#ffffff' : '#f1f5f9',
                  borderColor: totalPausedMinutes > 0 ? palette.border : '#e2e8f0',
                  color: totalPausedMinutes > 0 ? palette.accentText : '#64748b',
                }}
              >
                {pauseLogs.length} lần
              </span>
            </div>
            <div
              className="w-full h-10 rounded-lg bg-white border flex items-center justify-center shadow-2xs group-hover:border-slate-400 transition-colors"
              style={{
                borderColor: totalPausedMinutes > 0 ? palette.border : '#cbd5e1',
              }}
            >
              <span
                className="text-base font-semibold tabular-nums tracking-tight"
                style={{ color: totalPausedMinutes > 0 ? palette.accentText : '#0f172a' }}
              >
                {pausedHHMM}
              </span>
            </div>
          </button>

          {/* Ô 4: Giờ Chạy Máng (Nền tối #0f172b, tiêu đề Cyan #06b6d4) */}
          <div
            className="rounded-xl p-2.5 flex flex-col justify-between min-h-[82px] shadow-xs border border-slate-800"
            style={{ backgroundColor: '#0f172b' }}
          >
            <div className="flex items-center justify-between gap-1 text-[11px] mb-1.5">
              <span className="flex items-center gap-1.5 font-semibold whitespace-nowrap" style={{ color: '#06b6d4' }}>
                <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: '#06b6d4' }} />
                <span>Giờ Chạy Máng</span>
              </span>
            </div>
            <div className="w-full h-10 rounded-lg bg-slate-900/70 border border-slate-800 flex items-center justify-center">
              <span className="text-lg sm:text-xl font-semibold text-white tabular-nums leading-none tracking-tight">
                {runHHMM}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* MỤC "NHẬT KÝ PHIẾU DỪNG VẬN HÀNH TRONG NGÀY" (MẶC ĐỊNH ẨN / THU GỌN) */}
      <div
        className="bg-white rounded-xl border shadow-2xs overflow-hidden transition-colors"
        style={{ borderColor: palette.border }}
      >
        <button
          type="button"
          onClick={() => setShowDailyLog((v) => !v)}
          aria-expanded={showDailyLog}
          className="w-full px-3 sm:px-3.5 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/80 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: palette.lightBg, border: `1px solid ${palette.border}` }}
            >
              <FileText className="w-3.5 h-3.5" style={{ color: palette.primary }} />
            </span>
            <span className="text-xs font-semibold text-slate-800 truncate">
              Nhật Ký Phiếu Dừng Vận Hành Trong Ngày
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-md border"
              style={{
                backgroundColor: palette.lightBg,
                borderColor: palette.border,
                color: palette.accentText,
              }}
            >
              {pauseLogs.length} phiếu · {pausedHHMM}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                showDailyLog ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {/* Phần thân Nhật ký: Mặc định ẩn hoàn toàn khi chưa mở */}
        <div
          style={
            showDailyLog
              ? undefined
              : { display: 'none', maxHeight: 0, padding: 0, border: 0 }
          }
          className={showDailyLog ? 'px-3 sm:px-3.5 pb-3 pt-2 border-t border-slate-100 space-y-3' : ''}
        >
          {/* 5 thẻ tổng hợp nhanh theo từng loại sự cố (kiểu HH:mm) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {PAUSE_CATEGORIES.map((cat) => {
              const meta = CATEGORY_META[cat.id];
              const Icon = meta.icon;
              const stat = summaryByCategory[cat.id];
              const hasTime = stat.minutes > 0;
              return (
                <div
                  key={cat.id}
                  className="rounded-xl p-2.5 border flex flex-col justify-between gap-1.5 transition-colors"
                  style={{
                    backgroundColor: hasTime ? palette.lightBg : '#f8fafc',
                    borderColor: hasTime ? palette.border : '#e2e8f0',
                  }}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: meta.iconBg, color: meta.iconColor }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-[11px] font-semibold text-slate-700 truncate">
                      {cat.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[10px] font-medium text-slate-500 tabular-nums">
                      {stat.count} lượt
                    </span>
                    <span
                      className="text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded border"
                      style={{
                        backgroundColor: '#ffffff',
                        borderColor: hasTime ? palette.border : '#e2e8f0',
                        color: hasTime ? palette.accentText : '#475569',
                      }}
                    >
                      {minutesToHHMM(stat.minutes)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Danh sách các phiếu dừng chi tiết trong ngày */}
          {pauseLogs.length === 0 ? (
            <div className="text-center py-4 bg-slate-50/70 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
              Chưa có phiếu dừng vận hành nào trong ngày cho {mangById(mang).name}.
            </div>
          ) : (
            <div className="space-y-1.5">
              {pauseLogs.map((rec, idx) => {
                const catDef = PAUSE_CATEGORIES.find((c) => c.id === rec.category) ?? PAUSE_CATEGORIES[0]!;
                const meta = CATEGORY_META[rec.category] ?? CATEGORY_META.technical;
                const Icon = meta.icon;
                const isConfirming = confirmDailyDeleteId === rec.id;
                return (
                  <div
                    key={rec.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: meta.iconBg, color: meta.iconColor }}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <span
                        className="font-semibold px-1.5 py-0.5 rounded text-[11px] border tabular-nums"
                        style={{
                          backgroundColor: palette.lightBg,
                          borderColor: palette.border,
                          color: palette.accentText,
                        }}
                      >
                        #{idx + 1}
                      </span>
                      <span className="font-semibold text-slate-800">{catDef.label}</span>
                      <span className="font-semibold text-slate-700 tabular-nums bg-white px-2 py-0.5 rounded border border-slate-200">
                        {rec.startTime} – {rec.endTime} | {minutesToHHMM(rec.durationMinutes)}
                      </span>
                      {rec.note && (
                        <span className="text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 truncate max-w-xs">
                          {rec.note}
                        </span>
                      )}
                    </div>

                    {!closed && (
                      <div className="flex items-center justify-end gap-1.5 shrink-0">
                        {isConfirming ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDeleteDailyRecord(rec.id)}
                              className="px-2 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold transition cursor-pointer"
                            >
                              Xác nhận xóa
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDailyDeleteId(null)}
                              className="px-2 py-1 rounded-lg bg-white border border-slate-300 text-slate-600 text-[11px] font-semibold transition cursor-pointer"
                            >
                              Hủy
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDailyDeleteId(rec.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                            title="Xóa phiếu dừng này"
                            aria-label="Xóa phiếu dừng"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* BẢNG MODAL "DỪNG VẬN HÀNH" (5 DANH MỤC SỰ CỐ) */}
      <dialog
        ref={dialogRef}
        aria-labelledby={dialogTitleId}
        onClose={() => {
          modalOpenRef.current = false;
        }}
        onClick={(e) => {
          // Đóng khi click ra vùng backdrop ngoài hộp thoại
          const dlg = dialogRef.current;
          if (!dlg) return;
          const r = dlg.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
            closePauseModal();
          }
        }}
        className="m-auto w-[calc(100%-1.25rem)] max-w-lg rounded-2xl bg-white p-0 text-slate-900 shadow-2xl border overflow-hidden"
        style={{ borderColor: palette.border }}
      >
        <div className="flex flex-col max-h-[88dvh]">
          {/* Header Modal */}
          <div
            className="px-4 py-3.5 border-b flex items-center justify-between gap-2 shrink-0"
            style={{ backgroundColor: palette.lightBg, borderColor: palette.border }}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3
                  id={dialogTitleId}
                  className="text-sm sm:text-base font-bold uppercase tracking-wide text-slate-900"
                >
                  Dừng Vận Hành • {mangById(mang).name}
                </h3>
                <span
                  className="text-xs font-semibold tabular-nums px-2 py-0.5 rounded-md border bg-white"
                  style={{ borderColor: palette.border, color: palette.accentText }}
                >
                  Tổng: {minutesToHHMM(modalTotalMinutes)}
                </span>
              </div>
              <p className="text-[11px] font-medium mt-0.5" style={{ color: palette.accentText }}>
                {palette.lineMapping}
              </p>
            </div>
            <button
              type="button"
              onClick={closePauseModal}
              aria-label="Đóng bảng Dừng Vận Hành"
              className="w-8 h-8 rounded-lg bg-white/90 hover:bg-white border flex items-center justify-center text-slate-600 hover:text-slate-900 transition shrink-0 cursor-pointer"
              style={{ borderColor: palette.border }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Danh sách 5 danh mục sự cố (Accordion) */}
          <div className="p-3.5 sm:p-4 space-y-2.5 overflow-y-auto flex-1">
            {PAUSE_CATEGORIES.map((cat) => {
              const meta = CATEGORY_META[cat.id];
              const Icon = meta.icon;
              const isExpanded = expandedCat === cat.id;
              const catLogs = modalLogs.filter((r) => r.category === cat.id);
              const catMinutes = sumPauseRecordsMinutes(catLogs);
              const catHHMM = minutesToHHMM(catMinutes);
              const draft = drafts[cat.id];
              const draftDuration = calcPauseDurationMinutes(draft.startTime, draft.endTime);

              return (
                <div
                  key={cat.id}
                  className="rounded-xl border bg-white overflow-hidden transition-colors"
                  style={{
                    borderColor: isExpanded || catMinutes > 0 ? palette.border : '#e2e8f0',
                  }}
                >
                  {/* Khung tiêu đề cố định 56px (h-14), flex items-center justify-between */}
                  <button
                    type="button"
                    onClick={() => setExpandedCat((prev) => (prev === cat.id ? null : cat.id))}
                    aria-expanded={isExpanded}
                    className="w-full h-14 px-3.5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/80 transition-colors cursor-pointer select-none"
                    style={{
                      backgroundColor: isExpanded ? palette.lightBg : '#ffffff',
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: meta.iconBg, color: meta.iconColor }}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 text-left">
                        <span className="text-sm font-semibold text-slate-900 block truncate">
                          {cat.label}
                        </span>
                        {catLogs.length > 0 && (
                          <span
                            className="text-[10px] font-semibold tabular-nums block"
                            style={{ color: palette.accentText }}
                          >
                            {catLogs.length} lượt dừng trong ngày
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="text-xs font-semibold tabular-nums px-2.5 py-1 rounded-lg border"
                        style={{
                          backgroundColor: catMinutes > 0 ? palette.lightBg : '#f8fafc',
                          borderColor: catMinutes > 0 ? palette.border : '#e2e8f0',
                          color: catMinutes > 0 ? palette.accentText : '#475569',
                        }}
                      >
                        {catHHMM}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {/* Phần thân (Accordion Body): Khi đóng ẩn hoàn toàn (display: none; max-height: 0; padding: 0; border: 0) */}
                  <div
                    style={
                      isExpanded
                        ? { borderTop: `1px solid ${palette.border}` }
                        : { display: 'none', maxHeight: 0, padding: 0, border: 0 }
                    }
                    className={isExpanded ? 'p-3.5 space-y-3 bg-white' : ''}
                  >
                    {/* Lịch sử các lượt dừng của mục này (ví dụ: #1 10:40 – 10:55 | 00:15) */}
                    {catLogs.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-slate-600 block">
                          Lịch sử lượt dừng ({cat.label}):
                        </span>
                        {catLogs.map((rec, idx) => {
                          const isConfirming = confirmDeleteId === rec.id;
                          return (
                            <div
                              key={rec.id}
                              className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border text-xs"
                              style={{
                                backgroundColor: palette.lightBg,
                                borderColor: palette.border,
                              }}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                <span
                                  className="font-semibold tabular-nums"
                                  style={{ color: palette.accentText }}
                                >
                                  #{idx + 1} {rec.startTime} – {rec.endTime} | {minutesToHHMM(rec.durationMinutes)}
                                </span>
                                {rec.note && (
                                  <span className="text-slate-600 bg-white/90 px-1.5 py-0.5 rounded border border-slate-200 truncate max-w-[180px]">
                                    {rec.note}
                                  </span>
                                )}
                              </div>

                              {!closed && (
                                <div className="flex items-center gap-1 shrink-0">
                                  {isConfirming ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteModalRecord(rec.id)}
                                        className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold cursor-pointer"
                                      >
                                        Xác nhận
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteId(null)}
                                        className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-600 text-[11px] font-semibold cursor-pointer"
                                      >
                                        Hủy
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteId(rec.id)}
                                      className="p-1 rounded hover:bg-red-100 text-slate-500 hover:text-red-600 transition cursor-pointer"
                                      title="Xóa lượt dừng này"
                                      aria-label={`Xóa lượt dừng #${idx + 1}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 2 ô nhập Thời gian bắt đầu & Thời gian kết thúc (placeholder="--:--" ở giữa ô) */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Thời gian bắt đầu
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          enterKeyHint="next"
                          maxLength={5}
                          placeholder="--:--"
                          disabled={closed}
                          value={draft.startTime}
                          onChange={(e) =>
                            updateCategoryDraft(cat.id, {
                              startTime: formatSmartTime24h(e.target.value),
                            })
                          }
                          onBlur={(e) =>
                            updateCategoryDraft(cat.id, {
                              startTime: finalizeSmartTime24h(e.target.value),
                            })
                          }
                          className={timeInputCls}
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Thời gian kết thúc
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          enterKeyHint="done"
                          maxLength={5}
                          placeholder="--:--"
                          disabled={closed}
                          value={draft.endTime}
                          onChange={(e) =>
                            updateCategoryDraft(cat.id, {
                              endTime: formatSmartTime24h(e.target.value),
                            })
                          }
                          onBlur={(e) =>
                            updateCategoryDraft(cat.id, {
                              endTime: finalizeSmartTime24h(e.target.value),
                            })
                          }
                          className={timeInputCls}
                        />
                      </div>
                    </div>

                    {/* Ô Ghi chú sự cố (để trống không có chữ ẩn) & Nút thêm lượt dừng */}
                    <div className="space-y-2">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-slate-700">
                            Ghi chú sự cố
                          </label>
                          {draftDuration !== null && draftDuration > 0 && (
                            <span
                              className="text-[11px] font-semibold tabular-nums"
                              style={{ color: palette.accentText }}
                            >
                              Thời lượng: {minutesToHHMM(draftDuration)}
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          placeholder=""
                          disabled={closed}
                          value={draft.note}
                          onChange={(e) => updateCategoryDraft(cat.id, { note: e.target.value })}
                          aria-label={`Ghi chú sự cố ${cat.label}`}
                          className="w-full h-10 bg-white border border-slate-300 focus:border-slate-900 text-slate-900 text-xs font-medium rounded-lg px-3 outline-none shadow-2xs disabled:bg-slate-100"
                        />
                      </div>

                      {!closed && (
                        <button
                          type="button"
                          onClick={() => addPauseRecordForCategory(cat.id)}
                          className="w-full h-9 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition active:scale-[0.99] cursor-pointer"
                          style={{
                            backgroundColor: palette.lightBg,
                            borderColor: palette.border,
                            color: palette.accentText,
                          }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Thêm lượt dừng ({cat.label})</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Modal: Nút "Lưu & Đồng Bộ" rộng toàn khung theo màu của Máng ở cuối cùng */}
          <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50 shrink-0">
            <button
              type="button"
              disabled={closed}
              onClick={handleSaveAndSyncModal}
              className="w-full h-11 rounded-xl text-white font-semibold text-sm inline-flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: palette.primary }}
            >
              <Save className="w-4 h-4" />
              <span>Lưu &amp; Đồng Bộ</span>
            </button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
