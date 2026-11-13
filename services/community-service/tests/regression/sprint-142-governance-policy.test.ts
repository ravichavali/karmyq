import {
  GOVERNANCE_QUORUM_POLICY,
  requiredRatifications,
  canElevateRole,
  GovernanceError,
} from '../../src/database/governancePolicy';

describe('Sprint 142 governance quorum policy', () => {
  it('publishes the equal-vote proportional policy', () => {
    expect(GOVERNANCE_QUORUM_POLICY).toEqual({ version: 1, percentage: 20, minimum: 3 });
  });

  it.each([
    [0, 3], [1, 3], [2, 3], [3, 3], [10, 3], [15, 3], [16, 4], [50, 10], [149, 30],
  ])('requires %i voters to gather %i ratifications', (electorate, required) => {
    expect(requiredRatifications(electorate)).toBe(required);
  });

  it.each([-1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid electorate size %s instead of producing an unsafe quorum',
    (size) => expect(() => requiredRatifications(size)).toThrow(RangeError),
  );

  it.each([
    ['member', 'moderator', true], ['member', 'admin', true], ['moderator', 'admin', true],
    ['admin', 'moderator', false], ['admin', 'admin', false], ['moderator', 'moderator', false],
    ['unknown', 'admin', false], ['', 'moderator', false],
  ] as const)('elevating %s to %s is %s', (current, target, expected) => {
    expect(canElevateRole(current, target)).toBe(expected);
  });

  it('carries a stable HTTP status, code and public message without losing Error behavior', () => {
    const error = new GovernanceError(503, 'GOVERNANCE_RETRY', 'Please retry this decision.');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('GovernanceError');
    expect(error.status).toBe(503);
    expect(error.code).toBe('GOVERNANCE_RETRY');
    expect(error.message).toBe('Please retry this decision.');
  });
});
