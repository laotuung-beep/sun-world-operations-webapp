import { GrowthBadge, type GrowthData } from './GrowthBadge';

const fmt = new Intl.NumberFormat('vi-VN');

export interface OperationalKpiCardProps {
  passengers: number;
  passengersGrowth: GrowthData;
  activeLinesCount: number;
  conversionRate: number;
  conversionGrowth: GrowthData;
  cableCarVisitors: number;
}

/**
 * OperationalKpiCard:
 * Symmetrical 2-column executive KPI card:
 * - Col 1: KHÁCH CHƠI MÁNG (Growth badge, big count, "● X tuyến vận hành")
 * - Col 2: TỶ LỆ CHƠI / CÁP (Growth badge, big percentage, visual red progress bar, "X chơi / Y cáp")
 */
export function OperationalKpiCard({
  passengers,
  passengersGrowth,
  activeLinesCount,
  conversionRate,
  conversionGrowth,
  cableCarVisitors,
}: OperationalKpiCardProps) {
  const safeFillRate = Math.min(100, Math.max(0, conversionRate));

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 sm:p-5 shadow-xs">
      <div className="grid grid-cols-2 divide-x divide-[#E5E7EB]">
        {/* Cột 1: KHÁCH CHƠI MÁNG */}
        <div className="pr-2.5 sm:pr-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-1 mb-1.5 sm:mb-2">
              <span className="text-[11px] sm:text-xs font-bold text-[#64748B] uppercase tracking-wider truncate">
                KHÁCH CHƠI MÁNG
              </span>
              <GrowthBadge growth={passengersGrowth} variant="kpi" />
            </div>
            <div className="text-2xl sm:text-4xl font-bold font-numeric text-[#20242B] tabular-nums leading-tight">
              {fmt.format(passengers)}{' '}
              <span className="text-xs sm:text-base font-normal italic text-[#64748B] ml-0.5 sm:ml-1">
                khách
              </span>
            </div>
          </div>
          <div className="text-[11px] sm:text-xs font-medium text-[#6B7280] flex items-center gap-1.5 mt-2.5 sm:mt-3">
            <span className="w-2 h-2 rounded-full bg-[#16A34A] shrink-0" />
            <span className="truncate">{activeLinesCount} tuyến vận hành</span>
          </div>
        </div>

        {/* Cột 2: TỶ LỆ CHƠI / CÁP */}
        <div className="pl-2.5 sm:pl-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-1 mb-1.5 sm:mb-2">
              <span className="text-[11px] sm:text-xs font-bold text-[#64748B] uppercase tracking-wider truncate">
                TỶ LỆ CHƠI / CÁP
              </span>
              <GrowthBadge growth={conversionGrowth} variant="kpi" />
            </div>
            <div className="text-2xl sm:text-4xl font-bold font-numeric text-[#20242B] tabular-nums leading-tight">
              {conversionRate.toFixed(1)}%
            </div>
          </div>
          <div className="space-y-1.5 mt-2">
            <div className="w-full bg-[#F1F3F5] h-2 sm:h-2.5 rounded-full overflow-hidden border border-[#E5E7EB]">
              <div
                className="h-full bg-[#D71920] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${safeFillRate}%` }}
              />
            </div>
            <div className="text-[11px] sm:text-xs font-medium tabular-nums text-[#6B7280] truncate">
              <strong className="text-[#20242B] font-bold">{fmt.format(passengers)}</strong> chơi /{' '}
              <strong className="text-[#20242B] font-bold">{fmt.format(cableCarVisitors)}</strong> cáp
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
