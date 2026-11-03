import { describe, expect, it } from 'vitest';
import { canManageUsers, canReview, isSuperAdminEmail, resolveAccess, type UserProfile } from './access';

const base: UserProfile = { uid: 'u1', email: 'nv@gmail.com' };

describe('isSuperAdminEmail', () => {
  it('matches the list case-insensitively', () => {
    expect(isSuperAdminEmail('LaoTuung@Gmail.com')).toBe(true);
    expect(isSuperAdminEmail(' laotuung@gmail.com ')).toBe(true);
  });
  it('rejects others and empty', () => {
    expect(isSuperAdminEmail('someone@gmail.com')).toBe(false);
    expect(isSuperAdminEmail(null)).toBe(false);
    expect(isSuperAdminEmail('')).toBe(false);
  });
});

describe('resolveAccess', () => {
  it('super admin needs no profile', () => {
    expect(resolveAccess('phongbanana96@gmail.com', null)).toEqual({ kind: 'superadmin' });
  });
  it('is pending without profile or approval', () => {
    expect(resolveAccess('nv@gmail.com', null)).toEqual({ kind: 'pending', reason: 'not_approved' });
    expect(resolveAccess('nv@gmail.com', { ...base, appRole: 'manager' })).toEqual({ kind: 'pending', reason: 'not_approved' });
    expect(resolveAccess('nv@gmail.com', { ...base, approved: false, appRole: 'manager' })).toEqual({
      kind: 'pending',
      reason: 'not_approved',
    });
  });
  it('approved manager', () => {
    expect(resolveAccess('nv@gmail.com', { ...base, approved: true, appRole: 'manager' })).toEqual({ kind: 'manager' });
  });
  it('approved staff needs a máng', () => {
    expect(resolveAccess('nv@gmail.com', { ...base, approved: true, appRole: 'staff', mang: 2 })).toEqual({ kind: 'staff', mang: 2 });
    expect(resolveAccess('nv@gmail.com', { ...base, approved: true, appRole: 'staff', mang: null })).toEqual({
      kind: 'pending',
      reason: 'no_mang',
    });
  });
  it('approved by the old app (no appRole) still needs a role', () => {
    expect(resolveAccess('nv@gmail.com', { ...base, approved: true })).toEqual({ kind: 'pending', reason: 'no_mang' });
  });
});

describe('permissions', () => {
  it('only super admin manages users', () => {
    expect(canManageUsers({ kind: 'superadmin' })).toBe(true);
    expect(canManageUsers({ kind: 'manager' })).toBe(false);
  });
  it('managers and super admins review', () => {
    expect(canReview({ kind: 'manager' })).toBe(true);
    expect(canReview({ kind: 'superadmin' })).toBe(true);
    expect(canReview({ kind: 'staff', mang: 1 })).toBe(false);
  });
});
