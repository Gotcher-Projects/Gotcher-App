# Deployment Session Prompts

---

## S1 — Domain & VPS

S1 is a manual infrastructure session — no code. Follow the checklist in `plans/deployment/s1-domain-and-vps.md`. Come back with: domain name, VPS IP, SSH confirmed, Docker installed.

---

## S2 — Docker Compose & Caddy

Start S2. Plan: `plans/deployment/s2-docker-compose.md`

Read before writing anything:
- `Backend/Dockerfile` (check what already exists)
- `Backend/src/main/resources/application.properties` (env var names)
- `Backend/.env.example` (existing var template)
- `Frontend/vite.config.js` (confirm VITE_API_URL usage)

We need: `docker-compose.prod.yml`, `Caddyfile`, `Frontend/Dockerfile`, `.env.prod.example`, `deploy.sh`.

Domain and VPS IP are known from S1 — fill them into the Caddyfile and examples.

Do not push to VPS yet. Do not modify any application code.

---

## S3 — First Deploy & Smoke Test

Start S3. Plan: `plans/deployment/s3-first-deploy.md`

All config files exist from S2. This session is about getting them onto the VPS and verifying the app is live. Follow the steps in the plan file. Run through the full smoke test checklist in a browser over HTTPS before marking complete.
