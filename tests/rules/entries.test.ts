import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
  type TokenOptions,
} from '@firebase/rules-unit-testing';
import { dateKeyVN } from '../../src/time';

let env: RulesTestEnvironment;

const google = (email: string): TokenOptions => ({
  email,
  email_verified: true,
  firebase: { sign_in_provider: 'google.com' },
});

const STAFF1 = { uid: 'staff1', token: google('nv1@gmail.com') }; // AC 1
const STAFF1B = { uid: 'staff1b', token: google('nv1b@gmail.com') }; // AC 1
const STAFF2 = { uid: 'staff2', token: google('nv2@gmail.com') }; // AC 2
const MANAGER = { uid: 'mgr', token: google('ql@gmail.com') };
const PENDING = { uid: 'newbie', token: google('moi@gmail.com') };

const as = (who: { uid: string; token: TokenOptions }) => env.authenticatedContext(who.uid, who.token).firestore();
const now = () => firebase.firestore.FieldValue.serverTimestamp();

const TODAY = dateKeyVN();
const YESTERDAY = dateKeyVN(new Date(Date.now() - 24 * 3600 * 1000));

function entry(uid: string, over: Record<string, unknown> = {}) {
  return {
    date: TODAY,
    slotId: '1000',
    mang: 1,
    lines: { line1: { single: 3, double: 2 }, line2: { single: 0, double: 1 } },
    status: 'pending',
    createdBy: uid,
    createdByName: 'Nhân viên',
    createdByEmail: 'nv@gmail.com',
    createdAt: now(),
    clientCreatedAt: Date.now(),
    ...over,
  };
}

const entryPath = (id: string, date = TODAY) => `days/${date}/entries/${id}`;

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
    const db = ctx.firestore();
    await db.doc('users/staff1').set({ approved: true, appRole: 'staff', mang: 1 });
    await db.doc('users/staff1b').set({ approved: true, appRole: 'staff', mang: 1 });
    await db.doc('users/staff2').set({ approved: true, appRole: 'staff', mang: 2 });
    await db.doc('users/mgr').set({ approved: true, appRole: 'manager', mang: null });
    await db.doc('users/newbie').set({ email: 'moi@gmail.com' });
  });
});

describe('phiếu: create', () => {
  it('staff sends a phiếu for own máng today', async () => {
    await assertSucceeds(as(STAFF1).doc(entryPath('e1')).set(entry('staff1')));
  });

  it('staff cannot send for another máng or with other lines', async () => {
    await assertFails(as(STAFF2).doc(entryPath('e1')).set(entry('staff2')));
    await assertFails(
      as(STAFF2).doc(entryPath('e1')).set(entry('staff2', { mang: 2 })), // lines 1/2 do not belong to AC 2
    );
    await assertSucceeds(
      as(STAFF2)
        .doc(entryPath('e2'))
        .set(entry('staff2', { mang: 2, lines: { line3: { single: 1, double: 0 }, line4: { single: 0, double: 0 } } })),
    );
  });

  it('unapproved users and managers cannot send phiếu', async () => {
    await assertFails(as(PENDING).doc(entryPath('e1')).set(entry('newbie')));
    await assertFails(as(MANAGER).doc(entryPath('e1')).set(entry('mgr')));
  });

  it('cannot pretend to be someone else or pre-approve', async () => {
    await assertFails(as(STAFF1).doc(entryPath('e1')).set(entry('staff1b')));
    await assertFails(as(STAFF1).doc(entryPath('e1')).set(entry('staff1', { status: 'approved' })));
  });

  it('rejects bad numbers', async () => {
    const bad = (line1: unknown) => entry('staff1', { lines: { line1, line2: { single: 0, double: 0 } } });
    await assertFails(as(STAFF1).doc(entryPath('a')).set(bad({ single: -1, double: 2 })));
    await assertFails(as(STAFF1).doc(entryPath('b')).set(bad({ single: 1.5, double: 0 })));
    await assertFails(as(STAFF1).doc(entryPath('c')).set(bad({ single: 501, double: 0 })));
    await assertFails(as(STAFF1).doc(entryPath('d')).set(bad({ single: '3', double: 0 })));
    await assertFails(as(STAFF1).doc(entryPath('e')).set(bad({ single: 0, double: 0 }))); // all zero
    await assertFails(as(STAFF1).doc(entryPath('f')).set(bad({ single: 1, double: 0, triple: 1 })));
  });

  it('rejects unknown slot, extra fields, other dates and a fake time', async () => {
    await assertFails(as(STAFF1).doc(entryPath('a')).set(entry('staff1', { slotId: '1900' })));
    await assertFails(as(STAFF1).doc(entryPath('b')).set(entry('staff1', { rides: 99 })));
    await assertFails(as(STAFF1).doc(entryPath('c', YESTERDAY)).set(entry('staff1', { date: YESTERDAY })));
    await assertFails(as(STAFF1).doc(entryPath('d')).set(entry('staff1', { date: YESTERDAY })));
    await assertFails(as(STAFF1).doc(entryPath('e')).set(entry('staff1', { createdAt: new Date(0) })));
  });

  it('rejects phiếu after the day is closed', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`days/${TODAY}`).set({ closed: true });
    });
    await assertFails(as(STAFF1).doc(entryPath('e1')).set(entry('staff1')));
  });
});

