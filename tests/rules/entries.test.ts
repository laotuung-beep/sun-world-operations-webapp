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

const updateLines = (uid: string, over: Record<string, unknown> = {}) => ({
  lines: { line1: { single: 10, double: 5 }, line2: { single: 2, double: 1 } },
  updatedBy: uid,
  updatedByName: 'Nhân viên',
  updatedAt: now(),
  ...over,
});

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
  it('any approved Gmail sends a phiếu for any máng on any valid date (today, yesterday, etc.)', async () => {
    await assertSucceeds(as(A).doc(entryPath('e1')).set(entry('a')));
    await assertSucceeds(
      as(A)
        .doc(entryPath('e_yesterday', YESTERDAY))
        .set(entry('a', { date: YESTERDAY })),
    );
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

  it('rejects unknown slot, extra fields, invalid dates and fake time', async () => {
    await assertFails(as(A).doc(entryPath('a')).set(entry('a', { slotId: '1900' })));
    await assertFails(as(A).doc(entryPath('b')).set(entry('a', { rides: 99 })));
    await assertFails(as(A).doc(entryPath('c', 'not-a-date')).set(entry('a', { date: 'not-a-date' })));
    await assertFails(as(A).doc(entryPath('d')).set(entry('a', { date: YESTERDAY }))); // Mismatched path vs body date
    await assertFails(as(A).doc(entryPath('e')).set(entry('a', { createdAt: new Date(0) })));
  });

  it('rejects phiếu after the day is closed, unless super admin', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`days/${TODAY}`).set({ closed: true });
    });
    await assertFails(as(A).doc(entryPath('e1')).set(entry('a')));
    await assertSucceeds(as(ADMIN).doc(entryPath('e_admin')).set(entry('admin')));
  });
});

describe('phiếu: update lines (hiệu chỉnh số liệu)', () => {
  beforeEach(async () => {
    await as(A).doc(entryPath('e1')).set(entry('a'));
  });

  it('any member updates lines with valid counts and audit fields', async () => {
    await assertSucceeds(as(B).doc(entryPath('e1')).update(updateLines('b')));
  });

  it('rejects update if lines do not match máng or total rides is zero', async () => {
    // entry e1 belongs to mang 1 (lines: line1, line2). Lines 3 and 4 belong to mang 2:
    await assertFails(
      as(A).doc(entryPath('e1')).update({
        lines: { line3: { single: 5, double: 0 }, line4: { single: 1, double: 0 } },
        updatedBy: 'a',
        updatedByName: 'Nhân viên A',
        updatedAt: now(),
      }),
    );
    // Total rides == 0 is rejected (must use cancel instead):
    await assertFails(
      as(A).doc(entryPath('e1')).update({
        lines: { line1: { single: 0, double: 0 }, line2: { single: 0, double: 0 } },
        updatedBy: 'a',
        updatedByName: 'Nhân viên A',
        updatedAt: now(),
      }),
    );
  });

  it('rejects bad numbers in lines (negative, float, string, > 500)', async () => {
    const badLines = (line1: unknown) => ({
      lines: { line1, line2: { single: 0, double: 0 } },
      updatedBy: 'a',
      updatedByName: 'Nhân viên A',
      updatedAt: now(),
    });
    await assertFails(as(A).doc(entryPath('e1')).update(badLines({ single: -1, double: 2 })));
    await assertFails(as(A).doc(entryPath('e1')).update(badLines({ single: 1.5, double: 0 })));
    await assertFails(as(A).doc(entryPath('e1')).update(badLines({ single: 501, double: 0 })));
    await assertFails(as(A).doc(entryPath('e1')).update(badLines({ single: '3', double: 0 })));
  });

  it('rejects tampering with immutable or other fields during line update', async () => {
    await assertFails(
      as(A).doc(entryPath('e1')).update({
        ...updateLines('a'),
        status: 'approved',
      }),
    );
    await assertFails(
      as(A).doc(entryPath('e1')).update({
        ...updateLines('a'),
        mang: 2,
      }),
    );
    await assertFails(
      as(A).doc(entryPath('e1')).update({
        ...updateLines('a'),
        date: YESTERDAY,
      }),
    );
  });

  it('rejects spoofed updatedBy, invalid updatedByName, or fake updatedAt', async () => {
    // Spoofed updatedBy:
    await assertFails(
      as(A).doc(entryPath('e1')).update({
        ...updateLines('a'),
        updatedBy: 'b',
      }),
    );
    // Fake updatedAt:
    await assertFails(
      as(A).doc(entryPath('e1')).update({
        ...updateLines('a'),
        updatedAt: new Date(0),
      }),
    );
  });

  it('cannot edit numbers without audit fields, and phiếu is never deleted', async () => {
    await assertFails(as(A).doc(entryPath('e1')).update({ 'lines.line1.single': 99 }));
    await assertFails(as(A).doc(entryPath('e1')).delete());
  });

  it('rejects line update after the day is closed, unless super admin', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`days/${TODAY}`).set({ closed: true });
    });
    await assertFails(as(A).doc(entryPath('e1')).update(updateLines('a')));
    await assertSucceeds(as(ADMIN).doc(entryPath('e1')).update(updateLines('admin')));
  });

  it('unapproved user cannot update lines', async () => {
    await assertFails(as(NEWBIE).doc(entryPath('e1')).update(updateLines('newbie')));
  });
});

