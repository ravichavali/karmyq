import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
jest.mock('@/components/Layout', () => ({ children }: { children: React.ReactNode }) => (
  <div>{children}</div>
));
jest.mock('@/lib/api', () => ({
  inventoryService: {
    listMine: jest.fn(),
    listForCommunity: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    replaceShares: jest.fn(),
  },
  communityService: { getMyCommunities: jest.fn() },
}));
import InventoryPage from '@/pages/inventory';
import InventoryTab from '@/components/community/tabs/InventoryTab';
import { inventoryService, communityService } from '@/lib/api';
const inv = inventoryService as jest.Mocked<typeof inventoryService>;
const item = {
  id: 'item-1',
  name: 'Ladder',
  description: 'Tall',
  category: 'tools',
  condition: 'good',
  status: 'available',
  shared_with: [],
};
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('token', 'token');
  localStorage.setItem('user', JSON.stringify({ id: 'owner-1' }));
  localStorage.setItem('karmyq_onboarding', JSON.stringify({ inventory: true }));
  inv.listMine.mockResolvedValue({ data: { items: [] } } as any);
  inv.listForCommunity.mockResolvedValue({
    data: { community_owned: [], shared_by_members: [] },
  } as any);
  inv.create.mockResolvedValue({ data: item } as any);
  inv.update.mockResolvedValue({ data: item } as any);
  inv.replaceShares.mockResolvedValue({ data: { shared_with: [] } } as any);
  (communityService.getMyCommunities as jest.Mock).mockResolvedValue({
    data: { communities: [{ id: 'c1', name: 'Neighbours' }] },
  });
});
it('explains that new things are private in the empty state', async () => {
  render(<InventoryPage />);
  await screen.findByText(/private until you share/i);
});
it('shows and dismisses the inventory tour on first visit', async () => {
  localStorage.removeItem('karmyq_onboarding');
  render(<InventoryPage />);
  await screen.findByRole('dialog', { name: 'My things' });
  fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('karmyq_onboarding')!)).toEqual({ inventory: true });
});
it('renders fetched items', async () => {
  inv.listMine.mockResolvedValue({ data: { items: [item] } } as any);
  render(<InventoryPage />);
  await screen.findByText('Ladder');
});
it('offers retry after a fetch failure', async () => {
  inv.listMine.mockRejectedValueOnce(new Error('offline'));
  render(<InventoryPage />);
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText(/private until you share/i);
});
it('creates with the exact catalog payload', async () => {
  render(<InventoryPage />);
  await screen.findByText(/private until you share/i);
  fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ladder' } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Tall' } });
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'tools' } });
  fireEvent.change(screen.getByLabelText('Condition'), { target: { value: 'good' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save item' }));
  await waitFor(() =>
    expect(inv.create).toHaveBeenCalledWith({
      name: 'Ladder',
      description: 'Tall',
      category: 'tools',
      condition: 'good',
    })
  );
});
it('replaces the share checklist with the selected community ids', async () => {
  inv.listMine.mockResolvedValue({ data: { items: [item] } } as any);
  render(<InventoryPage />);
  await screen.findByText('Ladder');
  fireEvent.click(screen.getByRole('button', { name: 'Share Ladder' }));
  fireEvent.click(await screen.findByLabelText('Neighbours'));
  fireEvent.click(screen.getByRole('button', { name: 'Save sharing' }));
  await waitFor(() => expect(inv.replaceShares).toHaveBeenCalledWith('item-1', ['c1']));
});
it.each([true, false])('gates community creation for admin=%s', async (isAdmin) => {
  render(<InventoryTab communityId="c1" isAdmin={isAdmin} />);
  await screen.findByRole('heading', { name: 'Community-owned things' });
  expect(!!screen.queryByRole('button', { name: 'Add community item' })).toBe(isAdmin);
});
it('renders the two community sections with member attribution', async () => {
  inv.listForCommunity.mockResolvedValue({
    data: {
      community_owned: [item],
      shared_by_members: [
        { ...item, id: 'item-2', name: 'Tent', owner: { id: 'o1', name: 'Olivia' } },
      ],
    },
  } as any);
  render(<InventoryTab communityId="c1" isAdmin={false} />);
  await screen.findByText('Ladder');
  expect(screen.getByText('Tent')).toBeInTheDocument();
  expect(screen.getByText(/Olivia/)).toBeInTheDocument();
});
it('shows a graceful community fetch error', async () => {
  inv.listForCommunity.mockRejectedValueOnce(new Error('offline'));
  render(<InventoryTab communityId="c1" isAdmin={false} />);
  await screen.findByRole('alert');
});
it('edits an existing item with exact payload and keeps the form on a save failure', async () => {
  inv.listMine.mockResolvedValue({ data: { items: [item] } } as any);
  inv.update.mockRejectedValueOnce(new Error('offline'));
  render(<InventoryPage />);
  await screen.findByText('Ladder');
  fireEvent.click(screen.getByRole('button', { name: 'Edit Ladder' }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Step ladder' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save item' }));
  await screen.findByRole('alert');
  expect(inv.update).toHaveBeenCalledWith('item-1', {
    name: 'Step ladder',
    description: 'Tall',
    category: 'tools',
    condition: 'good',
  });
  expect(screen.getByLabelText('Name')).toHaveValue('Step ladder');
});
it('toggles availability using only the status patch', async () => {
  inv.listMine.mockResolvedValue({ data: { items: [item] } } as any);
  inv.update.mockResolvedValue({ data: { ...item, status: 'unavailable' } } as any);
  render(<InventoryPage />);
  await screen.findByText('Ladder');
  fireEvent.click(screen.getByRole('button', { name: 'Mark unavailable' }));
  await screen.findByText('Unavailable');
  expect(inv.update).toHaveBeenCalledWith('item-1', { status: 'unavailable' });
});
it('requires deletion confirmation before removing an item', async () => {
  inv.listMine.mockResolvedValue({ data: { items: [item] } } as any);
  inv.remove.mockResolvedValue({ data: { deleted: true } } as any);
  render(<InventoryPage />);
  await screen.findByText('Ladder');
  fireEvent.click(screen.getByRole('button', { name: 'Delete Ladder' }));
  expect(inv.remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
  await waitFor(() => expect(screen.queryByText('Ladder')).not.toBeInTheDocument());
  expect(inv.remove).toHaveBeenCalledWith('item-1');
});
it('fails closed on sharing when communities cannot load', async () => {
  inv.listMine.mockResolvedValue({ data: { items: [item] } } as any);
  (communityService.getMyCommunities as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  render(<InventoryPage />);
  await screen.findByText('Ladder');
  fireEvent.click(screen.getByRole('button', { name: 'Share Ladder' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Save sharing' })).toBeDisabled();
});
it('creates community property with the community owner in the payload', async () => {
  render(<InventoryTab communityId="c1" isAdmin />);
  fireEvent.click(await screen.findByRole('button', { name: 'Add community item' }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Tent' } });
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'camping' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save item' }));
  await waitFor(() =>
    expect(inv.create).toHaveBeenCalledWith({
      name: 'Tent',
      description: '',
      category: 'camping',
      condition: null,
      owner_community_id: 'c1',
    })
  );
});
it('clears the previous community when the next community cannot load', async () => {
  inv.listForCommunity
    .mockResolvedValueOnce({ data: { community_owned: [item], shared_by_members: [] } } as any)
    .mockRejectedValueOnce(new Error('forbidden'));
  const view = render(<InventoryTab communityId="c1" isAdmin />);
  await screen.findByText('Ladder');
  view.rerender(<InventoryTab communityId="c2" isAdmin />);
  await screen.findByRole('alert');
  expect(screen.queryByText('Ladder')).not.toBeInTheDocument();
});
it('ignores an obsolete community fetch after navigation', async () => {
  let resolveOld!: (value: any) => void;
  inv.listForCommunity.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      })
  );
  const view = render(<InventoryTab communityId="c1" isAdmin />);
  view.rerender(<InventoryTab communityId="c2" isAdmin={false} />);
  await screen.findByText('No community-owned things yet.');
  await act(async () => {
    resolveOld({ data: { community_owned: [item], shared_by_members: [] } });
  });
  expect(screen.queryByText('Ladder')).not.toBeInTheDocument();
});
it('does not enable sharing from an obsolete community lookup', async () => {
  let resolveOld!: (value: any) => void;
  inv.listMine.mockResolvedValue({
    data: { items: [item, { ...item, id: 'item-2', name: 'Tent' }] },
  } as any);
  (communityService.getMyCommunities as jest.Mock)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        })
    )
    .mockRejectedValueOnce(new Error('offline'));
  render(<InventoryPage />);
  await screen.findByText('Ladder');
  fireEvent.click(screen.getByRole('button', { name: 'Share Ladder' }));
  fireEvent.click(screen.getByRole('button', { name: 'Share Tent' }));
  await screen.findByRole('alert');
  await act(async () => {
    resolveOld({ data: { communities: [{ id: 'c1', name: 'Neighbours' }] } });
  });
  expect(screen.getByRole('button', { name: 'Save sharing' })).toBeDisabled();
});
