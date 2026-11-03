import { useEffect, useState } from 'react';
import { FileSpreadsheet, FileText, LoaderCircle, Smartphone, TableProperties, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useActor, useAuth } from './auth/AuthProvider';
import { canManageUsers, type Access } from './auth/access';
import { isMangId, type MangId, type SlotId } from './config';
import { dateKeyVN } from './time';
import { AppShell, type MenuItem, type Tab } from './components/AppShell';
import { LoginScreen } from './screens/LoginScreen';
import { PendingScreen } from './screens/PendingScreen';
import { UsersScreen } from './screens/UsersScreen';
import { StaffEntryScreen } from './screens/staff/StaffEntryScreen';
import { MatrixScreen } from './screens/review/MatrixScreen';
import { ReportScreen } from './screens/report/ReportScreen';
import { saveSheetsWebhook, useSheetsWebhook } from './report/api';
import { writeErrorMessage } from './entries/api';

type TabId = 'entry' | 'matrix' | 'report' | 'users';

const TABS: Tab<TabId>[] = [
  { id: 'entry', label: 'Nhập 6 Line', icon: Smartphone },
  { id: 'matrix', label: 'Ma Trận Giờ', icon: TableProperties },
  { id: 'report', label: 'Báo Cáo Ca', icon: FileText },
];

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
  const actor = useActor();
  const webhook = useSheetsWebhook();
  const admin = canManageUsers(access);
  const [current, setCurrent] = useState<TabId>(() => {
    const saved = readLocal(TAB_KEY) as TabId | null;
    return saved && (TABS.some((t) => t.id === saved) || (saved === 'users' && admin)) ? saved : 'entry';
  });
  const [date, setDate] = useState(() => dateKeyVN());
  const [selectedSlot, setSelectedSlot] = useState<SlotId | null>(null);
  const [mang, setMang] = useState<MangId>(() => {
    const saved = Number(readLocal(MANG_KEY));
    return isMangId(saved) ? saved : isMangId(profile?.mang) ? profile.mang : 1;
  });

  useEffect(() => writeLocal(TAB_KEY, current), [current]);
  useEffect(() => writeLocal(MANG_KEY, String(mang)), [mang]);

  const menu: MenuItem[] = admin
    ? [
        { label: 'Tài khoản (duyệt Gmail)', icon: Users, onClick: () => setCurrent('users') },
        {
          label: 'Google Sheets',
          icon: FileSpreadsheet,
          onClick: () => {
            const url = window.prompt('URL Web App của Google Apps Script (giống URL đã dùng ở app cũ):', webhook ?? '');
            if (url === null) return;
            if (url && !/^https:\/\/script\.google\.com\//.test(url.trim())) {
              toast.error('URL phải bắt đầu bằng https://script.google.com/');
              return;
            }
            saveSheetsWebhook(url, actor).then(
              () => toast.success('Đã lưu URL Google Sheets cho mọi máy.'),
              (e) => toast.error(`Không lưu được: ${writeErrorMessage(e)}`),
            );
          },
        },
      ]
    : [];

  return (
    <AppShell tabs={TABS} current={current} onChange={setCurrent} date={date} onDateChange={setDate} menu={menu}>
      <div key={current} className="animate-tab-fade">
        {current === 'entry' && (
          <StaffEntryScreen
            key={mang}
            mang={mang}
            onChangeMang={setMang}
            selectedSlotId={selectedSlot}
            onSelectSlotId={setSelectedSlot}
          />
        )}
        {current === 'matrix' && (
          <MatrixScreen
            date={date}
            onSelectSlot={(slotId) => {
              setSelectedSlot(slotId);
              setCurrent('entry');
            }}
          />
        )}
        {current === 'report' && <ReportScreen date={date} onGoMatrix={() => setCurrent('matrix')} />}
        {current === 'users' && admin && <UsersScreen />}
      </div>
    </AppShell>
  );
}
