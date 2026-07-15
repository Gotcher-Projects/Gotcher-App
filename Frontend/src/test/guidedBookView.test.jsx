import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GuidedBookView from '../components/storybook/GuidedBookView.jsx';
import { FIRST_YEAR_ARC, expandArcToChapterSeeds } from '../lib/guidedBookArc.js';

// Guided chapters as they arrive from the API: the seed shape (anchorKey + layoutData) plus an id.
function guidedChapters() {
  return expandArcToChapterSeeds(FIRST_YEAR_ARC).map((s, i) => ({ ...s, id: i + 1 }));
}

function renderView(overrides = {}) {
  const props = {
    title: "Lily's Memory Book",
    chapters: guidedChapters(),
    firsts: [{ id: 1, label: 'First smile', occurredDate: '2026-04-01', imageUrl: null, notes: '' }],
    onOpenBuilder: vi.fn(),
    onPick: vi.fn(),
    ...overrides,
  };
  render(<GuidedBookView {...props} />);
  return props;
}

describe('GuidedBookView', () => {
  it('shows progress (dividers excluded) and section headers', () => {
    renderView();
    expect(screen.getByText(/pages ready/).textContent).toContain('of 25 pages ready');
    expect(screen.getByText('The Beginning')).toBeInTheDocument();
    expect(screen.getByText('Your Firsts')).toBeInTheDocument();
  });

  it('renders an Add action for empty fill pages and routes it to the builder', () => {
    const { onOpenBuilder } = renderView();
    const addButtons = screen.getAllByRole('button', { name: 'Add' });
    expect(addButtons.length).toBeGreaterThan(0);
    fireEvent.click(addButtons[0]); // first fill page = "A Letter to You"
    expect(onOpenBuilder).toHaveBeenCalledTimes(1);
    expect(onOpenBuilder.mock.calls[0][0].anchorKey).toBe('letter-to-you');
  });

  it('renders a Choose action for the 4 pick pages and routes it to the picker', () => {
    const { onPick } = renderView();
    const chooseButtons = screen.getAllByRole('button', { name: 'Choose' });
    expect(chooseButtons).toHaveLength(4);
    fireEvent.click(chooseButtons[0]);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0][0].anchorKey).toBe('first-1');
  });

  it('pick pages fall back to a by-hand hint when there are no Firsts', () => {
    renderView({ firsts: [] });
    expect(screen.queryAllByRole('button', { name: 'Choose' })).toHaveLength(0);
    expect(screen.getAllByText('Add by hand').length).toBe(4);
  });

  it('marks auto/prefill pages as filled (no action button)', () => {
    renderView();
    // "The Day We Met You" is auto → shown as Filled, not an Add button.
    expect(screen.getByText('The Day We Met You')).toBeInTheDocument();
    expect(screen.getAllByText('Filled').length).toBeGreaterThan(0);
  });

  it('Continue jumps to the first unfilled fill/pick page', () => {
    const { onOpenBuilder } = renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onOpenBuilder.mock.calls[0][0].anchorKey).toBe('letter-to-you');
  });
});
