# Theming — Plan Overview

## Goal
Replace the generic shadcn default palette with the official CradleHQ brand identity and build a multi-theme-ready architecture so future themes can be added without touching component code.

## Design Assets
- `DesignPlan.png` (root) — brand guide: colors, typography, logo usage, do/don'ts
- `cradleLogo.png` (root) — icon-only PNG (baby in leaves, brand purple)
- `cradleVector.png` (root) — same icon, vector-quality PNG

## Theme System Architecture
- Themes are applied via a `data-theme` attribute on `<html>` (e.g. `data-theme="base"`)
- Each theme is a self-contained CSS block of custom property overrides
- A `useTheme` hook + `ThemeProvider` context manages the active theme and persists it to localStorage
- shadcn component tokens (`--primary`, `--background`, etc.) are remapped per theme so all existing components pick up the new look automatically
- Brand-specific tokens (`--brand-purple`, `--brand-navy`, etc.) sit alongside shadcn tokens for direct use in one-off components

## Sessions
| Session | Scope | Status |
|---------|-------|--------|
| S1 | Architecture + base theme CSS tokens + logo assets | Not started |
| S2 | Apply across app — fonts, logo in UI, color replacement | Not started |
