import { isMangId, type MangId } from '../config';
import type { AppRole } from './access';

export interface AccessDraft {
  appRole: AppRole | '';
  mang: MangId | null;
}

export type AccessUpdate =
  | { ok: true; data: { approved: true; appRole: AppRole; mang: MangId | null } }
  | { ok: false; error: string };

/** Kiểm tra lựa chọn của Super Admin trước khi duyệt / lưu một tài khoản. */
export function buildAccessUpdate(draft: AccessDraft): AccessUpdate {
  if (draft.appRole === 'manager') return { ok: true, data: { approved: true, appRole: 'manager', mang: null } };
  if (draft.appRole === 'staff') {
    if (!isMangId(draft.mang)) return { ok: false, error: 'Chọn máng cho nhân viên trước khi duyệt.' };
    return { ok: true, data: { approved: true, appRole: 'staff', mang: draft.mang } };
  }
  return { ok: false, error: 'Chọn vai trò (Nhân viên / Quản lý) trước khi duyệt.' };
}
