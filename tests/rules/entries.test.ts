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

const A = { uid: 'a', token: google('a@gmail.com') }; // đã duyệt
const B = { uid: 'b', token: google('b@gmail.com') }; // đã duyệt
const NEWBIE = { uid: 'newbie', token: google('moi@gmail.com') }; // chưa duyệt
const ADMIN = { uid: 'admin', token: google('laotuung@gmail.com') };

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
const approve = (uid: string) => ({ status: 'approved', reviewedBy: uid, reviewedByName: 'QL', reviewedAt: now() });

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
    await db.doc('users/a').set({ approved: true });
    await db.doc('users/b').set({ approved: true, mang: 3 });
    await db.doc('users/newbie').set({ email: 'moi@gmail.com' });
  });
});

describe('phiếu: create', () => {
  it('any approved Gmail sends a phiếu for any máng today', async () => {
    await assertSucceeds(as(A).doc(entryPath('e1')).set(entry('a')));
    await assertSucceeds(
      as(B)
        .doc(entryPath('e2'))
        .set(entry('b', { mang: 2, lines: { line3: { single: 1, double: 0 }, line4: { single: 0, double: 0 } } })),
    );
  });

  it('lines must belong to the máng', async () => {
    await assertFails(as(A).doc(entryPath('e1')).set(entry('a', { mang: 2 })));
  });

  it('unapproved Gmail cannot', async () => {
    await assertFails(as(NEWBIE).doc(entryPath('e1')).set(entry('newbie')));
  });

  it('cannot pretend to be someone else or pre-approve', async () => {
    await assertFails(as(A).doc(entryPath('e1')).set(entry('b')));
    await assertFails(as(A).doc(entryPath('e1')).set(entry('a', { status: 'approved' })));
  });

  it('rejects bad numbers', async () => {
    const bad = (line1: unknown) => entry('a', { lines: { line1, line2: { single: 0, double: 0 } } });
    await assertFails(as(A).doc(entryPath('a')).set(bad({ single: -1, double: 2 })));
    await assertFails(as(A).doc(entryPath('b')).set(bad({ single: 1.5, double: 0 })));
    await assertFails(as(A).doc(entryPath('c')).set(bad({ single: 501, double: 0 })));
    await assertFails(as(A).doc(entryPath('d')).set(bad({ single: '3', double: 0 })));
    await assertFails(as(A).doc(entryPath('e')).set(bad({ single: 0, double: 0 })));
    await assertFails(as(A).doc(entryPath('f')).set(bad({ single: 1, double: 0, triple: 1 })));
  });

  it('rejects unknown slot, extra fields, other dates and a fake time', async () => {
    await assertFails(as(A).doc(entryPath('a')).set(entry('a', { slotId: '1900' })));
    await assertFails(as(A).doc(entryPath('b')).set(entry('a', { rides: 99 })));
    await assertFails(as(A).doc(entryPath('c', YESTERDAY)).set(entry('a', { date: YESTERDAY })));
    await assertFails(as(A).doc(entryPath('d')).set(entry('a', { date: YESTERDAY })));
    await assertFails(as(A).doc(entryPath('e')).set(entry('a', { createdAt: new Date(0) })));
  });

  it('rejects phiếu after the day is closed', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`days/${TODAY}`).set({ closed: true });
    });
    await assertFails(as(A).doc(entryPath('e1')).set(entry('a')));
  });
});

describe('phiếu: cancel, approve, return', () => {
  beforeEach(async () => {
    await as(A).doc(entryPath('e1')).set(entry('a'));
  });

  it('sender cancels own pending phiếu; others cannot', async () => {
    await assertFails(as(B).doc(entryPath('e1')).update({ status: 'cancelled', cancelledAt: now() }));
    await assertSucceeds(as(A).doc(entryPath('e1')).update({ status: 'cancelled', cancelledAt: now() }));
  });

  it('any member approves a pending phiếu', async () => {
    await assertSucceeds(as(B).doc(entryPath('e1')).update(approve('b')));
  });

  it('returning needs a reason', async () => {
    const reject = (reason?: string) => ({ ...approve('b'), status: 'rejected', ...(reason === undefined ? {} : { rejectReason: reason }) });
    await assertFails(as(B).doc(entryPath('e1')).update(reject()));
    await assertFails(as(B).doc(entryPath('e1')).update(reject('')));
    await assertSucceeds(as(B).doc(entryPath('e1')).update(reject('Trùng phiếu')));
  });

  it('approving cannot touch numbers or fake the reviewer', async () => {
    await assertFails(as(B).doc(entryPath('e1')).update({ ...approve('b'), 'lines.line1.single': 99 }));
    await assertFails(as(B).doc(entryPath('e1')).update(approve('a')));
    await assertFails(as(B).doc(entryPath('e1')).update({ ...approve('b'), reviewedAt: new Date(0) }));
  });

  it('numbers are never edited and phiếu never deleted', async () => {
    await assertFails(as(A).doc(entryPath('e1')).update({ 'lines.line1.single': 99 }));
    await assertFails(as(A).doc(entryPath('e1')).delete());
  });

  it('approved phiếu is final (cannot cancel or approve again)', async () => {
    await as(B).doc(entryPath('e1')).update(approve('b'));
    await assertFails(as(A).doc(entryPath('e1')).update({ status: 'cancelled', cancelledAt: now() }));
    await assertFails(as(B).doc(entryPath('e1')).update({ ...approve('b'), status: 'rejected', rejectReason: 'x' }));
  });

  it('nothing changes after the day is closed', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`days/${TODAY}`).set({ closed: true });
    });
    await assertFails(as(B).doc(entryPath('e1')).update(approve('b')));
    await assertFails(as(A).doc(entryPath('e1')).update({ status: 'cancelled', cancelledAt: now() }));
  });

  it('unapproved Gmail cannot read or review', async () => {
    await assertFails(as(NEWBIE).collection(`days/${TODAY}/entries`).get());
    await assertFails(as(NEWBIE).doc(entryPath('e1')).update(approve('newbie')));
    await assertSucceeds(as(B).collection(`days/${TODAY}/entries`).get());
  });
});

