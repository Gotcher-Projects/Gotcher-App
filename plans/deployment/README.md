# Deployment Plan

Ship GotcherApp to a Hetzner VPS using Docker Compose + Caddy.

**Target stack:** Hetzner CX22 (~$4-5/mo) · Docker Compose · Caddy (HTTPS + static frontend) · Spring Boot API · PostgreSQL

---

## Status

| Session | Scope | Status |
|---------|-------|--------|
| [S1 — Domain & VPS](./s1-domain-and-vps.md) | Buy domain, provision VPS, point DNS | Pending |
| [S2 — Docker Compose & Caddy](./s2-docker-compose.md) | Prod docker-compose.yml, Caddyfile, env vars | Pending |
| [S3 — First Deploy & Smoke Test](./s3-first-deploy.md) | Push to VPS, run migrations, verify end-to-end | Pending |

---

## Key Decisions (already made)

- **Host:** Hetzner CX22 — cheaper than Railway+Vercel split
- **Reverse proxy:** Caddy — auto HTTPS via Let's Encrypt, serves static frontend + proxies `/api/*`
- **Frontend build:** Built inside a Caddy Docker image (multi-stage) so VPS needs no Node.js
- **Database:** Postgres container on the VPS (same compose file) — no managed DB for now
- **Tokens:** JWT in localStorage (already implemented), `SECURE_COOKIES=true` in prod env
- **Blocker:** Domain must be purchased before S1 can start — Caddy needs it for HTTPS

## Blockers

- [ ] Domain not yet purchased (Namecheap or Cloudflare Registrar, ~$10-15/yr)
