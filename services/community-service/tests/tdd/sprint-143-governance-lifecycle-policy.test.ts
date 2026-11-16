import { closeStatusFor, deriveViewerState } from '../../src/database/governancePolicy';
import {
  canSelfDepart,
  classifyExistingMembership,
  departureStatus,
} from '../../src/utils/memberLifecycle';

describe('deriveViewerState', () => {
  const base = {
    isNominee: false,
    inElectorate: true,
    hasVoted: false,
    count: 0,
    required: 3,
    nomineeEligible: true,
  };

  it.each([
    ['nominee', { isNominee: true }, { can_ratify: false, reason: 'nominee' }],
    ['not in electorate', { inElectorate: false }, { can_ratify: false, reason: 'not_in_electorate' }],
    ['voted below quorum', { hasVoted: true, count: 1 }, { can_ratify: false, reason: 'already_ratified' }],
    ['voted at quorum', { hasVoted: true, count: 3 }, { can_ratify: true, reason: 'ready_to_finalize' }],
    [
      'voted at quorum with ineligible nominee',
      { hasVoted: true, count: 3, nomineeEligible: false },
      { can_ratify: false, reason: 'nominee_ineligible' },
    ],
    ['eligible voter', {}, { can_ratify: true, reason: 'eligible' }],
    [
      'deciding ballot with ineligible nominee',
      { count: 2, nomineeEligible: false },
      { can_ratify: false, reason: 'nominee_ineligible' },
    ],
    [
      'non-deciding ballot with ineligible nominee',
      { nomineeEligible: false },
      { can_ratify: true, reason: 'eligible' },
    ],
  ])('maps %s to the POST outcome', (_name, overrides, expected) => {
    expect(deriveViewerState({ ...base, ...overrides })).toEqual(expected);
  });
});

describe('nomination close status', () => {
  it('maps withdraw and decline to distinct terminal states', () => {
    expect(closeStatusFor('withdraw')).toBe('withdrawn');
    expect(closeStatusFor('decline')).toBe('declined');
  });
});

describe('membership lifecycle rules', () => {
  it.each([
    [undefined, 'new'],
    ['active', 'already_active'],
    ['pending', 'already_pending'],
    ['left', 'rejoin'],
    ['inactive', 'staff_only'],
    ['invited', 'staff_only'],
    ['', 'staff_only'],
    ['unexpected', 'staff_only'],
  ])('classifies existing status %s as %s', (status, expected) => {
    expect(classifyExistingMembership(status)).toBe(expected);
  });

  it('distinguishes self-departure from staff removal', () => {
    expect(departureStatus(true)).toBe('left');
    expect(departureStatus(false)).toBe('inactive');
  });

  it.each([
    ['active', true],
    ['pending', true],
    ['left', false],
    ['inactive', false],
    ['invited', false],
    ['', false],
  ])('allows self-departure from %s: %s', (status, expected) => {
    expect(canSelfDepart(status)).toBe(expected);
  });
});
