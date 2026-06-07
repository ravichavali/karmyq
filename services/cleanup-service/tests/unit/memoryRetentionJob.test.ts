import { forgetExchangeContent, resolveRetentionWindows } from '../../src/jobs/memoryRetentionJob';

jest.mock('../../src/database/db', () => ({
  query: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
}));

import { query } from '../../src/database/db';
const mockQuery = query as jest.MockedFunction<typeof query>;

// Helper: collect the SQL text of every query the job issued.
const issuedSql = () => mockQuery.mock.calls.map((c) => c[0] as string);
// Helper: find the first issued statement matching a predicate.
const findSql = (pred: (sql: string) => boolean) => issuedSql().find(pred);
// Helper: the params for the statement matching a predicate.
const findCall = (pred: (sql: string) => boolean) =>
  mockQuery.mock.calls.find((c) => pred(c[0] as string));

describe('resolveRetentionWindows', () => {
  it('falls back to hardcoded windows when config is empty', () => {
    expect(resolveRetentionWindows([])).toEqual({
      completedRequestWindowDays: 180,
      expiredRequestWindowDays: 30,
      messageWindowDays: 180,
    });
  });

  it('uses the global (NULL community) row when present', () => {
    const rows = [
      {
        community_id: null,
        completed_request_window_days: 90,
        expired_request_window_days: 14,
        message_window_days: 60,
      },
    ];
    expect(resolveRetentionWindows(rows)).toEqual({
      completedRequestWindowDays: 90,
      expiredRequestWindowDays: 14,
      messageWindowDays: 60,
    });
  });

  it('lets a community row override the global row', () => {
    const rows = [
      {
        community_id: null,
        completed_request_window_days: 180,
        expired_request_window_days: 30,
        message_window_days: 180,
      },
      {
        community_id: 'c1',
        completed_request_window_days: 45,
        expired_request_window_days: 7,
        message_window_days: 45,
      },
    ];
    expect(resolveRetentionWindows(rows, 'c1')).toEqual({
      completedRequestWindowDays: 45,
      expiredRequestWindowDays: 7,
      messageWindowDays: 45,
    });
  });

  it('falls back to the global row when the community has no override', () => {
    const rows = [
      {
        community_id: null,
        completed_request_window_days: 180,
        expired_request_window_days: 30,
        message_window_days: 180,
      },
    ];
    expect(resolveRetentionWindows(rows, 'c-unknown')).toEqual({
      completedRequestWindowDays: 180,
      expiredRequestWindowDays: 30,
      messageWindowDays: 180,
    });
  });
});

