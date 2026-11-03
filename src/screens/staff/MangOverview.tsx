import { MANGS, type MangId } from '../../config';
import { clockVN } from '../../time';
import { isActive, linesTotals, sortNewestFirst, type Entry } from '../../entries/model';
import type { Schedules } from '../../report/compute';

type RunState = { label: string; className: string };

function runState(s: Schedules[MangId]): RunState {
  if (s?.openTime && !s.closeTime) return { label: `Đang chạy · mở ${s.openTime}`, className: 'bg-emerald-50 text-emerald-700' };
  if (s?.openTime && s.closeTime) return { label: `Đã đóng ${s.closeTime}`, className: 'bg-slate-100 text-slate-600' };
  return { label: 'Chưa mở', className: 'bg-slate-100 text-slate-400' };
}

/** 3 máng trong ngày cùng lúc: trạng thái chạy, số đã báo, lần báo gần nhất. Chạm để chọn máng nhập phiếu. */
export function MangOverview({
  entries,
  schedules,
  selected,
  onSelect,
}: {
  entries: Entry[];
  schedules: Schedules;
  selected: MangId;
  onSelect: (m: MangId) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {MANGS.map((m) => {
        const mine = entries.filter((e) => e.mang === m.id && isActive(e.status));
        const rides = mine.reduce((acc, e) => acc + linesTotals(e.lines).rides, 0);
        const passengers = mine.reduce((acc, e) => acc + linesTotals(e.lines).passengers, 0);
        const last = sortNewestFirst(mine)[0];
        const run = runState(schedules[m.id]);
        const active = m.id === selected;
        return (
          <button
            key={m.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(m.id)}
            className={`text-left rounded-2xl border-2 bg-white p-2.5 sm:p-3 transition min-w-0 ${active ? 'shadow-sm' : 'border-slate-200 opacity-80 hover:opacity-100'}`}
            style={active ? { borderColor: m.color } : undefined}
          >
            <img src={m.logo} alt={m.name} className="h-7 sm:h-9 w-full object-contain object-left" />
            <p className="mt-1.5 text-xs font-extrabold truncate" style={{ color: m.color }}>
              {m.short} <span className="font-semibold text-slate-400">· L{m.lines.map((l) => l.slice(4)).join('–')}</span>
            </p>
            <span className={`mt-1 inline-block max-w-full truncate rounded-full px-1.5 py-0.5 text-[10px] font-bold ${run.className}`}>
              {run.label}
            </span>
            <p className="mt-1 tabular text-base sm:text-lg font-extrabold leading-tight">
              {rides} <span className="text-[11px] font-semibold text-slate-500">lượt</span>
            </p>
            <p className="tabular text-[11px] text-slate-500 truncate">
              {passengers} khách{last ? ` · ${clockVN(last.createdAt ?? new Date(last.clientCreatedAt))}` : ''}
            </p>
          </button>
        );
      })}
    </div>
  );
}
