import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { isMangId } from '../config';
import {
  EMPTY_META,
  buildMatrix,
  legacySheetsPayload,
  matrixTotal,
  resolveFreeGate,
  type DayMeta,
  type Schedules,
} from './compute';
import { DRIVE_FILE_ID, DRIVE_FILE_NAME, DRIVE_FOLDER_ID, type DaySyncPayload } from './driveWorkbook';
import { useDayEntries, type Reviewer } from '../entries/api';
import { isActive, type PauseRecord } from '../entries/model';

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
          out[id] = {
            openTime: v.openTime ?? '',
            closeTime: v.closeTime ?? '',
            pausedMinutes: v.pausedMinutes ?? 0,
            pauseLogs: Array.isArray(v.pauseLogs) ? (v.pauseLogs as PauseRecord[]) : [],
          };
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

/** settings/app: cấu hình dùng chung mọi máy (URL Apps Script của Google Sheets / Drive). */
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

/**
 * Đồng bộ trực tiếp dữ liệu ngày từ Web App lên file Bao_Cao_van_hanh_Mang_Truot.xlsx
 * trong Folder Web App VHMT (1ZJjwdvmZs9znHacv0z8zLz39KNy4MrZ3) theo thời gian thực.
 */
export async function syncDayToGoogleDrive(
  payload: DaySyncPayload,
  webhookUrl: string | null,
  by: Reviewer,
): Promise<boolean> {
  let ok = false;
  try {
    const res = await fetch('/api/drive-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        driveFolderId: DRIVE_FOLDER_ID,
        driveFileId: DRIVE_FILE_ID,
        driveFileName: DRIVE_FILE_NAME,
        strictSingleFolderOnly: true,
      }),
    });
    if (res.ok) ok = true;
  } catch {
    // Nếu chạy tĩnh hoặc offline, tiếp tục thử qua webhook
  }

  if (webhookUrl && /^https:\/\/script\.google\.com\//.test(webhookUrl.trim())) {
    try {
      const legacyPayload = legacySheetsPayload(
        payload.date,
        payload.matrix,
        payload.meta,
        payload.schedules,
        payload.closed,
      );
      await postToSheets(webhookUrl.trim(), legacyPayload);
      ok = true;
    } catch {
      // Bỏ qua lỗi mạng tạm thời
    }
  }

  if (ok && by.uid) {
    try {
      await markSheetsSynced(payload.date, by);
    } catch {
      // Bỏ qua nếu không cần ghi dấu
    }
  }
  return ok;
}

/**
 * Hook tự động đồng bộ dữ liệu nhập từ Web App vào file Bao_Cao_van_hanh_Mang_Truot.xlsx
 * trong Folder Web App VHMT (1ZJjwdvmZs9znHacv0z8zLz39KNy4MrZ3) theo thời gian thực
 * ngay khi nhân viên / Admin lưu phiếu, cập nhật giờ vận hành hoặc chỉnh sửa số liệu.
 */
export function useRealtimeDriveSync(date: string, actor: Reviewer) {
  const day = useDay(date);
  const schedules = useSchedules(date);
  const { entries } = useDayEntries(date);
  const webhookUrl = useSheetsWebhook();
  const lastFingerprintRef = useRef<string | null>(null);
  const loadedDateRef = useRef<string | null>(null);

  const payload = useMemo<DaySyncPayload | null>(() => {
    if (!day || entries === null) return null;
    const matrix = buildMatrix(entries, (s) => isActive(s));
    const totalPassengers = matrixTotal(matrix).passengers;
    const freeGateVisitors = resolveFreeGate(
      totalPassengers,
      day.meta.paidGateVisitors,
      day.meta.freeGateVisitors,
      date,
    );
    return {
      date,
      matrix,
      totalPassengers,
      meta: {
        ...day.meta,
        freeGateVisitors,
      },
      schedules,
      closed: day.closed,
    };
  }, [date, day, entries, schedules]);

  useEffect(() => {
    if (!payload) return;
    const fp = JSON.stringify({
      date: payload.date,
      totalPassengers: payload.totalPassengers,
      matrix: payload.matrix,
      meta: payload.meta,
      schedules: payload.schedules,
      closed: payload.closed,
    });

    // Lần đầu tiên nạp dữ liệu của ngày -> chỉ ghi nhận trạng thái gốc, chưa bắn sync thừa
    if (loadedDateRef.current !== payload.date) {
      loadedDateRef.current = payload.date;
      lastFingerprintRef.current = fp;
      return;
    }

    if (lastFingerprintRef.current === fp) return;
    lastFingerprintRef.current = fp;

    const timer = window.setTimeout(() => {
      void syncDayToGoogleDrive(payload, webhookUrl, actor);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [payload, webhookUrl, actor]);
}
