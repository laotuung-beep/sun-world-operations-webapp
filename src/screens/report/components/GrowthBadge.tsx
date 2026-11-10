export interface GrowthData {
  rate: number | null;
  formatted: string;
  direction: 'up' | 'down' | 'neutral' | 'none';
  isAvailable: boolean;
}

export interface GrowthBadgeProps {
  growth?: GrowthData | null;
  variant?: 'hero' | 'kpi';
  className?: string;
}

/**
 * GrowthBadge displays percentage growth indicators with automatic color,
 * direction arrow, and safe fallback handling.
 *
 * - variant="hero": White pill badge with vivid green/red text for the Premier Red Hero Card.
 * - variant="kpi": Subtle tinted pill badge (e.g. green bg for positive) for operational cards.
 * - Returns null when growth data is unavailable (rate is null or isAvailable is false),
 *   preventing NaN%, Infinity%, or empty visual glitches.
 */
export function GrowthBadge({ growth, variant = 'kpi', className = '' }: GrowthBadgeProps) {
  if (!growth || !growth.isAvailable || growth.rate === null) {
    return null;
  }

  const { direction, formatted } = growth;
  const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '—';

  if (variant === 'hero') {
    const textColorClass =
      direction === 'up'
        ? 'text-[#15803D]'
        : direction === 'down'
          ? 'text-[#DC2626]'
          : 'text-slate-600';

    return (
      <span
        className={`bg-white ${textColorClass} shadow-2xs px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-xs font-bold font-numeric inline-flex items-center gap-1 border border-white/40 shrink-0 ${className}`}
      >
        <span className="text-[10px] sm:text-xs leading-none">{arrow}</span>
        <span>{formatted}</span>
      </span>
    );
  }

  // variant === 'kpi'
  const styleClass =
    direction === 'up'
      ? 'bg-[#F0FDF4] text-[#15803D] border-[#DCFCE7]'
      : direction === 'down'
        ? 'bg-[#FEF2F2] text-[#DC2626] border-[#FEE2E2]'
        : 'bg-slate-50 text-slate-600 border-slate-200';

  return (
    <span
      className={`${styleClass} border px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold font-numeric inline-flex items-center gap-0.5 shrink-0 ${className}`}
    >
      <span className="text-[9px] sm:text-[10px] leading-none">{arrow}</span>
      <span>{formatted}</span>
    </span>
  );
}
