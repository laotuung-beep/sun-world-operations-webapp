import { useState } from 'react';
import { ChartColumn, ClipboardPen, ListChecks, LoaderCircle, Users } from 'lucide-react';
import { useAuth } from './auth/AuthProvider';
import { canManageUsers, type Access } from './auth/access';
import { AppShell, type Tab } from './components/AppShell';
import { LoginScreen } from './screens/LoginScreen';
import { PendingScreen } from './screens/PendingScreen';
import { UsersScreen } from './screens/UsersScreen';
import { ComingSoon } from './screens/ComingSoon';
import { StaffEntryScreen } from './screens/staff/StaffEntryScreen';

type TabId = 'entry' | 'review' | 'report' | 'users';

function tabsFor(access: Access): Tab<TabId>[] {
  if (access.kind === 'staff') return [{ id: 'entry', label: 'Nhập phiếu', icon: ClipboardPen }];
  const tabs: Tab<TabId>[] = [
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
  if (access.kind === 'pending') return <PendingScreen reason={access.reason} />;
  return <Workspace access={access} />;
}

function Workspace({ access }: { access: Exclude<Access, { kind: 'pending' }> }) {
  const tabs = tabsFor(access);
  const [current, setCurrent] = useState<TabId>(tabs[0]!.id);
  const tab = tabs.some((t) => t.id === current) ? current : tabs[0]!.id;

  return (
    <AppShell tabs={tabs} current={tab} onChange={setCurrent}>
      {tab === 'entry' && access.kind === 'staff' && <StaffEntryScreen mang={access.mang} />}
      {tab === 'review' && <ComingSoon title="Chờ duyệt theo khung giờ" phase={3} />}
      {tab === 'report' && <ComingSoon title="Báo cáo vận hành" phase={4} />}
      {tab === 'users' && <UsersScreen />}
    </AppShell>
  );
}
