import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { MangId, SlotId } from '../config';
import type { Entry, EntryLines } from './model';
import type { MangSchedule } from '../report/compute';

const entriesCol = (date: string) => collection(db, 'days', date, 'entries');

/** Lý do Cloud từ chối một lần ghi, bằng tiếng Việt. */
export function writeErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code;
  if (code === 'permission-denied') return 'không có quyền (tài khoản bị khoá / đổi máng, hoặc ngày đã chốt).';
  if (code === 'unavailable') return 'mất kết nối tới Cloud.';
  return (e as { message?: string })?.message ?? 'lỗi không rõ.';
}

function toEntry(snap: DocumentSnapshot): Entry {
  const d = snap.data({ serverTimestamps: 'none' }) ?? {};
  return {
    id: snap.id,
    date: d.date,
    slotId: d.slotId,
    mang: d.mang,
    lines: d.lines ?? {},
    status: d.status,
    createdBy: d.createdBy,
    createdByName: d.createdByName ?? '',
    createdByEmail: d.createdByEmail,
    createdAt: d.createdAt?.toDate?.() ?? null,
    clientCreatedAt: d.clientCreatedAt ?? 0,
    rejectReason: d.rejectReason,
    reviewedByName: d.reviewedByName,
    reviewedAt: d.reviewedAt?.toDate?.() ?? null,
    pendingSync: snap.metadata.hasPendingWrites,
  };
}

export interface NewEntry {
  date: string;
  slotId: SlotId;
  mang: MangId;
  lines: EntryLines;
  uid: string;
  name: string;
  email: string;
}

/**
 * Gửi một phiếu. Trả về ngay (phiếu đã nằm trong bộ nhớ trên máy); `synced` xong khi Cloud nhận,
 * bị từ chối nếu rules không cho. Mất mạng thì `synced` chờ tới khi có mạng lại.
 */
export function sendEntry(e: NewEntry): { id: string; synced: Promise<void> } {
  const ref = doc(entriesCol(e.date));
  const synced = setDoc(ref, {
    date: e.date,
    slotId: e.slotId,
    mang: e.mang,
    lines: e.lines,
    status: 'pending',
    createdBy: e.uid,
    createdByName: e.name.slice(0, 100),
    createdByEmail: e.email,
    createdAt: serverTimestamp(),
    clientCreatedAt: Date.now(),
  });
  return { id: ref.id, synced };
}

export function cancelEntry(date: string, id: string): Promise<void> {
  return updateDoc(doc(entriesCol(date), id), { status: 'cancelled', cancelledAt: serverTimestamp() });
}

/** Mọi phiếu của một ngày (màn Chờ duyệt / Báo cáo). */
export function useDayEntries(date: string): { entries: Entry[] | null; error: boolean } {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setEntries(null);
    setError(false);
    return onSnapshot(
      entriesCol(date),
      { includeMetadataChanges: true },
      (snap) => setEntries(snap.docs.map(toEntry)),
      (e) => {
        console.warn('Không đọc được phiếu:', e);
        setError(true);
        setEntries([]);
      },
    );
  }, [date]);

  return { entries, error };
}

export interface Reviewer {
  uid: string;
  name: string;
}

/** Duyệt nhiều phiếu một lần (duyệt cả khung giờ). Tối đa 450 phiếu mỗi lần ghi. */
export async function approveEntries(date: string, ids: string[], by: Reviewer): Promise<void> {
  for (let i = 0; i < ids.length; i += 450) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + 450)) {
      batch.update(doc(entriesCol(date), id), {
        status: 'approved',
        reviewedBy: by.uid,
        reviewedByName: by.name.slice(0, 100),
        reviewedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

export function rejectEntry(date: string, id: string, reason: string, by: Reviewer): Promise<void> {
  return updateDoc(doc(entriesCol(date), id), {
    status: 'rejected',
    rejectReason: reason.slice(0, 200),
    reviewedBy: by.uid,
    reviewedByName: by.name.slice(0, 100),
    reviewedAt: serverTimestamp(),
  });
}

/** null khi chưa biết. */
export function useDayClosed(date: string): boolean | null {
  const [closed, setClosed] = useState<boolean | null>(null);
  useEffect(() => {
    setClosed(null);
    return onSnapshot(
      doc(db, 'days', date),
      (snap) => setClosed(snap.data()?.closed === true),
      () => setClosed(false),
    );
  }, [date]);
  return closed;
}

export interface Schedule extends MangSchedule {
  updatedByName?: string;
  updatedAt?: Date | null;
}

export const EMPTY_SCHEDULE: Schedule = { openTime: '', closeTime: '', pausedMinutes: 0 };

export function useSchedule(date: string, mang: MangId): Schedule | null {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  useEffect(() => {
    setSchedule(null);
    return onSnapshot(
      doc(db, 'days', date, 'schedules', String(mang)),
      (snap) => {
        const d = snap.data({ serverTimestamps: 'estimate' });
        setSchedule(
          d
            ? {
                openTime: d.openTime ?? '',
                closeTime: d.closeTime ?? '',
                pausedMinutes: d.pausedMinutes ?? 0,
                updatedByName: d.updatedByName,
                updatedAt: d.updatedAt?.toDate?.() ?? null,
              }
            : EMPTY_SCHEDULE,
        );
      },
      (e) => {
        console.warn('Không đọc được giờ chạy:', e);
        setSchedule(EMPTY_SCHEDULE);
      },
    );
  }, [date, mang]);
  return schedule;
}

export function saveSchedule(date: string, mang: MangId, s: Schedule, uid: string, name: string): Promise<void> {
  return setDoc(doc(db, 'days', date, 'schedules', String(mang)), {
    mang,
    openTime: s.openTime,
    closeTime: s.closeTime,
    pausedMinutes: s.pausedMinutes,
    updatedBy: uid,
    updatedByName: name.slice(0, 100),
    updatedAt: serverTimestamp(),
  });
}
