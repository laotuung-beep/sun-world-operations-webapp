import { SUPER_ADMINS, isMangId, type MangId } from '../config';

export type AppRole = 'staff' | 'manager';

/** Hồ sơ users/{uid}. approved / appRole / mang chỉ Super Admin được đặt (xem firestore.rules). */
export interface UserProfile {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  approved?: boolean;
  appRole?: AppRole;
  mang?: MangId | null;
  approvedBy?: string;
}

export type Access =
  | { kind: 'superadmin' }
  | { kind: 'manager' }
  | { kind: 'staff'; mang: MangId }
  | { kind: 'pending'; reason: 'not_approved' | 'no_mang' };

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return !!email && SUPER_ADMINS.includes(email.trim().toLowerCase());
}

/** Quyết định người đăng nhập được vào màn hình nào. */
export function resolveAccess(email: string | null | undefined, profile: UserProfile | null): Access {
  if (isSuperAdminEmail(email)) return { kind: 'superadmin' };
  if (!profile || profile.approved !== true) return { kind: 'pending', reason: 'not_approved' };
  if (profile.appRole === 'manager') return { kind: 'manager' };
  if (profile.appRole === 'staff' && isMangId(profile.mang)) return { kind: 'staff', mang: profile.mang };
  return { kind: 'pending', reason: 'no_mang' };
}

export const ACCESS_LABEL: Record<Access['kind'], string> = {
  superadmin: 'Super Admin',
  manager: 'Quản lý',
  staff: 'Nhân viên',
  pending: 'Chờ duyệt',
};

export function canManageUsers(access: Access): boolean {
  return access.kind === 'superadmin';
}

export function canReview(access: Access): boolean {
  return access.kind === 'superadmin' || access.kind === 'manager';
}
