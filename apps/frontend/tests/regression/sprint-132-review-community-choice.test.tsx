import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AskToBorrow from '@/components/inventory/AskToBorrow';
import { inventoryService } from '@/lib/api';
const push = jest.fn();
jest.mock('next/router', () => ({ useRouter: () => ({ push }) }));
jest.mock('@/lib/api', () => ({ inventoryService: { askToBorrow: jest.fn() } }));
const item: any = { id: 'item', owner_user_id: 'O', status: 'available', shared_with: [{ id: 'C', name: 'Old share' }], owner: { name: 'Olivia' } };
beforeEach(() => { jest.clearAllMocks(); localStorage.setItem('user', JSON.stringify({ id: 'R' })); });
it('updates the default when refreshed item metadata removes the previous share', async () => {
  (inventoryService.askToBorrow as jest.Mock).mockResolvedValue({ data: { id: 'ask' } });
  const { rerender } = render(<AskToBorrow item={item} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Ask to borrow' }));
  rerender(<AskToBorrow item={{ ...item, shared_with: [{ id: 'D', name: 'Live share' }] }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Send private ask' }));
  await waitFor(() => expect(inventoryService.askToBorrow).toHaveBeenCalledWith('item', { community_id: 'D', duration_days: 1 }));
});
it('explains how to recover if live sharing access changes while composing', async () => {
  (inventoryService.askToBorrow as jest.Mock).mockRejectedValue({ response: { status: 404 } });
  render(<AskToBorrow item={{ ...item, shared_with: [...item.shared_with, { id: 'D', name: 'Live share' }] }} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Ask to borrow' }));
  fireEvent.click(screen.getByRole('button', { name: 'Send private ask' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('choose another community');
  expect(push).not.toHaveBeenCalled();
});
