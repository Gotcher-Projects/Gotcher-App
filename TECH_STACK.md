# GotcherApp Technology Stack

A developer onboarding guide covering every technology used in the Baby Steps application — what it is, why we chose it, and exactly where in the codebase it lives.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Backend Technologies](#backend-technologies)
   - [Java 21](#java-21)
   - [Spring Boot 3.4.1](#spring-boot-341)
   - [Spring Security 6](#spring-security-6)
   - [JdbcTemplate (Raw SQL)](#jdbctemplate-raw-sql)
   - [JJWT 0.12.6](#jjwt-0126)
   - [Flyway](#flyway)
   - [PostgreSQL 16](#postgresql-16)
   - [Spring Boot Actuator](#spring-boot-actuator)
   - [Spring Mail (SMTP)](#spring-mail-smtp)
   - [Cloudinary](#cloudinary)
   - [Gradle](#gradle)
   - [JUnit 5 + Mockito](#junit-5--mockito)
3. [Frontend Technologies](#frontend-technologies)
   - [React 18](#react-18)
   - [Vite 6](#vite-6)
   - [Tailwind CSS v3](#tailwind-css-v3)
   - [shadcn/ui + Radix UI](#shadcnui--radix-ui)
   - [lucide-react](#lucide-react)
   - [recharts](#recharts)
   - [jsPDF](#jspdf)
   - [localStorage](#localstorage)
4. [Infrastructure](#infrastructure)
   - [Docker Compose](#docker-compose)
   - [pgAdmin 4](#pgadmin-4)
5. [Development Scripts](#development-scripts)
6. [Environment Configuration](#environment-configuration)
7. [Architecture at a Glance](#architecture-at-a-glance)

---

## Project Overview

Baby Steps is a baby tracking web application. Parents can log milestones, keep a photo journal, track growth measurements, and monitor feeding sessions. The app uses a traditional client-server architecture:

- **Frontend**: Single-page React app served by Vite (port 3000)
- **Backend**: Spring Boot REST API (port 3001)
- **Database**: PostgreSQL running in Docker (port 5432)

All three tiers run locally via a single start script. The backend handles all business logic and data persistence; the frontend communicates with it exclusively through authenticated REST API calls.

---

## Backend Technologies

### Java 21

**What it is:** The programming language and runtime for the entire backend. Java 21 is an LTS (Long-Term Support) release.

**Why we use it:** Spring Boot has excellent Java support and the Java ecosystem provides battle-tested libraries for everything we need (JWT, database access, testing). Java 21 adds pattern matching, records, and virtual threads.

**Where in the code:**
- All `.java` files under `Backend/src/main/java/com/gotcherapp/`
- Java version is declared in `Backend/build.gradle.kts`:
  ```
  java { toolchain { languageVersion = JavaLanguageVersion.of(21) } }
  ```
- The app runs fine on Java 24 as well — the toolchain declaration targets 21 bytecode but does not prevent newer JDKs from running it.

---

### Spring Boot 3.4.1

**What it is:** An opinionated framework that wraps the Spring ecosystem into a runnable JAR with auto-configuration. It handles: HTTP request routing, dependency injection, configuration loading, and lifecycle management.

**Why we use it:** Spring Boot eliminates boilerplate. Instead of configuring a servlet container, wiring every bean manually, and managing connection pools by hand, we declare what we need and Spring wires it together. It is the industry standard for Java web services.

**Key concepts:**
- `@RestController` — marks a class as an HTTP handler; methods return JSON automatically
- `@Service` — marks a class as a business-logic component; Spring manages its lifecycle
- `@Repository` — same as `@Service` but signals database access intent
- `@Autowired` / constructor injection — Spring supplies dependencies automatically
- `@RequestBody` — deserializes incoming JSON into a Java object
- `@PathVariable` / `@RequestParam` — binds URL segments and query parameters

**Where in the code:**
- Entry point: `Backend/src/main/java/com/gotcherapp/api/GotcherAppApplication.java`
- Configuration: `Backend/src/main/resources/application.properties`
- Every `*Controller.java` file uses `@RestController` and `@RequestMapping`
- Every `*Service.java` file uses `@Service`

**Controllers (REST endpoints):**

| Controller | File | Endpoints |
|------------|------|-----------|
| AuthController | `auth/AuthController.java` | POST /auth/register, /auth/login, /auth/refresh, /auth/logout, GET /auth/me |
| BabyProfileController | `baby/BabyProfileController.java` | GET /baby-profile, PUT /baby-profile |
| MilestoneController | `baby/MilestoneController.java` | GET /milestones, POST /milestones/{key}, DELETE /milestones/{key} |
| JournalController | `journal/JournalController.java` | GET /journal, POST /journal, PATCH /journal/{id}, DELETE /journal/{id} |
| GrowthController | `growth/GrowthController.java` | GET /growth, POST /growth, DELETE /growth/{id} |
| FeedingController | `feeding/FeedingController.java` | GET /feeding, POST /feeding, PATCH /feeding/{id}, DELETE /feeding/{id} |

---

### Spring Security 6

**What it is:** The authentication and authorization layer for Spring applications. It intercepts every HTTP request and enforces access rules before it reaches a controller.

**Why we use it:** We need to protect every API endpoint so that users can only access their own data. Spring Security integrates directly with Spring Boot and provides a clean extension point (filters) for our JWT-based auth scheme.

**How our auth flow works:**
1. User logs in → backend issues a short-lived **access token** (JWT, 15 minutes) and a long-lived **refresh token** (7 days, stored in PostgreSQL)
2. Frontend stores both tokens in `localStorage`
3. Every subsequent request includes `Authorization: Bearer <accessToken>`
4. `JwtAuthFilter` intercepts the request, verifies the JWT signature, and populates the Spring `SecurityContext` with an `AuthPrincipal`
5. Controllers receive the `AuthPrincipal` directly via `@AuthenticationPrincipal`
6. When the access token expires, the frontend calls `POST /auth/refresh` to rotate both tokens

**Where in the code:**
- `Backend/src/main/java/com/gotcherapp/api/config/SecurityConfig.java` — disables sessions (stateless), configures CORS, declares which endpoints are public vs. protected, registers `JwtAuthFilter`
- `Backend/src/main/java/com/gotcherapp/api/security/JwtAuthFilter.java` — reads the `Authorization` header, validates the token, sets `SecurityContextHolder`
- `Backend/src/main/java/com/gotcherapp/api/security/JwtUtil.java` — generates and parses JWTs
- `Backend/src/main/java/com/gotcherapp/api/security/AuthPrincipal.java` — a simple record(`Long userId, String email`) that represents the authenticated user in the request context

**Example — controller receiving the authenticated user:**
```java
@GetMapping
public ResponseEntity<List<GrowthRecord>> getRecords(@AuthenticationPrincipal AuthPrincipal principal) {
    return ResponseEntity.ok(growthService.getRecords(principal.userId()));
}
```

---

### JdbcTemplate (Raw SQL)

**What it is:** A Spring utility class that wraps JDBC (Java's low-level database API) and eliminates boilerplate like opening/closing connections, managing `PreparedStatement`s, and handling `SQLException`s.

**Why we use it (instead of an ORM like Hibernate/JPA):** The app started as a Node.js project using `pg` (raw SQL pool). When migrating to Java, we preserved the same philosophy: write exact SQL, know what queries run, and avoid the "magic" and performance surprises of ORM mapping. For an app of this size, raw SQL is simpler to reason about and debug.

**Key methods:**
- `jdbc.query(sql, rowMapper, args...)` — runs a SELECT and maps each row to an object
- `jdbc.queryForMap(sql, args...)` — returns a single row as `Map<String, Object>`
- `jdbc.queryForList(sql, args...)` — returns a list of `Map<String, Object>` rows
- `jdbc.update(sql, args...)` — runs INSERT, UPDATE, or DELETE; returns row count
- `jdbc.queryForObject(sql, type, args...)` — returns a single scalar value

**Where in the code:**
- Every `*Service.java` file injects `JdbcTemplate jdbc` and uses it directly
- Example: `Backend/src/main/java/com/gotcherapp/api/growth/GrowthService.java`

**Important note on test mocking:** `JdbcTemplate.queryForList` has two overloads — `(String, Object...)` and `(String, Class<T>, Object...)`. When writing unit tests with Mockito, be careful that your matcher count doesn't cause Java to resolve to the wrong overload. If you see `PotentialStubbingProblem`, annotate the test class with `@MockitoSettings(strictness = Strictness.LENIENT)` and use `doReturn().when()` syntax instead of `when().thenReturn()`.

---

### JJWT 0.12.6

**What it is:** The Java JWT (JSON Web Token) library. JWTs are self-contained tokens that encode a payload (user ID, email, expiry) and are cryptographically signed so the server can verify them without a database lookup.

**Why we use it:** JWTs let us build a stateless API — the server doesn't need to store session state for every user. Only refresh tokens (used to issue new access tokens) are stored in the database.

**JWT structure:** `header.payload.signature`
- Header: algorithm (HS256)
- Payload: `sub` (userId), `email`, `iat` (issued at), `exp` (expiry)
- Signature: HMAC-SHA256 of header + payload using `JWT_SECRET`

**Where in the code:**
- `Backend/src/main/java/com/gotcherapp/api/security/JwtUtil.java`
  - `generateAccessToken(userId, email)` → 15-minute token
  - `generateRefreshToken()` → random UUID (not a JWT; just a DB-stored secret)
  - `validateToken(token)` → parses and verifies; throws on tampered/expired tokens
- `JWT_SECRET` is read from the `JWT_SECRET` environment variable (set in `Backend/.env`)

---

### Flyway

**What it is:** A database migration tool. It tracks which SQL scripts have been applied to a database and runs new ones in order when the application starts.

**Why we use it:** Without a migration tool, keeping the database schema in sync across dev machines, CI, and production requires manual effort and is error-prone. Flyway automates this: every schema change is a numbered SQL file, and Flyway ensures it runs exactly once per database.

**File naming convention:** `V{version}__{description}.sql`
- `V1__create_users.sql`
- `V2__create_refresh_tokens.sql`
- `V3__create_baby_profiles.sql`
- `V4__create_milestones.sql`
- `V5__create_journal_entries.sql`
- `V6__add_journal_image_url.sql`
- `V7__baseline_gap.sql` — intentional placeholder (V7 was skipped during development; this keeps Flyway's history clean)
- `V8__create_baby_profile_display_fields.sql`
- `V9__create_growth_records.sql`
- `V10__create_feeding_logs.sql`
- `V11__growth_records_imperial_units.sql`

**Where in the code:**
- Migration files: `Backend/db/migration/`
- Flyway runs automatically on Spring Boot startup (auto-configured via `spring-flyway` dependency)
- Config in `Backend/src/main/resources/application.properties`:
  ```properties
  spring.flyway.locations=filesystem:db/migration
  spring.flyway.out-of-order=true
  ```
  `out-of-order=true` is set because V7 was added after V8 was already applied to existing databases. New installs do not need this setting but it is harmless.

**Important:** Never edit a migration file that has already been applied. Create a new migration instead. Flyway checksums every applied migration and will refuse to start if a previously applied file has changed.

---

### PostgreSQL 16

**What it is:** The relational database. All application data — users, profiles, milestones, journal entries, growth records, feeding logs — lives here.

**Why we use it:** PostgreSQL is the most feature-complete open-source relational database. It has excellent JSON support, strong data integrity guarantees, and is widely supported by hosting providers. We chose it over MySQL for its stricter SQL compliance and better support for advanced data types.

**Database schema overview:**

| Table | Purpose |
|-------|---------|
| `users` | Email, hashed password, display name |
| `refresh_tokens` | Stored refresh token strings (rotated on use) |
| `baby_profiles` | One per user: baby name, birthdate, parent info |
| `milestones` | Achieved milestone keys (FK → baby_profiles) |
| `journal_entries` | Week, title, story text, optional image URL |
| `growth_records` | Date, weight (lbs), height (total inches), head circumference (inches) |
| `feeding_logs` | Type (breast/bottle/formula/solids), start time, end time, optional amount (ml) |

**Where in the code:**
- `Backend/docker-compose.yml` — starts the PostgreSQL 16 container
- `Backend/db/init/01-setup.sql` — creates the `gotcherapp_app` user and `gotcherapp` database (runs once on first Docker start)
- `Backend/db/migration/` — all schema definitions via Flyway
- Connection config in `Backend/.env`: `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`

**App credentials (local dev):**
- Host: `localhost:5432`
- Database: `gotcherapp`
- User: `gotcherapp_app` / `changeme_local`

---

### Spring Boot Actuator

**What it is:** A Spring Boot module that exposes operational endpoints — health checks, metrics, environment info — over HTTP.

**Why we use it:** The `/actuator/health` endpoint is used by reverse proxies (Caddy, nginx, load balancers) and monitoring systems to determine whether the application is up and ready to serve traffic.

**Where in the code:**
- Dependency in `Backend/build.gradle.kts`: `implementation("org.springframework.boot:spring-boot-starter-actuator")`
- Enabled in `Backend/src/main/resources/application.properties`:
  ```properties
  management.endpoints.web.exposure.include=health
  ```
- Accessible at: `GET http://localhost:3001/actuator/health` → `{"status":"UP"}`

---

### Spring Mail (SMTP)

**What it is:** Spring's email sending abstraction. It wraps JavaMail and provides a simple `JavaMailSender` bean for sending transactional emails.

**Why we use it:** The app may send password reset emails, welcome emails, or notifications. SMTP configuration is already wired up but email sending is disabled by default (no SMTP host configured).

**Where in the code:**
- Configuration in `Backend/.env`:
  ```
  SMTP_HOST=       # leave blank to disable
  SMTP_PORT=587
  SMTP_USERNAME=
  SMTP_PASSWORD=
  ```
- `Backend/src/main/resources/application.properties` binds these vars to Spring Mail properties
- To enable: set `SMTP_HOST` to your mail server (e.g., `smtp.sendgrid.net`) and fill credentials

---

### Cloudinary

**What it is:** A cloud media management platform. It stores images, performs on-the-fly transformations (resize, crop, format conversion), and serves them via CDN.

**Why we use it:** Journal entries support photo uploads. Storing images in PostgreSQL as binary data is impractical at scale; Cloudinary provides durable storage, a global CDN, and automatic format optimization (e.g., converting JPEG to WebP for modern browsers).

**Where in the code:**
- API credentials in `Backend/.env`:
  ```
  CLOUDINARY_CLOUD_NAME=...
  CLOUDINARY_API_KEY=...
  CLOUDINARY_API_SECRET=...
  ```
- Image upload is handled in the journal feature (upload endpoint accepts multipart form data, backend uploads to Cloudinary, stores the returned URL in `journal_entries.image_url`)

---

### Gradle

**What it is:** The build tool for the Java backend. It compiles Java source files, manages library dependencies, runs tests, and packages the application into a runnable JAR.

**Why we use it:** Gradle is the standard build tool for modern Spring Boot projects. The Kotlin DSL (`build.gradle.kts`) provides type safety and IDE completion that the older Groovy DSL lacks.

**Key commands:**
```bash
cd Backend

./gradlew bootRun          # start the Spring Boot server
./gradlew test             # run all unit tests
./gradlew compileJava      # compile only (no tests, no run)
./gradlew build            # compile + test + package JAR
./gradlew dependencies     # print the full dependency tree
```

**Gradle Wrapper (`gradlew`):** The wrapper downloads the correct Gradle version (8.11.1) automatically on first run. You never need to install Gradle separately. The wrapper binary is committed to the repo (`Backend/gradlew`, `Backend/gradlew.bat`, `Backend/gradle/wrapper/`).

**Where in the code:**
- `Backend/build.gradle.kts` — all dependencies and plugin configuration
- `Backend/settings.gradle.kts` — project name declaration
- `Backend/gradle/wrapper/gradle-wrapper.properties` — pins the Gradle version

---

### JUnit 5 + Mockito

**What it is:** The Java testing framework stack.
- **JUnit 5** (`junit-jupiter`) — the test runner; `@Test`, `@BeforeEach`, assertions
- **Mockito** — mocking library; replaces real dependencies with controlled fakes in unit tests
- **MockitoExtension** — JUnit 5 integration; processes `@Mock` and `@InjectMocks` annotations automatically

**Why we use it:** Unit tests verify individual classes in isolation without needing a running database or web server. This makes them fast (milliseconds) and reliable. We use mocks to simulate the database layer so tests don't require a live PostgreSQL connection.

**Test structure:**
```java
@ExtendWith(MockitoExtension.class)
class GrowthControllerTest {
    @Mock GrowthService growthService;       // fake service, behavior controlled by `when()`
    @InjectMocks GrowthController controller; // real controller, gets the mock injected

    @Test
    void addRecord_returns201_onSuccess() {
        when(growthService.addRecord(eq(1L), any())).thenReturn(RECORD);
        var result = controller.addRecord(PRINCIPAL, REQUEST);
        assertEquals(HttpStatus.CREATED, result.getStatusCode());
    }
}
```

**Where in the code:**
- All test files: `Backend/src/test/java/com/gotcherapp/api/`
- Test classes follow the pattern `{ClassUnderTest}Test.java` in the same package
- Run tests: `cd Backend && ./gradlew test`
- Test reports: `Backend/build/reports/tests/test/index.html`

**Tip — strict stubs:** Tests use `STRICT_STUBS` mode by default (via `MockitoExtension`). This means any stubbed method that is never called will cause a test failure. If you stub `JdbcTemplate` methods that Spring resolves to a different overload at runtime, use `@MockitoSettings(strictness = Strictness.LENIENT)` on the test class and the `doReturn().when()` stub pattern.

---

## Frontend Technologies

### React 18

**What it is:** A JavaScript library for building user interfaces through reusable components. Each component manages its own state and re-renders when that state changes.

**Why we use it:** React is the dominant UI library in the industry. Its component model maps naturally to our tabbed single-page app — each feature (Journal, Growth, Feeding, Milestones) is a self-contained section that manages its own API calls and local state.

**Key React patterns used in this app:**
- `useState` — local component state (form inputs, data arrays, loading flags)
- `useEffect` — side effects (fetching data from the API when a component mounts)
- `useRef` — timer reference for the Feeding tab's live countdown
- Props — passing data and callbacks between parent (`BabySteps`) and child sections

**Where in the code:**
- `Frontend/src/components/BabySteps.jsx` — the main app shell; owns all state and API calls
- `Frontend/src/components/LoginPage.jsx` — login/register form
- `Frontend/src/App.jsx` — root component; shows `LoginPage` or `BabySteps` based on auth state
- `Frontend/src/components/ui/` — reusable UI primitives (Button, Card, Input, etc.)

---

### Vite 6

**What it is:** A frontend build tool and development server. It serves files to the browser during development (with hot module replacement) and bundles them into optimized static assets for production.

**Why we use it:** Vite is significantly faster than older tools like Create React App (which used webpack). Its dev server starts in milliseconds and updates the browser instantly on file changes.

**Key commands:**
```bash
cd Frontend

npm run dev      # start dev server at http://localhost:3000
npm run build    # bundle for production → Frontend/dist/
npm run preview  # serve the production bundle locally
```

**Where in the code:**
- `Frontend/vite.config.js` — sets port 3000, configures the `@/` path alias (maps to `Frontend/src/`)
- `Frontend/package.json` — npm scripts and all frontend dependencies

---

### Tailwind CSS v3

**What it is:** A utility-first CSS framework. Instead of writing `.card { padding: 16px; border-radius: 8px; }` in a separate stylesheet, you compose styles directly in JSX using class names like `p-4 rounded-lg`.

**Why we use it:** Utility classes keep styles co-located with markup, eliminate naming overhead, and make design constraints (spacing scale, color palette) consistently enforced. Combined with shadcn/ui, it provides a polished look with minimal custom CSS.

**Where in the code:**
- `Frontend/tailwind.config.js` — configures content paths (so Tailwind purges unused classes in production) and extends the theme with shadcn/ui color tokens
- `Frontend/src/index.css` — Tailwind directives (`@tailwind base; @tailwind components; @tailwind utilities`) and CSS custom properties for the color system
- Every `.jsx` file uses Tailwind class names directly on JSX elements

---

### shadcn/ui + Radix UI

**What it is:** shadcn/ui is a collection of copy-paste UI components built on top of Radix UI primitives. Radix UI provides accessible, headless (unstyled) component behaviors (dropdowns, dialogs, tabs, switches) that shadcn layers Tailwind styling on top of.

**Why we use it:** Accessibility is hard to get right from scratch (keyboard navigation, ARIA roles, focus trapping in modals). Radix handles all of that; shadcn gives us styled components that look polished and match the design system. Being "copy-paste" (not an installed design system) means we own the code and can modify components freely.

**Where in the code:**
- `Frontend/src/components/ui/` — all shadcn components (manually scaffolded):
  - `button.jsx`, `card.jsx`, `input.jsx`, `label.jsx`, `textarea.jsx`
  - `dialog.jsx` — modal overlay (used for Add Journal Entry)
  - `tabs.jsx` — tabbed navigation (main app tabs)
  - `select.jsx` — dropdown select (feed type picker)
  - `badge.jsx`, `separator.jsx`, `switch.jsx`, `checkbox.jsx`
- `Frontend/src/lib/utils.js` — exports the `cn()` helper (merges Tailwind class names safely using `clsx` + `tailwind-merge`)
- Radix UI packages are in `Frontend/package.json` under `@radix-ui/*`

---

### lucide-react

**What it is:** An icon library with 1,000+ SVG icons as React components.

**Why we use it:** Icons communicate meaning without text and improve UI scannability. lucide-react is the icon set used by shadcn/ui, so it's already in the dependency tree.

**Where in the code:**
- `Frontend/src/components/BabySteps.jsx` — dozens of icons imported at the top
- Examples: `<Baby />`, `<BookOpen />`, `<TrendingUp />`, `<Milk />`, `<Trash2 />`, `<Plus />`
- Import pattern: `import { Baby, BookOpen } from 'lucide-react'`

---

### recharts

**What it is:** A composable charting library for React. Built on D3 under the hood but exposed as React components.

**Why we use it:** The Growth Tracker needs a line chart to visualize baby weight, height, and head circumference over time. recharts integrates naturally into React's component model — the chart is just JSX.

**Where in the code:**
- `Frontend/src/components/BabySteps.jsx` — the Growth tab renders a `<LineChart>` with three `<Line>` series (weight, height, head)
- Import pattern:
  ```js
  import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
  ```
- `Frontend/package.json` — `"recharts": "^2.x"`

**Chart data shape:**
```js
// Each growth record becomes one data point:
{ date: "11/03", weight: 7.5, height: 20.0, head: 13.5 }
```

---

### jsPDF

**What it is:** A JavaScript library that generates PDF files entirely in the browser — no server required.

**Why we use it:** The Memory Book feature lets parents export their baby's journal as a PDF keepsake. By generating the PDF client-side, we avoid sending potentially large journal content to a server for rendering.

**Where in the code:**
- `Frontend/src/lib/pdf.js` — `generatePdf(entries, profile)` builds the PDF layout; `downloadPdf(entries, profile)` is the public entry point (paywall seam between the two)
- Called from `BabySteps.jsx` when the user clicks "Download Memory Book PDF"

---

### localStorage

**What it is:** A browser API that stores key-value string data that persists across page refreshes (but not across browsers/devices).

**Why we use it:** Two features rely on localStorage:
1. **Auth tokens** — the JWT access token and refresh token are stored in `localStorage` so the user stays logged in across page refreshes
2. **Active feed session** — when a parent starts a feeding session, the start time and feed type are saved to `localStorage` under the key `gotcher_active_feed`. If the page is refreshed mid-feed, the timer resumes from the saved start time rather than resetting.

**Where in the code:**
- `Frontend/src/lib/auth.js` — `saveSession()` writes tokens to localStorage; `getStoredSession()` reads them
- `Frontend/src/components/BabySteps.jsx` — Feeding tab reads/writes `gotcher_active_feed` on feed start/stop/page-load

**Note:** localStorage is accessible to any JavaScript on the page (XSS risk) and is not suitable for storing highly sensitive data in a production app. For a future hardening pass, consider `httpOnly` cookies for auth tokens.

---

## Infrastructure

### Docker Compose

**What it is:** A tool for defining and running multi-container Docker applications. The entire database layer (PostgreSQL + pgAdmin) runs in Docker containers defined in a single YAML file.

**Why we use it:** Docker ensures every developer has an identical PostgreSQL setup regardless of their OS. There is no "install PostgreSQL locally" step — just `docker compose up -d`.

**Services defined:**

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `postgres` | `postgres:16` | 5432 | Primary database |
| `pgadmin` | `dpage/pgadmin4` | 5050 | Database admin UI |

**Where in the code:**
- `Backend/docker-compose.yml` — service definitions; credentials loaded from `Backend/.env`
- `Backend/db/init/01-setup.sql` — mounted as a Docker init script; creates the `gotcherapp_app` user and `gotcherapp` database on first container start
- Start/stop: `cd Backend && docker compose up -d` / `docker compose down`

**Note on port conflicts:** TavernTales (another project on this machine) uses the same ports (5432, 5050). Both cannot run simultaneously. Use `stop-services.sh` from the project root to stop all containers before switching projects.

---

### pgAdmin 4

**What it is:** A web-based graphical administration interface for PostgreSQL. It lets you browse tables, run SQL queries, view query execution plans, and manage users.

**Why we use it:** It provides a quick way to inspect the database during development without memorizing `psql` commands.

**Where in the code:**
- Defined in `Backend/docker-compose.yml` under the `pgadmin` service
- Accessible at `http://localhost:5050` when Docker is running
- Login credentials set in `Backend/.env`:
  ```
  DOCKER_PGADMIN_EMAIL=admin@gotcherapp.com
  DOCKER_PGADMIN_PASSWORD=admin
  ```

**Important:** pgAdmin 8.14+ rejects `.local` TLD email addresses. Use a `.com` or other standard TLD for the admin email in your `.env`.

---

## Development Scripts

| Script | Location | Purpose |
|--------|----------|---------|
| `start-services.sh` | Root | Starts Docker containers + Spring Boot API + Vite frontend |
| `stop-services.sh` | Root | Stops ALL Docker containers and kills ports 3000/3001 |
| `seed-demo-user.sh` | Root | Creates `demo@gotcherapp.com` / `DemoPass1` with baby Lily, 8 journal entries, growth records, and feeding logs |
| `seed-demo-growth-feeding.sh` | Root | Seeds growth records and feeding logs only (for existing demo account) |
| `run-all-tests.sh` | Root | Runs `./gradlew test` and reports results |

**To start the full stack from scratch:**
```bash
cd Backend
docker compose up -d          # start PostgreSQL + pgAdmin
./gradlew bootRun             # start the API (Flyway migrations run automatically)
# In a separate terminal:
cd Frontend
npm run dev                   # start the frontend
```
Or use the convenience script from the project root: `./start-services.sh`

---

## Environment Configuration

All secrets and environment-specific values live in `Backend/.env` (gitignored). Never commit this file. Use `Backend/.env.example` as a template.

**Key variables:**

| Variable | Used by | Description |
|----------|---------|-------------|
| `JWT_SECRET` | Spring Boot / JwtUtil | 32+ character secret for signing JWTs |
| `PGHOST/PORT/USER/PASSWORD/DATABASE` | Spring Boot / DataSource | PostgreSQL connection |
| `DOCKER_POSTGRES_PASSWORD` | docker-compose.yml | PostgreSQL root password |
| `DOCKER_PGADMIN_EMAIL/PASSWORD` | docker-compose.yml | pgAdmin login |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | Backend upload handler | Image storage |
| `SMTP_HOST/PORT/USERNAME/PASSWORD` | Spring Mail | Transactional email |
| `FRONTEND_URL` | Spring Security CORS config | Allowed origin for API requests |

**Frontend environment variables:**
Stored in `Frontend/.env.local` (gitignored):
```
VITE_API_URL=http://localhost:3001
```
Vite exposes any variable prefixed with `VITE_` to the browser bundle. The `apiRequest()` helper in `Frontend/src/lib/api.js` reads `import.meta.env.VITE_API_URL` to build API URLs.

---

## Architecture at a Glance

```
┌─────────────────────────────────────┐
│           Browser (port 3000)       │
│                                     │
│  React 18 + Vite                    │
│  Tailwind CSS + shadcn/ui           │
│  recharts (Growth charts)           │
│  jsPDF (Memory Book export)         │
│  localStorage (tokens + feed timer) │
└──────────────┬──────────────────────┘
               │ HTTPS (JWT in header)
               │ REST API calls
               ▼
┌─────────────────────────────────────┐
│        Spring Boot API (port 3001)  │
│                                     │
│  Spring Security → JwtAuthFilter    │
│  REST Controllers (@RestController) │
│  Services (@Service)                │
│  JdbcTemplate (raw SQL)             │
│  JJWT (token generation/parsing)    │
│  Flyway (schema migrations)         │
│  Spring Actuator (/actuator/health) │
│  Spring Mail (SMTP, optional)       │
│  Cloudinary SDK (image uploads)     │
└──────────────┬──────────────────────┘
               │ JDBC
               ▼
┌─────────────────────────────────────┐
│       PostgreSQL 16 (port 5432)     │
│       [Docker Container]            │
│                                     │
│  users, refresh_tokens              │
│  baby_profiles, milestones          │
│  journal_entries                    │
│  growth_records, feeding_logs       │
└─────────────────────────────────────┘
               │
               │ Admin UI
               ▼
┌─────────────────────────────────────┐
│        pgAdmin 4 (port 5050)        │
│        [Docker Container]           │
└─────────────────────────────────────┘
```

---

*Last updated: 2026-03-27*
