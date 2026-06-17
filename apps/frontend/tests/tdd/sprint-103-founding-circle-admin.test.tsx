import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FoundingCircleAdminPage from '@/pages/admin/founding-circle';
import { foundingCircleAdminService } from '@/lib/api';

jest.mock('@/components/admin/AdminLayout', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/utils/admin-auth', () => ({
  requireAdmin: jest.fn(() => true),
  isAdmin: jest.fn(() => true),
}));

jest.mock('next/router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/lib/api', () => ({
  foundingCircleAdminService: {
    listSubmissions: jest.fn(),
    updateSubmissionStatus: jest.fn(),
  },
}));

const listResponse = {
  items: [
    {
      id: 's1',
      email: 'founder@example.com',
      lens: 'community organizer',
      contribution: 'I can host reviews.',
      concern: 'Trust at scale.',
      source_page: 'join',
      status: 'new',
      created_at: '2026-06-17T00:00:00.000Z',
      reviewed_at: null,
    },
  ],
  count: 1,
  limit: 50,
  offset: 0,
};

describe('Sprint 103 founding-circle admin page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (foundingCircleAdminService.listSubmissions as jest.Mock).mockResolvedValue({ data: listResponse });
    (foundingCircleAdminService.updateSubmissionStatus as jest.Mock).mockResolvedValue({
      data: { ...listResponse.items[0], status: 'reviewed', reviewed_at: '2026-06-17T01:00:00.000Z' },
    });
  });

  it('lists founding-circle submissions', async () => {
    render(<FoundingCircleAdminPage />);
    expect(await screen.findByText('founder@example.com')).toBeInTheDocument();
    expect(screen.getByText('community organizer')).toBeInTheDocument();
    expect(screen.getByText('I can host reviews.')).toBeInTheDocument();
  });

  it('filters by status', async () => {
    render(<FoundingCircleAdminPage />);
    await screen.findByText('founder@example.com');
    fireEvent.click(screen.getByRole('button', { name: /^reviewed$/i }));
    await waitFor(() =>
      expect(foundingCircleAdminService.listSubmissions).toHaveBeenLastCalledWith({
        status: 'reviewed',
        limit: 50,
        offset: 0,
      })
    );
  });

  it('marks a submission reviewed', async () => {
    render(<FoundingCircleAdminPage />);
    fireEvent.click(await screen.findByRole('button', { name: /mark reviewed/i }));
    await waitFor(() =>
      expect(foundingCircleAdminService.updateSubmissionStatus).toHaveBeenCalledWith('s1', 'reviewed')
    );
    await waitFor(() => expect(screen.getByText(/Status:/)).toHaveTextContent(/reviewed/i));
  });
});
