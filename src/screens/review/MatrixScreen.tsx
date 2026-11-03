import { useMemo, useState } from 'react';
import { Check, CheckCheck, Download, LoaderCircle, Undo2, X } from 'lucide-react';
import { toast } from 'sonner';
import { LINE_LABEL, MANGS, TIME_SLOTS, mangById, slotById, type LineId, type MangId, type SlotId } from '../../config';
import { useActor } from '../../auth/AuthProvider';
import { clockVN } from '../../time';
import { STATUS_LABEL, linesTotals, sortNewestFirst, type Entry } from '../../entries/model';
import { approveEntries, rejectEntry, useDayEntries, writeErrorMessage } from '../../entries/api';
import { buildMatrix, lineTotal, reportMetrics } from '../../report/compute';
import { useDay, useSchedules } from '../../report/api';
import { MANG_UI } from '../../components/brand';

type Filter = 'all' | MangId;

/** Tab "Ma Trận Giờ": bảng 6 line như app cũ (số đã duyệt) + phiếu chờ duyệt, bấm dòng để duyệt / trả lại. */
export function MatrixScreen({ date }: { date: string }) {
  const actor = useActor();
  const day = useDay(date);
  const schedules = useSchedules(date);
  const { entries, error } = useDayEntries(date);
  const [filter, setFilter] = useState<Filter>('all');
  const [openSlot, setOpenSlot] = useState<SlotId | null>(null);
  const [busy, setBusy] = useState<SlotId | 'all' | null>(null);
  const closed = day?.closed ?? false;

  const all = entries ?? [];
  const approved = useMemo(() => buildMatrix(all, (s) => s === 'approved'), [all]);
  const pending = useMemo(() => buildMatrix(all, (s) => s === 'pending'), [all]);
  const waiting = all.filter((e) => e.status === 'pending' && !e.pendingSync);
  const waitingRides = waiting.reduce((acc, e) => acc + linesTotals(e.lines).rides, 0);
  const mangs = filter === 'all' ? MANGS : MANGS.filter((m) => m.id === filter);
  const lines = mangs.flatMap((m) => m.lines) as LineId[];

  async function approve(slot: SlotId | 'all') {
    const ids = waiting.filter((e) => slot === 'all' || e.slotId === slot).map((e) => e.id);
    if (!ids.length) return;
    if (slot === 'all' && !window.confirm(`Duyệt toàn bộ ${ids.length} phiếu chờ duyệt?`)) return;
    setBusy(slot);
    try {
      await approveEntries(date, ids, actor);
      toast.success(slot === 'all' ? `Đã duyệt ${ids.length} phiếu.` : `Đã duyệt ${ids.length} phiếu khung ${slotById(slot).label}.`);
    } catch (e) {
      toast.error(`Không duyệt được: ${writeErrorMessage(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function reject(e: Entry) {
    const reason = window.prompt(`Lý do trả lại phiếu ${clockVN(e.createdAt ?? new Date(e.clientCreatedAt))} của ${e.createdByName}?`);
    if (reason === null) return;
    if (!reason.trim()) {
      toast.error('Cần ghi lý do để người gửi biết sửa.');
      return;
    }
    try {
      await rejectEntry(date, e.id, reason.trim(), actor);
      toast.success('Đã trả lại phiếu.');
    } catch (err) {
      toast.error(`Không trả lại được: ${writeErrorMessage(err)}`);
    }
  }

  async function excel() {
    if (!day) return;
    try {
      const { exportExcel } = await import('../../report/exporters');
      await exportExcel({ date, matrix: approved, metrics: reportMetrics(approved, day.meta, schedules), meta: day.meta, entries: all, closed });
      toast.success('Đã tải file Excel.');
    } catch (e) {
      toast.error(`Không xuất được Excel: ${writeErrorMessage(e)}`);
    }
  }

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
                {closed ? 'Đã chốt' : 'Số đã duyệt'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={excel}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-black text-white shadow-sm border border-slate-900 py-1 px-2.5 text-xs rounded-lg font-semibold shrink-0 active:scale-95 transition"
          >
            <Download className="w-3.5 h-3.5" /> Xuất Excel
          </button>
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
          <span className="text-[10px] text-slate-400">Chạm dòng để xem phiếu, duyệt / trả lại →</span>
        </div>
      </div>

      {waiting.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 sm:p-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
          <p className="text-xs text-amber-900 flex-1 min-w-0">
            <strong>{waiting.length} phiếu chờ duyệt</strong> · {waitingRides} chuyến (số cam <span className="font-bold">+N</span> trong bảng, chưa tính vào báo cáo)
          </p>
          <button
            type="button"
            disabled={closed || busy !== null}
            onClick={() => approve('all')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 text-xs font-bold shrink-0 disabled:opacity-50"
          >
            {busy === 'all' ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />} Duyệt tất cả
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600 px-1">Không tải được phiếu. Kiểm tra mạng hoặc quyền tài khoản.</p>}

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
                const hasApproved = lines.some((l) => approved[s.id][l].rides > 0);
                const hasPending = lines.some((l) => pending[s.id][l].rides > 0);
                const dot = hasPending ? 'bg-amber-500 animate-pulse' : hasApproved ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse';
                return (
                  <tr
                    key={s.id}
                    onClick={() => setOpenSlot(s.id)}
                    className={`cursor-pointer active:bg-slate-200/80 hover:bg-slate-50/80 border-b border-slate-100 ${hasApproved || hasPending ? 'text-slate-900' : 'bg-slate-50/40 text-slate-400'}`}
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
                      const a = approved[s.id][l].rides;
                      const p = pending[s.id][l].rides;
                      return (
                        <td
                          key={l}
                          className={`py-1.5 px-0.5 font-bold border-r ${i % 2 === 1 ? `border-slate-300 ${MANG_UI[m.id].tint}` : 'border-slate-200'} text-xs sm:text-sm leading-tight`}
                        >
                          <span className={`font-numeric tabular-nums ${a ? 'text-slate-900' : 'text-slate-300'}`}>{a || '-'}</span>
                          {p > 0 && <span className="block text-[9.5px] sm:text-[10px] font-bold text-amber-600">+{p}</span>}
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
                    <div className="text-xs sm:text-sm font-bold font-numeric tabular-nums">{lineTotal(approved, l).rides}</div>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {openSlot && (
        <SlotSheet
          slot={openSlot}
          entries={sortNewestFirst(all.filter((e) => e.slotId === openSlot && (filter === 'all' || e.mang === filter)))}
          closed={closed}
          busy={busy === openSlot}
          onApprove={() => approve(openSlot)}
          onReject={reject}
          onClose={() => setOpenSlot(null)}
        />
      )}
    </div>
  );
}

const STATUS_STYLE: Record<Entry['status'], string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

function SlotSheet({
  slot,
  entries,
  closed,
  busy,
  onApprove,
  onReject,
  onClose,
}: {
  slot: SlotId;
  entries: Entry[];
  closed: boolean;
  busy: boolean;
  onApprove: () => void;
  onReject: (e: Entry) => void;
  onClose: () => void;
}) {
  const waiting = entries.filter((e) => e.status === 'pending' && !e.pendingSync);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg max-h-[85dvh] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
          <div>
            <p className="text-sm font-bold">Khung {slotById(slot).label}</p>
            <p className="text-[11px] text-slate-500">
              {entries.length} phiếu · {waiting.length} chờ duyệt
            </p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 grid place-items-center rounded-full hover:bg-slate-100" aria-label="Đóng">
            <X className="w-4 h-4" />
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {entries.length === 0 && <li className="p-4 text-sm text-slate-400">Chưa có phiếu nào trong khung này.</li>}
          {entries.map((e) => {
            const m = mangById(e.mang);
            const t = linesTotals(e.lines);
            const dim = e.status === 'cancelled' || e.status === 'rejected';
            return (
              <li key={e.id} className={`px-4 py-2.5 flex items-start gap-3 ${dim ? 'opacity-55' : ''}`}>
                <img src={m.badge} alt={m.short} className={`h-5 w-12 object-contain shrink-0 mt-0.5 rounded ${MANG_UI[m.id].solid} px-1`} />
                <div className="min-w-0 flex-1 text-xs">
                  <p>
                    <span className="font-bold tabular-nums">{clockVN(e.createdAt ?? new Date(e.clientCreatedAt))}</span>
                    <span className="text-slate-500"> · {e.createdByName}</span>
                  </p>
                  <p className={`text-slate-600 tabular-nums ${e.status === 'cancelled' ? 'line-through' : ''}`}>
                    {m.lines.map((l) => `${LINE_LABEL[l]}: ${e.lines[l]?.single ?? 0} đơn · ${e.lines[l]?.double ?? 0} đôi`).join('   ')}
                  </p>
                  {e.reviewedByName && e.status !== 'pending' && <p className="text-slate-400">bởi {e.reviewedByName}</p>}
                  {e.rejectReason && <p className="text-red-600">Lý do: {e.rejectReason}</p>}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[e.status]}`}>
                    {e.pendingSync ? 'Chờ mạng' : STATUS_LABEL[e.status]}
                  </span>
                  <span className="text-xs font-bold tabular-nums">{t.rides} chuyến</span>
                  {e.status === 'pending' && !closed && !e.pendingSync && (
                    <button
                      type="button"
                      onClick={() => onReject(e)}
                      className="inline-flex items-center gap-0.5 text-[11px] font-bold text-slate-500 hover:text-red-600"
                    >
                      <Undo2 className="w-3 h-3" /> Trả lại
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="p-3 border-t border-slate-100 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={!waiting.length || closed || busy}
            onClick={onApprove}
            className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm disabled:bg-slate-200 disabled:text-slate-400"
          >
            {busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {waiting.length ? `Duyệt khung (${waiting.length} phiếu)` : closed ? 'Ngày đã chốt' : 'Không có phiếu chờ duyệt'}
          </button>
        </div>
      </div>
    </div>
  );
}