describe('phiếu: numbers are never edited, only cancelled by the sender', () => {
  beforeEach(async () => {
    await as(STAFF1).doc(entryPath('e1')).set(entry('staff1'));
  });

  it('sender cancels own pending phiếu', async () => {
    await assertSucceeds(as(STAFF1).doc(entryPath('e1')).update({ status: 'cancelled', cancelledAt: now() }));
  });

  it('cannot change numbers or status otherwise', async () => {
    await assertFails(as(STAFF1).doc(entryPath('e1')).update({ 'lines.line1.single': 99 }));
    await assertFails(as(STAFF1).doc(entryPath('e1')).update({ status: 'approved' }));
    await assertFails(as(STAFF1).doc(entryPath('e1')).delete());
  });

  it('colleague cannot cancel it', async () => {
    await assertFails(as(STAFF1B).doc(entryPath('e1')).update({ status: 'cancelled', cancelledAt: now() }));
  });

  it('cannot cancel once approved', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(entryPath('e1')).update({ status: 'approved' });
    });
    await assertFails(as(STAFF1).doc(entryPath('e1')).update({ status: 'cancelled', cancelledAt: now() }));
  });
});

describe('phiếu: read', () => {
  beforeEach(async () => {
    await as(STAFF1).doc(entryPath('e1')).set(entry('staff1'));
  });

  it('staff of the máng read its phiếu (query by máng)', async () => {
    await assertSucceeds(as(STAFF1B).collection(`days/${TODAY}/entries`).where('mang', '==', 1).get());
  });

  it('staff of another máng cannot', async () => {
    await assertFails(as(STAFF2).collection(`days/${TODAY}/entries`).where('mang', '==', 1).get());
    await assertFails(as(STAFF2).doc(entryPath('e1')).get());
    await assertFails(as(STAFF2).collection(`days/${TODAY}/entries`).get());
  });

  it('managers read everything, unapproved users nothing', async () => {
    await assertSucceeds(as(MANAGER).collection(`days/${TODAY}/entries`).get());
    await assertFails(as(PENDING).collection(`days/${TODAY}/entries`).where('mang', '==', 1).get());
  });
});

describe('giờ chạy máng', () => {
  const schedule = (uid: string, mang: number, over: Record<string, unknown> = {}) => ({
    mang,
    openTime: '08:30',
    closeTime: '',
    pausedMinutes: 15,
    updatedBy: uid,
    updatedByName: 'NV',
    updatedAt: now(),
    ...over,
  });

  it('staff sets own máng schedule today, not another máng', async () => {
    await assertSucceeds(as(STAFF1).doc(`days/${TODAY}/schedules/1`).set(schedule('staff1', 1)));
    await assertFails(as(STAFF1).doc(`days/${TODAY}/schedules/2`).set(schedule('staff1', 2)));
    await assertFails(as(STAFF1).doc(`days/${YESTERDAY}/schedules/1`).set(schedule('staff1', 1)));
  });

  it('manager can set any máng, any day', async () => {
    await assertSucceeds(as(MANAGER).doc(`days/${YESTERDAY}/schedules/3`).set(schedule('mgr', 3)));
  });

  it('rejects bad times', async () => {
    await assertFails(as(STAFF1).doc(`days/${TODAY}/schedules/1`).set(schedule('staff1', 1, { openTime: '25:00' })));
    await assertFails(as(STAFF1).doc(`days/${TODAY}/schedules/1`).set(schedule('staff1', 1, { pausedMinutes: -5 })));
  });

  it('staff reads only own máng', async () => {
    await assertSucceeds(as(STAFF1).doc(`days/${TODAY}/schedules/1`).get());
    await assertFails(as(STAFF2).doc(`days/${TODAY}/schedules/1`).get());
  });
});