describe('ngày: số liệu đối soát, chốt ngày', () => {
  const meta = (uid: string, over: Record<string, unknown> = {}) => ({
    date: TODAY,
    cableCarVisitors: 1500,
    paidGateVisitors: 5000,
    freeGateVisitors: 20,
    nightComboVisitors: 0,
    counterRevenue: 373360000,
    metaUpdatedBy: uid,
    metaUpdatedByName: 'A',
    metaUpdatedAt: now(),
    ...over,
  });
  const close = (uid: string, closed = true) => ({ date: TODAY, closed, closedBy: uid, closedByName: 'X', closedAt: now() });

  it('members save numbers and close the day', async () => {
    await assertSucceeds(as(A).doc(`days/${TODAY}`).set(meta('a'), { merge: true }));
    await assertSucceeds(as(B).doc(`days/${TODAY}`).set(close('b'), { merge: true }));
  });

  it('rejects bad numbers and unknown fields', async () => {
    await assertFails(as(A).doc(`days/${TODAY}`).set(meta('a', { counterRevenue: -1 })));
    await assertFails(as(A).doc(`days/${TODAY}`).set(meta('a', { cableCarVisitors: 1.5 })));
    await assertFails(as(A).doc(`days/${TODAY}`).set(meta('a', { hack: true })));
    await assertFails(as(A).doc(`days/${TODAY}`).set(close('b')));
  });

  it('closed day: members cannot edit or reopen, but can mark Sheets sent; super admin can reopen', async () => {
    await as(A).doc(`days/${TODAY}`).set(close('a'));
    await assertFails(as(B).doc(`days/${TODAY}`).set(meta('b'), { merge: true }));
    await assertFails(as(A).doc(`days/${TODAY}`).set(close('a', false), { merge: true }));
    await assertSucceeds(as(B).doc(`days/${TODAY}`).set({ sheetsSyncedBy: 'b', sheetsSyncedAt: now() }, { merge: true }));
    await assertSucceeds(as(ADMIN).doc(`days/${TODAY}`).set(close('admin', false), { merge: true }));
  });

  it('unapproved Gmail cannot read or write the day', async () => {
    await assertFails(as(NEWBIE).doc(`days/${TODAY}`).get());
    await assertFails(as(NEWBIE).doc(`days/${TODAY}`).set(meta('newbie')));
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

  it('members set any máng; bad values rejected', async () => {
    await assertSucceeds(as(A).doc(`days/${TODAY}/schedules/2`).set(schedule('a', 2)));
    await assertSucceeds(as(A).doc(`days/${YESTERDAY}/schedules/3`).set(schedule('a', 3)));
    await assertFails(as(A).doc(`days/${TODAY}/schedules/1`).set(schedule('a', 2)));
    await assertFails(as(A).doc(`days/${TODAY}/schedules/1`).set(schedule('a', 1, { openTime: '25:00' })));
    await assertFails(as(A).doc(`days/${TODAY}/schedules/1`).set(schedule('a', 1, { pausedMinutes: -5 })));
    await assertFails(as(NEWBIE).doc(`days/${TODAY}/schedules/1`).set(schedule('newbie', 1)));
  });
});

describe('settings/app (Google Sheets)', () => {
  it('members read, only super admin writes', async () => {
    const s = { sheetsWebhookUrl: 'https://script.google.com/macros/s/x/exec', updatedBy: 'x', updatedAt: now() };
    await assertFails(as(A).doc('settings/app').set(s));
    await assertSucceeds(as(ADMIN).doc('settings/app').set(s));
    await assertSucceeds(as(A).doc('settings/app').get());
    await assertFails(as(NEWBIE).doc('settings/app').get());
  });
});
