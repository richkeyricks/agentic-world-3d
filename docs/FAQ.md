# Frequently Asked Questions

## Is this real, or just an animation?

Real. Every agent's `Working` / `Idle` state and every progress bar is derived from a live task ledger (`tasks.jsonl`) that the server reads — an agent with no task honestly shows `Idle`, never fake-busy. The walking, snacking, traffic and UFO are how the office *visualises* those states; they run on deterministic schedules in the code, not on random decoration. If the ledger is unreachable, pages say *Not Available* instead of inventing data.

## Do I need an account or login to watch?

No. Open the live demo and the public office loads directly — no account, no login, no tracking cookies. A login (access code) is only needed for the admin dashboard.

## What can the public see?

Agent names, roles and states, the titles of tasks being worked on, the meeting dialogue, and how many tabs are watching. **Task titles are public** — never put passwords, keys or other secrets in a task title.

## What is the access code?

The password for the admin dashboard (Tasks, Calendar, Logs, Settings, Usage, Memory, Folders). Only a scrypt hash is stored on the server; the code itself is never saved or logged. Sessions last 12 hours (7 days with "remember this device"), and 5 wrong attempts trigger a lockout backoff.

## Can I run it without the ISA ledger?

Yes. The data source is auto-detected: ISA ledger mode when `ISA_LEDGER_DIR` (or the default path) exists, otherwise the upstream `hermes` CLI mode when Hermes is installed. With neither, the office still starts and pages without a source render *Not Available*.

## Why does the 3D take a while to load the first time?

The 3D chunk is about 1 MB. On the Cloudflare demo it loads in about a second; on the Serveo tunnel mirror it can take a few seconds because free tunnels throttle bandwidth. After the first load it is cached by the browser.

## Does it work on mobile?

Yes. Rotate buttons (tap for 15°, hold to spin), two-finger twist to rotate, camera presets, and the POV chips under the screen all work on touch. If WebGL is unavailable, use the 2D toggle.

## What does the viewer counter track?

Almost nothing. Each tab generates a random id (`crypto.randomUUID()`, kept in `sessionStorage`) and sends it with every poll; the server counts ids seen in the last 30 seconds, in memory only. No IPs, no cookies, no analytics, nothing stored to disk. A background tab drops out after ~30 seconds.

## How does the progress % work?

Tasks with `estimated_minutes` show `elapsed ÷ estimate`, rounded and capped at 99% while running — 100% appears only when the `done` event actually arrives. Re-opening a finished task restarts its clock. Tasks without an estimate show no bar at all; progress is never invented.

## Why is there a UFO?

Because the project's owner asked for one. A procedural UFO occasionally hovers over the street, lowers a blue beam and abducts a pedestrian (or Ricky the promoter): lift to 12.5 m, carry away, drop ≥ 8 m from the pickup point — then the victim just keeps walking. Only people outdoors are taken; the beam never goes through a roof.

## What happens if the server or tunnel goes down?

The Cloudflare demo keeps serving the **last cached snapshot** (marked `degraded`) from KV instead of going blank. Live data resumes automatically when the server is back. The server itself is kept alive by a watchdog that restarts it and its tunnels.

## How do I change the agent roster?

The roster lives in `server/ledger.ts` (id, name, role, colour per agent). Edit it, run `npm run build`, restart the server. The dorm beds, labels and POV chips follow the roster automatically.

## How do I deploy my own copy?

See [GETTING_STARTED.md](GETTING_STARTED.md) — build with `npm run build`, deploy `dist/` + `functions/` to Cloudflare Pages, and point the Pages Function at a server you expose (tunnel or VPS).

## What license is this?

[MIT](LICENSE) — a fork of [`yugienugraha/ruang`](https://github.com/yugienugraha/ruang) (Hermes Virtual Office). You can use, modify and share it freely; keep the license and the fork attribution.

## How can I support the project?

- ⭐ Star the repo and share the live demo.
- ☕ Donate via [Saweria](https://saweria.co/richkeyrick) or [PayPal](https://www.paypal.com/donate/?business=richkeyrick@gmail.com&currency_code=USD) (`richkeyrick@gmail.com`) — see [Support This Project](../README.md#support-this-project--dukung-proyek-ini) in the README.
- 🐛 Report a bug or open a pull request — see [CONTRIBUTING.md](../CONTRIBUTING.md).
