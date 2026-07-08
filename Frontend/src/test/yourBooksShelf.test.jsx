import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import YourBooksShelf from '../components/storybook/YourBooksShelf.jsx';

const noop = vi.fn();
const base = {
  activeBookId: 1,
  onSelect: noop, onRename: noop, onDuplicate: noop, onDelete: noop, onNewBook: noop, onClose: noop,
};

describe('YourBooksShelf — guided progress', () => {
  it('shows X / Y pages for a guided book with progress', () => {
    render(
      <YourBooksShelf
        {...base}
        books={[{ id: 1, type: 'guided', title: 'Lily', theme: 'classic' }]}
        progress={{ 1: { done: 9, total: 25, autoFilled: 5 } }}
      />
    );
    expect(screen.getByText('9 / 25 pages')).toBeInTheDocument();
  });

  it('shows no progress line for a freeform book', () => {
    render(
      <YourBooksShelf
        {...base}
        books={[{ id: 2, type: 'freeform', title: 'Scrapbook', theme: 'coral' }]}
        progress={{ 2: { done: 3, total: 8, autoFilled: 0 } }}
      />
    );
    expect(screen.queryByText(/pages$/)).not.toBeInTheDocument();
  });

  it('omits the bar when progress for the book has not loaded yet', () => {
    render(
      <YourBooksShelf
        {...base}
        books={[{ id: 1, type: 'guided', title: 'Lily', theme: 'classic' }]}
        progress={{}}
      />
    );
    expect(screen.queryByText(/\/ \d+ pages/)).not.toBeInTheDocument();
  });
});
