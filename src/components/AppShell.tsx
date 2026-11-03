import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Cloud, CloudOff, LogOut, type LucideIcon } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { ACCESS_LABEL } from '../auth/access';
import { useOnline } from '../hooks/useOnline';
import { Avatar } from './Avatar';
import { BrandLogo } from './brand';
import { DateSelector } from './DateSelector';

export interface Tab<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
}

export interface MenuItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}

interface Props<T extends string> {
  tabs: Tab<T>[];
  current: T;
  onChange: (id: T) => void;
  date: string;
  onDateChange: (date: string) => void;
  menu?: MenuItem[];
  children: ReactNode;
}

/** Khung app theo giao diện cũ: thanh trên ALPINE COASTER, tab giữa (máy tính), thanh tab dưới (điện thoại). */
export function AppShell<T extends string>({ tabs, current, onChange, date, onDateChange, menu = [], children }: Props<T>) {
  return (
    <div className="min-h-dvh flex flex-col overflow-x-hidden w-full">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 py-2">
          <div className="flex items-center justify-between gap-1.5 w-full">
            <BrandLogo />
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <SyncBadge />
              <DateSelector date={date} onChange={onDateChange} />
              <AccountMenu menu={menu} />
            </div>
          </div>
        </div>
        <div className="hidden md:block bg-slate-50/70 border-t border-slate-100 py-1.5 px-3">
          <div className="max-w-7xl mx-auto">
            <nav className="bg-slate-200/60 p-1 rounded-xl grid gap-1 text-center" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
              {tabs.map((t) => {
                const active = t.id === current;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onChange(t.id)}
                    className={`relative min-h-[40px] flex items-center justify-center gap-1.5 px-2 rounded-lg text-sm transition-colors ${
                      active ? 'bg-white shadow-sm text-slate-900 font-extrabold' : 'font-semibold text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <t.icon className="w-4 h-4" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-2 sm:px-6 lg:px-8 pt-2 sm:pt-4 pb-28 md:pb-8">{children}</main>

      <nav
        aria-label="Thanh điều hướng"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))]"
      >
        <div className="max-w-md mx-auto flex items-center justify-around gap-1">
          {tabs.map((t) => {
            const active = t.id === current;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange(t.id)}
                className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl min-h-[46px] relative active:scale-95 transition ${
                  active ? 'text-brand bg-red-50/80 border border-red-100' : 'text-slate-500 hover:text-slate-800 border border-transparent'
                }`}
              >
                <t.icon className={`w-5 h-5 ${active ? 'scale-110 stroke-[2.3]' : 'stroke-[1.8]'}`} />
                <span className={`text-[11px] tracking-tight mt-0.5 leading-none ${active ? 'font-bold' : 'font-medium'}`}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function SyncBadge() {
  const online = useOnline();
  return online ? (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shrink-0 select-none" title="Kết nối Cloud Firestore ổn định">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
      <span className="hidden sm:inline">Realtime</span>
      <Cloud className="w-3 h-3 text-emerald-600 shrink-0 hidden xs:inline" />
    </div>
  ) : (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200 shrink-0 select-none" title="Mất mạng - phiếu lưu trên máy, có mạng sẽ tự gửi">
      <CloudOff className="w-3 h-3 shrink-0" />
      <span className="hidden sm:inline">Mất mạng</span>
    </div>
  );
}

function AccountMenu({ menu }: { menu: MenuItem[] }) {
  const { user, profile, access, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const name = profile?.displayName || user?.displayName || user?.email || '';

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="min-h-[30px] sm:min-h-[34px] px-1.5 sm:px-2 py-1 rounded-xl border border-emerald-300 bg-emerald-50 hover:brightness-95 active:scale-95 flex items-center gap-1 shadow-2xs transition"
        aria-label={`Tài khoản: ${name}`}
      >
        <Avatar name={name} photoURL={user?.photoURL ?? undefined} size={22} />
        <ChevronDown className={`w-3.5 h-3.5 text-emerald-800 opacity-75 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-slate-200 shadow-xl p-2 z-50">
          <div className="flex items-center gap-2.5 p-2">
            <Avatar name={name} photoURL={user?.photoURL ?? undefined} size={36} />
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{name}</p>
              <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
              <p className="text-[10px] font-bold text-brand">{access ? ACCESS_LABEL[access.kind] : ''}</p>
            </div>
          </div>
          <div className="border-t border-slate-100 my-1" />
          {menu.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <item.icon className="w-4 h-4 text-slate-500" /> {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => signOut()}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" /> Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}