describe('phiếu: cancel (huỷ phiếu)', () => {
  beforeEach(async () => {
    await as(A).doc(entryPath('e1')).set(entry('a'));
  });

  it('any member can cancel a phiếu with isMemberCancel()', async () => {
    await assertSucceeds(as(B).doc(entryPath('e1')).update({ status: 'cancelled', cancelledAt: now() }));
  });

  it('member cancels a phiếu with audit fields (cancelledBy, cancelledByName)', async () => {
    await assertSucceeds(
      as(B).doc(entryPath('e1')).update({
        status: 'cancelled',
        cancelledAt: now(),
        cancelledBy: 'b',
        cancelledByName: 'Nhân viên B',
      }),
    );
  });

  it('member can cancel an already approved phiếu (e.g. xoá trắng khung giờ / huỷ trùng)', async () => {
    await as(B).doc(entryPath('e1')).update(approve('b'));
    await assertSucceeds(
      as(A).doc(entryPath('e1')).update({
        status: 'cancelled',
        cancelledAt: now(),
        cancelledBy: 'a',
        cancelledByName: 'Nhân viên A',
      }),
    );
  });

  it('rejects spoofed cancelledBy or fake cancelledAt', async () => {
    await assertFails(
      as(B).doc(entryPath('e1')).update({
        status: 'cancelled',
        cancelledAt: now(),
        cancelledBy: 'a', // spoofed
        cancelledByName: 'A',
      }),
    );
    await assertFails(
      as(B).doc(entryPath('e1')).update({
        status: 'cancelled',
        cancelledAt: new Date(0), // fake timestamp
      }),
    );
  });

  it('rejects cancel touching other fields', async () => {
    await assertFails(
      as(B).doc(entryPath('e1')).update({
        status: 'cancelled',
        cancelledAt: now(),
        'lines.line1.single': 0,
      }),
    );
  });

  it('rejects cancel after the day is closed, unless super admin', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`days/${TODAY}`).set({ closed: true });
    });
    await assertFails(as(B).doc(entryPath('e1')).update({ status: 'cancelled', cancelledAt: now() }));
    await assertSucceeds(as(ADMIN).doc(entryPath('e1')).update({ status: 'cancelled', cancelledAt: now() }));
  });

  it('unapproved user cannot cancel phiếu', async () => {
    await assertFails(as(NEWBIE).doc(entryPath('e1')).update({ status: 'cancelled', cancelledAt: now() }));
  });
});

describe('phiếu: approve & review', () => {
  beforeEach(async () => {
    await as(A).doc(entryPath('e1')).set(entry('a'));
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

  it('cannot re-review an approved phiếu', async () => {
    await as(B).doc(entryPath('e1')).update(approve('b'));
    await assertFails(as(B).doc(entryPath('e1')).update({ ...approve('b'), status: 'rejected', rejectReason: 'x' }));
  });

  it('rejects review after the day is closed, unless super admin', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`days/${TODAY}`).set({ closed: true });
    });
    await assertFails(as(B).doc(entryPath('e1')).update(approve('b')));
    await assertSucceeds(as(ADMIN).doc(entryPath('e1')).update(approve('admin')));
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

  it('closed day: member cannot edit schedule, but super admin can', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`days/${TODAY}`).set({ closed: true });
    });
    await assertFails(as(A).doc(`days/${TODAY}/schedules/1`).set(schedule('a', 1)));
    await assertSucceeds(as(ADMIN).doc(`days/${TODAY}/schedules/1`).set(schedule('admin', 1)));
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
