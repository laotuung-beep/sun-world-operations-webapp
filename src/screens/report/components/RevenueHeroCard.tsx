import { GrowthBadge, type GrowthData } from './GrowthBadge';

const fmt = new Intl.NumberFormat('vi-VN');

export interface RevenueHeroCardProps {
  revenue: number;
  growth: GrowthData;
}

/**
 * RevenueHeroCard:
 * - Solid brand red background (#D71920), rounded-2xl
 * - High contrast white typography
 * - "DOANH THU" label + translucent tag "✓ Vé tại quầy"
 * - White pill growth badge (▲ +X.X%)
 * - Formatted currency with italic "VNĐ"
 */
export function RevenueHeroCard({ revenue, growth }: RevenueHeroCardProps) {
  return (
    <div className="bg-[#D71920] border-transparent text-white rounded-2xl p-4 sm:p-5 sm:px-6 shadow-sm flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
            DOANH THU
          </span>
          <span className="bg-white/20 text-white border border-white/30 backdrop-blur-xs px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-semibold inline-flex items-center gap-1">
            ✓ Vé tại quầy
          </span>
        </div>
        <GrowthBadge growth={growth} variant="hero" />
      </div>

      <div className="text-3xl sm:text-[44px] font-bold font-numeric text-white leading-none tabular-nums tracking-tight mt-1 sm:mt-2 flex items-baseline flex-wrap">
        <span>{fmt.format(revenue)}</span>
        <span className="text-base sm:text-2xl font-normal italic text-white/90 ml-1.5">VNĐ</span>
      </div>
    </div>
  );
}
