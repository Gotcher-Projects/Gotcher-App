export const BOOK_THEMES = [
  {
    key: 'classic',
    label: 'Classic',
    bg: '#fdf9f2',
    accent: '#9b7e5a',
    fontClass: 'font-serif',
    dividerChar: '◆',
    palette: ['#fdf9f2', '#f5ede0', '#e8d8be', '#d4b896', '#c49a72'],
  },
  {
    key: 'coral',
    label: 'Coral',
    bg: '#fff3f1',
    accent: '#e06c5f',
    fontClass: 'font-serif',
    dividerChar: '♡',
    palette: ['#fff3f1', '#fde6e2', '#f8cfc9', '#f0b0a5', '#e88878'],
  },
  {
    key: 'midnight',
    label: 'Midnight',
    bg: '#1e2040',
    accent: '#a0a8c8',
    fontClass: 'font-sans',
    dividerChar: '·',
    textColor: '#e8eaf6',
    isDark: true,
    palette: ['#1e2040', '#252550', '#2e2e60', '#383870', '#424278'],
  },
  {
    key: 'meadow',
    label: 'Meadow',
    bg: '#edf4ed',
    accent: '#4a7a4a',
    fontClass: 'font-sans',
    dividerChar: '✿',
    palette: ['#edf4ed', '#d8ebd8', '#bddcbd', '#9cca9c', '#7ab87a'],
  },
];

export function getTheme(key) {
  return BOOK_THEMES.find(t => t.key === (key || 'classic')) ?? BOOK_THEMES[0];
}
