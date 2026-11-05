import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock, Eye, EyeOff, Lock, Save, ShieldAlert, WifiOff } from 'lucide-react';
import NumberFlow from '@number-flow/react';
import { toast } from 'sonner';
import { LINE_LABEL, MANGS, TIME_SLOTS, mangById, slotById, type LineId, type MangId, type SlotId } from '../../config';
import { useAuth } from '../../auth/AuthProvider';
import { isSuperAdminEmail } from '../../auth/access';
import { useNow } from '../../hooks/useNow';
import { useOnline } from '../../hooks/useOnline';
import { dateKeyVN, minutesVN } from '../../time';
import {
  countTotals,
  currentSlotId,
  emptyLines,
  isActive,
  linesTotals,
  validateLines,
  type EntryLines,
  type LineCount,
} from '../../entries/model';
import { saveOrUpdateSlotEntry, useDayClosed, useDayEntries, writeErrorMessage } from '../../entries/api';
import { useSchedules } from '../../report/api';
import { CountStepper } from '../../components/CountStepper';
import { MANG_UI } from '../../components/brand';
import { EntryList } from './EntryList';
import { ScheduleCard } from './ScheduleCard';

/** Tab "Nhập liệu": hiển thị số đã nhập, cho phép hiệu chỉnh và lưu trực tiếp vào Ma Trận Giờ. */
export function StaffEntryScreen({
  date: propDate,
  mang,
  onChangeMang,
  selectedSlotId,
  onSelectSlotId,
}: {
  date?: string;
  mang: MangId;
  onChangeMang: (m: MangId) => void;
  selectedSlotId?: SlotId | null;
  onSelectSlotId?: (s: SlotId) => void;
}) {
  const { user, profile, access } = useAuth();
  const now = useNow();
  const online = useOnline();
  const date = propDate ?? dateKeyVN(now);
  const minutes = minutesVN(now);
  const current = currentSlotId(minutes);
  const m = mangById(mang);
  const ui = MANG_UI[mang];

  const isSuperAdmin = access?.kind === 'superadmin' || isSuperAdminEmail(user?.email);

  const [chosen, setChosen] = useState<SlotId | null>(() => selectedSlotId ?? null);
  const slotId = chosen ?? current;
  const [lines, setLines] = useState<EntryLines>(() => emptyLines(mang));
  const [showAdminEntries, setShowAdminEntries] = useState(false);

  useEffect(() => {
    if (selectedSlotId) setChosen(selectedSlotId);
  }, [selectedSlotId]);

  const closed = useDayClosed(date);
  const canEdit = !closed || isSuperAdmin;

  const { entries: allEntries, error } = useDayEntries(date);
  const schedules = useSchedules(date);
  const entries = useMemo(() => (allEntries ? allEntries.filter((e) => e.mang === mang) : null), [allEntries, mang]);

  // Lọc các phiếu active của khung giờ và máng hiện tại
  const activeEntries = useMemo(() => {
    if (!entries) return [];
    return entries.filter((e) => e.slotId === slotId && isActive(e.status));
  }, [entries, slotId]);

  // Tính số liệu đã nhập sẵn trong hệ thống cho khung giờ này
  const existingLines = useMemo(() => {
    if (!entries) return null;
    const res = emptyLines(mang);
    let hasData = false;
    for (const l of m.lines) {
      let single = 0;
      let double = 0;
      for (const e of activeEntries) {
        if (e.lines && e.lines[l]) {
          single += e.lines[l]?.single || 0;
          double += e.lines[l]?.double || 0;
          hasData = true;
        }
      }
      res[l] = { single, double };
    }
    return hasData ? res : null;
  }, [activeEntries, entries, m.lines, mang]);

  // Tự động tải số đã nhập vào các ô Stepper khi chuyển khung giờ / máng / ngày
  const targetKey = `${date}:${mang}:${slotId}`;
  const loadedKeyRef = useRef<string>('');

  useEffect(() => {
    if (entries === null) return;
    if (loadedKeyRef.current !== targetKey) {
      loadedKeyRef.current = targetKey;
      setLines(existingLines ?? emptyLines(mang));
    }
  }, [entries, existingLines, mang, targetKey]);

  const totals = linesTotals(lines);
    const hasExisting = activeEntries.length > 0;
  const canSave = (totals.rides > 0 || hasExisting) && canEdit;

  // Khung đang chọn luôn nằm trong tầm nhìn của thanh khung giờ.
  const slotBar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = slotBar.current;
    const el = bar?.querySelector<HTMLElement>(`[data-slot="${slotId}"]`);
    if (!bar || !el) return;
    const offset = el.getBoundingClientRect().left - bar.getBoundingClientRect().left;
    bar.scrollTo({ left: bar.scrollLeft + offset - (bar.clientWidth - el.clientWidth) / 2, behavior: 'instant' });
  }, [slotId]);

  function setCount(line: LineId, key: keyof LineCount, value: number) {
    setLines((prev) => ({ ...prev, [line]: { ...prev[line]!, [key]: value } }));
  }

  async function save() {
    if (!user) return;
    if (closed && !isSuperAdmin) {
      toast.error('Ngày đã chốt báo cáo. Chỉ Super Admin mới có thể chỉnh sửa.');
      return;
    }
    const err = validateLines(mang, lines);
    if (err && totals.rides > 0) {
      toast.error(err);
      return;
    }
    const summary = `${m.short} ${slotById(slotId).label}`;
    try {
      const res = await saveOrUpdateSlotEntry({
        date,
        slotId,
        mang,
        lines,
        uid: user.uid,
        name: profile?.displayName || user.displayName || user.email || 'Nhân viên',
        email: user.email ?? '',
        activeEntries,
      });
      if (res.action === 'cleared') {
        toast.success(`Đã xoá số liệu khung ${summary}`);
      } else if (res.action === 'updated') {
        toast.success(`Đã cập nhật ${totals.rides} chuyến cho ${summary}`);
      } else {
        toast.success(`Đã lưu phiếu ${summary}: ${totals.rides} chuyến`);
      }
      // Đồng bộ loadedKeyRef để tiếp tục giữ số vừa lưu
      loadedKeyRef.current = targetKey;
    } catch (e) {
      toast.error(`Không lưu được số liệu ${summary}: ${writeErrorMessage(e)}`);
    }
  }

  // Khách hôm nay của từng máng (phiếu còn hiệu lực) - hiện trên nút chọn máng.
  const mangPassengers = (id: MangId) =>
    (allEntries ?? []).filter((e) => e.mang === id && isActive(e.status)).reduce((acc, e) => acc + linesTotals(e.lines).passengers, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-2.5 pb-16">
      {closed && (
        <div
          className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold ${
            isSuperAdmin
              ? 'bg-amber-950 text-amber-200 border border-amber-800'
              : 'bg-slate-900 text-white'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {isSuperAdmin ? <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" /> : <Lock className="w-4 h-4 shrink-0" />}
            <span>
              {isSuperAdmin
                ? 'Ngày đã chốt báo cáo. Chế độ Super Admin: Bạn có quyền hiệu chỉnh và lưu lại số liệu.'
                : 'Ngày đã chốt báo cáo. Chỉ Super Admin mới có thể chỉnh sửa số liệu.'}
            </span>
          </div>
        </div>
      )}
      {!online && (
        <div className="flex items-center gap-2 rounded-xl bg-orange-50 border border-orange-200 text-orange-800 px-3 py-2.5 text-xs font-semibold">
          <WifiOff className="w-4 h-4 shrink-0" /> Mất mạng. Phiếu vẫn lưu trên máy và tự gửi khi có mạng lại.
        </div>
      )}

      {/* Khung giờ + chọn máng */}
      <div className="bg-white rounded-xl p-2.5 sm:p-3 shadow-sm border border-slate-200/90 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="text-xs font-bold text-slate-800 truncate">
              Khung Giờ: <strong className="font-mono text-slate-900">{slotById(slotId).label.replace(' – ', ' - ')}</strong>
            </span>
            {hasExisting && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Đã có số
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            title="Lưu số liệu khung giờ vào hệ thống"
            className="inline-flex items-center gap-1.5 font-bold active:scale-95 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs min-h-[30px] px-3 py-1 text-[11px] rounded-lg disabled:opacity-40 disabled:bg-slate-300 transition"
          >
            <Save className="w-3.5 h-3.5" /> Lưu phiếu
          </button>
        </div>

        <div ref={slotBar} className="flex gap-1 overflow-x-auto pb-0.5 no-scrollbar scroll-smooth">
          {TIME_SLOTS.map((s) => {
            const active = s.id === slotId;
            return (
              <button
                key={s.id}
                data-slot={s.id}
                type="button"
                onClick={() => {
                  setChosen(s.id);
                  onSelectSlotId?.(s.id);
                }}
                className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] border transition-all active:scale-95 flex items-center gap-1 ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 font-semibold'
                }`}
              >
                {s.peak && <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-rose-500 animate-pulse" />}
                <span>
                  {s.start} - {s.end}
                </span>
              </button>
            );
          })}
        </div>

        <div className="pt-1.5 border-t border-slate-100 grid grid-cols-3 gap-1.5 bg-slate-100/70 p-1 rounded-xl">
          {MANGS.map((x) => {
            const active = x.id === mang;
            const s = schedules[x.id];
            const running = !!s?.openTime && !s.closeTime;
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => onChangeMang(x.id)}
                className={`relative min-h-[46px] py-1.5 px-1 rounded-lg text-center transition-all active:scale-95 ${active ? 'text-white font-bold' : 'text-slate-700 hover:bg-white/60'}`}
              >
                {active && <div className={`absolute inset-0 bg-gradient-to-r ${MANG_UI[x.id].gradient} rounded-lg shadow-sm border border-gold`} />}
                <div className="relative z-10 flex flex-col items-center justify-center w-full min-w-0 py-0.5">
                  <img src={x.badge} alt={x.name} className="h-5 sm:h-[22px] object-contain" />
                  <span className={`text-[10px] sm:text-[11px] block mt-0.5 font-numeric tabular-nums font-semibold whitespace-nowrap ${active ? MANG_UI[x.id].light : 'text-slate-500'}`}>
                    <NumberFlow value={mangPassengers(x.id)} /> khách
                  </span>
                  <span className={`text-[9px] leading-none mt-0.5 font-bold ${active ? 'text-white/80' : running ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {running ? '● Đang chạy' : s?.closeTime ? 'Đã đóng' : 'Chưa mở'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2 line của máng + thời gian vận hành */}
      <div key={`${mang}:${slotId}`} className="animate-coaster-switch space-y-2.5">
        {m.lines.map((line) => {
          const t = countTotals(lines[line]);
          return (
            <div key={line} className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between gap-1">
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-wider shadow-2xs shrink-0 text-white border border-gold ${ui.solid}`}>
                  {LINE_LABEL[line].toUpperCase()}
                </span>
                <div className="flex items-center gap-1 sm:gap-1.5 text-[11px] shrink-0">
                  <span className="px-2 py-0.5 rounded inline-flex items-center gap-1 bg-slate-100 text-slate-600 font-medium">
                    Chuyến: <strong className="text-slate-900 font-bold font-numeric tabular-nums"><NumberFlow value={t.rides} /></strong>
                  </span>
                  <span className="px-2 py-0.5 rounded inline-flex items-center gap-1 bg-slate-100 text-slate-800 font-bold">
                    Khách: <strong className="text-slate-900 font-bold font-numeric tabular-nums"><NumberFlow value={t.passengers} /></strong>
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                {(['single', 'double'] as const).map((k) => (
                  <CountStepper
                    key={k}
                    kind={k}
                    lineLabel={LINE_LABEL[line]}
                    value={lines[line]?.[k] ?? 0}
                    onChange={(v) => setCount(line, k, v)}
                    plusClass={`${ui.solid} ${ui.solidHover}`}
                    ringClass={ui.ring}
                    disabled={!canEdit}
                  />
                ))}
              </div>
            </div>
          );
        })}

        <ScheduleCard date={date} mang={mang} closed={!canEdit} />
      </div>

      {/* Nhật ký phiếu chi tiết: chỉ Admin mới xem được, mặc định ẩn cho thoáng giao diện */}
      {isSuperAdmin && entries !== null && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => setShowAdminEntries((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl transition active:scale-95 shadow-2xs cursor-pointer"
            >
              {showAdminEntries ? <EyeOff className="w-3.5 h-3.5 text-slate-500" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
              <span>{showAdminEntries ? 'Ẩn nhật ký phiếu (Admin)' : 'Xem nhật ký phiếu chi tiết (Chỉ Admin)'}</span>
            </button>
            <span className="text-[10px] text-slate-400">Chỉ Admin mới xem được</span>
          </div>
          {showAdminEntries && (
            <EntryList entries={entries} slotId={slotId} myUid={user?.uid ?? ''} date={date} closed={!canEdit} error={error} />
          )}
        </div>
      )}
    </div>
  );
}
