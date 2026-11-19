/**
 * Sprint 144 — the staff membership transition table (BUG-105, decisions 4 and 8, D1–D4).
 *
 * planStaffChange is pure: the PUT route locks the target and active admins, reads the caller's
 * live role, and executes whatever this returns. Every row of the spec's table is asserted as an
 * exact operation object, never a truthy check.
 */
import { planStaffChange, validateStaffBody, Target } from '../../src/utils/staffTransitions';

const t = (status: string | null, role: string | null = 'member', isSoleActiveAdmin = false): Target =>
  ({ status, role, isSoleActiveAdmin });

const refuse = (http: number, code: string) => ({ kind: 'refuse', http, code, message: expect.any(String) });

describe('Sprint 144 staff body validation (D1)', () => {
  it.each([
    ['both keys', { role: 'member', status: 'active' }],
    ['neither key', {}],
    ['only the ignored legacy key', { admin_user_id: 'x' }],
    ['an unknown key with status', { status: 'active', note: 'hi' }],
    ['an unknown key with role', { role: 'admin', joined_at: '2000-01-01' }],
    ['a non-string status', { status: 1 }],
    ['a null status', { status: null }],
    ['a non-string role', { role: ['admin'] }],
    ['status pending', { status: 'pending' }],
    ['an unknown status', { status: 'removed' }],
    ['an uppercase status', { status: 'ACTIVE' }],
    ['an unknown role', { role: 'superuser' }],
    ['an array body', [{ status: 'active' }]],
    ['a null body', null],
    ['a string body', 'status=active'],
  ])('refuses %s with 400 VALIDATION_ERROR', (_label, body) => {
    expect(validateStaffBody(body)).toEqual(refuse(400, 'VALIDATION_ERROR'));
    expect(planStaffChange('admin', t('pending'), body)).toEqual(refuse(400, 'VALIDATION_ERROR'));
  });

  it('ignores the legacy admin_user_id key', () => {
    expect(validateStaffBody({ status: 'active', admin_user_id: 'someone-else' })).toEqual({ kind: 'status', value: 'active' });
    expect(planStaffChange('admin', t('pending'), { status: 'active', admin_user_id: 'x' }))
      .toEqual({ kind: 'write', set: { status: 'active', role: 'member' }, admits: true });
  });

  it.each([
    [{ status: 'active' }, { kind: 'status', value: 'active' }],
    [{ status: 'inactive' }, { kind: 'status', value: 'inactive' }],
    [{ status: 'left' }, { kind: 'status', value: 'left' }],
    [{ role: 'member' }, { kind: 'role', value: 'member' }],
    [{ role: 'moderator' }, { kind: 'role', value: 'moderator' }],
    [{ role: 'admin' }, { kind: 'role', value: 'admin' }],
  ])('parses %j', (body, parsed) => {
    expect(validateStaffBody(body)).toEqual(parsed);
  });

  it('validates the body before authorizing the caller', () => {
    expect(planStaffChange(null, t('pending'), { status: 'pending' })).toEqual(refuse(400, 'VALIDATION_ERROR'));
  });
});

describe('Sprint 144 staff caller authorization', () => {
  it.each([null, 'member'] as const)('refuses a %s caller with 403 FORBIDDEN', (caller) => {
    expect(planStaffChange(caller, t('pending'), { status: 'active' })).toEqual(refuse(403, 'FORBIDDEN'));
    expect(planStaffChange(caller, t('active'), { role: 'admin' })).toEqual(refuse(403, 'FORBIDDEN'));
    expect(planStaffChange(caller, null, { status: 'active' })).toEqual(refuse(403, 'FORBIDDEN'));
  });

  it.each(['admin', 'moderator'] as const)('answers 404 NOT_FOUND to a %s when the target row is missing', (caller) => {
    expect(planStaffChange(caller, null, { status: 'active' })).toEqual(refuse(404, 'NOT_FOUND'));
  });

  it('refuses a moderator sending role before looking for the target', () => {
    expect(planStaffChange('moderator', null, { role: 'member' })).toEqual(refuse(403, 'FORBIDDEN'));
  });
});

