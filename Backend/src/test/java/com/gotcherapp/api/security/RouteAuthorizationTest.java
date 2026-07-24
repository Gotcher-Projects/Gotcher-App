package com.gotcherapp.api.security;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.http.HttpMethod;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

/**
 * The backend's first web-layer test — it exercises the real Spring Security filter chain
 * ({@code SecurityConfig} + {@code JwtAuthFilter}), which the 400+ pure-Mockito unit tests never touch.
 *
 * <p>The trap this guards: the permitAll list in {@code SecurityConfig} uses namespace wildcards
 * ({@code /print/**}, {@code /book/public/**}, {@code /admin/**}). A new controller mapping that lands
 * inside one of those namespaces becomes publicly reachable <em>silently</em> — nothing fails, no review
 * gate fires. This codebase hit exactly that during pr9 and s14c, caught both times only by a human
 * noticing. Those namespaces now guard a public book payload, a PDF store, and two money webhooks.
 *
 * <p>How it works: {@link #EXPECTED_PUBLIC} is the single source of truth for routes intended to be
 * reachable without a JWT. Every other mapping is fired with no token and must return 401. A route added
 * under a permitAll namespace is NOT in {@code EXPECTED_PUBLIC}, so it gets fired, SecurityConfig lets it
 * through, it returns something other than 401 — and this test fails, forcing a conscious decision. To
 * intentionally expose a new route you must add it here, which is the review checkpoint.
 *
 * <p>The context boots without a database: all 32 services inject plain {@code JdbcTemplate}, so a single
 * mock bean (plus excluding the DataSource/Flyway auto-config) is enough. Protected routes short-circuit
 * to 401 in the security filter before any controller or DB code runs, so the mock is never queried.
 */
@SpringBootTest(properties = {
        "spring.autoconfigure.exclude="
                + "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,"
                + "org.springframework.boot.autoconfigure.jdbc.DataSourceTransactionManagerAutoConfiguration,"
                + "org.springframework.boot.autoconfigure.jdbc.JdbcTemplateAutoConfiguration,"
                + "org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration"
})
@AutoConfigureMockMvc
class RouteAuthorizationTest {

    /**
     * Routes deliberately reachable without a JWT, as "METHOD /pattern" (path variables kept in {@code {}}
     * form). MUST stay in sync with the permitAll list in {@code SecurityConfig}. Adding a public route
     * here is the intentional, reviewable act of exposing it.
     */
    private static final Set<String> EXPECTED_PUBLIC = Set.of(
            // /auth/* anonymous flows (the seven exact paths permitAll lists; /auth/me,
            // /auth/resend-verification are NOT here and are asserted to require auth below)
            "POST /auth/register",
            "POST /auth/login",
            "POST /auth/refresh",
            "POST /auth/logout",
            "GET /auth/verify-email",
            "POST /auth/forgot-password",
            "POST /auth/reset-password",
            // /admin/** — guarded internally by the admin secret, not the JWT
            "DELETE /admin/account",
            // /book/public/** — public share-link payload (share token authorizes)
            "GET /book/public/{token}",
            // /print/** — render token authorizes the first two; HMAC authorizes the webhook
            "GET /print/payload/{token}",
            "GET /print/pdf/{token}",
            "POST /print/lulu-webhook",
            // Stripe webhook — HMAC signature authorizes
            "POST /billing/webhook"
    );

    /** All 32 services inject plain JdbcTemplate; one mock lets the context boot with no database. */
    @TestConfiguration
    static class MockDatabaseConfig {
        @Bean
        JdbcTemplate jdbcTemplate() {
            return Mockito.mock(JdbcTemplate.class);
        }
    }

    @Autowired
    MockMvc mockMvc;

    // Actuator registers its own RequestMappingHandlerMapping; disambiguate to the MVC controller one.
    @Autowired
    @Qualifier("requestMappingHandlerMapping")
    RequestMappingHandlerMapping handlerMapping;

    @Test
    void everyRouteIsEitherPublicByDesignOrRequiresAuth() throws Exception {
        List<String> reachableWithoutAuth = new ArrayList<>();

        for (RequestMappingInfo info : handlerMapping.getHandlerMethods().keySet()) {
            for (String key : routeKeys(info)) {
                if (EXPECTED_PUBLIC.contains(key)) {
                    continue; // intentionally public — verified by expectedPublicRoutesAllExist()
                }
                String method = key.substring(0, key.indexOf(' '));
                String pattern = key.substring(key.indexOf(' ') + 1);
                String path = pattern.replaceAll("\\{[^}]*}", "1"); // {id} -> 1

                int status = mockMvc.perform(request(HttpMethod.valueOf(method), path))
                        .andReturn().getResponse().getStatus();

                if (status != 401) {
                    reachableWithoutAuth.add(key + " -> " + status);
                }
            }
        }

        assertTrue(reachableWithoutAuth.isEmpty(),
                "These routes are reachable without a JWT but are not in EXPECTED_PUBLIC. If the exposure is "
                        + "intentional, add them to EXPECTED_PUBLIC; otherwise they must not sit under a permitAll "
                        + "namespace in SecurityConfig:\n  " + String.join("\n  ", reachableWithoutAuth));
    }

    /** Keeps EXPECTED_PUBLIC honest: a renamed/removed public route surfaces as a stale entry here. */
    @Test
    void expectedPublicRoutesAllExist() {
        Set<String> actual = new TreeSet<>();
        for (RequestMappingInfo info : handlerMapping.getHandlerMethods().keySet()) {
            actual.addAll(routeKeys(info));
        }

        List<String> stale = new ArrayList<>();
        for (String expected : EXPECTED_PUBLIC) {
            if (!actual.contains(expected)) {
                stale.add(expected);
            }
        }

        assertTrue(stale.isEmpty(),
                "EXPECTED_PUBLIC lists routes that no longer exist (rename/remove drift): " + stale);
    }

    /** One "METHOD /pattern" key per (path pattern × HTTP method); GET when a mapping restricts no method. */
    private static Set<String> routeKeys(RequestMappingInfo info) {
        var pathPatterns = info.getPathPatternsCondition();
        var antPatterns = info.getPatternsCondition();
        Set<String> patterns = pathPatterns != null
                ? pathPatterns.getPatternValues()
                : antPatterns != null ? antPatterns.getPatterns() : Set.of();

        Set<RequestMethod> methods = info.getMethodsCondition().getMethods();

        Set<String> keys = new TreeSet<>();
        for (String pattern : patterns) {
            if (pattern.equals("/error") || pattern.startsWith("/error/")) {
                continue; // Spring's framework error mapping, not an application route
            }
            if (methods.isEmpty()) {
                keys.add("GET " + pattern);
            } else {
                for (RequestMethod m : methods) {
                    keys.add(m.name() + " " + pattern);
                }
            }
        }
        return keys;
    }
}