describe('forgetExchangeContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: config lookup returns empty (→ fallback windows); all mutations affect 0 rows.
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
  });

  it('anonymizes aged completed-request free-text to sentinels (title, description, payload, requirements)', async () => {
    await forgetExchangeContent();
    const sql = findSql(
      (s) => s.includes('requests.help_requests') && s.includes('content_forgotten_at')
    );
    expect(sql).toBeDefined();
    // ALL free-text columns sentinelled — not just description.
    expect(sql).toContain("title = '[forgotten]'");
    expect(sql).toContain("description = '[forgotten]'");
    expect(sql).toContain("payload = '{}'::jsonb");
    expect(sql).toContain("requirements = '{}'::jsonb");
    // Trigger: completed + aged + not-already-forgotten.
    expect(sql).toContain("status = 'completed'");
    expect(sql).toContain('content_forgotten_at IS NULL');
  });

  it('cascades to the conversation messages in the SAME statement (one transaction)', async () => {
    await forgetExchangeContent();
    const sql = findSql(
      (s) => s.includes('requests.help_requests') && s.includes('content_forgotten_at')
    );
    // The completed-anonymize statement also forgets the linked conversation's messages.
    expect(sql).toContain('messaging.messages');
    expect(sql).toContain('request_match_id'); // request → match → conversation → messages join
    expect(sql).toContain("content = '[forgotten]'");
    expect(sql).toContain('forgotten_at');
  });

  it('hard-deletes expired + unmatched requests, aged from updated_at (NOT created_at)', async () => {
    await forgetExchangeContent();
    const sql = findSql((s) => s.startsWith('DELETE') || s.trimStart().startsWith('DELETE'));
    expect(sql).toBeDefined();
    expect(sql).toContain('expired = TRUE');
    expect(sql).toContain('NOT EXISTS'); // unmatched only
    expect(sql).toContain('requests.matches'); // checks for a match row
    expect(sql).toContain('updated_at'); // age from updated_at
    expect(sql).not.toContain('created_at'); // NEVER created_at — would delete just-expired old rows
  });

  it('resolves the completed + expired windows per-community (honors retention_config overrides)', async () => {
    await forgetExchangeContent();
    const completed = findSql(
      (s) => s.includes('requests.help_requests') && s.includes('content_forgotten_at')
    );
    const expired = findSql((s) => s.includes('DELETE') && s.includes('expired = TRUE'));
    // Both branches join through request_communities → retention_config and take the per-request
    // effective window (community override else global), not a flat global window.
    for (const sql of [completed, expired]) {
      expect(sql).toContain('requests.request_communities');
      expect(sql).toContain('retention_config');
      expect(sql).toMatch(/window_days/);
    }
  });

  it('never writes karma_records (off limits — load-bearing enum, no PII)', async () => {
    await forgetExchangeContent();
    for (const sql of issuedSql()) {
      expect(sql).not.toContain('karma_records');
    }
  });

  it('runs a standalone message backstop for old messages aged from created_at', async () => {
    await forgetExchangeContent();
    // The backstop touches messages but not help_requests, and ages from created_at.
    const sql = findSql(
      (s) =>
        s.includes('messaging.messages') &&
        !s.includes('requests.help_requests') &&
        s.includes('created_at')
    );
    expect(sql).toBeDefined();
    expect(sql).toContain("content = '[forgotten]'");
    expect(sql).toContain('forgotten_at IS NULL'); // idempotent: skip already-forgotten
  });

  it('respects the forgotten markers so a second run re-forgets nothing (idempotent predicates)', async () => {
    await forgetExchangeContent();
    const completed = findSql(
      (s) => s.includes('requests.help_requests') && s.includes('content_forgotten_at')
    );
    const backstop = findSql(
      (s) =>
        s.includes('messaging.messages') &&
        !s.includes('requests.help_requests') &&
        s.includes('created_at')
    );
    expect(completed).toContain('content_forgotten_at IS NULL');
    expect(backstop).toContain('forgotten_at IS NULL');
  });

  it('resolves windows from config and passes them as query params', async () => {
    // Config lookup returns a global row with custom windows.
    mockQuery.mockReset();
    mockQuery.mockImplementation((sql: any) => {
      if (typeof sql === 'string' && sql.includes('retention_config')) {
        return Promise.resolve({
          rows: [
            {
              community_id: null,
              completed_request_window_days: 90,
              expired_request_window_days: 14,
              message_window_days: 60,
            },
          ],
          rowCount: 1,
        }) as any;
      }
      return Promise.resolve({ rows: [], rowCount: 0 }) as any;
    });

    await forgetExchangeContent();

    const completedCall = findCall(
      (s) => s.includes('requests.help_requests') && s.includes('content_forgotten_at')
    );
    const expiredCall = findCall((s) => s.includes('DELETE') && s.includes('expired = TRUE'));
    const backstopCall = findCall(
      (s) =>
        s.includes('messaging.messages') &&
        !s.includes('requests.help_requests') &&
        s.includes('created_at')
    );
    expect(completedCall?.[1]).toContain(90);
    expect(expiredCall?.[1]).toContain(14);
    expect(backstopCall?.[1]).toContain(60);
  });
});
