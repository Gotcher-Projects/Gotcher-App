import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import LayoutRenderer from '../components/storybook/LayoutRenderer.jsx';
import MomentHeroCanvas from '../components/storybook/MomentHeroCanvas.jsx';

// Smoke tests for the published render path (the same path the PDF capture uses).
// They assert the page paints text + images without crashing — not pixel layout,
// which is jsdom-untestable. The ResizeObserver stub in setup.js feeds the canvas
// width LayoutRenderer waits for before painting.

const theme = { bg: '#ffffff', textColor: '#000000', fontClass: 'font-serif' };

function textBlock(over = {}) {
  return {
    id: 't1', type: 'text', x: 0.05, y: 0.04, width: 0.9, height: 0.36,
    content: 'Smiled for the first time', suppressDropCap: true, sourceKey: 'journal:1', ...over,
  };
}
function photoBlock(over = {}) {
  return {
    id: 'p1', type: 'photo', x: 0.05, y: 0.44, width: 0.9, height: 0.52,
    url: 'https://img/smile.jpg', sourceKey: 'journal:1', ...over,
  };
}

// ── LayoutRenderer ──────────────────────────────────────────────────────────────

describe('LayoutRenderer', () => {
  it('renders a v2 classic page (text + photo)', () => {
    const layout = { version: 2, pages: [{ id: 'pg1', templateId: 'classic', blocks: [textBlock(), photoBlock()] }] };
    const { container } = render(<LayoutRenderer layout={layout} theme={theme} />);
    expect(container.textContent).toContain('Smiled for the first time');
    expect(container.querySelector('img[src="https://img/smile.jpg"]')).toBeTruthy();
  });

  it('shows a page indicator for multi-page v2 layouts', () => {
    const layout = { version: 2, pages: [
      { id: 'pg1', templateId: 'classic', blocks: [textBlock()] },
      { id: 'pg2', templateId: 'classic', blocks: [textBlock({ id: 't2', content: 'Second page' })] },
    ] };
    const { container } = render(<LayoutRenderer layout={layout} theme={theme} />);
    expect(container.textContent).toContain('1 / 2');
  });

  it('routes a moment-hero page through MomentHeroCanvas', () => {
    const layout = { version: 2, pages: [{ id: 'pg1', templateId: 'moment-hero-portrait', blocks: [
      { id: 'title', type: 'text', content: 'First Bath' },
      { id: 'photo', type: 'photo', url: 'https://img/bath.jpg' },
    ] }] };
    const { container } = render(<LayoutRenderer layout={layout} theme={theme} />);
    expect(container.textContent).toContain('First Bath');
    expect(container.querySelector('img[src="https://img/bath.jpg"]')).toBeTruthy();
  });

  it('renders a v1 single-page layout', () => {
    const layout = { blocks: [textBlock(), photoBlock()] };
    const { container } = render(<LayoutRenderer layout={layout} theme={theme} />);
    expect(container.textContent).toContain('Smiled for the first time');
    expect(container.querySelector('img[src="https://img/smile.jpg"]')).toBeTruthy();
  });
});

// ── MomentHeroCanvas (read-only) ─────────────────────────────────────────────────

describe('MomentHeroCanvas (read-only)', () => {
  const heroBlocks = [
    { id: 'badge', type: 'text', content: 'FIRST TIME' },
    { id: 'title', type: 'text', content: 'First Steps' },
    { id: 'date', type: 'text', content: 'March 2026' },
    { id: 'photo', type: 'photo', url: 'https://img/steps.jpg' },
    { id: 'note', type: 'text', content: 'Two wobbly steps today.' },
    { id: 'attrib', type: 'text', content: '— Mom' },
  ];

  it('renders text and photo without a DndContext', () => {
    const { container } = render(<MomentHeroCanvas blocks={heroBlocks} orientation="portrait" />);
    expect(container.textContent).toContain('First Steps');
    expect(container.textContent).toContain('Two wobbly steps today.');
    expect(container.querySelector('img[src="https://img/steps.jpg"]')).toBeTruthy();
  });

  it('renders the landscape orientation', () => {
    const { container } = render(<MomentHeroCanvas blocks={heroBlocks} orientation="landscape" />);
    expect(container.querySelector('img[src="https://img/steps.jpg"]')).toBeTruthy();
  });
});