describe('Sprint 144 status transitions', () => {
  describe.each(['admin', 'moderator'] as const)('allowed for an active %s', (caller) => {
    it('approves pending → active, resets the role to member and admits', () => {
      expect(planStaffChange(caller, t('pending', 'member'), { status: 'active' }))
        .toEqual({ kind: 'write', set: { status: 'active', role: 'member' }, admits: true });
    });

    it('approves a pending row whose stored role is admin as a member (D2)', () => {
      expect(planStaffChange(caller, t('pending', 'admin'), { status: 'active' }))
        .toEqual({ kind: 'write', set: { status: 'active', role: 'member' }, admits: true });
    });

    it('rejects pending → inactive, leaving the role unchanged and admitting nobody', () => {
      expect(planStaffChange(caller, t('pending', 'moderator'), { status: 'inactive' }))
        .toEqual({ kind: 'write', set: { status: 'inactive' }, admits: false });
    });

    it.each(['active', 'inactive', 'left'])('refuses every request against a left row (%s) with MEMBER_MUST_REJOIN', (status) => {
      expect(planStaffChange(caller, t('left', 'admin'), { status })).toEqual(refuse(409, 'MEMBER_MUST_REJOIN'));
    });

    it.each(['active', 'inactive'])('treats %s → itself as a retry (409 INVALID_MEMBERSHIP_TRANSITION, D4)', (status) => {
      expect(planStaffChange(caller, t(status), { status })).toEqual(refuse(409, 'INVALID_MEMBERSHIP_TRANSITION'));
    });
  });

  describe('admin-only transitions', () => {
    it('deactivates active → inactive for an admin, leaving the role unchanged', () => {
      expect(planStaffChange('admin', t('active', 'moderator'), { status: 'inactive' }))
        .toEqual({ kind: 'write', set: { status: 'inactive' }, admits: false });
    });

    it('deactivates a non-sole active admin', () => {
      expect(planStaffChange('admin', t('active', 'admin', false), { status: 'inactive' }))
        .toEqual({ kind: 'write', set: { status: 'inactive' }, admits: false });
    });

    it('refuses deactivating the sole active admin with 400 LAST_ADMIN', () => {
      expect(planStaffChange('admin', t('active', 'admin', true), { status: 'inactive' })).toEqual(refuse(400, 'LAST_ADMIN'));
    });

    it('lifts a block inactive → left for an admin and resets the role to member (decision 8)', () => {
      expect(planStaffChange('admin', t('inactive', 'admin'), { status: 'left' }))
        .toEqual({ kind: 'write', set: { status: 'left', role: 'member' }, admits: false });
      expect(planStaffChange('admin', t('inactive', 'member'), { status: 'left' }))
        .toEqual({ kind: 'write', set: { status: 'left', role: 'member' }, admits: false });
    });

    it.each([
      ['deactivate an active member', t('active', 'member'), { status: 'inactive' }],
      ['deactivate a non-sole active admin', t('active', 'admin', false), { status: 'inactive' }],
      ['lift a block on a stored admin', t('inactive', 'admin'), { status: 'left' }],
      ['lift a block on a member', t('inactive', 'member'), { status: 'left' }],
      ['reactivate an inactive stored admin', t('inactive', 'admin'), { status: 'active' }],
      ['reactivate an inactive member', t('inactive', 'member'), { status: 'active' }],
      ['set an active member to left', t('active'), { status: 'left' }],
      ['set a pending applicant to left', t('pending'), { status: 'left' }],
    ])('refuses a moderator trying to %s with 403 FORBIDDEN (BUG-105, decision 4)', (_label, target, body) => {
      expect(planStaffChange('moderator', target, body)).toEqual(refuse(403, 'FORBIDDEN'));
    });
  });

  describe('transitions no staff member may make (admin caller)', () => {
    it('refuses inactive → active: lift the block, the person rejoins', () => {
      const plan = planStaffChange('admin', t('inactive', 'admin'), { status: 'active' });
      expect(plan).toEqual(refuse(409, 'INVALID_MEMBERSHIP_TRANSITION'));
      expect((plan as any).message).toMatch(/lift/i);
    });

    it.each(['active', 'pending'])('refuses %s → left: only the member leaves', (status) => {
      expect(planStaffChange('admin', t(status), { status: 'left' })).toEqual(refuse(409, 'INVALID_MEMBERSHIP_TRANSITION'));
    });

    it.each([null, 'invited', 'removed'])('refuses any status change on an unrecognized stored status (%s)', (status) => {
      expect(planStaffChange('admin', t(status), { status: 'active' })).toEqual(refuse(409, 'INVALID_MEMBERSHIP_TRANSITION'));
      expect(planStaffChange('moderator', t(status), { status: 'inactive' })).toEqual(refuse(403, 'FORBIDDEN'));
    });
  });
});

