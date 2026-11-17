# AGENTIC AI LIVE SERVER WORLD 3D

[![CI](https://github.com/richkeyricks/agentic-world-3d/actions/workflows/ci.yml/badge.svg)](https://github.com/richkeyricks/agentic-world-3d/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](package.json)
[![Live Demo](https://img.shields.io/badge/demo-live-2ea44f.svg)](https://agentic-world-3d.pages.dev/)
[![Cloudflare Pages](https://img.shields.io/badge/hosted%20on-Cloudflare%20Pages-F38020.svg)](https://agentic-world-3d.pages.dev/)

**A live 3D virtual office where 7 AI agents work in real time — a multi-agent mission control for agentic AI, rendered in Three.js.**

Watch a crew of autonomous AI agents plan, build, review and ship work inside a living 3D world: a two-floor Indonesian office with a meeting room, lounge, game room and a street full of food carts, traffic and pedestrians — plus a UFO that occasionally abducts passers-by. Every Working / Idle state on screen is real data, not animation: the office reads a live task ledger and polls it every 10 seconds.

> **Live demo (primary):** <https://agentic-world-3d.pages.dev/> — fast, worldwide, no warning page. **Mirror:** <https://isa-office.serveousercontent.com/> (served through a tunnel; the first 3D load can take a few seconds). Open either link in any browser — no login needed for the public view.

> **Fork attribution.** This is **Mission Control ISA**, an ISA fork of [`yugienugraha/ruang`](https://github.com/yugienugraha/ruang) (Hermes Virtual Office, formerly Hermes 3D Virtual Office). The original project is © yugienugraha, MIT — see [LICENSE](LICENSE). This fork replaces the `hermes` CLI data source with the ISA ledger (`tasks.jsonl` / `queue.jsonl` / `dispatch.json`) and adds the ISA agent roster, public view mode, viewer counter, POV mode, UFO events and the Indonesian street life described below. Upstream features that depend on the `hermes` CLI still work when it is present; without it they degrade to *Not Available* instead of failing.

## Live Demo

| | URL | Notes |
|---|---|---|
| **Primary (Cloudflare Pages)** | <https://agentic-world-3d.pages.dev/> | Static SPA on Cloudflare's global CDN — fast everywhere, no warning page. `/api/*` is proxied by a Pages Function to the live server (see [How it works](#how-it-works--the-full-flow)). |
| **Mirror (Serveo tunnel)** | <https://isa-office.serveousercontent.com/> | Direct tunnel to the VM. Same app, same live data — can be slower on first 3D load (free-tunnel bandwidth) and shows Serveo's interstitial warning page on first visit. |

What you see on the public link: the full 3D office, live — agents working, meeting bubbles, street life, the UFO. No account, no login. The header counter (`👁 N sedang menonton`) shows how many tabs are watching right now.

If the VM or tunnel is temporarily unreachable, the Cloudflare demo keeps serving the **last known snapshot** with a `degraded` flag instead of going blank — the office freezes on the last real state rather than inventing one.

📖 Docs: [Getting Started](docs/GETTING_STARTED.md) · [FAQ](docs/FAQ.md) · [Release Notes](RELEASE_NOTES.md)

## Features

### The living 3D office

- **Two floors.** Floor 1 is the office: hot desks, a glass-walled meeting room, lounge, game room (ping-pong, arcade, carrom), pantry and split ACs. Floor 2 is the dorm: one bed per agent, a lesehan corner, bathroom and a ruko-style balcony with rattan chairs, a hammock and string lights.
- **Day / night.** Light mode is daytime; dark mode is evening — office lights, street lamps and cart lamps switch on, with a smooth ~2 s transition, fog, a gradient sky, dust / firefly particles and a waving Merah Putih flag.
- **Indonesian street life.** Bakso, cilok, nasi goreng, kopi keliling and ayam penyet carts with named vendors, a beggar, a busker (who sings), a security guard, cars and motorcycles on the road, market visitors, and **Ricky Market** — a supermarket next door that agents and pedestrians visit.
- **Ricky the promoter.** A gold-shirted promoter named Ricky walks the whole map — around every building, across the road, behind the office — carrying a `RICHKEYRICK / FOLLOW • SUBSCRIBE` board and cycling through promo bubbles.
- **UFO + alien.** Every so often a procedural UFO hovers over the street, lowers a blue beam, and abducts a pedestrian (or Ricky) — lifting them 12.5 m, carrying them away and dropping them somewhere else, after which they just keep walking.
- **Camera.** Orbit / zoom / pan, camera presets (Depan / Jalan / Pasar / Atas), a fly-through intro, on-screen rotate buttons, and two-finger twist-to-rotate on mobile. Auto-rotate pauses while you interact and resumes after 10 s idle. A 2D fallback is included for browsers without WebGL.

### Real work, shown honestly

- **7 agents, one roster.** ISA (Chief Orchestrator), Richkeyrick AI (Architect & Lead Engineer), NEO AI (Router / Intake), Createme AI (Creative Director), ITC AI (Research, Evidence & Executor), SkyNET AI (Verifier, Adversarial & Security) and JARVIS AI (Memory & Delivery). States are `Idle`, `Working`, `Reviewing`, `Collaborating` or `Unknown` — derived from the ledger, never faked. An agent with no task shows Idle.
- **Per-agent progress.** Tasks with an `estimated_minutes` value show a live % bar (elapsed ÷ estimate, capped at 99% until done).
- **Meeting dialogue.** When ISA and Richkeyrick AI collaborate on a task, they discuss it in speech bubbles — 2–3 exchanges per task, generated from the actual task being worked on.
- **POV mode.** Become any agent's eyes: pick a chip under the screen or click a character, and the camera follows them at eye height (standing / sitting / lying) as they walk, snack and climb the stairs. Esc or *Keluar dari POV* returns to the exact orbit view.
- **Live viewer counter.** The header shows how many tabs are watching right now (polled `/api/office` in the last 30 s, per-tab — no IPs, no cookies, no analytics).
- **Public vs admin.** Anyone opening the link sees the public, view-only office (floor buttons, 2D/3D, zoom/pan, POV and rotate all work; nothing can be changed). The admin dashboard — Tasks, Calendar, Logs, Settings, Usage, Memory, Folders — is protected by an **access code** (scrypt hash, `HttpOnly` cookie, 12 h sessions / 7-day remember-me, lockout backoff after 5 wrong tries). The server binds `127.0.0.1` only.
- **Dashboard pages.** Task Board (Kanban), Agents, Calendar (cron), Activity, Logs, Stats, Token Usage, Memory, Folders and Settings — all read-only. Pages whose source is unavailable render *Not Available* rather than invented data.

## Architecture

```text
Browser (React 19 + Vite + React Three Fiber + three.js)
        │  polls GET /api/office every 10 s  (+ ?viewer=<tab id>)
        ▼
Express 5 server (single process, no dependencies beyond express)
        │  serves dist/ + /api/*
        ▼
Data source (auto-detected)
  ├─ ISA ledger mode (default here): tasks.jsonl / queue.jsonl / dispatch.json
  │   └─ set ISA_LEDGER_DIR to point at the ledger
  └─ hermes CLI mode: reads the Hermes Agent CLI (hermes profile list,
      kanban, cron, sessions, logs, insights) — the upstream behaviour
```

Key properties:

- **Read-only by design.** The server never writes to the ledger or to Hermes. The only writes in the whole app are its own optional access-code and profile-lock files.
- **No database.** State is a JSONL ledger on disk; snapshots are composed per request and cached for 10 s (server side).
- **Small surface.** One process, one port (`127.0.0.1:3001`), a handful of read endpoints; everything except `GET /api/office` and `GET /api/access` requires the access code.
- **Tested.** 275 tests (Vitest, 34 files) cover the ledger, the office state machine, the UFO state machine, POV maths, polling, viewers and the public/admin routing — run in CI on every push and PR.

## How it works — the full flow

Everything the office shows comes from one append-only file. Nothing is simulated, and nothing is faked when data is missing.

### 1. The ledger is the single source of truth

Work is recorded as events in `tasks.jsonl` — one JSON object per line:

```json
{"ts": "2026-11-17T10:25:00+07:00", "task_id": "mission-control-dialog-meeting", "agent": "isa", "title": "Dialog meeting ISA dan Richkeyrick AI per task", "status": "progress", "estimated_minutes": 45}
```

Event statuses are `created`, `queued`, `started`, `progress`, `review`, `blocked`, `done`, `failed`, `cancelled`. `queue.jsonl` holds work waiting to start; `dispatch.json` holds a single `{"paused": false}` flag. The server only ever **reads** these files — it never writes to them. The only files the server writes are its own access-code hash (`~/.config/ruang/access.json`) and profile-lock state.

### 2. Snapshot composition — from events to agent states

Every request to `GET /api/office` composes a fresh `OfficeSnapshot` (cached server-side for 10 s):

- **Agent state** is derived per agent from the latest event of their tasks: an active (`started` / `progress`) task means `Working`; `review` means `Reviewing`; anything else — including a finished task — means `Idle`. An agent with no attributed task is Idle. There is no "busy" animation without a task behind it.
- **Meetings.** When two or more agents share one active `task_id`, they are marked `Collaborating` (30 s TTL) and walk to the meeting area. While they collaborate, ISA (the planner) and Richkeyrick AI (the implementer) discuss the task in speech bubbles — 2–3 exchanges generated deterministically from the task title, cycling while the task runs; a new task gets a new set of exchanges.
- **Progress %.** A task with `estimated_minutes` shows `elapsed ÷ estimate`, rounded and **capped at 99%** while it runs — it only reads 100% when the `done` event actually arrives. A task re-opened after being done restarts its clock from the new start. A task with no estimate shows no bar at all: progress is never invented.
- **Viewer count.** Each tab generates a random id (`crypto.randomUUID()`, kept in `sessionStorage`) and sends it as `?viewer=<id>` on every poll. The server keeps an in-memory map of ids seen in the last 30 s and reports the count as `viewersNow`. No IPs, no cookies, no analytics, nothing stored to disk — a background tab drops out after ~30 s.

### 3. The request path — browser to ledger and back

```text
Visitor's browser
  │  GET / (static SPA from Cloudflare CDN)
  │  GET /api/office?viewer=<tab id>  every 10 s
  ▼
Cloudflare Pages Function  (functions/api/[[route]].ts)
  │  adds serveo-skip-browser-warning: true, forwards cookies,
  │  15 s upstream timeout
  ▼
Serveo tunnel  (https://isa-office.serveousercontent.com)
  ▼
Express 5 server on the VM  (127.0.0.1:3001, single process)
  │  composes OfficeSnapshot from the ledger (10 s cache)
  ▼
tasks.jsonl / queue.jsonl / dispatch.json
```

If the upstream is unreachable, the Function serves the **last snapshot cached in KV** with `degraded: true` (written only when `fetchedAt` changes, to stay inside the free KV write quota). Any other API failure returns `{"error": "upstream_unavailable", "degraded": true}`. Static files never depend on the VM — only live data does.

### 4. Public vs admin — one URL, two doors

Routing is decided client-side from the URL (`src/entry-view.ts`):

- `/` or `?public=1` → the **public office**: view-only. Floor buttons, 2D/3D toggle, zoom/pan, rotate buttons, POV and the viewer counter all work; nothing can be changed and no admin page is reachable.
- `?admin=1` (or the "Masuk sebagai admin" link) → the **lock screen**, then the full dashboard after the access code.
- An unlocked device (cookie) goes straight to the admin dashboard.

Server-side, only `GET /api/office` and `GET /api/access` are open without the code. Everything else — tasks, calendar, logs, settings, usage, memory, folders — requires the `HttpOnly` session cookie. The code itself is stored only as a scrypt hash; the only unauthenticated write endpoint is `/api/access/unlock` (the login itself, with lockout backoff after 5 wrong attempts).

### 5. The living world — POV, traffic, UFO

- **POV mode.** A `PovCamera` follows the chosen agent's group every frame at eye height — 1.55 m standing, 1.1 m sitting, 0.75 m lying in bed — looking along their facing direction. Exiting (button or Esc) restores the exact orbit camera saved on entry.
- **Street life.** Vendors, pedestrians and traffic run on deterministic schedules in `src/street-life.ts` and `src/scene3d/`; agent snack stops and market visits are real idle-route stops, and the meeting dialogue and promoter bubbles are pure functions of `Date.now()` over fixed line sets.
- **UFO state machine** (`src/scene3d/ufo-state.ts`): `arrive → beam → lift → carry → return → drop → leave`. First event 25–45 s after load, then a 75–150 s gap. The victim (a market pedestrian or Ricky the promoter) is lifted to the UFO belly at 12.5 m, carried away and dropped ≥ 8 m from where they were taken, then resumes walking. Only people outdoors are taken — the beam never goes through a roof.
- **Day / night.** The `nightAmount` value lerps at 1.4/s (~2 s fade) and drives lights, fog, sky gradient, emissives and particles together — no instant switch.

## Tech Stack

| Layer | Technology |
|---|---|
| 3D / UI | React 19, Vite 7, React Three Fiber 9, three 0.186, TypeScript 5.9 |
| Server | Node.js ≥ 20, Express 5, TypeScript |
| Data | JSONL ledger (`tasks.jsonl`, `queue.jsonl`, `dispatch.json`) or Hermes CLI |
| Tests | Vitest 3, jsdom |
| CI | GitHub Actions (`npm ci` → lint → test → build) |

## Quick Start

Requires Node.js 20+.

```bash
git clone https://github.com/richkeyricks/agentic-world-3d.git
cd agentic-world-3d
npm install
npm run build      # builds the UI into dist/ and the server into build/server/
npm test           # 275 tests
npm start          # serves the app on http://127.0.0.1:3001
```

Open <http://127.0.0.1:3001> — the public office loads directly; use the **Admin** button (or `?admin=1`) and the access code for the full dashboard.

Development (hot reload, API + Vite dev server):

```bash
npm run dev        # API on 127.0.0.1:3001 + Vite UI (usually http://localhost:5173)
```

Other checks: `npm run lint`, `npm test`, `npm run build`. After pulling new code, run `npm install && npm run build` and restart the server (a running server keeps serving the old build).

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `ISA_LEDGER_DIR` | `~/workspace/mission-control-isa/data` | Directory holding `tasks.jsonl`, `queue.jsonl`, `dispatch.json`. Setting it selects ledger mode. |
| `RUANG_DATA_SOURCE` | auto | `ledger` forces ISA ledger mode; `hermes` forces Hermes CLI mode. |
| `RUANG_PORT` / `--port` | `3001` | Port to listen on. The server always binds `127.0.0.1`. |
| `RUANG_CONFIG_DIR` | `~/.config/ruang` | Where the access-code hash (`access.json`) and profile-lock file live. |
| `RUANG_HERMES_ROOT` | `~/.hermes` | Hermes root, only used in hermes mode. |

Access code (admin): enable it in **Settings → Access code** (or `ruang access-code new` on the machine). Only a scrypt hash is stored; the code itself is never saved or logged. Lost it? `ruang access-code off` removes it, then set a new one.

## Project Structure

```text
.
├── bin/ruang.js            # CLI entry point (start, access-code, profile-lock)
├── server/                 # Express server: ledger, office snapshot, access, viewers
│   ├── ledger.ts           # ISA ledger reader + office state machine
│   ├── index.ts            # HTTP server, routes, public-mode whitelist
│   └── access.ts           # access-code auth (scrypt, HttpOnly cookie, lockout)
├── src/                    # React app
│   ├── pages/              # Office, Office3D, Agents, TaskBoard, Calendar, …
│   ├── scene3d/            # 3D world: office, street life, traffic, UFO, POV
│   ├── office3d-layout.ts  # coordinates, floors, routes
│   └── polling.ts          # polling hooks (office: 10 s)
├── functions/api/          # Cloudflare Pages Function: /api/* proxy + KV fallback
├── public/                 # og-image.png (social preview), static assets
├── docs/                   # GETTING_STARTED.md, FAQ.md, screenshots/
├── assets/                 # banner + social card images (see assets/README.md)
├── RELEASE_NOTES.md        # release notes (v1.0.0)
├── install.sh              # upstream installer (installs yugienugraha/ruang)
└── .github/                # workflows/ (CI + Release), ISSUE_TEMPLATE/, FUNDING.yml
```

## Support This Project — Dukung Proyek Ini

This project is free and open source (MIT). It is built and maintained by **Richkeyrick** in his spare time, and the live demo runs on a server he pays to keep alive. If this office made you smile, taught you something, or you just want it to stay online — a donation, any amount, genuinely helps keep the project (and its creator) going in difficult times. Thank you. 🙏

- ☕ **Saweria (Indonesia):** <https://saweria.co/richkeyrick>
- 💳 **PayPal (worldwide):** <https://www.paypal.com/donate/?business=richkeyrick@gmail.com&currency_code=USD> — or send directly to `richkeyrick@gmail.com`

You can also support for free: ⭐ star this repo, share the live demo, report a bug, or open a pull request.

## Premium Pack — $15 (optional)

The code in this repo is free forever. For those who want a head start, the **Premium Pack ($15)** adds:

- A ready-to-deploy build (prebuilt `dist/` + server) — no build step
- A step-by-step setup guide (local run, Cloudflare Pages deploy, custom domain, access code)
- Priority support — direct help getting your own office live

This is an optional add-on; everything in this repository stays free and open source. While there is no online store yet, the Premium Pack is sold manually via WhatsApp: [order on WhatsApp](https://wa.me/6285260113313?text=Halo%2C%20saya%20mau%20beli%20Premium%20Pack%20AGENTIC%20WORLD%203D%20%28%2415%29) — mention "Premium Pack AGENTIC WORLD 3D ($15)".

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). In short: fork, branch off `main`, run `npm test` and `npm run build`, and open a pull request with a clear description and test notes. Good first issues are labelled `good first issue`.

## Security

Found a vulnerability? See [SECURITY.md](SECURITY.md) — please report it privately by email instead of opening a public issue.

## License

[MIT](LICENSE) © yugienugraha. Contributions are accepted under the same license.

---

© Richkeyrick — <https://www.richkeyrick.com>
