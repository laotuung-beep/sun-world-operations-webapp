import { Minus, Plus } from 'lucide-react';
import { MAX_CARTS } from '../config';

interface Props {
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const clamp = (n: number) => Math.min(MAX_CARTS, Math.max(0, n));

/** Ô nhập số xe cho điện thoại: nút − / + to, gõ số trực tiếp được. */
export function CountStepper({ label, hint, value, onChange, disabled }: Props) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-600">
        {label} <span className="font-medium text-slate-400">· {hint}</span>
      </p>
      <div className="mt-1 flex items-stretch rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <button
          type="button"
          aria-label={`Bớt ${label}`}
          disabled={disabled || value <= 0}
          onClick={() => onChange(clamp(value - 1))}
          className="w-12 grid place-items-center text-slate-600 active:bg-slate-100 disabled:opacity-30"
        >
          <Minus className="w-5 h-5" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={label}
          disabled={disabled}
          value={value === 0 ? '' : String(value)}
          placeholder="0"
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '');
            onChange(clamp(digits ? Number(digits) : 0));
          }}
          className="tabular w-full min-w-0 text-center text-2xl font-bold py-2.5 outline-none placeholder:text-slate-300 disabled:bg-slate-50"
        />
        <button
          type="button"
          aria-label={`Thêm ${label}`}
          disabled={disabled || value >= MAX_CARTS}
          onClick={() => onChange(clamp(value + 1))}
          className="w-12 grid place-items-center text-slate-900 bg-slate-50 active:bg-slate-200 disabled:opacity-30"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
