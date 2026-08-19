/**
 * Sprint 125 / ADR-095 — the admin provider switch, made honest.
 *
 * `provider_services_list` has been held in ProfileTab state since Sprint 116 with NO editor: a
 * steward could not set it, and nothing read it. Now that the reach gate enforces all three
 * columns, an uneditable allowlist would be a silent, invisible filter.
 *
 * The load-bearing assertion here is the round trip — that an edited allowlist actually reaches
 * updateConfig. A toggle that updates local state and never persists looks identical in the UI.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

jest.mock('@/lib/api', () => ({
  communityService: { updateConfig: jest.fn().mockResolvedValue({ data: {} }) },
}));

import ProfileTab from '@/components/community/tabs/ProfileTab';
import { communityService } from '@/lib/api';

const mockUpdate = communityService.updateConfig as jest.Mock;
const mockRefetchConfig = jest.fn().mockResolvedValue(undefined);

const baseConfig = {
  provider_services_enabled: true,
  provider_min_personal_trust_score: 0,
  provider_services_list: [] as string[],
};

function renderProviders(config: Record<string, unknown> = baseConfig) {
  return render(
    <ProfileTab
      section="providers"
      communityId="c-1"
      isAdmin
      config={config as never}
      community={{ id: 'c-1', name: 'Riverside' } as never}
      settings={null}
      stats={null}
      communityCollectives={[]}
      currentUser={{ id: 'u-1' }}
      refetchCommunityCollectives={jest.fn()}
      refetchConfig={mockRefetchConfig}
    />
  );
}

beforeEach(() => {
  mockUpdate.mockClear();
  mockRefetchConfig.mockClear();
  window.alert = jest.fn();
});

describe('provider_services_list has an editor', () => {
  it('renders a control for every backend-valid service type', () => {
    renderProviders();

    for (const label of ['Rides', 'Home Repair', 'Tutoring', 'Other']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('presents an empty list as "every service type is allowed", not as none', () => {
    // The column defaults to '{}'. Reading empty as deny-all would switch off every community
    // that enabled provider services without curating a list.
    renderProviders();

    expect(screen.getByText(/every service type is allowed/i)).toBeInTheDocument();
  });

  it('marks a selected type as pressed and an unselected one as not', () => {
    renderProviders({ ...baseConfig, provider_services_list: ['ride'] });

    expect(screen.getByRole('button', { name: 'Rides' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Home Repair' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('the allowlist round-trips through the config API', () => {
  it('persists a newly selected type', async () => {
    renderProviders();

    fireEvent.click(screen.getByRole('button', { name: 'Rides' }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    const [, payload] = mockUpdate.mock.calls[0];
    expect(payload.provider_services_list).toEqual(['ride']);
  });

  it('persists a deselection back to the empty "all types" state', async () => {
    renderProviders({ ...baseConfig, provider_services_list: ['ride'] });

    fireEvent.click(screen.getByRole('button', { name: 'Rides' }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockUpdate.mock.calls[0][1].provider_services_list).toEqual([]);
  });

  it('clears the whole restriction in one action', async () => {
    renderProviders({ ...baseConfig, provider_services_list: ['ride', 'tutor'] });

    fireEvent.click(screen.getByText(/Clear restriction/i));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockUpdate.mock.calls[0][1].provider_services_list).toEqual([]);
  });
});

describe('the switch explains what it now actually does', () => {
  it('states that enabling adds a member-visible section', () => {
    renderProviders();

    expect(screen.getByText(/Adds a Providers section/i)).toBeInTheDocument();
  });

  it('distinguishes personal standing from provider rating', () => {
    // The two-trust-scores confusion, surfaced where the steward makes the decision.
    renderProviders();

    expect(screen.getByText(/personal standing in this community/i)).toBeInTheDocument();
  });

  it('warns that a floor above 0 hides members with no standing yet', () => {
    renderProviders();

    expect(screen.getByText(/counts as 0/i)).toBeInTheDocument();
  });

  it('hides the allowlist and floor entirely when provider services are off', () => {
    renderProviders({ ...baseConfig, provider_services_enabled: false });

    expect(screen.queryByRole('button', { name: 'Rides' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Minimum personal trust score/i)).not.toBeInTheDocument();
  });
});

describe('BUG: the form reflects SAVED config, not defaults', () => {
  /*
   * providerConfig initialised to {enabled: false, floor: 0, list: []} and was never synced from
   * the `config` prop. The form therefore always rendered "off", and Save wrote those defaults
   * back — so merely opening this tab and saving switched off a community's provider layer.
   * Harmless while nothing read the columns; destructive now that the reach gate enforces them.
   */
  it('shows an enabled community as enabled', () => {
    renderProviders({
      provider_services_enabled: true,
      provider_min_personal_trust_score: 40,
      provider_services_list: ['ride'],
    });

    // The floor control only renders when enabled, so its presence proves the sync ran.
    expect(screen.getByText(/Minimum personal trust score to appear \(40\)/)).toBeInTheDocument();
  });

  it('restores a saved allowlist rather than an empty one', () => {
    renderProviders({
      provider_services_enabled: true,
      provider_min_personal_trust_score: 0,
      provider_services_list: ['ride', 'tutor'],
    });

    expect(screen.getByRole('button', { name: 'Rides' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Tutoring' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Home Repair' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('saves the SAVED values back unchanged when nothing was edited', async () => {
    // The destructive path: open the tab, press Save, and the layer must survive intact.
    renderProviders({
      provider_services_enabled: true,
      provider_min_personal_trust_score: 40,
      provider_services_list: ['ride'],
    });

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockUpdate.mock.calls[0][1]).toEqual({
      provider_services_enabled: true,
      provider_min_personal_trust_score: 40,
      provider_services_list: ['ride'],
    });
  });

  it('treats a floor of 0 as a real value, not a missing one', () => {
    renderProviders({
      provider_services_enabled: true,
      provider_min_personal_trust_score: 0,
      provider_services_list: [],
    });

    expect(screen.getByText(/Minimum personal trust score to appear \(0\)/)).toBeInTheDocument();
  });
});

describe('saving re-reads the config it just wrote', () => {
  /*
   * `useCommunityData` fetches the config once on mount, and the member-facing Providers section on
   * Home is gated on `config.provider_services_enabled`. Without a refetch after save, an admin who
   * enables provider services sees no change until a full page reload — which reads as "the switch
   * still does nothing", the exact impression this sprint exists to remove.
   */
  it('refetches the config after a successful save', async () => {
    renderProviders();

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    await waitFor(() => expect(mockRefetchConfig).toHaveBeenCalledTimes(1));
  });

  it('does NOT refetch when the save failed', async () => {
    // Refetching after a failed write would overwrite the steward's unsaved edits with stale
    // server state, silently discarding what they were trying to save.
    mockUpdate.mockRejectedValueOnce(new Error('nope'));
    renderProviders();

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockRefetchConfig).not.toHaveBeenCalled();
  });
});
