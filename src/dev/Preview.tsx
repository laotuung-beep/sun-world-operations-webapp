import type { User } from 'firebase/auth';
import { AuthContext, type AuthState } from '../auth/AuthProvider';
import App from '../App';

// Chỉ dùng khi `npm run dev`: http://localhost:5178/?preview  (thêm &admin để xem như Super Admin)
// Gắn người dùng giả để xem giao diện sau đăng nhập. Firestore sẽ từ chối đọc / ghi (chưa đăng nhập thật),
// nên các danh sách hiện trống / báo lỗi - chỉ dùng để xem bố cục.

const admin = new URLSearchParams(location.search).has('admin');

const fakeUser = { uid: 'dev', email: 'nhanvien@example.com', displayName: 'Nhân viên thử', photoURL: null } as unknown as User;

const fakeAuth: AuthState = {
  loading: false,
  user: fakeUser,
  profile: { uid: 'dev', displayName: 'Nhân viên thử', approved: true, mang: 1 },
  access: admin ? { kind: 'superadmin' } : { kind: 'member' },
  signIn: async () => {},
  signOut: async () => {},
};

export function Preview() {
  return (
    <AuthContext.Provider value={fakeAuth}>
      <App />
    </AuthContext.Provider>
  );
}
