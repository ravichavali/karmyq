/**
 * Sprint 119 / BUG-029 (client end): a community_member badge never names a person the viewer
 * didn't exchange with. Full variant reads "Fellow member of {community}", feed-compact reads
 * "in {community}" — no "via {admin}", no person-chain row. Old cached 3-node paths (which
 * still carry the manufactured admin node until TTL) must render exactly like the new 2-node
 * shape; an absent community_name falls back to "Fellow community member".
 *
 * Truthful paths stay truthful: invitation_chain keeps its factual "Joined through {inviter}"
 * provenance, and exchange paths keep naming the real intermediary.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import TrustPathBadge, { TrustPath } from '../../src/components/TrustPathBadge';

const NEW_SHAPE: TrustPath = {
  degrees_of_separation: 2,
  path: [
    { id: '1', name: 'Maria Reyes' },
    { id: '2', name: 'Ben Okafor' },
  ],
  connection_type: 'community_member',
  community_name: 'Southeast PDX Helpers',
};

// Pre-S119 cached row: the admin was manufactured into the middle of the path.
const OLD_CACHED_SHAPE: TrustPath = {
  degrees_of_separation: 2,
  path: [
    { id: '1', name: 'Maria Reyes' },
    { id: '9', name: 'Nadia Ito' },
    { id: '2', name: 'Ben Okafor' },
  ],
  connection_type: 'community_member',
  community_name: 'Southeast PDX Helpers',
};

describe.each([
  ['new 2-node shape', NEW_SHAPE],
  ['old cached 3-node shape', OLD_CACHED_SHAPE],
])('Sprint 119 / BUG-029: community_member badge is truthful (%s)', (_label, trustPath) => {
  it('full variant reads "Fellow member of {community}" and never names a person', () => {
    render(<TrustPathBadge trustPath={trustPath} />);

    expect(screen.getByText('Fellow member of Southeast PDX Helpers')).toBeInTheDocument();
    expect(screen.queryByText(/via/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nadia Ito/)).not.toBeInTheDocument();
  });

  it('full variant renders no person-chain row', () => {
    render(<TrustPathBadge trustPath={trustPath} />);

    // The chain row is the only place the badge renders "You"; for community membership there
    // is no person-to-person route to draw.
    expect(screen.queryByText('You')).not.toBeInTheDocument();
    expect(screen.queryByText('Maria Reyes')).not.toBeInTheDocument();
    expect(screen.queryByText('Ben Okafor')).not.toBeInTheDocument();
  });

  it('compact variant reads "Fellow member of {community}"', () => {
    render(<TrustPathBadge trustPath={trustPath} compact />);

    expect(screen.getByText('Fellow member of Southeast PDX Helpers')).toBeInTheDocument();
    expect(screen.queryByText(/via/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nadia Ito/)).not.toBeInTheDocument();
  });

  it('feed-compact variant reads "in {community}" with no via', () => {
    render(<TrustPathBadge trustPath={trustPath} compact presentation="feed" />);

    expect(screen.getByText(/in Southeast PDX Helpers/)).toBeInTheDocument();
    expect(screen.queryByText(/via/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nadia Ito/)).not.toBeInTheDocument();
  });
});

describe('Sprint 119 / BUG-029: absent community_name falls back gracefully', () => {
  const NAMELESS: TrustPath = {
    degrees_of_separation: 2,
    path: [
      { id: '1', name: 'Maria Reyes' },
      { id: '2', name: 'Ben Okafor' },
    ],
    connection_type: 'community_member',
  };

  it('full variant falls back to "Fellow community member"', () => {
    render(<TrustPathBadge trustPath={NAMELESS} />);

    expect(screen.getByText('Fellow community member')).toBeInTheDocument();
    expect(screen.queryByText(/via/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
  });

  it('feed-compact variant never renders "of undefined"', () => {
    render(<TrustPathBadge trustPath={NAMELESS} compact presentation="feed" />);

    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
    expect(screen.queryByText(/via/i)).not.toBeInTheDocument();
  });
});

describe('Sprint 119: truthful paths keep their wording', () => {
  it('invitation_chain keeps its factual "Joined through {inviter}" provenance', () => {
    const trustPath: TrustPath = {
      degrees_of_separation: 2,
      path: [
        { id: '1', name: 'You' },
        { id: '2', name: 'Priya Shah' },
        { id: '3', name: 'Ben Okafor' },
      ],
      connection_type: 'invitation_chain',
    };
    render(<TrustPathBadge trustPath={trustPath} compact />);

    expect(screen.getByText('Joined through Priya Shah')).toBeInTheDocument();
  });

  it('exchange 2° feed-compact still names the real intermediary via {person}', () => {
    const trustPath: TrustPath = {
      degrees_of_separation: 2,
      path: [
        { id: '1', name: 'You' },
        { id: '2', name: 'Priya Shah' },
        { id: '3', name: 'Ben Okafor' },
      ],
      connection_type: 'exchange',
    };
    render(<TrustPathBadge trustPath={trustPath} compact presentation="feed" />);

    expect(screen.getByText(/via Priya Shah/)).toBeInTheDocument();
  });

  it('exchange 3° full variant still names both real intermediaries', () => {
    const trustPath: TrustPath = {
      degrees_of_separation: 3,
      path: [
        { id: '1', name: 'You' },
        { id: '2', name: 'Priya Shah' },
        { id: '3', name: 'Ben Okafor' },
        { id: '4', name: 'Liam Chen' },
      ],
      connection_type: 'exchange',
    };
    render(<TrustPathBadge trustPath={trustPath} compact />);

    expect(screen.getByText('Connected through Priya Shah → Ben Okafor')).toBeInTheDocument();
  });
});
