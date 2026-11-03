import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { History, LoaderCircle, Lock, Save, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { LINE_LABEL, mangById, slotById, type LineId, type MangId, type SlotId } from '../../config';
import { useAuth } from '../../auth/AuthProvider';
import { useNow } from '../../hooks/useNow';
import { dateKeyVN, longDateVN, minutesVN } from '../../time';
import {
  countTotals,
  currentSlotId,
  emptyLines,
  linesTotals,
  selectableSlots,
  totalsBySlot,
  validateLines,
  type EntryLines,
  type LineCount,
} from '../../entries/model';
import { sendEntry, useDayClosed, useDayEntries, writeErrorMessage } from '../../entries/api';
import { useSchedules } from '../../report/api';
import { MangOverview } from './MangOverview';
import { CountStepper } from '../../components/CountStepper';
import { EntryList } from './EntryList';
import { ScheduleCard } from './ScheduleCard';

export function StaffEntryScreen({ mang, onChangeMang }: { mang: MangId; onChangeMang: (m: MangId) => void }) {
  const { user, profile } = useAuth();
  const now = useNow();
  const date = dateKeyVN(now);
  const minutes = minutesVN(now);
  const current = currentSlotId(minutes);
  const slots = selectableSlots(minutes);
  const m = mangById(mang);

  const [chosen, setChosen] = useState<SlotId | null>(null);
  const slotId = chosen && slots.some((s) => s.id === chosen) ? chosen : current;
  const [lines, setLines] = useState<EntryLines>(() => emptyLines(mang));
  const [online, setOnline] = useState(() => navigator.onLine);

  const closed = useDayClosed(date);
  const { entries: allEntries, error } = useDayEntries(date);
  const schedules = useSchedules(date);
  const entries = useMemo(() => (allEntries ? allEntries.filter((e) => e.mang === mang) : null), [allEntries, mang]);
  const reported = useMemo(() => totalsBySlot(entries ?? []), [entries]);
  const totals = linesTotals(lines);
  const late = slotId !== current;

  // Sang ngày mới: bỏ phiếu đang nhập dở.
  useEffect(() => {
    setLines(emptyLines(mang));
    setChosen(null);
  }, [date, mang]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  function setCount(line: LineId, key: keyof LineCount, value: number) {
    setLines((prev) => ({ ...prev, [line]: { ...prev[line]!, [key]: value } }));
  }

  function save() {
    if (!user) return;
    if (closed) {
      toast.error('Ngày đã chốt, không gửi thêm phiếu được.');
      return;
    }
    const err = validateLines(mang, lines);
    if (err) {
      toast.error(err);
      return;
    }
    const summary = `${slotById(slotId).label}: ${totals.rides} lượt xe`;
    const { synced } = sendEntry({
      date,
      slotId,
      mang,
      lines,
      uid: user.uid,
      name: profile?.displayName || user.displayName || user.email || 'Nhân viên',
      email: user.email ?? '',
    });
    synced.catch((e) => toast.error(`Phiếu ${summary} bị từ chối: ${writeErrorMessage(e)}`, { duration: 15_000 }));
    toast.success(navigator.onLine ? `Đã lưu phiếu ${summary}` : `Đã lưu trên máy (${summary}). Có mạng sẽ tự gửi.`);
    setLines(emptyLines(mang));
    setChosen(null);
  }

  return (
    <div className="pb-56 md:pb-36">
      <div className="flex items-baseline justify-between gap-2 px-1 mb-2">
        <p className="font-extrabold">{longDateVN(now)}</p>
        <p className="text-xs text-slate-500">Chạm máng để nhập</p>
      </div>
      <MangOverview entries={allEntries ?? []} schedules={schedules} selected={mang} onSelect={onChangeMang} />

      {closed && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-slate-900 text-white px-4 py-3 text-sm font-semibold">
          <Lock className="w-4 h-4 shrink-0" /> Ngày đã chốt báo cáo. Không gửi thêm phiếu được.
        </div>
      )}
      {!online && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm font-semibold">
          <WifiOff className="w-4 h-4 shrink-0" /> Mất mạng. Phiếu vẫn lưu trên máy và tự gửi khi có mạng lại.
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4 min-w-0">
          <SlotPicker
            slots={slots.map((s) => ({ ...s, reported: reported.get(s.id)?.rides ?? 0 }))}
            current={current}
            value={slotId}
            onChange={setChosen}
          />

          {m.lines.map((line) => {
            const t = countTotals(lines[line]);
            return (
              <section key={line} className="bg-white rounded-3xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
                    {LINE_LABEL[line]}
                  </h3>
                  <p className="text-xs text-slate-500 tabular">
                    {t.rides} lượt · {t.passengers} khách
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <CountStepper
                    label="Xe đơn"
                    hint="1 khách"
                    value={lines[line]?.single ?? 0}
                    onChange={(v) => setCount(line, 'single', v)}
                    disabled={!!closed}
                  />
                  <CountStepper
                    label="Xe đôi"
                    hint="2 khách"
                    value={lines[line]?.double ?? 0}
                    onChange={(v) => setCount(line, 'double', v)}
                    disabled={!!closed}
                  />
                </div>
              </section>
            );
          })}
        </div>

        <div className="space-y-4 min-w-0">
          {entries === null ? (
            <div className="grid place-items-center py-10 text-slate-400">
              <LoaderCircle className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <EntryList entries={entries} slotId={slotId} myUid={user?.uid ?? ''} date={date} closed={!!closed} error={error} />
          )}
          <ScheduleCard date={date} mang={mang} closed={!!closed} />
        </div>
      </div>

      <div className="fixed inset-x-0 z-20 bg-white/95 backdrop-blur border-t border-slate-200 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] md:bottom-0">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-bold flex items-center gap-1 ${late ? 'text-amber-600' : 'text-slate-500'}`}>
              {late && <History className="w-3.5 h-3.5" />}
              {late ? 'Báo trễ · ' : 'Khung '}
              {slotById(slotId).label}
            </p>
            <p className="tabular text-lg font-extrabold leading-tight">
              {totals.rides} <span className="text-sm font-semibold text-slate-500">lượt xe ·</span> {totals.passengers}{' '}
              <span className="text-sm font-semibold text-slate-500">khách</span>
            </p>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={totals.rides === 0 || !!closed}
            className="inline-flex items-center gap-2 rounded-2xl bg-brand text-white font-extrabold px-5 py-3.5 shadow-sm active:scale-[0.98] transition disabled:bg-slate-300 disabled:shadow-none"
          >
            <Save className="w-5 h-5" /> Lưu phiếu
          </button>
        </div>
      </div>
    </div>
  );
}

interface SlotChip {
  id: SlotId;
  start: string;
  end: string;
  peak: boolean;
  reported: number;
}

function SlotPicker({
  slots,
  current,
  value,
  onChange,
}: {
  slots: SlotChip[];
  current: SlotId;
  value: SlotId;
  onChange: (id: SlotId) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  // Khung đang chạy luôn nằm cuối danh sách: cuộn sẵn về cuối.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [slots.length]);

  return (
    <section className="bg-white rounded-3xl border border-slate-200 p-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Khung giờ</h3>
      <div ref={scroller} className="mt-2 -mx-1 px-1 flex gap-2 overflow-x-auto pb-1 snap-x">
        {slots.map((s) => {
          const active = s.id === value;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              className={`snap-end shrink-0 rounded-2xl border px-3 py-2 text-left transition ${
                active ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <p className="tabular font-bold text-sm whitespace-nowrap">
                {s.start}–{s.end}
              </p>
              <p className={`text-[11px] whitespace-nowrap ${active ? 'text-white/80' : 'text-slate-400'}`}>
                {s.id === current ? 'Đang chạy · ' : ''}
                {s.reported > 0 ? `đã báo ${s.reported} lượt` : 'chưa báo'}
                {s.peak ? ' · cao điểm' : ''}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
