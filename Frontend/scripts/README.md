# Frontend/scripts — demo seeding & asset prep

Two scripts, plus how to run the demo seed against **local** and **production (Hetzner)**.

| Script | npm alias | What it does | Deps |
|---|---|---|---|
| `seed-demo-users.mjs` | `npm run seed:demo` | Seeds two demo accounts (sv2-s9.1) via the API | Node 20 + `vite-node` |
| `downscale-seed-assets.mjs` | `npm run downscale:seed-assets` | One-time: shrinks `seed-assets/*.jpg` to ≤1600px | `sharp` (**dev/local only**) |

The seed accounts (password `DemoPass1`, existing `demo@gotcherapp.com` untouched):
- `demo-pregnancy@demoapp.com` — Maya, pregnancy, bump diary + guided book.
- `demo-bumptobaby@demoapp.com` — Chloe/Noah, full lifecycle + guided + freeform books.

## What actually needs installing

- **The seed is an HTTP client** — it runs wherever you can reach the API and creates data over HTTPS.
  It does **not** need to run on the server.
- **`vite-node`** is required to *run* the seed (it imports the real guided-book arc via the `@/` alias, so
  the demo books can't drift from the app). It comes from `npm ci`.
- **`sharp`** is **only** used by `downscale-seed-assets.mjs` — a one-time local prep. The downscaled images
  are committed, so `sharp` is **never needed on the server**.
- **Node 20** — the seed uses global `fetch` / `FormData` / `Blob` (Node ≥18; use 20 to match the build).
- **Cloudinary must be configured on the target API** (the seed uploads photos). Prod already has it; for a
  local target, set `CLOUDINARY_*` in `Backend/.env` or the uploads fail.

## Run locally

```bash
cd Backend && ./start-services.sh      # API on :3001
cd Frontend && npm ci                  # once — installs vite-node
npm run seed:demo                       # API defaults to http://localhost:3001
```

## Run against production (Hetzner) — RECOMMENDED: remotely, no server changes

The prod containers don't run Node (Caddy serves static files; the API is Java), so the cleanest way is to
run the seed from **any machine that has the repo + `npm ci`** (a laptop, the deploy box, CI) pointed at the
public API. Caddy routes `https://cradlehq.app/api/*` to the API.

```bash
cd Frontend
npm ci                                          # installs vite-node (+ everything else)
API=https://cradlehq.app/api npm run seed:demo  # creates the demo accounts in PROD
```

Nothing to install on the Hetzner host for this path.

## Run ON the Hetzner host (only if you can't run it remotely)

The host has Docker but not Node, and the API container has no host port (reachable only via Caddy). So:

```bash
# 1) install Node 20 (Debian/Ubuntu, NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2) from the repo already on the box (~/gotcherapp)
cd ~/gotcherapp/Frontend
npm ci                                          # pulls vite-node etc.
API=https://cradlehq.app/api npm run seed:demo  # via the public URL (api port isn't exposed on the host)
```

## Notes & safety

- **Idempotent:** if an account already exists, its whole block is skipped (register 4xx → skip). Safe to
  re-run.
- **It mutates the target:** running against prod creates real rows in the prod DB and uploads ~13 images to
  the prod Cloudinary account. Intended for the two demo accounts only.
- **Fake `@demoapp.com` emails** never receive mail — the accounts are usable by password/token immediately
  (same as the existing `demo@`). If prod ever enforces email verification for login, revisit.
- **Alternative (fully self-contained on prod, no vite-node):** pre-generate the guided-arc payload to a
  committed JSON and switch the seed to plain `node`. Not built — ask if you want it; only worth it if
  remote-run isn't an option.
