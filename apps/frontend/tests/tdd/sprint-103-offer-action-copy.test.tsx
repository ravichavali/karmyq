import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RequestCard from '@/components/Feed/RequestCard';
import RequestDetailPage from '@/pages/requests/[id]';
import { requestService } from '@/lib/api';
import { getOfferActionLabel, getOfferErrorFallback } from '@/lib/requestActionCopy';

jest.mock('@/lib/api', () => ({
  requestService: {
    getRequest: jest.fn(),
    createMatch: jest.fn(),
  },
}));

jest.mock('@/hooks/useTrustPath', () => ({
  useTrustPath: () => ({ trustPath: null, loading: false, error: null }),
}));

jest.mock('next/router', () => ({
  useRouter: () => ({ isReady: true, query: { id: 'request-1' }, push: jest.fn(), replace: jest.fn() }),
}));

const card = (requestType: string) => ({
  request_id: 'request-1',
  requester_id: 'requester-1',
  title: 'Fix a sink',
  description: 'Kitchen sink',
  status: 'open',
  urgency: 'medium',
  request_type: requestType,
  payload_type: requestType,
  payload: {},
  requirements: {},
  author_name: 'Maya',
  community_id: 'community-1',
});

const detail = (requestType: string) => ({
  id: 'request-1',
  title: 'Fix a sink',
  status: 'open',
  request_type: requestType,
  viewer_relation: 'can_offer',
});

describe('Sprint 103 offer action copy', () => {
  beforeEach(() => jest.clearAllMocks());

  it('centralizes idle and pending labels', () => {
    expect(getOfferActionLabel('service')).toBe('Offer service');
    expect(getOfferActionLabel('service', 'pending')).toBe('Offering service...');
    expect(getOfferActionLabel('generic')).toBe('Offer to Help');
    expect(getOfferActionLabel('ride', 'pending')).toBe('Offering...');
    expect(getOfferErrorFallback('service')).toBe('Failed to offer service');
    expect(getOfferErrorFallback('borrow')).toBe('Failed to offer help');
  });

  it('uses service language on request cards', () => {
    render(<RequestCard data={card('service') as any} currentUserId="helper-1" />);
    expect(screen.getByRole('button', { name: /offer service/i })).toBeInTheDocument();
  });

  it('keeps mutual-aid language on request cards', () => {
    render(<RequestCard data={card('generic') as any} currentUserId="helper-1" />);
    expect(screen.getByRole('button', { name: /offer to help/i })).toBeInTheDocument();
  });

  it('uses the same service label on request detail', async () => {
    (requestService.getRequest as jest.Mock).mockResolvedValue({ data: detail('service') });
    (requestService.createMatch as jest.Mock).mockResolvedValue({});

    render(<RequestDetailPage />);

    fireEvent.click(await screen.findByRole('button', { name: /offer service/i }));
    await waitFor(() => expect(requestService.createMatch).toHaveBeenCalledWith({ request_id: 'request-1' }));
  });
});
