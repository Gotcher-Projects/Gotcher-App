import { describe, it, expect } from 'vitest';
import { TEMPLATES } from '../lib/storybookTemplates.js';

const KNOWN_TYPES = new Set(['text', 'photo', 'l-wrap']);

// Data-driven page renderers (sv2-s2 birth_day, sv2-s3 people, sv2-s5 family_tree) ignore block
// geometry entirely — they live-read external data (birth_details / family_members) and lay out
// their own fixed design. The box/known-type invariants below only apply to the box-layout
// templates, so these are exempt. (chapter_divider / prompts / bump from sv2-s6 DO carry real
// 0–1 boxes — they're editable role-block pages — so they are not exempt.)
const DATA_DRIVEN_RENDERERS = new Set(['birth_day', 'people', 'family_tree']);
const isDataDriven = t => DATA_DRIVEN_RENDERERS.has(t.renderer);

describe('TEMPLATES invariants', () => {
  it('has unique, non-empty string ids', () => {
    const ids = TEMPLATES.map(t => t.id);
    expect(ids.every(id => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has non-negative integer memory/photo counts with minPhotos <= maxPhotos', () => {
    for (const t of TEMPLATES) {
      for (const field of ['memoryCount', 'minPhotos', 'maxPhotos']) {
        expect(Number.isInteger(t[field]), `${t.id}.${field}`).toBe(true);
        expect(t[field], `${t.id}.${field}`).toBeGreaterThanOrEqual(0);
      }
      expect(t.minPhotos, `${t.id} minPhotos<=maxPhotos`).toBeLessThanOrEqual(t.maxPhotos);
    }
  });

  it('has at least one block of a known type per template', () => {
    for (const t of TEMPLATES.filter(t => !isDataDriven(t))) {
      expect(Array.isArray(t.blocks) && t.blocks.length > 0, t.id).toBe(true);
      for (const b of t.blocks) {
        expect(KNOWN_TYPES.has(b.type), `${t.id}: bad block type ${b.type}`).toBe(true);
      }
    }
  });

  it('declares a renderer for data-driven page templates', () => {
    const dataDriven = TEMPLATES.filter(isDataDriven);
    expect(dataDriven.length).toBeGreaterThan(0);
    for (const t of dataDriven) {
      expect(typeof t.renderer, `${t.id} renderer`).toBe('string');
      expect(Array.isArray(t.blocks), `${t.id} blocks array`).toBe(true);
    }
  });

  it('keeps every block box within the normalized 0–1 canvas', () => {
    for (const t of TEMPLATES.filter(t => !isDataDriven(t))) {
      for (const b of t.blocks) {
        for (const field of ['x', 'y', 'width', 'height']) {
          expect(typeof b[field], `${t.id}.${field}`).toBe('number');
        }
        expect(b.x, `${t.id} x`).toBeGreaterThanOrEqual(0);
        expect(b.y, `${t.id} y`).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width, `${t.id} right edge`).toBeLessThanOrEqual(1.0001);
        expect(b.y + b.height, `${t.id} bottom edge`).toBeLessThanOrEqual(1.0001);
      }
    }
  });

  it('models l-wrap as a single l-wrap block', () => {
    const lwrap = TEMPLATES.find(t => t.id === 'l-wrap');
    expect(lwrap.blocks).toHaveLength(1);
    expect(lwrap.blocks[0].type).toBe('l-wrap');
  });

  it('registers the sv2-s5/s6 page types', () => {
    const byId = Object.fromEntries(TEMPLATES.map(t => [t.id, t]));
    expect(byId.family_tree?.renderer).toBe('family_tree');
    expect(byId.chapter_divider?.renderer).toBe('chapter_divider');
    expect(byId.prompts?.renderer).toBe('prompts');
    expect(byId.bump?.renderer).toBe('bump');
    // generic-block fill templates (no custom renderer)
    expect(byId['growth-spread']).toBeTruthy();
    expect(byId['growth-spread'].renderer).toBeUndefined();
    expect(byId['hands-feet']).toBeTruthy();
    expect(byId['hands-feet'].renderer).toBeUndefined();
  });

  it('gives prompts sequential val0.. value blocks', () => {
    const prompts = TEMPLATES.find(t => t.id === 'prompts');
    const valIds = prompts.blocks.filter(b => /^val\d+$/.test(b.id)).map(b => b.id);
    expect(valIds.length).toBeGreaterThan(0);
    // ids must be val0..val(n-1) contiguous (PromptsCanvas pulls each label's answer by index)
    expect(valIds).toEqual(valIds.map((_, i) => `val${i}`));
  });

  it('gives bump the role ids its renderer reads', () => {
    const bump = TEMPLATES.find(t => t.id === 'bump');
    const ids = bump.blocks.map(b => b.id);
    expect(ids).toEqual(expect.arrayContaining(['title', 'photo1', 'week1', 'photo2', 'week2', 'note']));
  });

  it('gives moment_hero templates a photo block with an aspect ratio', () => {
    const heroes = TEMPLATES.filter(t => t.renderer === 'moment_hero');
    expect(heroes.length).toBeGreaterThan(0);
    for (const t of heroes) {
      const photo = t.blocks.find(b => b.type === 'photo');
      expect(photo, `${t.id} has photo block`).toBeTruthy();
      expect(typeof photo.slotAR, `${t.id} slotAR`).toBe('number');
    }
  });

  it('never references a photoIndex beyond maxPhotos or a memoryIndex beyond memoryCount', () => {
    for (const t of TEMPLATES) {
      for (const b of t.blocks) {
        const cs = b.contentSource;
        if (!cs) continue;
        if (typeof cs.photoIndex === 'number') {
          expect(cs.photoIndex, `${t.id} photoIndex<maxPhotos`).toBeLessThan(t.maxPhotos);
        }
        if (typeof cs.memoryIndex === 'number') {
          expect(cs.memoryIndex, `${t.id} memoryIndex<memoryCount`).toBeLessThan(t.memoryCount);
        }
      }
    }
  });
});
