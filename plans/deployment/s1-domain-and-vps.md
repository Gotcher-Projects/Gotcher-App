# S1 — Domain & VPS
**Status:** Pending
**Branch:** deployment/infra-setup
**Depends on:** Domain purchased (manual step — not a code session)

## Goal
Get the external infrastructure in place so S2 can write config files against real values (VPS IP, domain name).

## Steps (manual — no code)

1. **Buy domain** — Namecheap or Cloudflare Registrar (~$10-15/yr)
   - Decide on domain name before this session
   - Cloudflare Registrar preferred (at-cost pricing, free DNS management)

2. **Provision Hetzner VPS**
   - hetzner.com → Cloud → Create Server
   - Location: closest to you (Ashburn, VA for US East)
   - Image: Ubuntu 24.04 LTS
   - Type: CX22 (2 vCPU, 4GB RAM) — ~$4.49/mo
   - Add your SSH public key during creation
   - Note the public IPv4 address

3. **Point DNS at VPS**
   - Add an A record: `@` → VPS IP (root domain)
   - Add an A record: `www` → VPS IP
   - TTL: 300 (5 min) for fast propagation during initial setup

4. **SSH into VPS and install Docker**
   ```bash
   ssh root@<VPS_IP>
   apt update && apt upgrade -y
   curl -fsSL https://get.docker.com | sh
   docker --version  # verify
   ```

5. **Create deploy user** (optional but good practice)
   ```bash
   adduser deploy
   usermod -aG docker deploy
   ```

## Outputs needed for S2
- [ ] Domain name (e.g. `gotcherapp.com`)
- [ ] VPS IP address
- [ ] SSH access confirmed
- [ ] Docker installed and running

## Out of Scope
- No application code written this session
- No docker-compose yet
- No SSL/HTTPS yet (Caddy handles that in S2 once DNS propagates)
