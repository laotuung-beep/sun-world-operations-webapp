import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { dateKeyVN } from '../time';

interface DateSelectorProps {
  date: string; // 'YYYY-MM-DD'
  onChange: (d: string) => void;
  savedDates?: string[];
}

function parseParts(dStr: string) {
  const [y, m, d] = (dStr || '').split('-');
  return {
    year: parseInt(y, 10) || 2026,
    month: parseInt(m, 10) || 11,
    day: parseInt(d, 10) || 1,
  };
}

function getVietnamTimeString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(d);
}

export function DateSelector({ date, onChange, savedDates = [] }: DateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [timeVN, setTimeVN] = useState(() => getVietnamTimeString());
  const containerRef = useRef<HTMLDivElement>(null);

  const todayVN = dateKeyVN();
  const isViewingToday = date === todayVN;

  const { year: selYear, month: selMonth } = parseParts(date);
  const [viewYear, setViewYear] = useState<number>(selYear);
  const [viewMonth, setViewMonth] = useState<number>(selMonth);

  useEffect(() => {
    const { year, month } = parseParts(date);
    setViewYear(year);
    setViewMonth(month);
  }, [date]);

  // Cập nhật đồng hồ thời gian thực Múi giờ Việt Nam mỗi giây
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeVN(getVietnamTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Đóng popover khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const mStr = String(viewMonth).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const newDateStr = `${viewYear}-${mStr}-${dStr}`;
    onChange(newDateStr);
    setIsOpen(false);
  };

  const handleQuickJumpToday = () => {
    onChange(todayVN);
    const { year, month } = parseParts(todayVN);
    setViewYear(year);
    setViewMonth(month);
    setIsOpen(false);
  };

  // Tính toán lưới lịch theo chuẩn tuần Việt Nam (Bắt đầu từ Thứ Hai)
  const firstDayIndex = new Date(viewYear, viewMonth - 1, 1).getDay(); // 0: CN, 1: T2, ..., 6: T7
  const startOffset = (firstDayIndex + 6) % 7; // T2 = 0, T3 = 1, ..., CN = 6
  const daysInCurrentMonth = new Date(viewYear, viewMonth, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth - 1, 0).getDate();

  const prevMonthDays = Array.from({ length: startOffset }, (_, i) => {
    return daysInPrevMonth - startOffset + 1 + i;
  });

  const currentMonthDays = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1);

  const totalSlots = startOffset + daysInCurrentMonth;
  const remainingSlots = totalSlots % 7 === 0 ? 0 : 7 - (totalSlots % 7);
  const nextMonthDays = Array.from({ length: remainingSlots }, (_, i) => i + 1);

  const weekHeaders = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  const [y, m, d] = date.split('-');

  return (
    <div className="relative" ref={containerRef}>
      {/* NÚT KÍCH HOẠT CHÍNH TRÊN THANH HEADER */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 border active:scale-[0.98] rounded-xl px-2 sm:px-2.5 py-1 sm:py-1.5 text-xs min-h-[30px] sm:min-h-[34px] shrink-0 transition-all cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
          isOpen
            ? 'bg-slate-100 border-slate-300 text-slate-900 font-bold'
            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
        }`}
        title="Chọn ngày vận hành kiểm tra thông tin"
        aria-label="Chọn ngày vận hành"
      >
        <CalendarIcon className="w-3.5 h-3.5 text-[#D71920] shrink-0" strokeWidth={2.2} />

        {/* Chấm tròn xanh báo hiệu hôm nay */}
        {isViewingToday && (
          <span
            className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse"
            title="Đang xem hôm nay"
          />
        )}

        {/* Hiển thị ngày chuẩn Việt Nam DD/MM (mobile) hoặc DD/MM/YYYY (desktop) */}
        <span className="text-xs font-bold text-slate-900 whitespace-nowrap">
          <span className="sm:hidden">{d}/{m}</span>
          <span className="hidden sm:inline">{d}/{m}/{y}</span>
        </span>

        {isViewingToday && (
          <span className="hidden md:inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            Hôm nay
          </span>
        )}

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* POPOVER LỊCH CHỌN NGÀY NGUYÊN BẢN */}
      {isOpen && (
        <>
          {/* Backdrop làm mờ khi mở lịch trên di động */}
          <div
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px] sm:hidden"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="fixed inset-x-2.5 top-12 sm:top-full sm:inset-x-auto sm:absolute sm:right-0 mt-2 max-w-[325px] w-auto sm:w-[325px] mx-auto sm:mx-0 bg-white rounded-2xl shadow-2xl sm:shadow-xl border border-[#E5E7EB] p-3 sm:p-3.5 space-y-2.5 z-50 text-[#20242B] animate-tab-fade"
          >
            {/* 1. THANH ĐIỀU HƯỚNG THÁNG & ĐỒNG HỒ VIỆT NAM */}
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F3F5]">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 active:scale-95 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
                title="Tháng trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="text-center">
                <span className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight font-sans">
                  Tháng {viewMonth}, {viewYear}
                </span>
                <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500 font-sans tabular-nums mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{timeVN} (GMT+7)</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 active:scale-95 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
                title="Tháng sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* 2. TIÊU ĐỀ THỨ TRONG TUẦN (CHUẨN TIẾNG VIỆT T2 -> CN) */}
            <div className="grid grid-cols-7 text-center gap-1">
              {weekHeaders.map((head, idx) => (
                <span
                  key={head}
                  className={`text-[10px] font-bold uppercase py-1 ${
                    idx === 6 ? 'text-red-500' : 'text-slate-400'
                  }`}
                >
                  {head}
                </span>
              ))}
            </div>

            {/* 3. LƯỚI NGÀY TRONG THÁNG */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {prevMonthDays.map((dayNum) => (
                <div
                  key={`prev-${dayNum}`}
                  className="h-8 flex items-center justify-center text-[11px] font-medium text-slate-300 select-none"
                >
                  {dayNum}
                </div>
              ))}

              {currentMonthDays.map((dayNum) => {
                const mStr = String(viewMonth).padStart(2, '0');
                const dStr = String(dayNum).padStart(2, '0');
                const dateKey = `${viewYear}-${mStr}-${dStr}`;

                const isSelected = dateKey === date;
                const isToday = dateKey === todayVN;
                const hasData = savedDates.includes(dateKey);

                return (
                  <button
                    key={`curr-${dayNum}`}
                    type="button"
                    onClick={() => handleSelectDay(dayNum)}
                    className={`h-8 w-full rounded-lg flex flex-col items-center justify-center text-xs font-semibold relative transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-[#D71920] text-white font-bold shadow-xs active:scale-95'
                        : isToday
                        ? 'border border-[#D71920] text-[#D71920] font-bold hover:bg-red-50'
                        : 'text-slate-700 hover:bg-slate-100 active:scale-95'
                    }`}
                  >
                    <span>{dayNum}</span>
                    {hasData && (
                      <span
                        className={`w-1 h-1 rounded-full absolute bottom-1 ${
                          isSelected ? 'bg-white' : 'bg-[#D71920]'
                        }`}
                      />
                    )}
                  </button>
                );
              })}

              {nextMonthDays.map((dayNum) => (
                <div
                  key={`next-${dayNum}`}
                  className="h-8 flex items-center justify-center text-[11px] font-medium text-slate-300 select-none"
                >
                  {dayNum}
                </div>
              ))}
            </div>

            {/* 4. FOOTER: NÚT HÔM NAY & CHÚ THÍCH */}
            <div className="pt-2 border-t border-[#F1F3F5] flex items-center justify-between gap-1 text-[11px]">
              <button
                type="button"
                onClick={handleQuickJumpToday}
                className="px-2.5 py-1 rounded-lg font-bold text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>Hôm nay ({todayVN.split('-')[2]}/{todayVN.split('-')[1]})</span>
              </button>

              {date !== '2026-10-31' && (
                <button
                  type="button"
                  onClick={() => {
                    onChange('2026-10-31');
                    setViewYear(2026);
                    setViewMonth(10);
                    setIsOpen(false);
                  }}
                  className="px-2 py-1 rounded-lg text-[10px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Mẫu 31/10
                </button>
              )}

              <div className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D71920]" />
                <span>Vận hành</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
