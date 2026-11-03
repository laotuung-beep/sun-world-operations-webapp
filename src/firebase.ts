import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const PROJECT_ID = 'sunworld-ops-laotuung';

// Đăng nhập qua chính tên miền đang mở (web.app / kênh xem thử) để luồng redirect
// không bị trình duyệt chặn cookie bên thứ ba. Các nơi khác (localhost) dùng firebaseapp.com.
function pickAuthDomain(): string {
  const host = typeof window === 'undefined' ? '' : window.location.hostname;
  const isOwnHosting =
    host === `${PROJECT_ID}.firebaseapp.com` || (host.startsWith(PROJECT_ID) && host.endsWith('.web.app'));
  return isOwnHosting ? host : `${PROJECT_ID}.firebaseapp.com`;
}

export const app = initializeApp({
  apiKey: 'AIzaSyAVHfPs1IsHNpwwVKbnd0LBNhcbM8Wu17g',
  authDomain: pickAuthDomain(),
  projectId: PROJECT_ID,
  storageBucket: `${PROJECT_ID}.firebasestorage.app`,
  messagingSenderId: '432835347015',
  appId: '1:432835347015:web:421389b25b807c34cfa762',
});

export const auth = getAuth(app);
auth.languageCode = 'vi';

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Bộ nhớ đệm trên máy: mất mạng vẫn lưu được, có mạng lại tự gửi lên.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
