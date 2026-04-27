# S1 — Theme Architecture + Base Theme CSS Tokens
**Status:** Complete
**Area:** `Frontend/src/index.css`, `Frontend/src/themes/`, `Frontend/src/contexts/ThemeContext.jsx`, `Frontend/public/`, `Frontend/tailwind.config.js`

## Goal
Build the multi-theme foundation and define all base theme tokens from the CradleHQ design plan. No visible UI changes yet — this session is purely architecture and token definitions. S2 applies them across the app.

## Design Reference (from DesignPlan.png)

### Color Palette — Base Theme
| Token name | Role | Approx hex |
|---|---|---|
| `--brand-purple` | Primary brand / logo color | `#6366F1` (periwinkle) |
| `--brand-navy` | Dark text / dark surfaces | `#1E1B4B` |
| `--brand-pink` | Accent — soft rose | `#F9A8D4` |
| `--brand-peach` | Accent — warm cream | `#FDE68A` |
| `--brand-lavender` | Accent — light background | `#EEF2FF` |
| `--brand-mint` | Accent — light green | `#D1FAE5` |

Remap shadcn tokens to brand values:
| shadcn token | Maps to |
|---|---|
| `--primary` | `--brand-purple` |
| `--primary-foreground` | white |
| `--foreground` | `--brand-navy` |
| `--ring` | `--brand-purple` |
| `--accent` | `--brand-lavender` |
| `--accent-foreground` | `--brand-navy` |

### Typography
- **Primary (headings, brand text):** Poppins — weights 400, 600, 700
- **Secondary (body, UI):** Inter — weights 400, 500

### Logo Variations (from design guide)
- Horizontal: icon + "CradleHQ" wordmark side by side
- Stacked: icon above wordmark
- Icon only: `cradleLogo.png` / `cradleVector.png`
- Dark backgrounds: use white version of icon + wordmark
- Min clear space: equal to the height of the "C" in CradleHQ on all sides

## Steps

### 1. Copy logo assets to Frontend/public/
- Copy `cradleLogo.png` → `Frontend/public/images/cradleLogo.png`
- Copy `cradleVector.png` → `Frontend/public/images/cradleVector.png`

### 2. Create theme file structure
```
Frontend/src/themes/
  index.js          ← exports THEMES list and default
  base.css          ← base theme token definitions
```

`base.css` structure:
```css
[data-theme="base"] {
  /* Brand tokens */
  --brand-purple: 239 84% 67%;      /* #6366F1 */
  --brand-navy: 244 44% 20%;        /* #1E1B4B */
  --brand-pink: 327 87% 82%;        /* #F9A8D4 */
  --brand-peach: 48 96% 89%;        /* #FDE68A */
  --brand-lavender: 238 100% 95%;   /* #EEF2FF */
  --brand-mint: 152 76% 91%;        /* #D1FAE5 */

  /* Remap shadcn tokens */
  --background: 0 0% 100%;
  --foreground: 244 44% 20%;
  --card: 0 0% 100%;
  --card-foreground: 244 44% 20%;
  --popover: 0 0% 100%;
  --popover-foreground: 244 44% 20%;
  --primary: 239 84% 67%;
  --primary-foreground: 0 0% 100%;
  --secondary: 238 100% 95%;
  --secondary-foreground: 244 44% 20%;
  --muted: 238 100% 97%;
  --muted-foreground: 244 20% 50%;
  --accent: 238 100% 95%;
  --accent-foreground: 244 44% 20%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 100%;
  --border: 238 50% 90%;
  --input: 238 50% 90%;
  --ring: 239 84% 67%;
  --radius: 0.75rem;
}
```

`index.js`:
```js
export const THEMES = [
  { id: 'base', label: 'Base' },
];
export const DEFAULT_THEME = 'base';
```

### 3. Create ThemeContext
`Frontend/src/contexts/ThemeContext.jsx`:
- Reads `localStorage.getItem('cradlehq-theme')` on init, falls back to `'base'`
- Sets `document.documentElement.setAttribute('data-theme', theme)` whenever theme changes
- Exports `ThemeProvider` (wraps the app) and `useTheme()` hook returning `{ theme, setTheme }`

### 4. Wire ThemeProvider into App.jsx
Wrap the root render in `<ThemeProvider>`. On mount, the provider sets the `data-theme` attribute so the correct CSS block activates immediately.

### 5. Update index.css
- Import `./themes/base.css` after the Tailwind directives
- Remove the old `:root { }` block (tokens now live in `[data-theme="base"]`)
- Keep the `.dark { }` block for now — it will be replaced by a proper dark theme in a future session
- Set a default `data-theme="base"` on `<html>` in `index.html` so the page has a theme even before React hydrates

### 6. Update tailwind.config.js
Extend the Tailwind theme so brand tokens are available as utilities (`bg-brand-purple`, `text-brand-navy`, etc.):
```js
theme: {
  extend: {
    colors: {
      'brand-purple': 'hsl(var(--brand-purple) / <alpha-value>)',
      'brand-navy':   'hsl(var(--brand-navy)   / <alpha-value>)',
      'brand-pink':   'hsl(var(--brand-pink)   / <alpha-value>)',
      'brand-peach':  'hsl(var(--brand-peach)  / <alpha-value>)',
      'brand-lavender':'hsl(var(--brand-lavender) / <alpha-value>)',
      'brand-mint':   'hsl(var(--brand-mint)   / <alpha-value>)',
    },
    fontFamily: {
      sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      display: ['Poppins', 'ui-sans-serif'],
    },
  },
}
```

### 7. Load fonts in index.html
Add Google Fonts preconnect + stylesheet link for Poppins (400, 600, 700) and Inter (400, 500) in `<head>`.

## Verification
- `data-theme="base"` appears on `<html>` at page load (before JS)
- All shadcn components render with the new purple primary instead of the old slate/blue
- `bg-brand-purple` works as a Tailwind utility in a quick test element
- `useTheme()` returns `{ theme: 'base', setTheme }` in React DevTools
- `localStorage` key `cradlehq-theme` is written on first render
