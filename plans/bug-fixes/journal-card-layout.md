# Journal Card Layout Issues
**Status:** In Progress
**Area:** Frontend — MemoriesTab / JournalTab

## Issues

### 1. Landscape journal cards look bad
Horizontal/landscape card layout needs a design pass. Vertical (portrait) cards look great — landscape cards need comparable polish.

### 2. New Entry sidebar becomes a blank block with many entries
The left column (New Entry form + Memory Book) is in a CSS grid alongside the journal entry list. When there are many entries, the right column grows tall and the left card sits as a large blank white rectangle below its content.

**Fix:** Make the left card `sticky` so it follows the user down the page:
```jsx
<Card className="... lg:sticky lg:top-6 lg:self-start">
```
This keeps the form visible while scrolling through entries and eliminates the blank space.
