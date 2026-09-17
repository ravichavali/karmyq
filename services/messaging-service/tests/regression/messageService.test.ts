/**
 * Sprint 131 PR B (BUG-034): the first tests messaging-service has ever had.
 *
 * Exercises the REAL messageService functions. Only the database module is replaced; its real
 * version constructs a pg Pool at import time. No Redis, no Socket.IO, no HTTP server.
 *
 * These characterize existing behavior, so they may pass on first run. Each authorization/ordering
 * assertion was proven able to fail by a temporary mutation (recorded in the PR B handoff).
 */
import { query } from '../../src/database/db';
import { getMessages, sendMessage } from '../../src/services/messageService';

jest.mock('../../src/database/db', () => ({ query: jest.fn() }));

const mockQuery = query as jest.MockedFunction<typeof query>;

const CONVERSATION = 'c0ffee00-0000-4000-8000-000000000001';
const MEMBER = 'a11ce000-0000-4000-8000-000000000002';
const OUTSIDER = '0b5e0000-0000-4000-8000-000000000003';
const NOT_PARTICIPANT = 'User is not a participant in this conversation';

const rows = (r: unknown[]) => ({ rows: r }) as any;
const PARTICIPANT_SQL = /FROM messaging\.conversation_participants\s+WHERE conversation_id = \$1 AND participant_id = \$2/;

let consoleError: jest.SpyInstance;

beforeEach(() => {
  // Root jest.config.js sets resetMocks + restoreMocks: implementations and spies are wiped before
  // every test, so all behavior is installed here or in the test, never at module scope.
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('getMessages', () => {
  it('denies a non-participant before querying any messages', async () => {
    mockQuery.mockResolvedValueOnce(rows([]));

    await expect(getMessages(CONVERSATION, OUTSIDER, 20, 40)).rejects.toThrow(NOT_PARTICIPANT);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][0]).toMatch(PARTICIPANT_SQL);
    expect(mockQuery.mock.calls[0][1]).toEqual([CONVERSATION, OUTSIDER]);
  });

  it('returns a participant the requested page in chronological order', async () => {
    const newest = { id: 'm3', created_at: '2026-09-16T10:03:00.000Z' };
    const middle = { id: 'm2', created_at: '2026-09-16T10:02:00.000Z' };
    const oldest = { id: 'm1', created_at: '2026-09-16T10:01:00.000Z' };
    mockQuery
      .mockResolvedValueOnce(rows([{ participant_id: MEMBER }]))
      .mockResolvedValueOnce(rows([newest, middle, oldest])); // SQL orders DESC

    const messages = await getMessages(CONVERSATION, MEMBER, 20, 40);

    expect(messages.map((m: { id: string }) => m.id)).toEqual(['m1', 'm2', 'm3']);
    expect(mockQuery).toHaveBeenCalledTimes(2);
    const [sql, params] = mockQuery.mock.calls[1];
    expect(sql).toMatch(/ORDER BY m\.created_at DESC\s+LIMIT \$2 OFFSET \$3/);
    expect(params).toEqual([CONVERSATION, 20, 40]);
  });

  it('defaults to the first page of 50', async () => {
    mockQuery.mockResolvedValueOnce(rows([{ participant_id: MEMBER }])).mockResolvedValueOnce(rows([]));

    await expect(getMessages(CONVERSATION, MEMBER)).resolves.toEqual([]);

    expect(mockQuery.mock.calls[1][1]).toEqual([CONVERSATION, 50, 0]);
  });
});

describe('sendMessage', () => {
  it('denies a non-participant without inserting anything', async () => {
    mockQuery.mockResolvedValueOnce(rows([]));

    await expect(sendMessage(CONVERSATION, OUTSIDER, 'hello')).rejects.toThrow(NOT_PARTICIPANT);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][1]).toEqual([CONVERSATION, OUTSIDER]);
    expect(mockQuery.mock.calls.some(([sql]) => /INSERT INTO messaging\.messages/.test(sql))).toBe(false);
  });

  it('checks, inserts, bumps the conversation, then attaches the sender', async () => {
    const inserted = {
      id: 'm4',
      conversation_id: CONVERSATION,
      sender_id: MEMBER,
      content: 'hello',
      status: 'sent',
      created_at: '2026-09-16T10:04:00.000Z',
    };
    const sender = { id: MEMBER, name: 'Maria Reyes', email: 'maria@example.test' };
    mockQuery
      .mockResolvedValueOnce(rows([{ participant_id: MEMBER }]))
      .mockResolvedValueOnce(rows([inserted]))
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce(rows([sender]));

    const message = await sendMessage(CONVERSATION, MEMBER, 'hello');

    expect(message).toEqual({ ...inserted, sender });
    const calls = mockQuery.mock.calls;
    expect(calls).toHaveLength(4);
    expect(calls[0][0]).toMatch(PARTICIPANT_SQL);
    expect(calls[0][1]).toEqual([CONVERSATION, MEMBER]);
    expect(calls[1][0]).toMatch(/INSERT INTO messaging\.messages \(conversation_id, sender_id, content, status\)\s+VALUES \(\$1, \$2, \$3, 'sent'\)/);
    expect(calls[1][1]).toEqual([CONVERSATION, MEMBER, 'hello']);
    expect(calls[2][0]).toMatch(/UPDATE messaging\.conversations\s+SET last_message_at = CURRENT_TIMESTAMP\s+WHERE id = \$1/);
    expect(calls[2][1]).toEqual([CONVERSATION]);
    expect(calls[3][0]).toMatch(/SELECT id, name, email FROM auth\.users WHERE id = \$1/);
    expect(calls[3][1]).toEqual([MEMBER]);
  });

  it('logs and rethrows a database failure', async () => {
    const failure = new Error('connection terminated');
    mockQuery.mockRejectedValueOnce(failure);

    await expect(sendMessage(CONVERSATION, MEMBER, 'hello')).rejects.toBe(failure);

    expect(consoleError).toHaveBeenCalledWith('Error in sendMessage:', failure);
  });
});
