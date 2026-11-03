import type { User } from 'firebase/auth';
import { AuthContext, type AuthState } from '../auth/AuthProvider';
import { AppShell } from '../components/AppShell';
import { ClipboardPen } from 'lucide-react';
import { StaffEntryScreen } from '../screens/staff/StaffEntryScreen';
import { EntryList } from '../screens/staff/EntryList';
import { dateKeyVN } from '../time';
import type { Entry } from '../entries/model';

// Chỉ dùng khi `npm run dev`: http://localhost:5178/?preview
// Gắn người dùng giả để xem giao diện sau đăng nhập. Firestore sẽ từ chối đọc / ghi (chưa đăng nhập thật).

const fakeUser = { uid: 'dev', email: 'nhanvien@example.com', displayName: 'Nhân viên thử', photoURL: null } as unknown as User;

const fakeAuth: AuthState = {
  loading: false,
  user: fakeUser,
  profile: { uid: 'dev', displayName: 'Nhân viên thử', approved: true, appRole: 'staff', mang: 1 },
  access: { kind: 'staff', mang: 1 },
  signIn: async () => {},
  signOut: async () => {},
};

const today = dateKeyVN();
const t = (h: number, m: number) => new Date(`${today}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+07:00`);

const sample: Entry[] = [
  { id: '1', date: today, slotId: '1000', mang: 1, status: 'approved', createdBy: 'a', createdByName: 'Trần Văn A', createdAt: t(10, 20), clientCreatedAt: 0, pendingSync: false, lines: { line1: { single: 12, double: 8 }, line2: { single: 10, double: 5 } } },
  { id: '2', date: today, slotId: '1000', mang: 1, status: 'pending', createdBy: 'dev', createdByName: 'Nhân viên thử', createdAt: t(10, 55), clientCreatedAt: 0, pendingSync: false, lines: { line1: { single: 6, double: 4 }, line2: { single: 3, double: 2 } } },
  { id: '3', date: today, slotId: '1100', mang: 1, status: 'rejected', rejectReason: 'Trùng phiếu lúc 11:05', createdBy: 'a', createdByName: 'Trần Văn A', createdAt: t(11, 10), clientCreatedAt: 0, pendingSync: false, lines: { line1: { single: 5, double: 1 }, line2: { single: 0, double: 0 } } },
  { id: '4', date: today, slotId: '1100', mang: 1, status: 'cancelled', createdBy: 'dev', createdByName: 'Nhân viên thử', createdAt: t(11, 15), clientCreatedAt: 0, pendingSync: false, lines: { line1: { single: 2, double: 0 }, line2: { single: 1, double: 0 } } },
  { id: '5', date: today, slotId: '1100', mang: 1, status: 'pending', createdBy: 'dev', createdByName: 'Nhân viên thử', createdAt: null, clientCreatedAt: t(11, 40).getTime(), pendingSync: true, lines: { line1: { single: 9, double: 3 }, line2: { single: 7, double: 2 } } },
];

export function Preview() {
  return (
    <AuthContext.Provider value={fakeAuth}>
      <AppShell tabs={[{ id: 'entry', label: 'Nhập phiếu', icon: ClipboardPen }]} current="entry" onChange={() => {}}>
        <StaffEntryScreen mang={1} />
        <h2 className="mt-8 mb-2 text-xs font-bold uppercase text-slate-400">Xem thử danh sách phiếu (dữ liệu mẫu)</h2>
        <EntryList entries={sample} myUid="dev" date={today} closed={false} error={false} />
      </AppShell>
    </AuthContext.Provider>
  );
}
