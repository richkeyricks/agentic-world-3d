# Getting Started

Get your own **AGENTIC AI LIVE SERVER WORLD 3D** office running in a few minutes.

**Just want to watch?** Open the live demo — no install, no login for the public view:

- Primary: <https://agentic-world-3d.pages.dev/>
- Mirror: <https://isa-office.serveousercontent.com/>

## Prerequisites

- **Node.js 20+** (`node --version` — the server and the build both need it)
- `npm` (ships with Node.js)
- A browser with WebGL for the 3D view (any modern desktop or mobile browser; a 2D fallback is included for browsers without WebGL)

## Run it locally

```bash
git clone https://github.com/richkeyricks/agentic-world-3d.git
cd agentic-world-3d
npm install
npm run build      # builds the UI into dist/ and the server into build/server/
npm test           # 275 tests — make sure everything is green first
npm start          # serves the app on http://127.0.0.1:3001
```

Open <http://127.0.0.1:3001> — the public office loads directly. For the admin dashboard, use the **Admin** button (or add `?admin=1` to the URL) and enter the access code.

Development mode (hot reload — API on `127.0.0.1:3001`, Vite UI usually on `http://localhost:5173`):

```bash
npm run dev
```

Other commands: `npm run lint`, `npm test`, `npm run build`. After pulling new code, run `npm install && npm run build` and restart the server — a running server keeps serving the old build.

## Use your own task ledger

By default the server looks for the ISA ledger at `~/workspace/mission-control-isa/data` (`tasks.jsonl`, `queue.jsonl`, `dispatch.json`). Point it somewhere else:

```bash
ISA_LEDGER_DIR=/path/to/your/ledger npm start
```

Ledger event format — one JSON object per line in `tasks.jsonl`:

```json
{"ts": "2026-11-17T10:25:00+07:00", "task_id": "my-first-task", "agent": "isa", "title": "My first task", "status": "progress", "estimated_minutes": 45}
```

Statuses: `created`, `queued`, `started`, `progress`, `review`, `blocked`, `done`, `failed`, `cancelled`. Add `estimated_minutes` to a task to get the live progress bar (elapsed ÷ estimate, capped at 99% until `done`).

No ledger and no Hermes CLI? The office still starts; pages whose source is unavailable render *Not Available* instead of invented data. With the `hermes` CLI installed, set `RUANG_DATA_SOURCE=hermes` to use the upstream Hermes data source instead.

## Set the access code (admin)

The admin dashboard is protected by an access code. Enable it in **Settings → Access code**, or on the machine:

```bash
node bin/ruang.js access-code new    # prints a fresh random code once
node bin/ruang.js access-code off    # removes the code again
```

Only a scrypt hash is stored (in `~/.config/ruang/access.json`); the code itself is never saved or logged. Lost it? Run `access-code off`, then set a new one. After 5 wrong attempts the login locks out with a backoff — this is by design.

## Deploy it publicly (Cloudflare Pages)

The live demo runs on Cloudflare Pages (free tier):

1. `npm run build` — this produces `dist/` (the static site).
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Direct Uploads**, upload `dist/` **and** the `functions/` folder (the Pages Function proxies `/api/*` to your live server).
   - Or with Wrangler: `npx wrangler pages deploy dist --project-name agentic-world-3d`
3. Your server must be reachable from the internet for live data — the demo server here is exposed through a Serveo tunnel (`https://isa-office.serveousercontent.com`). If you self-host, edit the `UPSTREAM` constant in `functions/api/[[route]].ts` to point at your own tunnel/VPS, then redeploy.
4. (Optional, recommended) In the Pages project settings, bind a **KV namespace as `SNAPSHOT_KV`** — the Function caches the last `/api/office` snapshot there and serves it with a `degraded` flag when your server is unreachable, instead of showing an error.
5. (Optional) Add a custom domain under **Pages → your project → Custom domains** (add the matching `CNAME` at your DNS provider first).

Without a reachable server, the deployed site still loads — only the live data falls back to the last cached snapshot (or an error if none was ever cached).

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `EADDRINUSE` on start | Something already listens on port 3001 — stop it, or set `RUANG_PORT` / `--port` to another port. |
| Page loads but 3D says "Loading…" for a long time | The 1 MB 3D chunk is still downloading (slow on a free tunnel). Wait, or use the Cloudflare demo. |
| 3D never renders / black canvas | WebGL is unavailable in that browser — use the **2D** toggle, or try another browser. |
| Admin pages say *Not Available* | The data source for that page isn't reachable (no ledger / no Hermes CLI). Check `ISA_LEDGER_DIR` and the server log. |
| `npm test` fails after pulling | Run `npm install` first — dependencies may have changed. |
| Access code rejected | Codes are case-sensitive and use no `0`/`O`/`1`/`I`. After 5 wrong tries, wait out the lockout, or reset with `access-code off` + `new`. |
