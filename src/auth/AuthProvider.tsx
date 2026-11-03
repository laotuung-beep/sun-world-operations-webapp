import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { resolveAccess, type Access, type UserProfile } from './access';

export interface AuthState {
  /** true cho tới khi biết chắc đã / chưa đăng nhập và đã đọc xong hồ sơ. */
  loading: boolean;
  user: User | null;
  profile: UserProfile | null;
  access: Access | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

/** Xuất ra để màn xem thử khi dev (src/dev/Preview.tsx) gắn người dùng giả. */
export const AuthContext = createContext<AuthState | null>(null);

/** Ghi / cập nhật hồ sơ của chính mình. Không bao giờ đụng tới approved / appRole / mang. */
async function upsertOwnProfile(user: User): Promise<void> {
  const ref = doc(db, 'users', user.uid);
  const info = {
    uid: user.uid,
    email: (user.email ?? '').toLowerCase(),
    displayName: user.displayName ?? user.email?.split('@')[0] ?? 'Nhân viên',
    photoURL: user.photoURL ?? '',
    lastLoginAt: serverTimestamp(),
  };
  const snap = await getDoc(ref);
  await setDoc(ref, snap.exists() ? info : { ...info, createdAt: serverTimestamp() }, { merge: true });
}

const POPUP_FALLBACK = new Set(['auth/popup-blocked', 'auth/operation-not-supported-in-environment']);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    getRedirectResult(auth).catch(() => {});
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    setProfile(null);
    setProfileReady(false);
    if (!user) return;
    upsertOwnProfile(user).catch((e) => console.warn('Không ghi được hồ sơ người dùng:', e));
    return onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        setProfile(snap.exists() ? ({ uid: user.uid, ...snap.data() } as UserProfile) : null);
        setProfileReady(true);
      },
      (e) => {
        console.warn('Không đọc được hồ sơ người dùng:', e);
        setProfileReady(true);
      },
    );
  }, [user]);

  const value = useMemo<AuthState>(() => {
    const loading = !authReady || (!!user && !profileReady);
    return {
      loading,
      user,
      profile,
      access: user && !loading ? resolveAccess(user.email, profile) : null,
      async signIn() {
        try {
          await signInWithPopup(auth, googleProvider);
        } catch (e) {
          const code = (e as { code?: string }).code ?? '';
          if (POPUP_FALLBACK.has(code)) return signInWithRedirect(auth, googleProvider);
          throw e;
        }
      },
      signOut: () => fbSignOut(auth),
    };
  }, [authReady, user, profile, profileReady]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải nằm trong <AuthProvider>');
  return ctx;
}

/** Người đang thao tác (ghi vào phiếu duyệt / chốt ngày). */
export function useActor(): { uid: string; name: string } {
  const { user, profile } = useAuth();
  return { uid: user?.uid ?? '', name: profile?.displayName || user?.displayName || user?.email || 'Không rõ' };
}

/** Thông báo lỗi đăng nhập bằng tiếng Việt. */
export function signInErrorMessage(e: unknown): string | null {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null;
    case 'auth/unauthorized-domain':
      return `Tên miền "${window.location.hostname}" chưa được cho phép đăng nhập. Thêm nó vào Firebase Console → Authentication → Settings → Authorized domains.`;
    case 'auth/network-request-failed':
      return 'Không có mạng. Kiểm tra kết nối rồi thử lại.';
    case 'auth/operation-not-allowed':
      return 'Đăng nhập Google chưa được bật trong Firebase Console → Authentication → Sign-in method.';
    default:
      return `Đăng nhập Google thất bại${code ? ` (${code})` : ''}.`;
  }
}
