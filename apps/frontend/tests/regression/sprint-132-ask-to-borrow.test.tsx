import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';
jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock('@/lib/api', () => ({
  inventoryService: { listForCommunity: jest.fn(), getVisible: jest.fn(), askToBorrow: jest.fn(), incomingAsks: jest.fn() },
  requestService: { getRequest: jest.fn(), createMatch: jest.fn(), getMatches: jest.fn(), getRequests: jest.fn(), getCuratedRequests: jest.fn(), getOfferedAwaiting: jest.fn() },
}));
jest.mock('@/lib/api/providerApi', () => ({ getOffersForRequest: jest.fn(), acceptOffer: jest.fn(), declineOffer: jest.fn() }));
import { inventoryService, requestService } from '@/lib/api';
import InventoryTab from '@/components/community/tabs/InventoryTab';
import RequestDetailPage from '@/pages/requests/[id]';
import CommitmentsTab from '@/components/CommitmentsTab';
import InventoryItemPage from '@/pages/inventory/[id]';
const inv = inventoryService as any;
const req = requestService as any;
const item = { id: 'item', owner_user_id: 'O', owner_community_id: null, name: 'Ladder', category: 'tools', condition: 'good', status: 'available', shared_with: [{ id: 'C', name: 'Neighbours' }], owner: { id: 'O', name: 'Olivia' } };
beforeEach(() => {
  jest.clearAllMocks(); localStorage.setItem('user', JSON.stringify({ id: 'R' }));
  (useRouter as jest.Mock).mockReturnValue({ push: jest.fn(), query: {}, isReady: true });
  inv.listForCommunity.mockResolvedValue({ data: { community_owned: [], shared_by_members: [item] } });
  inv.askToBorrow.mockResolvedValue({ data: { id: 'ask' } });
  inv.incomingAsks.mockResolvedValue({ data: { asks: [] } });
  req.getMatches.mockResolvedValue({ data: { matches: [] } }); req.getRequests.mockResolvedValue({ data: { requests: [] } });
  req.getCuratedRequests.mockResolvedValue({ data: { items: [] } }); req.getOfferedAwaiting.mockResolvedValue({ data: { items: [], count: 0 } });
  req.createMatch.mockResolvedValue({ data: { id: 'match' } });
  req.getRequest.mockResolvedValue({ data: { id: 'ask', title: 'Ask to borrow Ladder', status: 'open', viewer_relation: 'own_request', is_directed: true, directed_to: { kind: 'user', id: 'O', name: 'Olivia' } } });
});
it.each([['own', 'R', 'available'], ['unavailable', 'O', 'unavailable']])('hides borrowing on %s item', async (_kind, owner, status) => {
  inv.listForCommunity.mockResolvedValue({ data: { community_owned: [], shared_by_members: [{ ...item, owner_user_id: owner, status }] } });
  render(<InventoryTab communityId="C" isAdmin={false} />); await screen.findByText('Ladder');
  expect(screen.queryByRole('button', { name: 'Ask to borrow' })).not.toBeInTheDocument();
});
it('submits the compact form with exact attribution/duration/note, then opens the private request', async () => {
  render(<InventoryTab communityId="C" isAdmin={false} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Ask to borrow' }));
  fireEvent.change(screen.getByLabelText('Duration (days)'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: 'Painting' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send private ask' }));
  await waitFor(() => expect(inv.askToBorrow).toHaveBeenCalledWith('item', { community_id: 'C', duration_days: 3, description: 'Painting' }));
  await waitFor(() => expect(useRouter().push).toHaveBeenCalledWith('/requests/ask'));
});
it('keeps a failed submission editable and explains the error', async () => {
  inv.askToBorrow.mockRejectedValue(new Error('offline')); render(<InventoryTab communityId="C" isAdmin={false} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Ask to borrow' })); fireEvent.click(screen.getByRole('button', { name: 'Send private ask' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/could not send/i); expect(useRouter().push).not.toHaveBeenCalled();
});
it('shows a private recipient banner on directed request detail', async () => {
  (useRouter() as any).query = { id: 'ask' }; (useRouter() as any).isReady = true;
  render(<RequestDetailPage />); expect(await screen.findByText('Private request to Olivia')).toBeInTheDocument();
});
it('names community admins as the private recipient on request detail', async () => {
  (useRouter() as any).query = { id: 'ask' };
  req.getRequest.mockResolvedValue({ data: { id: 'ask', title: 'Ask to borrow Tent', status: 'open', viewer_relation: 'own_request', is_directed: true, directed_to: { kind: 'community_admins', id: 'C', name: 'Neighbours' } } });
  render(<RequestDetailPage />); expect(await screen.findByText('Private request to Neighbours admins')).toBeInTheDocument();
});
it('shows unanswered requests in Asked of you and refetches commitments after Offer', async () => {
  localStorage.setItem('user', JSON.stringify({ id: 'O' }));
  inv.incomingAsks.mockResolvedValueOnce({ data: { asks: [{ id: 'ask', title: 'Ask to borrow Ladder', requester_name: 'Riley', payload: { duration_days: 3 } }] } }).mockResolvedValue({ data: { asks: [] } });
  req.getMatches.mockResolvedValueOnce({ data: { matches: [] } }).mockResolvedValue({ data: { matches: [{ id: 'match', request_id: 'ask', responder_id: 'O', requester_id: 'R', request_title: 'Ask to borrow Ladder', is_directed: true, status: 'proposed', created_at: new Date().toISOString() }] } });
  render(<CommitmentsTab />); expect(await screen.findByText('Asked of you')).toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button', { name: 'Offer' }));
  await waitFor(() => expect(req.createMatch).toHaveBeenCalledWith({ request_id: 'ask' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Offer' })).not.toBeInTheDocument());
  await waitFor(() => expect(req.getMatches).toHaveBeenCalledTimes(2));
  expect(await screen.findByText('Ask to borrow Ladder')).toBeInTheDocument();
});
it('renders the incoming empty state', async () => {
  render(<CommitmentsTab />); expect(await screen.findByText('No private asks waiting for you.')).toBeInTheDocument();
});
it('shows a graceful inbox fetch failure alongside the existing commitments', async () => {
  inv.incomingAsks.mockRejectedValue(new Error('offline')); render(<CommitmentsTab />);
  expect(await screen.findByText('Could not load private asks. Please try again.')).toBeInTheDocument();
});
it('borrows from item view with the selected shared community and return date', async () => {
  (useRouter() as any).query = { id: 'item' };
  inv.getVisible.mockResolvedValue({ data: { ...item, shared_with: [...item.shared_with, { id: 'D', name: 'Friends' }] } });
  render(<InventoryItemPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Ask to borrow' }));
  fireEvent.change(screen.getByLabelText('Community'), { target: { value: 'D' } });
  fireEvent.change(screen.getByLabelText('Return date (optional)'), { target: { value: '2026-10-08' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send private ask' }));
  await waitFor(() => expect(inv.askToBorrow).toHaveBeenCalledWith('item', { community_id: 'D', duration_days: 1, return_date: '2026-10-08T00:00:00.000Z' }));
});
it('shows item-view absence without a borrow form when the read fails', async () => {
  (useRouter() as any).query = { id: 'item' }; inv.getVisible.mockRejectedValue(new Error('404'));
  render(<InventoryItemPage />); expect(await screen.findByRole('alert')).toHaveTextContent('unavailable');
  expect(screen.queryByRole('button', { name: 'Ask to borrow' })).not.toBeInTheDocument();
});
