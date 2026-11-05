import { useMemo, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import NumberFlow from '@number-flow/react';
import { LINE_LABEL, MANGS, TIME_SLOTS, type LineId, type MangId, type SlotId } from '../../config';
import { isActive } from '../../entries/model';
import { useDayEntries } from '../../entries/api';
import { buildMatrix, lineTotal } from '../../report/compute';
import { useDay } from '../../report/api';
import { MANG_UI } from '../../components/brand';

type Filter = 'all' | MangId;

/** Tab "Ma Trận Giờ": bảng 6 line chuẩn (chỉ đọc), nhấn vào dòng để chuyển về Nhập liệu hiệu chỉnh. */
export function MatrixScreen({
  date,
  onSelectSlot,
}: {
  date: string;
  onSelectSlot?: (slotId: SlotId, mangId?: MangId) => void;
}) {
  const day = useDay(date);
  const { entries, error } = useDayEntries(date);
  const [filter, setFilter] = useState<Filter>('all');
  const closed = day?.closed ?? false;

  const all = entries ?? [];
  const matrix = useMemo(() => buildMatrix(all, (s) => isActive(s)), [all]);
  const mangs = filter === 'all' ? MANGS : MANGS.filter((m) => m.id === filter);
  const lines = mangs.flatMap((m) => m.lines) as LineId[];

  return (
    <div className="max-w-7xl mx-auto space-y-2.5 pb-16">
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl shadow-sm border border-slate-200/90 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              {date.split('-')[2]}
            </div>
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">Ma Trận 6 Line Theo Khung Giờ</h2>
              <span className="text-[9px] font-bold tracking-wider px-1.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase whitespace-nowrap">
                {closed ? 'Đã chốt' : 'Chỉ đọc'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
          <div className="flex bg-slate-100 p-0.5 rounded-xl text-xs font-semibold overflow-x-auto no-scrollbar max-w-full">
            {([['all', 'Cả 6 Line'], ...MANGS.map((m) => [m.id, m.name] as const)] as const).map(([id, label]) => (
              <button
                key={String(id)}
                type="button"
                onClick={() => setFilter(id as Filter)}
                className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs rounded-lg whitespace-nowrap shrink-0 active:scale-95 transition ${
                  filter === id ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-slate-400">Chạm dòng để quay về Nhập liệu hiệu chỉnh</span>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 px-1">Không tải được dữ liệu. Kiểm tra mạng hoặc quyền tài khoản.</p>}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden select-none">
        {entries === null ? (
          <div className="grid place-items-center py-16 text-slate-400">
            <LoaderCircle className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <table className="w-full table-fixed text-center border-collapse">
            <thead>
              <tr className="text-white text-[10px] sm:text-[11px] font-bold">
                <th rowSpan={2} className="bg-slate-900 text-white font-bold py-1.5 px-1 text-left border-r border-slate-800 text-[10px] sm:text-xs w-[26%] sm:w-[20%]">
                  Khung Giờ
                </th>
                {mangs.map((m, i) => (
                  <th key={m.id} colSpan={2} className={`py-1 px-0.5 ${MANG_UI[m.id].head} ${i < mangs.length - 1 ? 'border-r' : ''}`}>
                    <img src={m.badge} alt={m.name} className="h-5 sm:h-6 object-contain mx-auto" />
                  </th>
                ))}
              </tr>
              <tr className="border-b border-slate-200">
                {lines.map((l) => {
                  const m = MANGS.find((x) => x.lines.includes(l))!;
                  return (
                    <th key={l} className={`py-1 px-0.5 ${MANG_UI[m.id].sub} border-r border-slate-200 text-[11px] font-medium`}>
                      {LINE_LABEL[l].replace('Line ', 'L')}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map((s) => {
                const hasRides = lines.some((l) => matrix[s.id][l].rides > 0);
                const dot = hasRides ? 'bg-emerald-500' : 'bg-slate-300';
                return (
                  <tr
                    key={s.id}
                    onClick={() => onSelectSlot?.(s.id, mangs[0]?.id ?? 1)}
                    title="Chạm để chuyển sang Nhập liệu hiệu chỉnh khung giờ này"
                    className={`cursor-pointer active:bg-slate-200/80 hover:bg-slate-50/80 border-b border-slate-100 ${hasRides ? 'text-slate-900' : 'bg-slate-50/40 text-slate-400'}`}
                  >
                    <td className="py-2 px-1 text-left border-r border-slate-200 font-medium overflow-hidden">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                        <span className="text-[9.5px] sm:text-[11px] tabular-nums tracking-tighter truncate block text-slate-600">
                          {s.start}-{s.end}
                        </span>
                      </div>
                    </td>
                    {lines.map((l, i) => {
                      const m = MANGS.find((x) => x.lines.includes(l))!;
                      const r = matrix[s.id][l].rides;
                      return (
                        <td
                          key={l}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSlot?.(s.id, m.id);
                          }}
                          title={`Chạm để hiệu chỉnh ${LINE_LABEL[l]} (${m.name}) khung ${s.start}-${s.end}`}
                          className={`py-1.5 px-0.5 font-bold border-r hover:bg-emerald-50 transition-colors ${i % 2 === 1 ? `border-slate-300 ${MANG_UI[m.id].tint}` : 'border-slate-200'} text-xs sm:text-sm leading-tight`}
                        >
                          <span className={`font-numeric tabular-nums ${r ? 'text-slate-900' : 'text-slate-300'}`}>{r || '-'}</span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-900 text-white font-bold border-t border-slate-800">
              <tr>
                <td className="py-2 px-1.5 text-left border-r border-slate-800">
                  <div className="text-[9.5px] sm:text-[10.5px] font-bold tracking-wider uppercase whitespace-nowrap">Tổng Ca</div>
                </td>
                {lines.map((l) => (
                  <td key={l} className="py-2 px-0.5 border-r border-slate-800">
                    <div className="text-xs sm:text-sm font-bold font-numeric tabular-nums">
                      <NumberFlow value={lineTotal(matrix, l).rides} />
                    </div>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
