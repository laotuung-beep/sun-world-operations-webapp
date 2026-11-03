import { useEffect, useState } from 'react';
import { ChartColumn, ClipboardPen, ListChecks, LoaderCircle, Users } from 'lucide-react';
import { useAuth } from './auth/AuthProvider';
import { canManageUsers, type Access } from './auth/access';
import { isMangId, type MangId } from './config';
import { dateKeyVN } from './time';
import { AppShell, type Tab } from './components/AppShell';
import { LoginScreen } from './screens/LoginScreen';
import { PendingScreen } from './screens/PendingScreen';
import { UsersScreen } from './screens/UsersScreen';
import { StaffEntryScreen } from './screens/staff/StaffEntryScreen';
import { ReviewScreen } from './screens/review/ReviewScreen';
import { ReportScreen } from './screens/report/ReportScreen';

type TabId = 'entry' | 'review' | 'report' | 'users';

function tabsFor(access: Access): Tab<TabId>[] {
  const tabs: Tab<TabId>[] = [
    { id: 'entry', label: 'Nhập phiếu', icon: ClipboardPen },
    { id: 'review', label: 'Chờ duyệt', icon: ListChecks },
    { id: 'report', label: 'Báo cáo', icon: ChartColumn },
  ];
  if (canManageUsers(access)) tabs.push({ id: 'users', label: 'Tài khoản', icon: Users });
  return tabs;
}

export default function App() {
  const { loading, user, access } = useAuth();

  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center text-slate-500">
        <LoaderCircle className="w-7 h-7 animate-spin" />
      </div>
    );
  }
  if (!user || !access) return <LoginScreen />;
  if (access.kind === 'pending') return <PendingScreen />;
  return <Workspace access={access} />;
}

const TAB_KEY = 'mt_tab';
const MANG_KEY = 'mt_mang';

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* chế độ ẩn danh: bỏ qua */
  }
}

function Workspace({ access }: { access: Access }) {
  const { profile } = useAuth();
  const tabs = tabsFor(access);
  const [current, setCurrent] = useState<TabId>(() => (readLocal(TAB_KEY) as TabId) || 'entry');
  const tab = tabs.some((t) => t.id === current) ? current : tabs[0]!.id;
  const [date, setDate] = useState(() => dateKeyVN());
  const [mang, setMang] = useState<MangId>(() => {
    const saved = Number(readLocal(MANG_KEY));
    return isMangId(saved) ? saved : isMangId(profile?.mang) ? profile.mang : 1;
  });

  useEffect(() => writeLocal(TAB_KEY, tab), [tab]);
  useEffect(() => writeLocal(MANG_KEY, String(mang)), [mang]);

  return (
    <AppShell tabs={tabs} current={tab} onChange={setCurrent}>
      {tab === 'entry' && <StaffEntryScreen key={mang} mang={mang} onChangeMang={setMang} />}
      {tab === 'review' && <ReviewScreen date={date} onDateChange={setDate} />}
      {tab === 'report' && <ReportScreen date={date} onDateChange={setDate} onGoReview={() => setCurrent('review')} />}
      {tab === 'users' && <UsersScreen />}
    </AppShell>
  );
}
