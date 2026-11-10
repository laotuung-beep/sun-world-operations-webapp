import { LoaderCircle, TrendingUp } from 'lucide-react';

export interface ReportHeaderCardProps {
  date: string;
  onShareReport: () => void;
  onExportExcel: () => void;
  busy: 'close' | 'excel' | 'image' | null;
  showMondayExportAlert?: boolean;
}

/**
 * ReportHeaderCard:
 * - Red square icon badge with white TrendingUp arrow
 * - Title "BÁO CÁO VẬN HÀNH" + Subtitle "Ngày DD/MM/YYYY"
 * - Primary red button "Gửi báo cáo"
 * - Secondary bordered button "Xuất Excel"
 */
export function ReportHeaderCard({
  date,
  onShareReport,
  onExportExcel,
  busy,
  showMondayExportAlert = false,
}: ReportHeaderCardProps) {
  const [y, mo, d] = date.split('-');

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-3.5 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#D71920] text-white flex items-center justify-center shrink-0 shadow-xs">
          <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
        </div>
        <div>
          <h1 className="text-sm sm:text-base font-extrabold uppercase tracking-tight text-[#20242B] leading-tight">
            BÁO CÁO VẬN HÀNH
          </h1>
          <p className="text-xs sm:text-sm font-medium text-[#64748B] mt-0.5">
            Ngày {d}/{mo}/{y}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        <button
          type="button"
          onClick={onShareReport}
          disabled={busy === 'image'}
          className="h-9 sm:h-10 px-4 rounded-xl font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 active:scale-[0.98] bg-[#D71920] hover:bg-[#b9151b] text-white shadow-xs transition-all disabled:opacity-60 cursor-pointer"
        >
          {busy === 'image' && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />}
          <span>Gửi báo cáo</span>
        </button>

        <button
          type="button"
          onClick={onExportExcel}
          disabled={busy === 'excel'}
          title="Xuất file Excel Bao_Cao_van_hanh_Mang_Truot.xlsx"
          className={`h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 active:scale-[0.98] bg-white hover:bg-[#F5F6F8] text-[#20242B] border border-[#E5E7EB] shadow-2xs transition-all disabled:opacity-60 cursor-pointer ${
            showMondayExportAlert ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/50' : ''
          }`}
        >
          {busy === 'excel' && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />}
          <span>Xuất Excel</span>
        </button>
      </div>
    </div>
  );
}