describe('Sprint 144 role changes (active admin caller, active target)', () => {
  it.each([
    ['member', 'moderator'],
    ['member', 'admin'],
    ['moderator', 'member'],
    ['moderator', 'admin'],
  ])('changes an active %s to %s', (from, to) => {
    expect(planStaffChange('admin', t('active', from), { role: to }))
      .toEqual({ kind: 'write', set: { role: to }, admits: false });
  });

  it('demotes a non-sole active admin', () => {
    expect(planStaffChange('admin', t('active', 'admin', false), { role: 'moderator' }))
      .toEqual({ kind: 'write', set: { role: 'moderator' }, admits: false });
  });

  it.each(['member', 'moderator'])('refuses demoting the sole active admin to %s with 400 LAST_ADMIN', (role) => {
    expect(planStaffChange('admin', t('active', 'admin', true), { role })).toEqual(refuse(400, 'LAST_ADMIN'));
  });

  it.each(['member', 'moderator', 'admin'])('refuses a moderator sending role %s with 403', (role) => {
    expect(planStaffChange('moderator', t('active', 'member'), { role })).toEqual(refuse(403, 'FORBIDDEN'));
  });

  it.each(['member', 'moderator', 'admin'])('treats an unchanged role %s as a retry (409, D4)', (role) => {
    expect(planStaffChange('admin', t('active', role, role === 'admin'), { role })).toEqual(refuse(409, 'INVALID_MEMBERSHIP_TRANSITION'));
  });

  it('treats a NULL stored role as member', () => {
    expect(planStaffChange('admin', t('active', null), { role: 'member' })).toEqual(refuse(409, 'INVALID_MEMBERSHIP_TRANSITION'));
    expect(planStaffChange('admin', t('active', null), { role: 'moderator' }))
      .toEqual({ kind: 'write', set: { role: 'moderator' }, admits: false });
  });

  it.each(['pending', 'inactive', null])('refuses a role change on a %s target with 409 INVALID_MEMBERSHIP_TRANSITION', (status) => {
    expect(planStaffChange('admin', t(status, 'member'), { role: 'admin' })).toEqual(refuse(409, 'INVALID_MEMBERSHIP_TRANSITION'));
  });

  it('refuses a role change on a left target with MEMBER_MUST_REJOIN (D3 precedes D4)', () => {
    expect(planStaffChange('admin', t('left', 'member'), { role: 'admin' })).toEqual(refuse(409, 'MEMBER_MUST_REJOIN'));
  });
});

describe('Sprint 144 admission flag', () => {
  it('marks only approve as admitting', () => {
    const cases: Array<[string | null, Target, unknown]> = [];
    for (const caller of ['admin', 'moderator'] as const) {
      for (const status of ['pending', 'active', 'inactive', 'left', null]) {
        for (const role of ['member', 'moderator', 'admin']) {
          for (const sole of [false, true]) {
            for (const body of [{ status: 'active' }, { status: 'inactive' }, { status: 'left' }, { role: 'member' }, { role: 'moderator' }, { role: 'admin' }]) {
              cases.push([caller, t(status, role, sole), body]);
            }
          }
        }
      }
    }
    const admitting = cases
      .map(([caller, target, body]) => ({ caller, target, body, plan: planStaffChange(caller as any, target, body) }))
      .filter(({ plan }) => plan.kind === 'write' && plan.admits);
    expect(admitting.length).toBeGreaterThan(0);
    for (const { target, body } of admitting) {
      expect(target.status).toBe('pending');
      expect(body).toEqual({ status: 'active' });
    }
  });
});
