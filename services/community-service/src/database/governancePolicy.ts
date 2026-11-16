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

export type GovernanceViewerReason = 'eligible' | 'nominee' | 'already_ratified'
  | 'not_in_electorate' | 'ready_to_finalize' | 'nominee_ineligible';

export function deriveViewerState(input: {
  isNominee: boolean;
  inElectorate: boolean;
  hasVoted: boolean;
  count: number;
  required: number;
  nomineeEligible: boolean;
}): { can_ratify: boolean; reason: GovernanceViewerReason } {
  if (input.isNominee) return { can_ratify: false, reason: 'nominee' };
  if (!input.inElectorate) return { can_ratify: false, reason: 'not_in_electorate' };
  if (input.hasVoted) {
    if (input.count < input.required) return { can_ratify: false, reason: 'already_ratified' };
    return input.nomineeEligible
      ? { can_ratify: true, reason: 'ready_to_finalize' }
      : { can_ratify: false, reason: 'nominee_ineligible' };
  }
  if (!input.nomineeEligible && input.count + 1 >= input.required) {
    return { can_ratify: false, reason: 'nominee_ineligible' };
  }
  return { can_ratify: true, reason: 'eligible' };
}

export function closeStatusFor(action: 'withdraw' | 'decline'): 'withdrawn' | 'declined' {
  return action === 'withdraw' ? 'withdrawn' : 'declined';
}

/** Only deliberate public denials cross the router boundary; other errors become logged 500s. */
export class GovernanceError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = 'GovernanceError';
  }
}
