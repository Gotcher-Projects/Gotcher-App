# s3 — permitAll authorization test (F7)

**Status:** Needs Verification (implemented 2026-07-22) · **Tier:** 1 (sooner) · **When:** first thing after deploy · **Independent:** yes
**Finding:** `plans/storybook-v2-review/findings.md` → **F7**

There is **no HTTP/authorization-layer test anywhere** in the backend — all 423 tests are pure Mockito unit
tests that call controller/service methods directly, so the Spring Security filter chain is never exercised.
**Nothing would fail if a new route landed under `/print/**` unauthenticated** — the exact trap this codebase
hit twice (pr9, s14c), caught both times only by a human noticing. The permitAll list now guards a public book
payload, a PDF store, and two money webhooks; review discipline is the only thing enforcing it.

## The change
One `@SpringBootTest` + `MockMvc` test that asserts the **shape**, not a hand-list of routes:

- Enumerate every mapping from `RequestMappingHandlerMapping`.
- For each, assert it **either** matches the permitAll list (`/health`, the seven `/auth/*` anonymous flows,
  `/admin/**`, `/book/public/**`, `/print/**`, `/billing/webhook`) **or** returns **401 without a JWT**.

This fails automatically the moment someone adds a route to a permitted namespace — which is the point. A
hand-written list of six paths would just be a second copy to forget.

> **Infra note:** this is the repo's **first** `MockMvc`/web-layer test. Expect to stand up a minimal web test
> context (real `SecurityConfig` + `JwtAuthFilter`, services can be `@MockBean`). Budget the session for that
> bootstrap, not just the assertions.

## Done when
- [x] A test enumerates mappings and asserts permitAll-or-401 for each.
      (`Backend/src/test/java/com/gotcherapp/api/security/RouteAuthorizationTest.java`)
- [x] It genuinely **fails** if a dummy authenticated-less route is added under `/print/**` (verified by
      temporarily adding a `GET /print/verify-dummy` bean → test failed with `-> 200`, then removed it).
- [x] `./gradlew test` green.

## How it ended up working
- First `@SpringBootTest`/`MockMvc` test in the repo. Boots the real `SecurityConfig` + `JwtAuthFilter`
  **without a database**: all 32 services inject plain `JdbcTemplate`, so a single mock bean + excluding the
  DataSource/Flyway auto-config is enough (protected routes 401 in the filter before any controller/DB runs).
- Single source of truth `EXPECTED_PUBLIC` (13 routes). Every other mapping is fired unauthenticated and must
  return 401 — no duplicated permitAll list to drift. Second test keeps `EXPECTED_PUBLIC` honest against renames.
- Two beans of type `RequestMappingHandlerMapping` exist (MVC + actuator); disambiguated via
  `@Qualifier("requestMappingHandlerMapping")`.
- Noted but **out of scope**: `SecurityConfig` permits `/health`, but the actuator health endpoint actually
  lives at `/actuator/health` (no base-path override) — a latent mismatch, not part of F7.

## Not this session
Unit-testing individual controllers · F8's `JwtUtil`/`PrintPdfStore` tests (that's s6) · changing any route.
