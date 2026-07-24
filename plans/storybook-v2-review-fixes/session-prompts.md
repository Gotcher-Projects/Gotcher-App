# Session prompts — storybook-v2 review fixes

One paste-able prompt per session. **Each assumes a cold session** — the prompt plus the named plan file plus
its finding row in `plans/storybook-v2-review/findings.md` is enough to start. All items are 📋 (nothing blocks
DEPLOY-0). Read `README.md` for the tier split.

---

## Tier 1 — sooner

### s1 — RestTemplate timeouts (F13, pre-deploy, ~2 lines)
```
Do s1 (F13). Plan: plans/storybook-v2-review-fixes/s1-resttemplate-timeouts.md; finding detail in
plans/storybook-v2-review/findings.md F13. Give AppConfig's shared RestTemplate a connect (10s) + read (60s)
timeout, mirroring LuluClient. Don't touch the print clients — they already have their own. ./gradlew test green.
```

### s2 — Payments/print primer (F11, do now)
```
Do s2 (F11). Plan: plans/storybook-v2-review-fixes/s2-payments-print-primer.md; finding detail in findings.md
F11. Write plans/storybook-v2/print/print-context.md (shape: plans/storybook/storybook-context.md) covering the
print runtime path, kill switch, token types, where money is decided, the two status feeds, the ops scripts;
then add the pdf-sidecar + both tracks to CLAUDE.md. If s7 hasn't run, fix CLAUDE.md's start-services.sh path here too.
```

### s3 — permitAll authorization test (F7, first thing after deploy)
```
Do s3 (F7). Plan: plans/storybook-v2-review-fixes/s3-permitall-auth-test.md; finding detail in findings.md F7.
Write the repo's first MockMvc test: enumerate every mapping from RequestMappingHandlerMapping and assert each
either matches the permitAll list or returns 401 without a JWT. Prove it fails if a dummy unauthenticated route
is added under /print/**. Budget time for standing up the web test context.
```

---

## Tier 2 — eventually

### s4 — Dead code (F1, F4; F2/F3 need a decision)
```
Do s4. Plan: plans/storybook-v2-review-fixes/s4-dead-code.md; findings F1/F2/F3/F4. Unconditionally: delete
letterTypes.js (F1), delete LuluClient.getPrintJob + repoint its Javadoc (F4), fix the stale StorybookTab:362
PDF comment. Then ASK ME before touching F2 (storybookPdf.js — delete unless PDF export is coming back) and F3
(first_time_photos — finish s9.0a or remove the endpoints + drop the hot-path JOIN). ./gradlew test + npm test green.
```

### s5 — Security hygiene (F5, F15, F14) — AFTER deploy has settled
```
Do s5. Plan: plans/storybook-v2-review-fixes/s5-security-hygiene.md; findings F5/F15/F14. Extract one
BookOwnership helper (require + isOwned) with a single BookNotAccessibleException, repoint all four callers
(F5); fold the owner scope into the share-token read/delete SQL (F15); make the terminal 500 handlers return
generic text like ApiExceptionHandler instead of e.getMessage() (F14). Behaviour must not change; existing tests
pass untouched. This touches money paths — only after the deploy is stable.
```

### s6 — Test backfill (F8, F9)
```
Do s6. Plan: plans/storybook-v2-review-fixes/s6-test-backfill.md; findings F8/F9. Add JwtUtilTest (valid render
token → bookId; access token / expired / tampered → rejected) and PrintPdfStoreTest (expired row → empty); add
three Stripe refund-routing tests (charge.refunded, refund.created, refund.failed) to BillingWebhookServiceTest,
mirroring the existing print-routing test. ./gradlew test green.
```

### s7 — Small debt: formatter + docs (F6, F10, F12)
```
Do s7. Plan: plans/storybook-v2-review-fixes/s7-small-debt.md; findings F6/F10/F12. Add formatTimeOfDay(hhmm) +
formatTime(iso) to lib/formatting.js and collapse the 5 inline copies (F6); fix CLAUDE.md's start-services.sh
path + stop caveat (F10, skip if s2 did it); add a DEPLOY-0 banner to deployment-guide.html (F12). npm test green.
```
