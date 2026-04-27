# Tech Debt

## Growth Chart Color Picker (Option B)
**Status:** Not started
**Context:** Growth charts currently use `chartColors` defined per-theme in `themes/index.js` (Option A). This is the current implementation.

**Future enhancement:** Add a per-user color picker in a settings panel that lets users override each chart line color independently. Colors would be stored in localStorage alongside the theme preference. Would need:
- A settings/preferences UI (doesn't exist yet)
- A color picker component (e.g. a native `<input type="color">` or a small palette grid)
- Merge logic: theme chartColors as defaults, user overrides on top
- ThemeContext update to expose merged colors
