import { useState } from 'react';
import { LoaderCircle, Pen, X } from 'lucide-react';
import { toast } from 'sonner';
import { useActor } from '../../../auth/AuthProvider';
import { writeErrorMessage } from '../../../entries/api';
import {
  FREE_GATE_FORMULA_START_DATE,
  META_LABEL,
  resolveFreeGate,
  type DayMeta,
} from '../../../report/compute';
import { saveMeta } from '../../../report/api';

const fmt = new Intl.NumberFormat('vi-VN');

export interface ReconciliationGridProps {
  date: string;
  meta: DayMeta;
  displayTotalPassengers: number;
  closed: boolean;
}

/**
 * ReconciliationGrid:
 * 2x2 grid matching theme park executive audit slip:
 * - Khách lên cáp
 * - Khách tính phí
 * - Khách miễn phí (automatically resolved via resolveFreeGate)
 * - Khách combo đêm
 * Maintains admin button "Chỉnh sửa số liệu" (marked with data-no-capture) to toggle MetaForm.
 */
export function ReconciliationGrid({
  date,
  meta,
  displayTotalPassengers,
  closed,
}: ReconciliationGridProps) {
  const [editMeta, setEditMeta] = useState(false);

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
      <div className="flex items-center justify-between gap-2 w-full">
        <h2 className="text-xs sm:text-sm font-bold tracking-wide uppercase text-[#20242B] whitespace-nowrap">
          ĐỐI SOÁT CÁP TREO &amp; CỔNG
        </h2>
        {!closed && (
          <button
            type="button"
            data-no-capture
            onClick={() => setEditMeta((v) => !v)}
            className="text-xs font-semibold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl whitespace-nowrap shrink-0 border border-[#E5E7EB] bg-white hover:bg-[#F5F6F8] text-[#20242B] inline-flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-[0.98]"
          >
            {editMeta ? <X className="w-3.5 h-3.5 text-[#6B7280]" /> : <Pen className="w-3.5 h-3.5 text-[#6B7280]" />}
            <span>{editMeta ? 'Đóng' : 'Chỉnh sửa số liệu'}</span>
          </button>
        )}
      </div>

      {editMeta && !closed ? (
        <MetaForm
          date={date}
          meta={meta}
          totalPassengers={displayTotalPassengers}
          onDone={() => setEditMeta(false)}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {/* Ô 1: Khách lên cáp */}
          <div className="bg-[#FAFAFA] border border-[#EAECEF] rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Khách lên cáp</span>
            <div className="text-2xl sm:text-3xl font-bold font-numeric tabular-nums text-[#20242B] mt-1.5 leading-none">
              {fmt.format(meta.cableCarVisitors)}{' '}
              <span className="text-xs sm:text-sm font-normal italic text-[#64748B] ml-0.5 sm:ml-1">
                khách
              </span>
            </div>
          </div>

          {/* Ô 2: Khách tính phí */}
          <div className="bg-[#FAFAFA] border border-[#EAECEF] rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Khách tính phí</span>
            <div className="text-2xl sm:text-3xl font-bold font-numeric tabular-nums text-[#20242B] mt-1.5 leading-none">
              {fmt.format(meta.paidGateVisitors)}{' '}
              <span className="text-xs sm:text-sm font-normal italic text-[#64748B] ml-0.5 sm:ml-1">
                khách
              </span>
            </div>
          </div>

          {/* Ô 3: Khách miễn phí */}
          <div className="bg-[#FAFAFA] border border-[#EAECEF] rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Khách miễn phí</span>
            <div className="text-2xl sm:text-3xl font-bold font-numeric tabular-nums text-[#20242B] mt-1.5 leading-none">
              {fmt.format(meta.freeGateVisitors)}{' '}
              <span className="text-xs sm:text-sm font-normal italic text-[#64748B] ml-0.5 sm:ml-1">
                khách
              </span>
            </div>
          </div>

          {/* Ô 4: Khách combo đêm */}
          <div className="bg-[#FAFAFA] border border-[#EAECEF] rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Khách combo đêm</span>
            <div className="text-2xl sm:text-3xl font-bold font-numeric tabular-nums text-[#20242B] mt-1.5 leading-none">
              {fmt.format(meta.nightComboVisitors)}{' '}
              <span className="text-xs sm:text-sm font-normal italic text-[#64748B] ml-0.5 sm:ml-1">
                khách
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetaForm({
  date,
  meta,
  totalPassengers,
  onDone,
}: {
  date: string;
  meta: DayMeta;
  totalPassengers: number;
  onDone: () => void;
}) {
  const actor = useActor();
  const [draft, setDraft] = useState<DayMeta>(meta);
  const [busy, setBusy] = useState(false);

  const useFormulaFromFeb12 = date >= FREE_GATE_FORMULA_START_DATE;
  const autoFreeGate = resolveFreeGate(
    totalPassengers,
    draft.paidGateVisitors,
    draft.freeGateVisitors,
    date
  );

  async function save() {
    setBusy(true);
    try {
      await saveMeta(date, { ...draft, freeGateVisitors: autoFreeGate }, actor);
      toast.success('Đã lưu thông số đối soát.');
      onDone();
    } catch (e) {
      toast.error(`Không lưu được: ${writeErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-no-capture className="bg-[#FAFAFA] border border-[#EAECEF] rounded-xl p-3 space-y-3">
      <p className="text-xs font-bold text-slate-700">Cập nhật số liệu đối soát &amp; doanh thu:</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {(Object.keys(META_LABEL) as (keyof DayMeta)[]).map((k) => {
          if (k === 'freeGateVisitors' && useFormulaFromFeb12) {
            return (
              <label key={k} className="block">
                <span className="text-[11px] font-semibold text-slate-600 flex items-center justify-between">
                  <span>{META_LABEL[k]}:</span>
                  <span className="text-[9.5px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    Tự động
                  </span>
                </span>
                <input
                  type="text"
                  readOnly
                  value={fmt.format(autoFreeGate)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 font-bold tabular-nums text-slate-700 cursor-not-allowed outline-none select-none"
                  title="Khách miễn phí = Khách chơi máng - Khách tính phí (áp dụng từ 12/02/2026)"
                />
                <span className="text-[10px] text-slate-400 mt-1 block leading-tight">
                  = Khách chơi máng ({fmt.format(totalPassengers)}) − Khách tính phí ({fmt.format(draft.paidGateVisitors)})
                </span>
              </label>
            );
          }
          return (
            <label key={k} className="block">
              <span className="text-[11px] font-semibold text-slate-600">{META_LABEL[k]}:</span>
              <input
                type="text"
                inputMode="numeric"
                value={draft[k] ? fmt.format(draft[k]) : ''}
                placeholder="0"
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '');
                  setDraft((d) => ({ ...d, [k]: digits ? Math.min(Number(digits), 99_999_999_999) : 0 }));
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-bold tabular-nums outline-none focus:border-slate-900"
              />
            </label>
          );
        })}
      </div>
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 text-white px-3.5 py-2 text-xs font-bold disabled:opacity-50 cursor-pointer"
      >
        {busy && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />} Lưu thông số
      </button>
    </div>
  );
}
