# s1 — Shared `RestTemplate` timeouts (F13)

**Status:** Needs Verification (implemented 2026-07-22) · **Tier:** 1 (sooner) · **When:** pre-deploy · **Size:** ~2 lines · **Independent:** yes
**Finding:** `plans/storybook-v2-review/findings.md` → **F13**

The shared bean at `Backend/.../config/AppConfig.java:11` is a bare `new RestTemplate()`, so its connect and
read timeouts are **infinite** (Spring's `SimpleClientHttpRequestFactory` default). Its one caller is
`storybook/ClaudeClient.java` (the "✨ write this for me" assist). A silently-stalled Anthropic call pins the
Tomcat worker forever; enough concurrent stalls exhaust the worker pool and take the whole API down — including
`/billing/webhook` and `/print/lulu-webhook`, and Lulu deactivates a webhook after 5 failed deliveries.

The print clients already do this right (`LuluClient.java:63–64` = 10s/30s; `PrintSidecarClient.java:31–32`);
this bean was just missed.

## The change
Give the bean a `SimpleClientHttpRequestFactory` (or `ClientHttpRequestFactorySettings` in Boot 3.4) with:
- connect timeout **10s**
- read timeout **60s** (Anthropic calls are seconds; 60s is generous headroom)

Mirror the shape `LuluClient` uses. Only the shared bean changes — the print clients keep their own factories.

## Done when
- [x] `AppConfig.restTemplate()` sets connect + read timeouts. (connect 10s / read 60s, mirroring `LuluClient`)
- [x] `./gradlew test` green (no behavioural change expected).

## Not this session
Retry/circuit-breaker policy · touching the print clients (they already have timeouts) · anything in F14/F15.
