import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Hoisted mock for the api layer so StorybookTab's book/chapter loads are deterministic.
const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('@/lib/api', () => ({ apiRequest, apiUpload: vi.fn() }));

// Stub the book sub-components: this test exercises the 0/1/2+ landing logic in StorybookTab,
// not the children's own rendering (which pull in Radix/dnd/pdf machinery).
vi.mock('@/components/storybook/NewBookChooser', () => ({
  default: ({ onCreate }) => (
    <div data-testid="chooser">
      <button onClick={() => onCreate('guided')}>create-guided</button>
    </div>
  ),
}));
vi.mock('@/components/storybook/BookSwitcher', () => ({
  default: ({ title, onOpen }) => <button onClick={onOpen}>switcher:{title}</button>,
}));
vi.mock('@/components/storybook/YourBooksShelf', () => ({
  default: ({ books }) => <div data-testid="shelf">{books.map(b => <span key={b.id}>{b.title}</span>)}</div>,
}));
vi.mock('@/components/storybook/BookCover', () => ({ default: () => <div data-testid="cover" /> }));

import StorybookTab from '../components/tabs/StorybookTab.jsx';

function mockApi(books) {
  apiRequest.mockImplementation((url, opts) => {
    if (url === '/books' && (!opts || !opts.method)) return Promise.resolve(books);
    if (url === '/books' && opts?.method === 'POST') {
      return Promise.resolve({ id: 99, type: JSON.parse(opts.body).type, title: null, theme: 'classic', coverPhotoUrl: null, coverSubtitle: null });
    }
    if (url.startsWith('/storybook')) return Promise.resolve([]);
    if (url === '/milestones') return Promise.resolve({ achieved: [] });
    return Promise.resolve(url === '/family-members' ? [] : null);
  });
}

const props = { week: 10, journalEntries: [], firsts: [], birthdate: '2025-06-01', babyName: 'Lily', onUpload: vi.fn(), onError: vi.fn() };

beforeEach(() => { apiRequest.mockReset(); localStorage.clear(); });

describe('StorybookTab landing logic (sv2-s7a)', () => {
  it('0 books → opens the new-book chooser', async () => {
    mockApi([]);
    render(<StorybookTab {...props} />);
    expect(await screen.findByTestId('chooser')).toBeInTheDocument();
  });

  it('1 book → lands inside it (switcher shown, no chooser)', async () => {
    mockApi([{ id: 1, title: "Lily's First Year", type: 'freeform', theme: 'classic', coverPhotoUrl: null, coverSubtitle: null }]);
    render(<StorybookTab {...props} />);
    expect(await screen.findByText("switcher:Lily's First Year")).toBeInTheDocument();
    expect(screen.queryByTestId('chooser')).toBeNull();
  });

  it('2+ books → switcher opens the shelf with all books', async () => {
    mockApi([
      { id: 1, title: 'Book One', type: 'freeform', theme: 'classic', coverPhotoUrl: null, coverSubtitle: null },
      { id: 2, title: 'Book Two', type: 'guided', theme: 'coral', coverPhotoUrl: null, coverSubtitle: null },
    ]);
    render(<StorybookTab {...props} />);
    fireEvent.click(await screen.findByText('switcher:Book One'));
    const shelf = await screen.findByTestId('shelf');
    expect(shelf).toHaveTextContent('Book One');
    expect(shelf).toHaveTextContent('Book Two');
  });

  it('chooser create → POSTs a new book', async () => {
    mockApi([]);
    render(<StorybookTab {...props} />);
    fireEvent.click(await screen.findByText('create-guided'));
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith('/books', expect.objectContaining({ method: 'POST' }))
    );
  });
});
