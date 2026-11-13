/** Nomination electorates are captured once; the threshold never shrinks with membership. */
export const GOVERNANCE_QUORUM_POLICY = { version: 1, percentage: 20, minimum: 3 } as const;

export function requiredRatifications(electorateSize: number): number {
  if (!Number.isSafeInteger(electorateSize) || electorateSize < 0) {
    throw new RangeError('Electorate size must be a nonnegative safe integer');
  }
  return Math.max(GOVERNANCE_QUORUM_POLICY.minimum, Math.ceil(electorateSize / 5));
}

export function canElevateRole(currentRole: string, targetRole: 'admin' | 'moderator'): boolean {
  return (currentRole === 'member' && (targetRole === 'admin' || targetRole === 'moderator'))
    || (currentRole === 'moderator' && targetRole === 'admin');
}

/** Only deliberate public denials cross the router boundary; other errors become logged 500s. */
export class GovernanceError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = 'GovernanceError';
  }
}
