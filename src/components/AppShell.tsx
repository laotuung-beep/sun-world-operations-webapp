import type { ReactNode } from 'react';
import { LogOut, type LucideIcon } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { ACCESS_LABEL } from '../auth/access';
import { Avatar } from './Avatar';

export interface Tab<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
}

interface Props<T extends string> {
  tabs: Tab<T>[];
  current: T;
  onChange: (id: T) => void;
  children: ReactNode;
}

export function AppShell<T extends string>({ tabs, current, onChange, children }: Props<T>) {
  const { user, profile, access, signOut } = useAuth();
  const roleLabel = access ? ACCESS_LABEL[access.kind] : '';
  const showNav = tabs.length > 1;

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="w-8 h-8" />
          <div className="min-w-0">
            <p className="font-extrabold leading-tight truncate">Vận Hành Máng Trượt</p>
            <p className="text-[11px] text-slate-500 leading-tight truncate">Sun World Ba Na Hills</p>
          </div>

          {showNav && (
            <nav className="hidden md:flex items-center gap-1 ml-6">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onChange(t.id)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition ${
                    t.id === current ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <t.icon className="w-4 h-4" /> {t.label}
                </button>
              ))}
            </nav>
          )}

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:block text-right min-w-0">
              <p className="text-sm font-semibold truncate max-w-48">{profile?.displayName || user?.displayName}</p>
              <p className="text-[11px] font-bold text-brand">{roleLabel}</p>
            </div>
            <Avatar name={profile?.displayName || user?.displayName || undefined} photoURL={user?.photoURL ?? undefined} size={34} />
            <button
              type="button"
              onClick={() => signOut()}
              title="Đăng xuất"
              className="w-9 h-9 grid place-items-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className={`flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 ${showNav ? 'pb-24 md:pb-8' : ''}`}>{children}</main>

      {showNav && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-slate-200 grid pb-[env(safe-area-inset-bottom)]" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={`h-[var(--nav-h)] flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${t.id === current ? 'text-brand' : 'text-slate-500'}`}
            >
              <t.icon className="w-5 h-5" />
              {t.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
