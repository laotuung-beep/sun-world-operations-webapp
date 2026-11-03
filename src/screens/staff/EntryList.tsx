import { useState } from 'react';
import { CloudOff, X } from 'lucide-react';
import { toast } from 'sonner';
import { LINE_LABEL, TIME_SLOTS, type LineId } from '../../config';
import { clockVN } from '../../time';
import {
  STATUS_LABEL,
  countTotals,
  isActive,
  linesTotals,
  sortNewestFirst,
  totalsBySlot,
  type Entry,
} from '../../entries/model';
import { cancelEntry, writeErrorMessage } from '../../entries/api';

interface Props {
  entries: Entry[];
  myUid: string;
  date: string;
  closed: boolean;
  error: boolean;
}

const STATUS_STYLE: Record<Entry['status'], string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

/** Phiếu hôm nay của máng, nhóm theo khung giờ (khung mới nhất trước). */
export function EntryList({ entries, myUid, date, closed, error }: Props) {
  const totals = totalsBySlot(entries);
  const groups = [...TIME_SLOTS]
    .reverse()
    .map((slot) => ({ slot, items: sortNewestFirst(entries.filter((e) => e.slotId === slot.id)) }))
    .filter((g) => g.items.length > 0);

  return (
    <section className="bg-white rounded-3xl border border-slate-200">
      <div className="px-4 pt-4 pb-2 flex items-baseline justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Phiếu hôm nay</h3>
        <p className="text-xs text-slate-400 tabular">{entries.filter((e) => isActive(e.status)).length} phiếu</p>
      </div>

      {error && <p className="px-4 pb-4 text-sm text-red-600">Không tải được danh sách phiếu. Kiểm tra mạng hoặc quyền tài khoản.</p>}
      {!error && groups.length === 0 && <p className="px-4 pb-4 text-sm text-slate-400">Chưa có phiếu nào.</p>}

      {groups.map(({ slot, items }) => {
        const t = totals.get(slot.id);
        return (
          <div key={slot.id} className="border-t border-slate-100">
            <div className="px-4 py-2 bg-slate-50/70 flex items-center justify-between">
              <p className="tabular text-sm font-bold">{slot.label}</p>
              <p className="tabular text-xs font-semibold text-slate-600">
                {t?.rides ?? 0} lượt · {t?.passengers ?? 0} khách
              </p>
            </div>
            <ul className="divide-y divide-slate-100">
              {items.map((e) => (
                <EntryRow key={e.id} entry={e} mine={e.createdBy === myUid} date={date} closed={closed} />
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function EntryRow({ entry: e, mine, date, closed }: { entry: Entry; mine: boolean; date: string; closed: boolean }) {
  const [busy, setBusy] = useState(false);
  const t = linesTotals(e.lines);
  const time = clockVN(e.createdAt ?? new Date(e.clientCreatedAt));
  const dim = !isActive(e.status);
  const canCancel = mine && e.status === 'pending' && !closed;

  async function cancel() {
    if (!window.confirm(`Huỷ phiếu lúc ${time} (${t.rides} lượt xe)?`)) return;
    setBusy(true);
    try {
      await cancelEntry(date, e.id);
      toast.success('Đã huỷ phiếu.');
    } catch (err) {
      toast.error(`Không huỷ được: ${writeErrorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={`px-4 py-3 flex items-start gap-3 ${dim ? 'opacity-55' : ''}`}>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="tabular font-bold">{time}</span>
          <span className="text-slate-500"> · {mine ? 'Bạn' : e.createdByName}</span>
        </p>
        <p className={`mt-0.5 text-xs text-slate-600 tabular ${e.status === 'cancelled' ? 'line-through' : ''}`}>
          {(Object.keys(e.lines) as LineId[])
            .sort()
            .map((l) => {
              const c = countTotals(e.lines[l]);
              return `${LINE_LABEL[l]}: ${c.single} đơn · ${c.double} đôi`;
            })
            .join('   ')}
        </p>
        {e.status === 'rejected' && e.rejectReason && <p className="mt-1 text-xs text-red-600">Lý do: {e.rejectReason}</p>}
      </div>

      <div className="flex flex-col items-end gap-1.5 shrink-0">
        {e.pendingSync ? (
          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold bg-slate-100 text-slate-600 border-slate-200">
            <CloudOff className="w-3 h-3" /> Chờ mạng
          </span>
        ) : (
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[e.status]}`}>{STATUS_LABEL[e.status]}</span>
        )}
        <span className="tabular text-xs font-bold text-slate-700">{t.rides} lượt</span>
        {canCancel && (
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="inline-flex items-center gap-0.5 text-[11px] font-bold text-slate-500 hover:text-red-600 disabled:opacity-50"
          >
            <X className="w-3 h-3" /> Huỷ
          </button>
        )}
      </div>
    </li>
  );
}
