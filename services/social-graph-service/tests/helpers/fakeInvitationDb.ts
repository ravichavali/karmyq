/**
 * Sprint 145 (BUG-106): an in-memory stand-in for the tables invitation acceptance touches, for the
 * route and module unit tiers. It interprets each statement by its table and verb, applies the two
 * triggers the real database owns (the ADR-106 member counter and the inviter-stats acceptance trigger),
 * snapshots state at BEGIN and restores it on ROLLBACK, and throws on any statement it does not know, so
 * a new query cannot slip past these tests unasserted.
 *
 * It answers the pre-Sprint-145 handler's pool statements too, so the old handler runs and fails on
 * behavior assertions rather than on harness errors. It proves wiring, ordering and outcomes only: row
 * locks, interleavings and real SQL are proven in
 * tests/integration/sprint-145-admission-integrity.integration.test.ts.
 */

export const DB_NOW = new Date('2026-11-23T12:00:00.000Z');
export const TRIPLET_CONSTRAINT = 'user_invitations_inviter_id_invitee_id_community_id_key';

export interface FakeInvitation {
  id: string;
  invitation_code: string;
  inviter_id: string;
  invitee_id: string | null;
  community_id: string | null;
  invitation_accepted_at: Date | null;
}
export interface FakeCommunity {
  id: string;
  status: string;
  access_type: string;
  current_members: number;
  max_members: number;
}
export interface FakeMember {
  community_id: string;
  user_id: string;
  status: string | null;
  role: string | null;
  joined_at: Date;
  join_request_message: string | null;
}
export interface FakeState {
  invitations: FakeInvitation[];
  communities: FakeCommunity[];
  members: FakeMember[];
  users: Record<string, { invited_by: string | null; invitation_accepted_at: Date | null }>;
  /** total_invitations_accepted per `${inviter}:${community}`, as the acceptance trigger maintains it. */
  acceptedStats: Record<string, number>;
}
export interface Call { via: 'pool' | 'client'; sql: string; params: unknown[] }
export interface FakeDbOptions {
  connectError?: Error;
  rollbackError?: Error;
  /** Throw `error` from the first statement whose text matches. */
  failOn?: { match: RegExp; error: Error };
  /** Runs before a member INSERT is applied: lets a test plant the row a concurrent winner committed. */
  beforeMemberInsert?: (state: FakeState) => void;
  /** Runs after the conflict no-op, before the next statement: lets a test remove the winner again. */
  afterMemberInsertConflict?: (state: FakeState) => void;
  /** Runs once, right after the inviter FOR SHARE select returns: lets a test commit a row that select missed. */
  afterInviterLock?: (state: FakeState) => void;
}

export const pgError = (message: string, fields: { code: string; constraint?: string }): Error =>
  Object.assign(new Error(message), fields);

const rows = (r: unknown[]) => ({ rows: r, rowCount: r.length });
const WRITE = /^\s*(INSERT|UPDATE|DELETE)\b/i;

