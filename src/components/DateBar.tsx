import type { ReactNode } from 'react';
import { CalendarDays, Lock } from 'lucide-react';
import { dateKeyVN, longDateVN } from '../time';

interface Props {
  date: string;
  onChange: (date: string) => void;
  closed?: boolean;
  children?: ReactNode;
}

/** Chọn ngày cho màn Chờ duyệt / Báo cáo. */
export function DateBar({ date, onChange, closed, children }: Props) {
  const today = dateKeyVN();
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-3 sm:p-4 flex flex-wrap items-center gap-3">
      <CalendarDays className="w-5 h-5 text-brand shrink-0" />
      <div className="min-w-0">
        <p className="font-extrabold leading-tight">{longDateVN(new Date(`${date}T12:00:00+07:00`))}</p>
        <p className="text-xs text-slate-500 flex items-center gap-1">
          {date === today ? 'Hôm nay' : 'Ngày đã chọn'}
          {closed && (
            <span className="inline-flex items-center gap-0.5 font-bold text-slate-800">
              · <Lock className="w-3 h-3" /> Đã chốt
            </span>
          )}
        </p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {date !== today && (
          <button type="button" onClick={() => onChange(today)} className="text-xs font-bold text-brand px-2 py-1">
            Hôm nay
          </button>
        )}
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="tabular rounded-xl border border-slate-200 px-2 py-1.5 text-sm font-bold outline-none focus:ring-2 focus:ring-brand/30"
        />
        {children}
      </div>
    </div>
  );
}
