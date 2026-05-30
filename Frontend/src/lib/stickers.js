// Decorative sticker blocks for the storybook layout editor.
// Each sticker is a monochrome SVG silhouette in /public/stickers/, tinted at
// render time via a CSS mask so it can take the theme accent or a custom color.

export const STICKERS = [
  { key: 'heart',        label: 'Heart' },
  { key: 'heart-double', label: 'Double Heart' },
  { key: 'star',         label: 'Star' },
  { key: 'sparkle',      label: 'Sparkle' },
  { key: 'footprint',    label: 'Footprint' },
  { key: 'onesie',       label: 'Onesie' },
  { key: 'bottle',       label: 'Bottle' },
  { key: 'pacifier',     label: 'Pacifier' },
  { key: 'flower',       label: 'Flower' },
  { key: 'butterfly',    label: 'Butterfly' },
  { key: 'leaf',         label: 'Leaf' },
  { key: 'sun',          label: 'Sun' },
  { key: 'moon',         label: 'Moon' },
  { key: 'balloon',      label: 'Balloon' },
  { key: 'ribbon',       label: 'Ribbon' },
  { key: 'crown',        label: 'Crown' },
];

export const DEFAULT_STICKER_COLOR = '#9b7e5a';

// Inline style that paints a sticker SVG in `color` using a CSS mask.
export function stickerMaskStyle(stickerKey, color) {
  const url = `url(/stickers/${stickerKey}.svg)`;
  return {
    width: '100%',
    height: '100%',
    backgroundColor: color || DEFAULT_STICKER_COLOR,
    WebkitMaskImage: url,
    maskImage: url,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
  };
}

// Palette of tint choices for the sticker color cycler, derived from the active
// book theme (accent + a couple of palette shades) plus a light/dark neutral.
export function stickerColors(theme) {
  return [
    theme?.accent || DEFAULT_STICKER_COLOR,
    theme?.palette?.[4],
    theme?.palette?.[2],
    '#ffffff',
    '#2b2b2b',
  ].filter(Boolean);
}