export function createFakeDb(initial: FakeState, options: FakeDbOptions = {}) {
  let state: FakeState = structuredClone(initial);
  let snapshot: FakeState | null = null;
  let pendingConflictHook = false;
  const calls: Call[] = [];

  const member = (c: unknown, u: unknown) => state.members.find((m) => m.community_id === c && m.user_id === u);
  const community = (c: unknown) => state.communities.find((x) => x.id === c);
  const bump = (c: string, delta: number) => {
    const row = community(c);
    if (row) row.current_members += delta;
  };

  async function run(via: Call['via'], sql: string, params: unknown[] = []) {
    calls.push({ via, sql, params });
    if (pendingConflictHook) {
      pendingConflictHook = false;
      options.afterMemberInsertConflict?.(state);
    }
    if (options.failOn && options.failOn.match.test(sql)) {
      const { error } = options.failOn;
      options.failOn = undefined;
      throw error;
    }
    if (/^\s*BEGIN\s*$/i.test(sql)) {
      snapshot = structuredClone(state);
      return rows([]);
    }
    if (/^\s*COMMIT\s*$/i.test(sql)) {
      snapshot = null;
      return rows([]);
    }
    if (/^\s*ROLLBACK\s*$/i.test(sql)) {
      if (options.rollbackError) throw options.rollbackError;
      if (snapshot) state = snapshot;
      snapshot = null;
      return rows([]);
    }
    if (/FROM auth\.user_invitations\s+WHERE invitation_code = \$1/i.test(sql)) {
      return rows(state.invitations.filter((i) => i.invitation_code === params[0]).map((i) => ({ ...i })));
    }
    if (/FROM communities\.communities\s+WHERE id = \$1/i.test(sql)) {
      const row = community(params[0]);
      return rows(row ? [{ ...row }] : []);
    }
    if (/SELECT role FROM communities\.members\s+WHERE community_id = \$1 AND user_id = \$2 AND status = 'active'/i.test(sql)) {
      const row = member(params[0], params[1]);
      return rows(row && row.status === 'active' ? [{ role: row.role }] : []);
    }
    if (/^\s*SELECT[\s\S]*FROM communities\.members\s+WHERE community_id = \$1 AND user_id = \$2/i.test(sql)) {
      const row = member(params[0], params[1]);
      const result = rows(row ? [{ ...row }] : []);
      if (/FOR SHARE\s*$/i.test(sql) && options.afterInviterLock) {
        const hook = options.afterInviterLock;
        options.afterInviterLock = undefined;
        hook(state);
      }
      return result;
    }
    if (/^\s*INSERT INTO communities\.members/i.test(sql)) {
      options.beforeMemberInsert?.(state);
      const [c, u] = params as string[];
      if (member(c, u)) {
        pendingConflictHook = true;
        return rows([]);
      }
      const row: FakeMember = { community_id: c, user_id: u, status: 'active', role: 'member', joined_at: DB_NOW, join_request_message: null };
      state.members.push(row);
      bump(c, 1);
      return rows([{ ...row }]);
    }
    if (/^\s*UPDATE communities\.members/i.test(sql)) {
      const [c, u, from] = params as string[];
      const row = member(c, u);
      if (!row || row.status !== from) return rows([]);
      const wasActive = row.status === 'active';
      Object.assign(row, { status: 'active', role: 'member', joined_at: DB_NOW, join_request_message: null });
      if (!wasActive) bump(c, 1);
      return rows([{ ...row }]);
    }
    if (/^\s*UPDATE auth\.user_invitations/i.test(sql)) {
      const [invitee, id] = params as string[];
      const inv = state.invitations.find((i) => i.id === id);
      if (!inv) return rows([]);
      if (inv.inviter_id === invitee) {
        throw pgError('new row for relation "user_invitations" violates check constraint "no_self_invitation"',
          { code: '23514', constraint: 'no_self_invitation' });
      }
      if (state.invitations.some((i) => i.id !== id && i.inviter_id === inv.inviter_id && i.invitee_id === invitee
        && i.community_id === inv.community_id)) {
        throw pgError(`duplicate key value violates unique constraint "${TRIPLET_CONSTRAINT}"`,
          { code: '23505', constraint: TRIPLET_CONSTRAINT });
      }
      const wasAccepted = inv.invitation_accepted_at !== null;
      inv.invitee_id = invitee;
      inv.invitation_accepted_at = DB_NOW;
      if (!wasAccepted && inv.community_id) {
        const key = `${inv.inviter_id}:${inv.community_id}`;
        state.acceptedStats[key] = (state.acceptedStats[key] ?? 0) + 1;
      }
      return rows([{ invitation_accepted_at: DB_NOW }]);
    }
    if (/^\s*UPDATE auth\.users/i.test(sql)) {
      const [inviter, user] = params as string[];
      state.users[user] = { invited_by: inviter, invitation_accepted_at: DB_NOW };
      return rows([]);
    }
    throw new Error(`fakeInvitationDb: unhandled SQL: ${sql}`);
  }

  const release = jest.fn();
  const client = { query: jest.fn((sql: string, params?: unknown[]) => run('client', sql, params)), release };
  const pool = {
    query: jest.fn((sql: string, params?: unknown[]) => run('pool', sql, params)),
    connect: jest.fn(async () => {
      if (options.connectError) throw options.connectError;
      return client;
    }),
  };
  return {
    pool,
    client,
    release,
    calls,
    state: () => state,
    sql: () => calls.map((c) => c.sql.replace(/\s+/g, ' ').trim()),
    writes: () => calls.filter((c) => WRITE.test(c.sql)),
  };
}

export type FakeDb = ReturnType<typeof createFakeDb>;
