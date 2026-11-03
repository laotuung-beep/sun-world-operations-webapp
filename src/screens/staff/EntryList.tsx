import { useState } from 'react';
import { CloudOff, X } from 'lucide-react';
import { toast } from 'sonner';
import { LINE_LABEL, slotById, type LineId, type SlotId } from '../../config';
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
  /** Chỉ hiện phiếu của khung giờ đang chọn cho gọn. */
  slotId: SlotId;
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

/** Phiếu của máng trong khung giờ đang chọn (chọn khung khác ở thanh Khung giờ để xem). */
export function EntryList({ entries, slotId, myUid, date, closed, error }: Props) {
  const slot = slotById(slotId);
  const items = sortNewestFirst(entries.filter((e) => e.slotId === slotId));
  const t = totalsBySlot(entries).get(slotId);
  const dayCount = entries.filter((e) => isActive(e.status)).length;

  return (
    <section className="bg-white rounded-xl border border-slate-200/90 shadow-sm">
      <div className="px-4 pt-4 pb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Phiếu khung <span className="tabular text-slate-800">{slot.label}</span>
        </h3>
        <p className="text-xs text-slate-400 tabular shrink-0">{dayCount} phiếu cả ngày</p>
      </div>
      <div className="px-4 pb-2 flex items-center justify-between text-xs">
        <span className="text-slate-500">{items.length} phiếu trong khung</span>
        <span className="tabular font-bold text-slate-700">
          {t?.rides ?? 0} lượt · {t?.passengers ?? 0} khách
        </span>
      </div>

      {error && <p className="px-4 pb-4 text-sm text-red-600">Không tải được danh sách phiếu. Kiểm tra mạng hoặc quyền tài khoản.</p>}
      {!error && items.length === 0 && (
        <p className="px-4 pb-4 text-sm text-slate-400 border-t border-slate-100 pt-3">Chưa có phiếu nào trong khung này.</p>
      )}
      {items.length > 0 && (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {items.map((e) => (
            <EntryRow key={e.id} entry={e} mine={e.createdBy === myUid} date={date} closed={closed} />
          ))}
        </ul>
      )}
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
