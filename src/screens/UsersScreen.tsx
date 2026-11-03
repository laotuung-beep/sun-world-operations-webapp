import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, updateDoc, type Timestamp } from 'firebase/firestore';
import { Check, Lock, LoaderCircle, Search, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '../firebase';
import { MANGS, type MangId } from '../config';
import { useAuth } from '../auth/AuthProvider';
import { isSuperAdminEmail, type AppRole, type UserProfile } from '../auth/access';
import { buildAccessUpdate, type AccessDraft } from '../auth/userAdmin';
import { Avatar } from '../components/Avatar';

type Row = UserProfile & { lastLoginAt?: Timestamp };

const timeFmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
});

function lastLoginText(row: Row): string {
  const d = row.lastLoginAt?.toDate?.();
  return d ? `Đăng nhập ${timeFmt.format(d)}` : 'Chưa rõ lần đăng nhập';
}

function lastLoginMs(row: Row): number {
  return row.lastLoginAt?.toMillis?.() ?? 0;
}

export function UsersScreen() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(
    () =>
      onSnapshot(
        collection(db, 'users'),
        (snap) => setRows(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as Row)),
        (e) => {
          console.warn(e);
          toast.error('Không đọc được danh sách tài khoản.');
          setRows([]);
        },
      ),
    [],
  );

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (rows ?? []).filter(
      (r) => !q || r.email?.toLowerCase().includes(q) || r.displayName?.toLowerCase().includes(q),
    );
    const admins = list.filter((r) => isSuperAdminEmail(r.email));
    const others = list.filter((r) => !isSuperAdminEmail(r.email));
    return {
      pending: others.filter((r) => r.approved !== true).sort((a, b) => lastLoginMs(b) - lastLoginMs(a)),
      active: others
        .filter((r) => r.approved === true)
        .sort((a, b) => (a.displayName ?? '').localeCompare(b.displayName ?? '', 'vi')),
      admins,
    };
  }, [rows, query]);

  if (!rows) {
    return (
      <div className="grid place-items-center py-16 text-slate-500">
        <LoaderCircle className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
        <div>
          <h2 className="text-lg font-extrabold">Tài khoản</h2>
          <p className="text-sm text-slate-500">Duyệt Gmail mới, chọn vai trò và giao máng cho nhân viên.</p>
        </div>
        <label className="relative sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên hoặc Gmail"
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/30"
          />
        </label>
      </div>

      <Section title="Chờ duyệt" count={groups.pending.length} empty="Không có tài khoản nào chờ duyệt.">
        {groups.pending.map((r) => (
          <UserRow key={`${r.uid}:${r.appRole}:${r.mang}`} row={r} />
        ))}
      </Section>

      <Section title="Đang hoạt động" count={groups.active.length} empty="Chưa có tài khoản nào được duyệt.">
        {groups.active.map((r) => (
          <UserRow key={`${r.uid}:${r.appRole}:${r.mang}`} row={r} />
        ))}
      </Section>

      {groups.admins.length > 0 && (
        <Section title="Super Admin" count={groups.admins.length}>
          {groups.admins.map((r) => (
            <div key={r.uid} className="flex items-center gap-3 p-3">
              <Avatar name={r.displayName} photoURL={r.photoURL} />
              <Identity row={r} />
              <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-brand">
                <ShieldCheck className="w-4 h-4" /> Toàn quyền
              </span>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, count, empty, children }: { title: string; count: number; empty?: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
        {title} <span className="tabular text-slate-400">({count})</span>
      </h3>
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {count === 0 ? <p className="p-4 text-sm text-slate-400">{empty}</p> : children}
      </div>
    </section>
  );
}

function Identity({ row }: { row: Row }) {
  return (
    <div className="min-w-0">
      <p className="font-semibold text-sm truncate">{row.displayName || row.email}</p>
      <p className="text-xs text-slate-500 truncate">
        {row.email} · {lastLoginText(row)}
      </p>
    </div>
  );
}

function UserRow({ row }: { row: Row }) {
  const { user } = useAuth();
  const initial: AccessDraft = { appRole: row.appRole ?? '', mang: row.mang ?? null };
  const [draft, setDraft] = useState<AccessDraft>(initial);
  const [busy, setBusy] = useState(false);
  const approved = row.approved === true;
  const dirty = draft.appRole !== initial.appRole || (draft.appRole === 'staff' && draft.mang !== initial.mang);

  async function save() {
    const update = buildAccessUpdate(draft);
    if (!update.ok) {
      toast.error(update.error);
      return;
    }
    setBusy(true);
    try {
      await updateDoc(doc(db, 'users', row.uid), {
        ...update.data,
        approvedBy: user?.email ?? '',
        approvedAt: serverTimestamp(),
      });
      toast.success(`${approved ? 'Đã cập nhật' : 'Đã duyệt'} ${row.displayName || row.email}`);
    } catch (e) {
      console.warn(e);
      toast.error('Không lưu được. Kiểm tra rules Firestore đã publish bản mới chưa.');
    } finally {
      setBusy(false);
    }
  }

  async function lock() {
    if (!window.confirm(`Khoá tài khoản ${row.email}? Người này sẽ không dùng được app cho tới khi duyệt lại.`)) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, 'users', row.uid), {
        approved: false,
        approvedBy: user?.email ?? '',
        approvedAt: serverTimestamp(),
      });
      toast.success(`Đã khoá ${row.displayName || row.email}`);
    } catch (e) {
      console.warn(e);
      toast.error('Không khoá được tài khoản.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center gap-3">
      <div className="flex items-center gap-3 min-w-0 lg:w-80">
        <Avatar name={row.displayName} photoURL={row.photoURL} />
        <Identity row={row} />
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
        <Segmented<AppRole>
          value={draft.appRole}
          options={[
            { value: 'staff', label: 'Nhân viên' },
            { value: 'manager', label: 'Quản lý' },
          ]}
          onChange={(appRole) => setDraft((d) => ({ ...d, appRole }))}
        />
        {draft.appRole === 'staff' && (
          <Segmented<MangId>
            value={draft.mang ?? ''}
            options={MANGS.map((m) => ({ value: m.id, label: m.short, color: m.color }))}
            onChange={(mang) => setDraft((d) => ({ ...d, mang }))}
          />
        )}

        {!approved ? (
          <button type="button" onClick={save} disabled={busy} className={btn('bg-brand text-white hover:bg-brand-dark')}>
            {busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Duyệt
          </button>
        ) : (
          <>
            {dirty && (
              <button type="button" onClick={save} disabled={busy} className={btn('bg-slate-900 text-white hover:bg-slate-700')}>
                <Check className="w-4 h-4" /> Lưu
              </button>
            )}
            <button type="button" onClick={lock} disabled={busy} className={btn('border border-slate-200 text-slate-600 hover:bg-slate-50')}>
              <Lock className="w-4 h-4" /> Khoá
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function btn(extra: string): string {
  return `inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition disabled:opacity-50 ${extra}`;
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T | '';
  options: { value: T; label: string; color?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              active ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'
            }`}
            style={active && o.color ? { color: o.color } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
