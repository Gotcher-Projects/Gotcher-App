import { describe, it, expect } from 'vitest';
import { TEMPLATES } from '../lib/storybookTemplates.js';

const KNOWN_TYPES = new Set(['text', 'photo', 'l-wrap']);

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
    for (const t of TEMPLATES) {
      expect(Array.isArray(t.blocks) && t.blocks.length > 0, t.id).toBe(true);
      for (const b of t.blocks) {
        expect(KNOWN_TYPES.has(b.type), `${t.id}: bad block type ${b.type}`).toBe(true);
      }
    }
  });

  it('keeps every block box within the normalized 0–1 canvas', () => {
    for (const t of TEMPLATES) {
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
