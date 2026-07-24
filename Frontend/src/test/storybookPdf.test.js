import { describe, it, expect, vi } from 'vitest';

// downloadPdf is a pure slug-builder, but importing the module pulls in heavy
// capture deps (html2canvas, jsPDF) and the layout components. Stub them so the
// import stays light and the test stays focused on the filename slug.
vi.mock('html2canvas', () => ({ default: vi.fn() }));
vi.mock('jspdf', () => ({ jsPDF: vi.fn() }));
vi.mock('@/components/storybook/LayoutRenderer', () => ({ default: () => null }));
vi.mock('@/components/storybook/MomentHeroCanvas', () => ({ default: () => null }));

import { downloadPdf } from '../lib/storybookPdf.js';

function fakeDoc() {
  return { save: vi.fn() };
}

describe('downloadPdf', () => {
  it('builds a kebab-case slug from the baby name', () => {
    const doc = fakeDoc();
    downloadPdf(doc, 'Lily');
    expect(doc.save).toHaveBeenCalledWith('lily-storybook.pdf');
  });

  it('lowercases and collapses runs of whitespace to single hyphens', () => {
    const doc = fakeDoc();
    downloadPdf(doc, 'Baby   Lily Rose');
    expect(doc.save).toHaveBeenCalledWith('baby-lily-rose-storybook.pdf');
  });

  it('defaults to "storybook" when no name is given', () => {
    const doc = fakeDoc();
    downloadPdf(doc, '');
    expect(doc.save).toHaveBeenCalledWith('storybook-storybook.pdf');

    const doc2 = fakeDoc();
    downloadPdf(doc2, undefined);
    expect(doc2.save).toHaveBeenCalledWith('storybook-storybook.pdf');
  });
});
