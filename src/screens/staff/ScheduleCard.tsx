import { useState } from 'react';
import { Clock, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { MangId } from '../../config';
import { useAuth } from '../../auth/AuthProvider';
import { clockVN } from '../../time';
import { formatDuration, runMinutes } from '../../entries/model';
import { saveSchedule, useSchedule, writeErrorMessage, type Schedule } from '../../entries/api';

/** Giờ mở / đóng / tạm dừng của máng trong ngày. */
export function ScheduleCard({ date, mang, closed }: { date: string; mang: MangId; closed: boolean }) {
  const schedule = useSchedule(date, mang);
  if (!schedule) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-4 grid place-items-center text-slate-400">
        <LoaderCircle className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  // Remount khi dữ liệu trên Cloud đổi để ô nhập lấy giá trị mới.
  return <ScheduleForm key={JSON.stringify(schedule)} date={date} mang={mang} closed={closed} saved={schedule} />;
}

function ScheduleForm({ date, mang, closed, saved }: { date: string; mang: MangId; closed: boolean; saved: Schedule }) {
  const { user, profile } = useAuth();
  const [draft, setDraft] = useState<Schedule>(saved);
  const [busy, setBusy] = useState(false);
  const dirty =
    draft.openTime !== saved.openTime || draft.closeTime !== saved.closeTime || draft.pausedMinutes !== saved.pausedMinutes;
  const run = runMinutes(draft.openTime, draft.closeTime, draft.pausedMinutes);
  const nowHHMM = () => clockVN(new Date());

  async function save() {
    if (!user) return;
    if (draft.openTime && draft.closeTime && runMinutes(draft.openTime, draft.closeTime, 0) === null) {
      toast.error('Giờ đóng phải sau giờ mở.');
      return;
    }
    setBusy(true);
    try {
      const name = profile?.displayName || user.displayName || user.email || 'Nhân viên';
      const pending = saveSchedule(date, mang, draft, user.uid, name);
      if (!navigator.onLine) {
        // Mất mạng: lời hứa chỉ xong khi có mạng lại, không chờ ở đây.
        pending.catch((e) => toast.error(`Giờ chạy bị từ chối: ${writeErrorMessage(e)}`));
        toast.success('Đã lưu giờ chạy trên máy. Có mạng sẽ tự gửi.');
        return;
      }
      await pending;
      toast.success('Đã lưu giờ chạy máng.');
    } catch (e) {
      toast.error(`Không lưu được giờ chạy: ${writeErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-white rounded-3xl border border-slate-200 p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> Giờ chạy máng
        </h3>
        {run !== null && <p className="text-xs font-bold text-slate-700">Chạy {formatDuration(run)}</p>}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <TimeField label="Giờ mở" value={draft.openTime} disabled={closed} onChange={(openTime) => setDraft((d) => ({ ...d, openTime }))} onNow={() => setDraft((d) => ({ ...d, openTime: nowHHMM() }))} />
        <TimeField label="Giờ đóng" value={draft.closeTime} disabled={closed} onChange={(closeTime) => setDraft((d) => ({ ...d, closeTime }))} onNow={() => setDraft((d) => ({ ...d, closeTime: nowHHMM() }))} />
        <label className="block">
          <span className="text-xs font-bold text-slate-600">Tạm dừng (phút)</span>
          <input
            type="text"
            inputMode="numeric"
            disabled={closed}
            value={draft.pausedMinutes === 0 ? '' : String(draft.pausedMinutes)}
            placeholder="0"
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '');
              setDraft((d) => ({ ...d, pausedMinutes: Math.min(720, digits ? Number(digits) : 0) }));
            }}
            className="tabular mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-base font-bold outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-slate-50"
          />
        </label>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[11px] text-slate-400 min-w-0 truncate">
          {saved.updatedByName && saved.updatedAt ? `Cập nhật ${clockVN(saved.updatedAt)} · ${saved.updatedByName}` : 'Chưa nhập giờ chạy hôm nay'}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || busy || closed}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 text-white px-3 py-2 text-sm font-bold disabled:bg-slate-200 disabled:text-slate-400"
        >
          {busy && <LoaderCircle className="w-4 h-4 animate-spin" />} Lưu giờ chạy
        </button>
      </div>
    </section>
  );
}

function TimeField({
  label,
  value,
  disabled,
  onChange,
  onNow,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
  onNow: () => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-600 flex items-center justify-between">
        {label}
        {!disabled && (
          <button type="button" onClick={onNow} className="text-[11px] font-bold text-brand">
            Bây giờ
          </button>
        )}
      </span>
      <input
        type="time"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="tabular mt-1 w-full rounded-xl border border-slate-200 px-2 py-2 text-base font-bold outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-slate-50"
      />
    </label>
  );
}
