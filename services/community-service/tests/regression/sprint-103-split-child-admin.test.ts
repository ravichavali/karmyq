import { selectChildAdmin, SplitAdminSelectionContext } from '../../src/services/fissionService';

const context = (overrides: Partial<SplitAdminSelectionContext> = {}): SplitAdminSelectionContext => ({
  executingAdminId: 'admin-parent',
  parentAdmins: new Set(['admin-parent', 'admin-b']),
  joinedAtByUser: new Map([
    ['admin-parent', '2026-01-01T00:00:00.000Z'],
    ['admin-b', '2026-01-02T00:00:00.000Z'],
    ['member-strong', '2026-01-03T00:00:00.000Z'],
    ['member-quiet', '2026-01-04T00:00:00.000Z'],
  ]),
  trustEdges: [
    { user_id_a: 'member-strong', user_id_b: 'member-quiet', effective_weight: 5 },
    { user_id_a: 'member-strong', user_id_b: 'member-third', effective_weight: 4 },
    { user_id_a: 'member-quiet', user_id_b: 'member-third', effective_weight: 1 },
  ],
  ...overrides,
});

describe('Sprint 103 split child admin selection', () => {
  it('keeps the executing admin only for the child they are assigned to', () => {
    expect(selectChildAdmin(['admin-parent', 'member-quiet'], context())).toBe('admin-parent');
    expect(selectChildAdmin(['admin-b', 'member-quiet'], context())).toBe('admin-b');
  });

  it('prefers an assigned parent admin over a non-admin with higher trust degree', () => {
    expect(selectChildAdmin(['admin-b', 'member-strong', 'member-quiet'], context())).toBe('admin-b');
  });

  it('promotes the strongest assigned member when no parent admin is assigned', () => {
    expect(selectChildAdmin(['member-quiet', 'member-strong', 'member-third'], context())).toBe('member-strong');
  });

  it('uses joined_at then user_id as deterministic tie-breakers', () => {
    const tied = context({
      trustEdges: [
        { user_id_a: 'member-a', user_id_b: 'member-b', effective_weight: 2 },
        { user_id_a: 'member-c', user_id_b: 'member-b', effective_weight: 2 },
        { user_id_a: 'member-a', user_id_b: 'member-c', effective_weight: 2 },
      ],
      joinedAtByUser: new Map([
        ['member-a', '2026-01-02T00:00:00.000Z'],
        ['member-b', '2026-01-03T00:00:00.000Z'],
        ['member-c', '2026-01-01T00:00:00.000Z'],
      ]),
    });

    expect(selectChildAdmin(['member-a', 'member-b', 'member-c'], tied)).toBe('member-c');
  });

  it('throws if asked to select an admin for an empty child', () => {
    expect(() => selectChildAdmin([], context())).toThrow(/empty child/i);
  });
});
