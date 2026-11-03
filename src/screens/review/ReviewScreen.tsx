import { Fragment, useMemo, useState } from 'react';
import { Check, CheckCheck, ChevronDown, LoaderCircle, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { LINE_LABEL, MANGS, TIME_SLOTS, mangById, type SlotId } from '../../config';
import { useActor } from '../../auth/AuthProvider';
import { useNow } from '../../hooks/useNow';
import { clockVN, dateKeyVN, minutesVN } from '../../time';
import { STATUS_LABEL, currentSlotId, linesTotals, sortNewestFirst, type Entry } from '../../entries/model';
import { approveEntries, rejectEntry, useDayEntries, writeErrorMessage } from '../../entries/api';
import { ALL_LINES, buildMatrix, sumLines } from '../../report/compute';
import { useDay } from '../../report/api';
import { DateBar } from '../../components/DateBar';

export function ReviewScreen({ date, onDateChange }: { date: string; onDateChange: (d: string) => void }) {
  const actor = useActor();
  const now = useNow();
  const day = useDay(date);
  const closed = day?.closed ?? false;
  const { entries, error } = useDayEntries(date);
  const [open, setOpen] = useState<SlotId | null>(null);
  const [busy, setBusy] = useState<SlotId | 'all' | null>(null);

  const all = entries ?? [];
  const pending = useMemo(() => buildMatrix(all, (s) => s === 'pending'), [all]);
  const approved = useMemo(() => buildMatrix(all, (s) => s === 'approved'), [all]);
  const pendingEntries = all.filter((e) => e.status === 'pending' && !e.pendingSync);
  const isToday = date === dateKeyVN(now);
  const runningSlot = isToday ? currentSlotId(minutesVN(now)) : null;

  async function approve(slot: SlotId | 'all') {
    const ids = pendingEntries.filter((e) => slot === 'all' || e.slotId === slot).map((e) => e.id);
    if (ids.length === 0) return;
    const label = slot === 'all' ? `toàn bộ ${ids.length} phiếu chờ duyệt` : `${ids.length} phiếu khung ${TIME_SLOTS.find((s) => s.id === slot)!.label}`;
    if (slot === 'all' && !window.confirm(`Duyệt ${label}?`)) return;
    setBusy(slot);
    try {
      await approveEntries(date, ids, actor);
      toast.success(`Đã duyệt ${label}.`);
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
      toast.error('Cần ghi lý do để nhân viên biết sửa.');
      return;
    }
    try {
      await rejectEntry(date, e.id, reason.trim(), actor);
      toast.success('Đã trả lại phiếu.');
    } catch (err) {
      toast.error(`Không trả lại được: ${writeErrorMessage(err)}`);
    }
  }

  const pendingTotal = linesTotalsOf(pendingEntries);

  return (
    <div className="space-y-4">
      <DateBar date={date} onChange={onDateChange} closed={closed} />

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-center bg-white rounded-3xl border border-slate-200 p-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Chờ duyệt</p>
          <p className="tabular text-2xl font-extrabold">
            {pendingEntries.length} <span className="text-base font-semibold text-slate-500">phiếu ·</span> {pendingTotal.rides}{' '}
            <span className="text-base font-semibold text-slate-500">lượt ·</span> {pendingTotal.passengers}{' '}
            <span className="text-base font-semibold text-slate-500">khách</span>
          </p>
        </div>
        <button
          type="button"
          disabled={pendingEntries.length === 0 || closed || busy !== null}
          onClick={() => approve('all')}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand text-white font-extrabold px-4 py-3 disabled:bg-slate-200 disabled:text-slate-400"
        >
          {busy === 'all' ? <LoaderCircle className="w-5 h-5 animate-spin" /> : <CheckCheck className="w-5 h-5" />} Duyệt tất cả
        </button>
      </div>

      <Reporting entries={all} />

      {error && <p className="text-sm text-red-600">Không tải được phiếu. Kiểm tra mạng hoặc quyền tài khoản.</p>}
      {entries === null ? (
        <div className="grid place-items-center py-10 text-slate-400">
          <LoaderCircle className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular min-w-[640px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-500 bg-slate-50">
                  <th className="sticky left-0 bg-slate-50 text-left font-bold px-3 py-2">Khung giờ</th>
                  {ALL_LINES.map((l) => (
                    <th key={l} className="font-bold px-2 py-2 text-center" style={{ color: MANGS.find((m) => m.lines.includes(l))!.color }}>
                      {LINE_LABEL[l].replace('Line ', 'L')}
                    </th>
                  ))}
                  <th className="font-bold px-2 py-2 text-center">Chờ</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((slot) => {
                  const p = pending[slot.id];
                  const a = approved[slot.id];
                  const count = pendingEntries.filter((e) => e.slotId === slot.id).length;
                  const approvedRides = sumLines(a).rides;
                  const slotEntries = sortNewestFirst(all.filter((e) => e.slotId === slot.id));
                  const expanded = open === slot.id;
                  return (
                    <Fragment key={slot.id}>
                      <tr
                        className={`border-t border-slate-100 cursor-pointer hover:bg-slate-50/60 ${count > 0 ? '' : 'text-slate-400'}`}
                        onClick={() => setOpen(expanded ? null : slot.id)}
                      >
                        <td className="sticky left-0 bg-white px-3 py-2.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                            <ChevronDown className={`w-3.5 h-3.5 transition ${expanded ? 'rotate-180' : ''}`} />
                            {slot.label}
                          </span>
                          <span className="block text-[10px] text-slate-400 pl-4.5">
                            {slot.id === runningSlot ? 'đang diễn ra' : slot.peak ? 'cao điểm' : ''}
                          </span>
                        </td>
                        {ALL_LINES.map((l) => (
                          <td key={l} className="px-2 py-2.5 text-center">
                            <span className={p[l].rides ? 'font-extrabold text-amber-700' : ''}>{p[l].rides || '–'}</span>
                            {a[l].rides > 0 && <span className="block text-[10px] text-emerald-600">✓{a[l].rides}</span>}
                          </td>
                        ))}
                        <td className="px-2 py-2.5 text-center font-bold">{count || ''}</td>
                        <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                          {count > 0 ? (
                            <button
                              type="button"
                              disabled={closed || busy !== null}
                              onClick={() => approve(slot.id)}
                              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 text-white px-3 py-1.5 text-xs font-extrabold disabled:bg-slate-200 disabled:text-slate-400"
                            >
                              {busy === slot.id ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              Duyệt khung
                            </button>
                          ) : approvedRides > 0 ? (
                            <span className="text-xs font-bold text-emerald-600">✓ Đã duyệt</span>
                          ) : null}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={ALL_LINES.length + 3} className="px-3 py-2">
                            {slotEntries.length === 0 ? (
                              <p className="text-xs text-slate-400 py-1">Chưa có phiếu nào trong khung này.</p>
                            ) : (
                              <ul className="divide-y divide-slate-200">
                                {slotEntries.map((e) => (
                                  <EntryLine key={e.id} entry={e} closed={closed} onReject={() => reject(e)} />
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2 text-[11px] text-slate-400 border-t border-slate-100">
            Số màu cam: lượt xe chờ duyệt · ✓ số đã duyệt. Bấm vào khung giờ để xem từng phiếu và trả lại phiếu sai.
          </p>
        </div>
      )}
    </div>
  );
}

function linesTotalsOf(entries: Entry[]) {
  return entries.reduce(
    (acc, e) => {
      const t = linesTotals(e.lines);
      return { rides: acc.rides + t.rides, passengers: acc.passengers + t.passengers };
    },
    { rides: 0, passengers: 0 },
  );
}

const STATUS_COLOR: Record<Entry['status'], string> = {
  pending: 'text-amber-700',
  approved: 'text-emerald-700',
  rejected: 'text-red-600',
  cancelled: 'text-slate-400',
};

function EntryLine({ entry: e, closed, onReject }: { entry: Entry; closed: boolean; onReject: () => void }) {
  const m = mangById(e.mang);
  const t = linesTotals(e.lines);
  return (
    <li className={`py-2 flex items-center gap-3 text-xs ${e.status === 'cancelled' || e.status === 'rejected' ? 'opacity-60' : ''}`}>
      <span className="font-extrabold w-10 shrink-0" style={{ color: m.color }}>
        {m.short}
      </span>
      <div className="min-w-0 flex-1">
        <p>
          <span className="font-bold">{clockVN(e.createdAt ?? new Date(e.clientCreatedAt))}</span>
          <span className="text-slate-500"> · {e.createdByName}</span>
          <span className={`font-bold ${STATUS_COLOR[e.status]}`}> · {STATUS_LABEL[e.status]}</span>
          {e.reviewedByName && e.status !== 'pending' && <span className="text-slate-400"> bởi {e.reviewedByName}</span>}
        </p>
        <p className="text-slate-600">
          {m.lines.map((l) => `${LINE_LABEL[l]}: ${e.lines[l]?.single ?? 0} đơn · ${e.lines[l]?.double ?? 0} đôi`).join('   ')}
          <span className="font-bold text-slate-800"> = {t.rides} lượt</span>
        </p>
        {e.rejectReason && <p className="text-red-600">Lý do: {e.rejectReason}</p>}
      </div>
      {e.status === 'pending' && !closed && (
        <button
          type="button"
          onClick={onReject}
          className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 font-bold text-slate-600 hover:text-red-600"
        >
          <Undo2 className="w-3.5 h-3.5" /> Trả lại
        </button>
      )}
    </li>
  );
}

/** Lần báo gần nhất của từng máng. */
function Reporting({ entries }: { entries: Entry[] }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {MANGS.map((m) => {
        const mine = sortNewestFirst(entries.filter((e) => e.mang === m.id && e.status !== 'cancelled'));
        const last = mine[0];
        const waiting = mine.filter((e) => e.status === 'pending').length;
        return (
          <div key={m.id} className="bg-white rounded-2xl border border-slate-200 p-3 min-w-0">
            <p className="text-sm font-extrabold" style={{ color: m.color }}>
              {m.short}
            </p>
            <p className="text-xs text-slate-600 truncate">
              {last ? `Báo lúc ${clockVN(last.createdAt ?? new Date(last.clientCreatedAt))}` : 'Chưa có phiếu'}
            </p>
            <p className="text-[11px] text-slate-400 truncate">{last ? last.createdByName : ' '}</p>
            <p className={`mt-1 text-[11px] font-bold ${waiting ? 'text-amber-700' : 'text-slate-400'}`}>{waiting} phiếu chờ</p>
          </div>
        );
      })}
    </div>
  );
}
