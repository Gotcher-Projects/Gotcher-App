# S2 — Docker Compose & Caddy
**Status:** Complete — 2026-04-17
**Branch:** deployment/docker-compose
**Depends on:** S1 complete ✅ (domain: `michaelgotcher.com`, VPS: `87.99.153.7`)

## Goal
Write all config files needed to run the app in production. By end of this session, `docker compose up -d` on the VPS should bring up the full stack with HTTPS.

## Files to Change / Create

| File | Change |
|------|--------|
| `docker-compose.prod.yml` | New — 3 services: caddy, api, postgres |
| `Caddyfile` | New — serve frontend static files + reverse proxy /api/* |
| `Frontend/Dockerfile` | New — multi-stage: Node build → copy dist into Caddy image |
| `Backend/Dockerfile` | Likely already exists — verify and adjust if needed |
| `.env.prod.example` | New — template for all prod env vars |
| `deploy.sh` | New — one-command deploy script (git pull + compose up) |
| `backup.sh` | New — dumps Postgres DB to a timestamped `.sql.gz` file for migration or disaster recovery |

## Key Decisions

- **Frontend build:** Multi-stage Dockerfile — Node 20 builds `npm run build`, output copied into `caddy:2-alpine` image. VPS never needs Node installed.
- **API container:** Uses existing `Backend/Dockerfile`. Gradle builds the fat JAR in the image.
- **Caddy config:** Root path serves `/srv/frontend` static files. `/api/*` strips prefix and proxies to `http://api:3001`.
- **Postgres data:** Named Docker volume `postgres_data` — survives container restarts and `compose down`.
- **Env vars:** Injected via `.env` file on the VPS (not committed). `.env.prod.example` is committed as a template.
- **HTTPS:** Caddy auto-provisions Let's Encrypt cert once DNS A record resolves. No manual cert management.
- **Domain swappability:** All domain references flow from one `APP_DOMAIN` env var in the server `.env` file. Caddyfile uses `{$APP_DOMAIN}`, backend CORS reads it, frontend `VITE_API_URL` is built as `https://${APP_DOMAIN}/api`. Swapping domain = edit one line + rebuild frontend image.

## Env Vars Needed (prod)

| Variable | Where set | Notes |
|----------|-----------|-------|
| `APP_DOMAIN` | Caddyfile / .env | Current: `michaelgotcher.com` — swap here only when real domain ready |
| `JWT_SECRET` | Backend .env | min 32 chars, random |
| `DB_PASSWORD` | Backend .env | strong random password |
| `SECURE_COOKIES` | Backend .env | `true` in prod |
| `VITE_API_URL` | Frontend build arg | Derived from `APP_DOMAIN` at build time: `https://${APP_DOMAIN}/api` |
| `SMTP_*` | Backend .env | Optional — email verification |

## Progress Checklist

### Files
- [x] `deploy.sh` — written
- [x] `backup.sh` — written
- [x] `Frontend/Dockerfile` — multi-stage Node → Caddy
- [x] `Caddyfile` — static files + /api/* proxy + www redirect
- [x] `docker-compose.prod.yml` — caddy, api, postgres services
- [x] `.env.prod.example` — all prod env vars documented

### Verification
- [ ] `docker compose -f docker-compose.prod.yml config` validates without errors
- [ ] Frontend Dockerfile builds locally: `docker build -f Frontend/Dockerfile -t frontend-test .`
- [ ] Backend Dockerfile builds locally: `docker build -f Backend/Dockerfile -t api-test .`
- [ ] Caddyfile has correct site address and proxy target
- [ ] `.env.prod.example` documents every required variable

## Out of Scope
- Not pushing to VPS yet — that's S3
- No database migrations yet — that's S3
- No monitoring / alerting
