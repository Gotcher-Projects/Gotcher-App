import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';

// The section fetches on mount, so the api module is stubbed per test.
vi.mock('@/lib/api', () => ({ apiRequest: vi.fn() }));

import { apiRequest } from '@/lib/api';
import PrintOrdersSection from '../components/storybook/PrintOrdersSection.jsx';

const order = (over = {}) => ({
  orderId: 6, status: 'submitted', quantity: 2, amountCents: 7000, currency: 'USD',
  bookTitle: 'Your First Year', createdAt: '2026-07-21T10:00:00Z',
  trackingUrl: null, carrierName: null, shippedAt: null, refunded: false,
  ...over,
});

describe('PrintOrdersSection — s14c', () => {
  // Reset to a benign default rather than to "no implementation": a bare mockReset() makes apiRequest return
  // undefined, and any stray call then blows up somewhere unrelated to the test that caused it.
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
    vi.mocked(apiRequest).mockResolvedValue([]);
  });

  it('renders nothing when the user has never ordered a printed book', async () => {
    vi.mocked(apiRequest).mockResolvedValue([]);
    const { container } = render(<PrintOrdersSection />);
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/print-orders'));
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the fetch fails, rather than an error box', async () => {
    vi.mocked(apiRequest).mockImplementation(() => Promise.reject(new Error('offline')));

    const { container } = render(<PrintOrdersSection />);
    // Flush the microtask chain inside act so the component's .catch actually runs before we assert.
    // Without this the assertion passes trivially (nothing has rendered yet) and the rejection surfaces
    // after the test as an unhandled error.
    await act(async () => { await Promise.resolve(); });

    expect(apiRequest).toHaveBeenCalledWith('/print-orders');
    expect(container).toBeEmptyDOMElement();
  });

  it('shows an in-flight order as "Being printed", never the internal status', async () => {
    vi.mocked(apiRequest).mockResolvedValue([order()]);
    render(<PrintOrdersSection />);
    expect(await screen.findByText('Being printed')).toBeInTheDocument();
    expect(screen.queryByText(/submitted/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Order #6/)).toBeInTheDocument();
    expect(screen.getByText(/2 copies/)).toBeInTheDocument();
    expect(screen.getByText(/\$70\.00/)).toBeInTheDocument();
  });

  it("calls a single copy a 'copy', not '1 copies'", async () => {
    vi.mocked(apiRequest).mockResolvedValue([order({ quantity: 1, amountCents: 3500 })]);
    render(<PrintOrdersSection />);
    expect(await screen.findByText(/1 copy/)).toBeInTheDocument();
  });

  it('offers a tracking link on a shipped order', async () => {
    vi.mocked(apiRequest).mockResolvedValue([order({
      status: 'shipped', trackingUrl: 'https://ups.com/1Z999', carrierName: 'UPS',
    })]);
    render(<PrintOrdersSection />);
    const link = await screen.findByRole('link', { name: /Track package \(UPS\)/ });
    expect(link).toHaveAttribute('href', 'https://ups.com/1Z999');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('reads a failed order like an apology, not a stack trace', async () => {
    vi.mocked(apiRequest).mockResolvedValue([order({ status: 'failed' })]);
    render(<PrintOrdersSection />);
    expect(await screen.findByText('There was a problem')).toBeInTheDocument();
    expect(screen.getByText(/refunded in full/)).toBeInTheDocument();
    // The backend never sends failureReason or luluStatus; nothing vendor-shaped should appear.
    expect(document.body.textContent).not.toMatch(/lulu|REJECTED|Upload Error/i);
  });

  it('shows a refunded order as Refunded rather than as a problem', async () => {
    vi.mocked(apiRequest).mockResolvedValue([order({ status: 'failed', refunded: true })]);
    render(<PrintOrdersSection />);
    expect(await screen.findByText('Refunded')).toBeInTheDocument();
    expect(screen.queryByText('There was a problem')).not.toBeInTheDocument();
  });

  it('falls back to a generic title when the book has none', async () => {
    vi.mocked(apiRequest).mockResolvedValue([order({ bookTitle: null })]);
    render(<PrintOrdersSection />);
    expect(await screen.findByText('Your memory book')).toBeInTheDocument();
  });
});
