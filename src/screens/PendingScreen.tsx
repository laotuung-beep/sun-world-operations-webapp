import { Hourglass, LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { Avatar } from '../components/Avatar';

export function PendingScreen() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-dvh grid place-items-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-sm p-6 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 grid place-items-center">
          <Hourglass className="w-7 h-7" />
        </div>
        <h1 className="mt-4 text-lg font-extrabold">Tài khoản đang chờ duyệt</h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Nhờ quản trị viên vào mục Tài khoản để duyệt Gmail này. Màn hình sẽ tự mở khi được duyệt.
        </p>

        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-slate-50 border border-slate-200 p-3 text-left">
          <Avatar name={user?.displayName ?? undefined} photoURL={user?.photoURL ?? undefined} size={40} />
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{user?.displayName}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => signOut()}
          className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <LogOut className="w-4 h-4" /> Đăng xuất, dùng Gmail khác
        </button>
      </div>
    </div>
  );
}
