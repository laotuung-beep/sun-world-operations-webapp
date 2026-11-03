import { SUPER_ADMINS, type MangId } from '../config';

/** Hồ sơ users/{uid}. approved / mang chỉ Super Admin được đặt (xem firestore.rules). */
export interface UserProfile {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  approved?: boolean;
  /** Máng hay trực - chỉ để chọn sẵn ở màn nhập phiếu. */
  mang?: MangId | null;
  approvedBy?: string;
}

/**
 * Không chia cấp: Gmail đã được duyệt thấy và làm được mọi việc (nhập phiếu, duyệt, báo cáo).
 * Super Admin thêm quyền duyệt tài khoản và mở lại ngày đã chốt.
 */
export type Access = { kind: 'superadmin' } | { kind: 'member' } | { kind: 'pending' };

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return !!email && SUPER_ADMINS.includes(email.trim().toLowerCase());
}

export function resolveAccess(email: string | null | undefined, profile: UserProfile | null): Access {
  if (isSuperAdminEmail(email)) return { kind: 'superadmin' };
  if (profile?.approved === true) return { kind: 'member' };
  return { kind: 'pending' };
}

export const ACCESS_LABEL: Record<Access['kind'], string> = {
  superadmin: 'Super Admin',
  member: 'Vận hành',
  pending: 'Chờ duyệt',
};

export function canManageUsers(access: Access): boolean {
  return access.kind === 'superadmin';
}

/** Mở lại ngày đã chốt. */
export function canReopenDay(access: Access): boolean {
  return access.kind === 'superadmin';
}
