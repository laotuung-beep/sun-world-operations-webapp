import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
  type TokenOptions,
} from '@firebase/rules-unit-testing';

let env: RulesTestEnvironment;

const google = (email: string, verified = true): TokenOptions => ({
  email,
  email_verified: verified,
  firebase: { sign_in_provider: 'google.com' },
});

const ADMIN = { uid: 'admin', token: google('LaoTuung@gmail.com') };
const STAFF = { uid: 'staff', token: google('nv@gmail.com') };
const OTHER = { uid: 'other', token: google('khac@gmail.com') };

const as = (who: { uid: string; token: TokenOptions }) => env.authenticatedContext(who.uid, who.token).firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-mangtruot',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc('users/staff').set({ uid: 'staff', email: 'nv@gmail.com', displayName: 'NV' });
  });
});

describe('users: own profile', () => {
  it('can create own profile without access fields', async () => {
    await assertSucceeds(as(OTHER).doc('users/other').set({ uid: 'other', email: 'khac@gmail.com' }));
  });

  it('cannot create own profile already approved', async () => {
    await assertFails(as(OTHER).doc('users/other').set({ uid: 'other', approved: true }));
    await assertFails(as(OTHER).doc('users/other').set({ uid: 'other', appRole: 'manager' }));
  });

  it('cannot create someone else profile', async () => {
    await assertFails(as(OTHER).doc('users/staff2').set({ uid: 'staff2' }));
  });

  it('can update own display fields, including old-app fields', async () => {
    await assertSucceeds(as(STAFF).doc('users/staff').update({ displayName: 'Nhân viên A', role: 'operator', assignedMang: 1 }));
  });

  it('cannot self-approve or change own role / máng', async () => {
    await assertFails(as(STAFF).doc('users/staff').update({ approved: true }));
    await assertFails(as(STAFF).doc('users/staff').update({ appRole: 'manager' }));
    await assertFails(as(STAFF).doc('users/staff').update({ mang: 2 }));
  });

  it('reads only own profile', async () => {
    await assertSucceeds(as(STAFF).doc('users/staff').get());
    await assertFails(as(OTHER).doc('users/staff').get());
    await assertFails(as(STAFF).collection('users').get());
  });

  it('rejects non-Google or unverified sign-in', async () => {
    const anon = env.authenticatedContext('staff', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
    await assertFails(anon.doc('users/staff').get());
    const unverified = env.authenticatedContext('staff', google('nv@gmail.com', false)).firestore();
    await assertFails(unverified.doc('users/staff').get());
    await assertFails(env.unauthenticatedContext().firestore().doc('users/staff').get());
  });
});

describe('users: super admin', () => {
  it('lists all users', async () => {
    await assertSucceeds(as(ADMIN).collection('users').get());
  });

  it('approves staff with a máng, or a manager', async () => {
    await assertSucceeds(
      as(ADMIN).doc('users/staff').update({ approved: true, appRole: 'staff', mang: 2, approvedBy: 'laotuung@gmail.com' }),
    );
    await assertSucceeds(as(ADMIN).doc('users/staff').update({ approved: true, appRole: 'manager', mang: null }));
  });

  it('rejects invalid access values', async () => {
    await assertFails(as(ADMIN).doc('users/staff').update({ approved: true, appRole: 'boss' }));
    await assertFails(as(ADMIN).doc('users/staff').update({ approved: true, appRole: 'staff', mang: 4 }));
    await assertFails(as(ADMIN).doc('users/staff').update({ approved: 'yes' }));
  });

  it('non-admin cannot approve others', async () => {
    await assertFails(as(OTHER).doc('users/staff').update({ approved: true, appRole: 'staff', mang: 1 }));
  });
});

describe('legacy app (v2) keeps working for approved users', () => {
  it('approved user writes a line, unapproved cannot', async () => {
    const line = { lineId: 'line1', date: '2026-11-03', hourSlots: [] };
    await assertFails(as(STAFF).doc('daily_reports/2026-11-03/lines/line1').set(line));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('users/staff').update({ approved: true });
    });
    await assertSucceeds(as(STAFF).doc('daily_reports/2026-11-03/lines/line1').set(line));
  });
});

describe('everything else is closed', () => {
  it('denies unknown collections even for super admin', async () => {
    await assertFails(as(ADMIN).doc('random/x').set({ a: 1 }));
  });
});
