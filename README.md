# Gotcher-App — Baby Steps

Baby tracking app: milestones, journal, health records, feeding/sleep/poop logs, and first-times.

## Stack

| Layer    | Tech |
|----------|------|
| Frontend | Vite + React (JSX), Tailwind CSS v3, shadcn/ui, lucide-react |
| Backend  | Spring Boot 3.4.1 (Java 21+), Spring Security 6, JdbcTemplate |
| Database | PostgreSQL 16 (Docker), Flyway migrations |
| Auth     | JWT access token (15 min) + refresh token (7 days, rotation) |

## Development

### Prerequisites

- Java 21+ (24 works)
- Docker Desktop
- Node.js 18+

### Start all services

```bash
cd Backend && ./start-services.sh
```

This starts: Postgres + pgAdmin (Docker), Spring Boot API on port 3001, Vite frontend on port 3000.

### Start services individually

```bash
# Database only
cd Backend && docker compose up -d

# API only (after DB is up)
cd Backend && ./gradlew bootRun

# Frontend only
cd Frontend && npm run dev
```

### Environment setup

```bash
cp Backend/.env.example Backend/.env
# Edit Backend/.env — set JWT_SECRET to a 32+ char random string
# SMTP and Cloudinary are optional; leave blank to disable those features
```

### Run frontend tests

```bash
cd Frontend && npm test
```

### Run backend tests

```bash
cd Backend && ./gradlew test
```

### Seed demo data

Creates `demo@gotcherapp.com / DemoPass1` with baby Lily and sample journal entries:

```bash
./seed-demo-user.sh
```

### Add a database migration

1. Create `Backend/db/migration/VN__description.sql` (increment N)
2. Restart the API — Flyway runs pending migrations automatically on startup

> **Port conflict:** If a TavernTales postgres container is running it binds port 5432 first.
> Run `./stop-services.sh` before starting GotcherApp services.

## Ports

| Service  | Port |
|----------|------|
| Frontend | 3000 |
| API      | 3001 |
| Postgres | 5432 |
| pgAdmin  | 5050 |
