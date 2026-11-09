import { User, Users } from 'lucide-react';
import NumberFlow from '@number-flow/react';
import { MAX_CARTS } from '../config';

interface Props {
  kind: 'single' | 'double';
  lineLabel: string;
  value: number;
  onChange: (value: number) => void;
  onBlur?: () => void;
  /** Lớp màu nút + theo máng (giữ để tương thích ngược). */
  plusClass?: string;
  /** Lớp viền focus theo thương hiệu máng. */
  ringClass?: string;
  disabled?: boolean;
}

const clamp = (n: number) => Math.min(MAX_CARTS, Math.max(0, n));

/**
 * Ô nhập số xe trực tiếp tối ưu di động:
 * - Loại bỏ hoàn toàn nút + và - để giải phóng diện tích tối đa.
 * - Kích hoạt bàn phím số chuyên dụng (inputMode="numeric", pattern="[0-9]*").
 * - Chạm vào tự động bôi đen toàn bộ số (select-on-tap) để nhập đè tức thì.
 * - Chiều cao 48px (h-12) chuẩn công thái học di động.
 */
export function CountStepper({
  kind,
  lineLabel,
  value,
  onChange,
  onBlur,
  ringClass = 'focus-within:border-slate-800',
  disabled,
}: Props) {
  const label = kind === 'single' ? 'Xe Đơn' : 'Xe Đôi';
  const Icon = kind === 'single' ? User : Users;
  const passengers = kind === 'single' ? value : value * 2;

  const handleSelect = (e: React.FocusEvent<HTMLInputElement> | React.MouseEvent<HTMLInputElement>) => {
    e.currentTarget.select();
  };

  return (
    <div
      className={`bg-slate-50/80 p-2.5 sm:p-3 rounded-2xl border border-slate-200/90 focus-within:bg-white focus-within:border-slate-800 focus-within:ring-2 focus-within:ring-slate-900/10 transition-all shadow-xs ${ringClass}`}
    >
      {/* Tiêu đề loại xe & Số khách quy đổi tự động */}
      <div className="flex items-center justify-between mb-2 text-xs">
        <span className="font-bold text-slate-700 flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>{label}</span>
        </span>
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center shadow-2xs text-emerald-800 bg-emerald-50 border-emerald-200 tabular-nums"
          title="Số khách tương ứng"
        >
          = <NumberFlow value={passengers} /> khách
        </span>
      </div>

      {/* Ô nhập số trực tiếp toàn khung (Full-width, h-12 / 48px) */}
      <div className="relative w-full">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          enterKeyHint={kind === 'single' ? 'next' : 'done'}
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          placeholder="0"
          disabled={disabled}
          aria-label={`Số ${label.toLowerCase()} ${lineLabel}`}
          value={value === 0 ? '' : String(value)}
          onFocus={handleSelect}
          onClick={handleSelect}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '');
            onChange(clamp(digits ? Number(digits) : 0));
          }}
          onBlur={onBlur}
          className="w-full h-12 text-center font-black font-numeric tabular-nums text-2xl sm:text-3xl bg-white border border-slate-300 focus:border-slate-900 focus:ring-0 text-slate-900 rounded-xl outline-none shadow-inner px-2 transition-colors disabled:bg-slate-100 disabled:text-slate-400 placeholder:text-slate-300"
        />
      </div>
    </div>
  );
}
