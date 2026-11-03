import { useEffect, useRef, useState } from 'react';
import { CircleAlert, LoaderCircle, X } from 'lucide-react';
import { MANGS, isMangId, type MangId } from '../config';
import { signInErrorMessage, useAuth } from '../auth/AuthProvider';

const MANG_KEY = 'mt_mang';
const VIDEO = '/assets/coaster_sphere_v2.mp4';

function savedMang(): MangId {
  try {
    const v = Number(localStorage.getItem(MANG_KEY));
    return isMangId(v) ? v : 1;
  } catch {
    return 1;
  }
}

function buzz(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* không hỗ trợ rung */
  }
}

/** Màn đăng nhập giống app cũ: quả cầu video toàn màn hình, chạm vào để mở thẻ đăng nhập. */
export function LoginScreen() {
  const { signIn } = useAuth();
  const [open, setOpen] = useState(false);
  const [mang, setMang] = useState<MangId>(savedMang);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const small = useRef<HTMLVideoElement>(null);
  const m = MANGS.find((x) => x.id === mang)!;

  useEffect(() => {
    small.current?.play().catch(() => {});
  }, [open]);

  function pick(id: MangId) {
    buzz(10);
    setMang(id);
    try {
      localStorage.setItem(MANG_KEY, String(id));
    } catch {
      /* chế độ ẩn danh */
    }
  }

  async function handleSignIn() {
    setBusy(true);
    setError(null);
    try {
      await signIn();
    } catch (e) {
      setError(signInErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-[#040507] text-white overflow-hidden select-none flex flex-col justify-between">
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0">
        <div className="w-[360px] h-[360px] sm:w-[540px] sm:h-[540px] rounded-full blur-[120px] opacity-25 transition-colors duration-700" style={{ backgroundColor: m.color }} />
        <div className="absolute inset-0 bg-radial from-transparent via-[#040507]/40 to-[#040507]" />
      </div>

      {open ? (
        <div className="relative z-20 w-full h-full flex flex-col items-center justify-between p-4 py-6 overflow-y-auto">
          <div
            className="w-40 h-40 sm:w-48 sm:h-48 rounded-full overflow-hidden relative shadow-2xl shrink-0 my-auto transition-all duration-500"
            style={{ boxShadow: `0 0 35px ${m.color}59, inset 0 0 20px ${m.color}26`, border: `2px solid ${m.color}70` }}
          >
            <video ref={small} src={VIDEO} autoPlay loop muted playsInline className="w-full h-full object-cover pointer-events-none" />
          </div>

          <div
            className="backdrop-blur-xl bg-black/65 rounded-3xl p-5 sm:p-6 shadow-2xl max-w-sm w-full relative overflow-hidden transition-all duration-500 mt-2 mb-auto"
            style={{ border: `1px solid ${m.color}50`, boxShadow: `0 20px 50px rgba(0,0,0,0.8), 0 0 30px ${m.color}26` }}
          >
            <button
              type="button"
              onClick={() => {
                buzz(10);
                setOpen(false);
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-zinc-400 hover:text-white"
              aria-label="Đóng giao diện đăng nhập"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-4">
              <label className="text-[11px] font-semibold text-zinc-400 block mb-2 uppercase tracking-wider">Chọn nhanh máng trực:</label>
              <div className="grid grid-cols-3 gap-2">
                {MANGS.map((x) => {
                  const active = x.id === mang;
                  return (
                    <button
                      key={x.id}
                      type="button"
                      onClick={() => pick(x.id)}
                      title={x.name}
                      className={`h-14 p-1.5 rounded-xl border flex items-center justify-center transition-all ${
                        active ? 'scale-[1.03] shadow-md ring-2' : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08] opacity-75 hover:opacity-100'
                      }`}
                      style={active ? { backgroundColor: `${x.color}25`, borderColor: x.color, boxShadow: `0 0 16px ${x.color}59` } : undefined}
                    >
                      <img src={x.logo} alt={x.name} className="h-9 w-full object-contain drop-shadow-sm pointer-events-none" />
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div role="alert" className="mb-3 p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <CircleAlert className="w-4 h-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSignIn}
              disabled={busy}
              className="w-full py-3 rounded-xl font-bold text-sm text-white shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 duration-300 disabled:opacity-70"
              style={{ backgroundColor: m.color, boxShadow: `0 8px 24px ${m.color}59`, border: `1px solid ${m.color}90` }}
            >
              {busy ? (
                <LoaderCircle className="w-4 h-4 animate-spin" />
              ) : (
                <svg className="w-4 h-4 shrink-0 bg-white rounded-full p-0.5" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                  <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
                </svg>
              )}
              <span>{busy ? 'Đang kết nối...' : "Let's Go · Đăng nhập Google"}</span>
            </button>

            <p className="mt-4 text-[11px] text-zinc-400 leading-relaxed text-center">
              Dùng Gmail được cấp. Lần đầu đăng nhập cần quản trị viên duyệt.
            </p>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            buzz(15);
            setOpen(true);
          }}
          className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden"
          aria-label="Chạm để đăng nhập"
        >
          <video src={VIDEO} autoPlay loop muted playsInline className="w-full h-full object-cover pointer-events-none" />
          <div className="absolute inset-0 pointer-events-none bg-radial from-transparent via-transparent to-[#040507]/60" />
          <span className="absolute bottom-[max(2rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 text-xs font-semibold text-white/70 tracking-wider animate-pulse">
            Chạm để bắt đầu
          </span>
        </button>
      )}
    </div>
  );
}
