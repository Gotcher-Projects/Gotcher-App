# S3 — First Deploy & Smoke Test
**Status:** Complete
**Branch:** deployment/docker-compose (continue from S2)
**Depends on:** S2 complete, DNS propagated, .env file on VPS

## Goal
Get the app live. Run through the deploy process end-to-end on the VPS, run Flyway migrations, and verify every major feature works over HTTPS.

## Steps

1. ✅ **SSH into VPS confirmed** — deploy@87.99.153.7 accessible

2. ✅ **Clone repo on VPS** — cloned to ~/gotcherapp (note: repo cloned without -d flag, had to mv files into ~/gotcherapp manually)

3. ✅ **.env file created** — APP_DOMAIN, JWT_SECRET, DB_PASSWORD, SECURE_COOKIES set + Cloudinary credentials added (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)
   📝 GUIDE UPDATE NEEDED: Add Cloudinary as a required step in .env setup, not optional

4. ✅ **Backend Dockerfile fixed** — swapped eclipse-temurin + gradlew wrapper for official gradle:8.11.1-jdk21-alpine image (gradle/wrapper/ dir was never committed to repo)
   📝 GUIDE UPDATE NEEDED: Note that gradle wrapper dir is not in repo — Dockerfile uses official Gradle image instead

5. ✅ **Docker build successful** — all three images built and containers started
   📝 GUIDE UPDATE NEEDED: Note gradle.properties must not contain org.gradle.java.home — move to ~/.gradle/gradle.properties locally using printf not echo (spaces in path)

6. ✅ **All services started cleanly** — Caddy TLS certs issued, all 19 Flyway migrations applied, API started in 4.8s

7. **Copy config to VPS**
   ```bash
   scp docker-compose.prod.yml deploy@<VPS_IP>:~/gotcherapp/
   scp Caddyfile deploy@<VPS_IP>:~/gotcherapp/
   # Create .env from .env.prod.example — fill in real secrets
   ```

2. **Clone repo on VPS**
   ```bash
   ssh deploy@<VPS_IP>
   cd ~/gotcherapp
   git clone <repo-url> .
   ```

3. **First boot**
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   docker compose logs -f  # watch for startup errors
   ```

4. **Verify Flyway migrations ran**
   ```bash
   docker compose exec postgres psql -U gotcherapp_app -d gotcherapp -c "\dt"
   # Should list all tables: users, refresh_tokens, baby_profiles, milestones, etc.
   ```

5. **Smoke test checklist** (browser, over HTTPS)

## Verification
- [ ] HTTPS certificate issued (green padlock, no warnings)
- [ ] `www` redirects to root domain (or vice versa)
- [ ] Register a new account
- [ ] Login / logout / token refresh works
- [ ] Save a baby profile (Dashboard tab)
- [ ] Log a feeding session
- [ ] Log a sleep entry
- [ ] Add a poop entry
- [ ] Add a growth measurement — chart renders
- [ ] Toggle a vaccine
- [ ] Add an appointment
- [ ] Check a milestone
- [ ] Add a journal entry with photo
- [ ] Add a first time with photo
- [ ] PDF export works
- [ ] Page reload preserves session (localStorage token refresh)
- [ ] Session expiry logs user out cleanly

## write a deploy.sh for future deploys
```bash
#!/bin/bash
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
docker compose logs --tail=50
```

## Out of Scope
- No CI/CD pipeline (manual deploy for now)
- No backups (add after first real users)
- No monitoring / uptime alerts
- No staging environment
