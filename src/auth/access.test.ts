import { describe, expect, it } from 'vitest';
import { canManageUsers, canReopenDay, isSuperAdminEmail, resolveAccess, type UserProfile } from './access';

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
  it('is pending until approved', () => {
    expect(resolveAccess('nv@gmail.com', null)).toEqual({ kind: 'pending' });
    expect(resolveAccess('nv@gmail.com', base)).toEqual({ kind: 'pending' });
    expect(resolveAccess('nv@gmail.com', { ...base, approved: false })).toEqual({ kind: 'pending' });
  });
  it('any approved Gmail is a full member, no role or máng needed', () => {
    expect(resolveAccess('nv@gmail.com', { ...base, approved: true })).toEqual({ kind: 'member' });
    expect(resolveAccess('nv@gmail.com', { ...base, approved: true, mang: 2 })).toEqual({ kind: 'member' });
  });
});

describe('permissions', () => {
  it('only super admin manages users and reopens a closed day', () => {
    expect(canManageUsers({ kind: 'superadmin' })).toBe(true);
    expect(canManageUsers({ kind: 'member' })).toBe(false);
    expect(canReopenDay({ kind: 'superadmin' })).toBe(true);
    expect(canReopenDay({ kind: 'member' })).toBe(false);
  });
});
