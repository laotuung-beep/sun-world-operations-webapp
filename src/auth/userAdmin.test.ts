import { describe, expect, it } from 'vitest';
import { buildAccessUpdate } from './userAdmin';

describe('buildAccessUpdate', () => {
  it('needs a role', () => {
    expect(buildAccessUpdate({ appRole: '', mang: 1 }).ok).toBe(false);
  });
  it('staff needs a máng', () => {
    expect(buildAccessUpdate({ appRole: 'staff', mang: null }).ok).toBe(false);
    expect(buildAccessUpdate({ appRole: 'staff', mang: 3 })).toEqual({
      ok: true,
      data: { approved: true, appRole: 'staff', mang: 3 },
    });
  });
  it('manager drops the máng', () => {
    expect(buildAccessUpdate({ appRole: 'manager', mang: 2 })).toEqual({
      ok: true,
      data: { approved: true, appRole: 'manager', mang: null },
    });
  });
});
