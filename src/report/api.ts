import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { isMangId } from '../config';
import { EMPTY_META, type DayMeta, type Schedules } from './compute';
import type { Reviewer } from '../entries/api';

export interface DayInfo {
  meta: DayMeta;
  closed: boolean;
  closedByName?: string;
  closedAt?: Date | null;
  metaUpdatedByName?: string;
  sheetsSyncedAt?: Date | null;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** days/{date}: thông số nhập tay + trạng thái chốt. null khi đang tải. */
export function useDay(date: string): DayInfo | null {
  const [info, setInfo] = useState<DayInfo | null>(null);
  useEffect(() => {
    setInfo(null);
    return onSnapshot(
      doc(db, 'days', date),
      (snap) => {
        const d = snap.data({ serverTimestamps: 'estimate' }) ?? {};
        setInfo({
          meta: {
            cableCarVisitors: num(d.cableCarVisitors),
            paidGateVisitors: num(d.paidGateVisitors),
            freeGateVisitors: num(d.freeGateVisitors),
            nightComboVisitors: num(d.nightComboVisitors),
            counterRevenue: num(d.counterRevenue),
          },
          closed: d.closed === true,
          closedByName: d.closedByName,
          closedAt: d.closedAt?.toDate?.() ?? null,
          metaUpdatedByName: d.metaUpdatedByName,
          sheetsSyncedAt: d.sheetsSyncedAt?.toDate?.() ?? null,
        });
      },
      (e) => {
        console.warn('Không đọc được ngày:', e);
        setInfo({ meta: EMPTY_META, closed: false });
      },
    );
  }, [date]);
  return info;
}

export function useSchedules(date: string): Schedules {
  const [schedules, setSchedules] = useState<Schedules>({});
  useEffect(() => {
    setSchedules({});
    return onSnapshot(
      collection(db, 'days', date, 'schedules'),
      (snap) => {
        const out: Schedules = {};
        for (const d of snap.docs) {
          const id = Number(d.id);
          if (!isMangId(id)) continue;
          const v = d.data();
          out[id] = { openTime: v.openTime ?? '', closeTime: v.closeTime ?? '', pausedMinutes: v.pausedMinutes ?? 0 };
        }
        setSchedules(out);
      },
      (e) => console.warn('Không đọc được giờ chạy:', e),
    );
  }, [date]);
  return schedules;
}

const dayRef = (date: string) => doc(db, 'days', date);

export function saveMeta(date: string, meta: DayMeta, by: Reviewer): Promise<void> {
  return setDoc(
    dayRef(date),
    { date, ...meta, metaUpdatedBy: by.uid, metaUpdatedByName: by.name.slice(0, 100), metaUpdatedAt: serverTimestamp() },
    { merge: true },
  );
}

export function setDayClosed(date: string, closed: boolean, by: Reviewer): Promise<void> {
  return setDoc(
    dayRef(date),
    { date, closed, closedBy: by.uid, closedByName: by.name.slice(0, 100), closedAt: serverTimestamp() },
    { merge: true },
  );
}

export function markSheetsSynced(date: string, by: Reviewer): Promise<void> {
  return setDoc(dayRef(date), { sheetsSyncedBy: by.uid, sheetsSyncedAt: serverTimestamp() }, { merge: true });
}

/** settings/app: cấu hình dùng chung mọi máy (URL Apps Script của Google Sheets). */
export function useSheetsWebhook(): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'settings', 'app'),
        (snap) => setUrl(snap.data()?.sheetsWebhookUrl ?? ''),
        () => setUrl(''),
      ),
    [],
  );
  return url;
}

export function saveSheetsWebhook(url: string, by: Reviewer): Promise<void> {
  return setDoc(
    doc(db, 'settings', 'app'),
    { sheetsWebhookUrl: url.trim(), updatedBy: by.uid, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/** Gửi sang Apps Script giống app cũ (no-cors: không đọc được phản hồi, chỉ biết đã gửi đi). */
export async function postToSheets(url: string, payload: unknown): Promise<void> {
  await fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
