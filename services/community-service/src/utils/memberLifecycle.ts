export type ExistingMembershipClassification =
  'new' | 'already_active' | 'already_pending' | 'rejoin' | 'staff_only';

export function classifyExistingMembership(status: string | undefined): ExistingMembershipClassification {
  if (status === undefined) return 'new';
  if (status === 'active') return 'already_active';
  if (status === 'pending') return 'already_pending';
  if (status === 'left') return 'rejoin';
  return 'staff_only';
}

export function departureStatus(isSelfRemove: boolean): 'left' | 'inactive' {
  return isSelfRemove ? 'left' : 'inactive';
}

export function canSelfDepart(status: string): boolean {
  return status === 'active' || status === 'pending';
}
