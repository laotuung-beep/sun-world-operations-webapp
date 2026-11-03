import { useEffect, useRef, useState } from 'react';
import { CircleCheck, CirclePause, Clock, DoorClosed, DoorOpen, LoaderCircle, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { mangById, type MangId } from '../../config';
import { useActor } from '../../auth/AuthProvider';
import { clockVN, hhmmToMinutes } from '../../time';
import { normalizeHHMM, runMinutes } from '../../entries/model';
import { saveSchedule, useSchedule, writeErrorMessage, type Schedule } from '../../entries/api';

/** "Thời gian vận hành" như app cũ: gõ giờ mở / đóng, ±15 phút dừng; tự lưu, không cần bấm nút. */
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
  const [open, setOpen] = useState(saved.openTime);
  const [close, setClose] = useState(saved.closeTime);
  const [paused, setPaused] = useState(saved.pausedMinutes);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Máy khác cập nhật: lấy số mới (khi mình không đang gõ dở).
  useEffect(() => {
    if (timer.current) return;
    setOpen(saved.openTime);
    setClose(saved.closeTime);
    setPaused(saved.pausedMinutes);
  }, [saved.openTime, saved.closeTime, saved.pausedMinutes]);

  function persist(next: { openTime: string; closeTime: string; pausedMinutes: number }) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      timer.current = null;
      if (next.openTime === saved.openTime && next.closeTime === saved.closeTime && next.pausedMinutes === saved.pausedMinutes) return;
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
        if (navigator.onLine) await pending;
        else pending.catch((e) => toast.error(`Giờ chạy bị từ chối: ${writeErrorMessage(e)}`));
      } catch (e) {
        toast.error(`Không lưu được giờ chạy: ${writeErrorMessage(e)}`);
      } finally {
        setSaving(false);
      }
    }, 700);
  }

  function commitTime(which: 'open' | 'close', raw: string) {
    const v = raw ? normalizeHHMM(raw) : '';
    if (v === null) {
      toast.error('Giờ không hợp lệ. Gõ dạng 08:30 hoặc 0830.');
      which === 'open' ? setOpen(saved.openTime) : setClose(saved.closeTime);
      return;
    }
    const next = { openTime: which === 'open' ? v : open, closeTime: which === 'close' ? v : close, pausedMinutes: paused };
    which === 'open' ? setOpen(v) : setClose(v);
    persist(next);
  }

  function changePaused(v: number) {
    const p = Math.min(720, Math.max(0, v));
    setPaused(p);
    persist({ openTime: open, closeTime: close, pausedMinutes: p });
  }

  const run = runMinutes(normalizeHHMM(open) ?? '', normalizeHHMM(close) ?? '', paused);
  const runText = run === null ? '00:00' : `${String(Math.floor(run / 60)).padStart(2, '0')}:${String(run % 60).padStart(2, '0')}`;
  const inputCls =
    'w-full text-center font-bold text-base bg-white border border-slate-300 focus:border-slate-900 text-slate-900 rounded-lg py-1.5 outline-none shadow-xs tabular-nums disabled:bg-slate-100';

  return (
    <div className="bg-white rounded-xl p-3 sm:p-3.5 shadow-sm border border-slate-200/90 space-y-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Timer className="w-4 h-4 text-slate-800 shrink-0" />
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider truncate">Thời Gian Vận Hành • {mangById(mang).name}</span>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
          <span className="text-[10px] text-slate-500 font-medium tracking-tight bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
            Giờ chạy Máng = Giờ đóng cửa − Giờ mở cửa − Dừng vận hành
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-slate-50/80 border border-slate-200/80 focus-within:border-slate-800 focus-within:bg-white rounded-xl p-2 sm:p-2.5 flex flex-col justify-between">
          <span className="flex items-center gap-1 font-semibold text-slate-700 text-[11px] mb-1">
            <DoorOpen className="w-3.5 h-3.5 text-indigo-500" />
            Giờ Mở Cửa
          </span>
          <input
            type="text"
            inputMode="numeric"
            enterKeyHint="done"
            maxLength={5}
            placeholder="08:30"
            disabled={closed}
            value={open}
            onChange={(e) => setOpen(e.target.value)}
            onBlur={(e) => commitTime('open', e.target.value)}
            aria-label="Giờ mở cửa"
            className={inputCls}
          />
        </div>
        <div className="bg-slate-50/80 border border-slate-200/80 focus-within:border-slate-800 focus-within:bg-white rounded-xl p-2 sm:p-2.5 flex flex-col justify-between">
          <span className="flex items-center gap-1 font-semibold text-slate-700 text-[11px] mb-1">
            <DoorClosed className="w-3.5 h-3.5 text-rose-500" />
            Giờ Đóng Cửa
          </span>
          <input
            type="text"
            inputMode="numeric"
            enterKeyHint="done"
            maxLength={5}
            placeholder="19:00"
            disabled={closed}
            value={close}
            onChange={(e) => setClose(e.target.value)}
            onBlur={(e) => commitTime('close', e.target.value)}
            aria-label="Giờ đóng cửa"
            className={inputCls}
          />
        </div>
        <div className="bg-slate-50/80 border border-slate-200/80 focus-within:border-slate-800 focus-within:bg-white rounded-xl p-2 sm:p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="flex items-center gap-1 font-semibold text-slate-700">
              <CirclePause className="w-3.5 h-3.5 text-amber-500" />
              Dừng Vận Hành
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded border text-slate-500 bg-slate-100 border-slate-200 font-medium">{paused}p</span>
          </div>
          <div className="flex items-center w-full gap-1">
            <button
              type="button"
              disabled={closed || paused <= 0}
              onClick={() => changePaused(paused - 15)}
              className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs active:scale-90 transition-transform disabled:opacity-40 shadow-xs"
              aria-label="Giảm 15 phút dừng"
            >
              −15
            </button>
            <input
              type="text"
              inputMode="numeric"
              disabled={closed}
              value={paused === 0 ? '' : String(paused)}
              placeholder="0"
              onChange={(e) => {
                const d = e.target.value.replace(/\D/g, '');
                changePaused(d ? Number(d) : 0);
              }}
              aria-label="Số phút dừng vận hành"
              className="w-full min-w-0 flex-1 text-center font-bold text-base bg-white border border-slate-300 focus:border-slate-900 text-slate-900 rounded-lg py-1 outline-none shadow-xs tabular-nums disabled:bg-slate-100"
            />
            <button
              type="button"
              disabled={closed}
              onClick={() => changePaused(paused + 15)}
              className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs active:scale-90 transition-transform disabled:opacity-40 shadow-xs"
              aria-label="Tăng 15 phút dừng (mưa / sự cố)"
            >
              +15
            </button>
          </div>
        </div>
        <div className="bg-slate-900 text-white rounded-xl p-2 sm:p-2.5 flex flex-col justify-between shadow-xs border border-slate-800">
          <div className="flex items-center gap-1 text-[11px] mb-1">
            <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="font-semibold text-cyan-300 whitespace-nowrap">Giờ Chạy Máng</span>
          </div>
          <div className="flex-1 flex items-center justify-center py-1">
            <div className="text-xl sm:text-2xl font-bold font-numeric tabular-nums leading-none tracking-tight">{runText}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
