# Deferred — Remove Temporary Claude Request/Response Logging

**Status: Not Started (deferred)**
**Branch:** journal-updates (or current)
**Depends on:** S5.46 (which adds the logging this session removes)

---

## Overview

S5.46 added **temporary** logging in `ClaudeClient` that prints the full system prompt, user
prompt, and Claude's response (prefixed `[CLAUDE-DEBUG]`) to help debug the new batched
page-generation prompt. Those payloads contain **real journal/first-time content — personal
family data** — so the logging must not remain in the product long-term.

This session removes it once the batched generation is stable and trusted.

---

## When to do this
After S5.46 is verified and the batched "One Page Per Memory" output quality is confirmed
good in real use — i.e. once we no longer need to eyeball what's sent to / returned from Claude.

---

## Changes
- **`Backend/.../storybook/ClaudeClient.java`** — remove the `[CLAUDE-DEBUG]` `log.info(...)`
  calls (both the outbound system+user prompt log and the inbound response log). Remove the
  `Logger`/`LoggerFactory` import if nothing else uses it.
- Grep the repo for `[CLAUDE-DEBUG]` to catch any other spots logging added during S5.46.

```
grep -rn "CLAUDE-DEBUG" Backend/src
```

---

## Verification
- `grep -rn "CLAUDE-DEBUG" Backend/src` returns nothing.
- Generate a chapter — app/Docker logs no longer print prompt or response bodies.
- Generation still works (logging removal is non-functional).

---

## Session Prompt (Deferred)

```
Deferred storybook session — Remove temporary Claude logging.
Plan: plans/storybook/sDeferred-remove-claude-logging.md
Branch: journal-updates
Depends on: S5.46 verified and batched generation trusted.

Remove the [CLAUDE-DEBUG] logging added in S5.46 from ClaudeClient.java (and anywhere else
grep finds it). Confirm no prompt/response bodies are logged anymore. Read ClaudeClient.java
first.
```
