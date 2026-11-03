import { Minus, Plus, User, Users } from 'lucide-react';
import { MAX_CARTS } from '../config';

interface Props {
  kind: 'single' | 'double';
  lineLabel: string;
  value: number;
  onChange: (value: number) => void;
  /** Lớp màu nút + theo máng. */
  plusClass: string;
  ringClass: string;
  disabled?: boolean;
}

const clamp = (n: number) => Math.min(MAX_CARTS, Math.max(0, n));

/** Ô nhập số xe theo kiểu app cũ: nhãn + "= nK" (số khách), nút − / ô số / nút + màu máng. */
export function CountStepper({ kind, lineLabel, value, onChange, plusClass, ringClass, disabled }: Props) {
  const label = kind === 'single' ? 'Xe Đơn' : 'Xe Đôi';
  const Icon = kind === 'single' ? User : Users;
  const passengers = kind === 'single' ? value : value * 2;
  return (
    <div className={`bg-slate-50/80 p-2 sm:p-2.5 rounded-xl border border-slate-200/90 focus-within:bg-white transition-all ${ringClass}`}>
      <div className="flex items-center justify-between mb-1.5 text-[11px]">
        <span className="font-semibold text-slate-700 flex items-center gap-1">
          <Icon className="w-3.5 h-3.5 text-slate-500" />
          <span>{label}</span>
        </span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center shadow-2xs text-emerald-800 bg-emerald-50 border-emerald-200" title="Số khách">
          = {passengers}K
        </span>
      </div>
      <div className="flex items-center w-full gap-1">
        <button
          type="button"
          disabled={disabled || value <= 0}
          onClick={() => onChange(clamp(value - 1))}
          aria-label={`Giảm 1 ${label.toLowerCase()} ${lineLabel}`}
          className="w-9 h-10 shrink-0 rounded-lg bg-white hover:bg-slate-100 active:scale-90 transition-transform border border-slate-200 text-slate-700 flex items-center justify-center shadow-xs touch-manipulation disabled:opacity-40"
        >
          <Minus className="w-4 h-4" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          enterKeyHint="done"
          pattern="[0-9]*"
          placeholder="0"
          disabled={disabled}
          aria-label={`Số ${label.toLowerCase()} ${lineLabel}`}
          value={value === 0 ? '' : String(value)}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '');
            onChange(clamp(digits ? Number(digits) : 0));
          }}
          className="w-full min-w-0 h-10 text-center font-semibold font-numeric tabular-nums text-xl bg-white border border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 text-slate-900 rounded-lg outline-none shadow-xs px-1 disabled:bg-slate-100"
        />
        <button
          type="button"
          disabled={disabled || value >= MAX_CARTS}
          onClick={() => onChange(clamp(value + 1))}
          aria-label={`Tăng 1 ${label.toLowerCase()} ${lineLabel}`}
          className={`w-9 h-10 shrink-0 rounded-lg flex items-center justify-center shadow-xs touch-manipulation active:scale-90 transition-transform text-white border disabled:opacity-40 ${plusClass}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
