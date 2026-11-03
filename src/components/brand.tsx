import type { MangId } from '../config';

/** Lớp màu Tailwind theo máng - giống app cũ (AC 1 xanh lá, AC 2 xanh dương, AC 3 đỏ). */
export const MANG_UI: Record<
  MangId,
  { gradient: string; solid: string; solidHover: string; head: string; sub: string; tint: string; text: string; light: string; ring: string }
> = {
  1: {
    gradient: 'from-emerald-600 to-emerald-700',
    solid: 'bg-emerald-600 border-emerald-600',
    solidHover: 'hover:bg-emerald-700',
    head: 'bg-emerald-600 border-emerald-500',
    sub: 'bg-emerald-50 text-emerald-800',
    tint: 'bg-emerald-50/20',
    text: 'text-emerald-600',
    light: 'text-emerald-100',
    ring: 'focus-within:border-emerald-500',
  },
  2: {
    gradient: 'from-sky-600 to-sky-700',
    solid: 'bg-sky-600 border-sky-600',
    solidHover: 'hover:bg-sky-700',
    head: 'bg-sky-600 border-sky-500',
    sub: 'bg-sky-50 text-sky-800',
    tint: 'bg-sky-50/20',
    text: 'text-sky-600',
    light: 'text-sky-100',
    ring: 'focus-within:border-sky-500',
  },
  3: {
    gradient: 'from-red-600 to-red-700',
    solid: 'bg-red-600 border-red-600',
    solidHover: 'hover:bg-red-700',
    head: 'bg-red-600 border-red-500',
    sub: 'bg-red-50 text-red-800',
    tint: 'bg-red-50/20',
    text: 'text-red-600',
    light: 'text-red-100',
    ring: 'focus-within:border-red-500',
  },
};

/** Biểu tượng máng trượt ở góc trái thanh trên (vẽ lại từ app cũ). */
export function CoasterMark({ className = 'w-5 h-5 sm:w-6 sm:h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <path d="M3 26C8 26 13 22 17 17C21 12 25 8 29 6" stroke="#C8A97E" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M5 29C10 29 15 25 19 20C23 15 27 11 31 9" stroke="#78716C" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="8" y1="26" x2="10" y2="29" stroke="#C8A97E" strokeWidth="1.2" />
      <line x1="14" y1="20" x2="16" y2="23" stroke="#C8A97E" strokeWidth="1.2" />
      <line x1="20" y1="14" x2="22" y2="17" stroke="#C8A97E" strokeWidth="1.2" />
      <line x1="26" y1="8" x2="28" y2="11" stroke="#C8A97E" strokeWidth="1.2" />
      <g transform="translate(11, 8) rotate(-22)">
        <path d="M1 9 L 11 6 L 10 2 L 0 5 Z" fill="#EF4444" stroke="#B91C1C" strokeWidth="1" />
        <path d="M0 5 C -1 1, 3 -1, 4 2 L 5 7" fill="#292524" stroke="#C8A97E" strokeWidth="1" />
        <circle cx="10" cy="5" r="1.2" fill="#FEF08A" />
      </g>
      <path d="M5 24 Q 9 20, 4 18 Q 11 20, 11 23" fill="#F97316" opacity="0.8" />
      <circle cx="7" cy="22" r="1" fill="#FBBF24" />
    </svg>
  );
}

/** Ô biểu tượng nền đen viền vàng + chữ ALPINE COASTER. */
export function BrandLogo({ legend = true }: { legend?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 select-none shrink-0">
      <div
        className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl relative flex items-center justify-center shrink-0 overflow-hidden shadow-md"
        style={{
          backgroundColor: '#1c1917',
          border: '1.5px solid #c8a97e',
          boxShadow: 'rgba(0,0,0,0.4) 0 2px 8px, rgba(200,169,126,0.6) 0 1px 1px inset',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-amber-100/10 to-transparent pointer-events-none" />
        <CoasterMark />
        <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
        </span>
      </div>
      <div className="flex flex-col justify-center min-w-0">
        <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap leading-none">
          <span
            className="text-[12px] sm:text-base font-black italic tracking-tight uppercase leading-none"
            style={{ backgroundImage: 'linear-gradient(#1c1917, #44403c)', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            ALPINE
          </span>
          <span
            className="text-[12px] sm:text-base font-extrabold italic tracking-tight uppercase leading-none text-gold"
            style={{ textShadow: 'rgba(0,0,0,0.15) 0 1px 1px' }}
          >
            COASTER
          </span>
        </div>
        {legend && (
          <div className="hidden sm:flex items-center gap-1.5 text-[9px] text-slate-400 tracking-wide mt-0.5 whitespace-nowrap">
            <span className="text-emerald-600 font-bold">AC 1: L1-2</span>
            <span>•</span>
            <span className="text-sky-600 font-bold">AC 2: L3-4</span>
            <span>•</span>
            <span className="text-red-600 font-bold">AC 3: L5-6</span>
          </div>
        )}
      </div>
    </div>
  );
}
