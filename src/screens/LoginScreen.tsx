import { useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { MANGS } from '../config';
import { signInErrorMessage, useAuth } from '../auth/AuthProvider';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function LoginScreen() {
  const { signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="relative min-h-dvh overflow-hidden bg-[#040507] text-white">
      <video
        src="/assets/coaster_sphere_v2.mp4"
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-70 pointer-events-none"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/80" />

      <main className="relative z-10 min-h-dvh flex items-end sm:items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-sm rounded-3xl bg-zinc-950/70 backdrop-blur-xl border border-white/10 p-6 shadow-2xl">
          <div className="grid grid-cols-3 gap-2 mb-5">
            {MANGS.map((m) => (
              <img key={m.id} src={m.logo} alt={m.name} className="w-full h-10 object-contain" />
            ))}
          </div>

          <h1 className="text-xl font-extrabold leading-tight">Vận Hành Máng Trượt</h1>
          <p className="text-sm text-zinc-300 mt-1">Sun World Ba Na Hills · Alpine Coaster</p>

          <button
            type="button"
            onClick={handleSignIn}
            disabled={busy}
            className="mt-6 w-full flex items-center justify-center gap-3 rounded-xl bg-white text-zinc-900 font-bold py-3.5 hover:bg-zinc-100 active:scale-[0.99] transition disabled:opacity-60"
          >
            {busy ? <LoaderCircle className="w-5 h-5 animate-spin" /> : <GoogleIcon />}
            Đăng nhập với Google
          </button>

          {error && (
            <p role="alert" className="mt-3 text-sm text-red-300 bg-red-950/60 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <p className="mt-5 text-xs text-zinc-400 leading-relaxed">
            Dùng Gmail được cấp. Lần đầu đăng nhập, tài khoản cần quản trị viên duyệt và giao máng trước khi sử dụng.
          </p>
        </div>
      </main>
    </div>
  );
}
