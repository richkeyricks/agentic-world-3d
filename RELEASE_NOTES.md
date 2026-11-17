# Release Notes

## v1.0.0 — First public release (2026-11-17)

The first public release of **AGENTIC AI LIVE SERVER WORLD 3D** — a live 3D virtual office where 7 AI agents work in real time. This release is the ISA fork of [`yugienugraha/ruang`](https://github.com/yugienugraha/ruang) (Hermes Virtual Office), rebuilt around the ISA task ledger and published as a public, free (MIT) repository.

**Live demo:** <https://agentic-world-3d.pages.dev/> (primary, Cloudflare Pages) · mirror: <https://isa-office.serveousercontent.com/>

### Highlights

- **Living 3D office** — two floors (office + dorm), day/night with a ~2 s transition, fog, gradient sky, dust/firefly particles, animated TV screens, and a waving Merah Putih flag.
- **Indonesian street life** — bakso, cilok, nasi goreng, kopi keliling and ayam penyet carts with named vendors, a beggar, a singing busker, a security guard, road traffic, market visitors and Ricky Market.
- **Ricky the promoter** — a gold-shirted promoter who walks the whole map (around every building, across the road, behind the office) with a `RICHKEYRICK / FOLLOW • SUBSCRIBE` board.
- **UFO + alien** — a procedural UFO that occasionally abducts a pedestrian or Ricky with a blue beam (12.5 m lift, drop ≥ 8 m away).
- **Real work, shown honestly** — agent states (`Idle` / `Working` / `Reviewing` / `Collaborating`) and per-agent progress % are derived from the live `tasks.jsonl` ledger; nothing is faked.
- **Meeting dialogue** — ISA and Richkeyrick AI discuss the task they collaborate on, in 2–3 exchanges generated from the actual task.
- **POV mode** — see the office through any agent's eyes (eye height by pose), exit restores the exact orbit view.
- **Public vs admin** — anyone can watch the public office with no login; the admin dashboard is protected by an access code (scrypt hash, `HttpOnly` cookie, lockout backoff).
- **Live viewer counter** — per-tab, in-memory, 30 s window; no IPs, no cookies, no analytics.
- **Cloudflare Pages hosting** — static SPA on the global CDN; a Pages Function proxies `/api/*` to the live server and serves the last KV-cached snapshot with a `degraded` flag when the upstream is unreachable.

### Under the hood

- React 19 + Vite 7 + React Three Fiber 9 + three 0.186, TypeScript 5.9, Express 5, Node.js ≥ 20.
- 275 tests (Vitest, 34 files) run in CI on every push and PR.
- Read-only by design: the server never writes to the ledger or to Hermes; the only writes are its own access-code and profile-lock files.
- Data sources auto-detected: ISA ledger mode (default here) or upstream `hermes` CLI mode.

### Known limitations

- The Ricky Market interior is hidden by the roof from the default high camera angle; zoom low or use the Pasar preset to see visitors inside.
- Two-finger twist direction on touch devices is reasoned from geometry, not yet confirmed on a physical phone — if it feels reversed, it is a one-line fix.
- Admin pages (Agents % bar, header viewer chip, admin POV) are covered by unit tests and the shared components, but were not all verified in a live admin browser session.
- The first 3D load on the Serveo mirror can take a few seconds (free-tunnel bandwidth); the Cloudflare demo does not have this problem.
- The live demo still depends on the VM + tunnel staying up for fresh data; if they go down, the Cloudflare demo shows the last cached snapshot (marked `degraded`) instead of live data.

### Upgrading

Fresh clone: follow [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md). No migration is needed — v1.0.0 is the first public release and there is no earlier released version to upgrade from.
