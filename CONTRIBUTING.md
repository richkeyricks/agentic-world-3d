# Contributing to AGENTIC AI LIVE SERVER WORLD 3D

Thanks for helping improve the office! This guide is short on purpose — the
full setup lives in the [README](README.md#quick-start).

## Setup

Requires Node.js 20+.

```bash
git clone https://github.com/richkeyricks/agentic-world-3d.git
cd agentic-world-3d
npm install
npm run dev        # API on 127.0.0.1:3001 + Vite UI (usually http://localhost:5173)
```

For a production-like run: `npm run build && npm start`, then open
<http://127.0.0.1:3001>.

## How to contribute

1. **Find or open an issue** describing the change. Check the `good first
   issue` label for starter tasks.
2. **Fork and branch off `main`:** `git checkout -b feat/short-name` (or
   `fix/…`, `docs/…`).
3. **Make the change.** Keep it focused — one thing per PR.
4. **Verify before you push:**
   ```bash
   npm test
   npm run build
   ```
   CI runs exactly these two steps (plus `npm ci`). `npm run lint` is
   useful to run locally, but it currently reports 5 pre-existing errors
   (unused `_board` in `server/ledger.ts`, and two `@ts-ignore` / unused
   `err` in the Cloudflare `functions/` proxy) — do not add new ones, and
   do not “fix” them by editing code outside your change.
   Add or update tests when behaviour changes. The suite is Vitest
   (`npm test`); new pure helpers go with a colocated `*.test.ts`.
5. **Open a pull request** against `main` using the PR template: what it
   does, how to test it, and the checklist. CI runs lint, tests and build
   on every PR.

## Rules of the house

- **Read-only by design.** The server never writes to the ledger or to
  Hermes. Do not add write endpoints, shell commands driven by browser
  input, or file uploads.
- **Do not fake activity.** Agent states come from the ledger / CLI reads.
  Idle means idle — never invent work to make the office look busy.
- **Public view stays public-safe.** Anything shown without an access code
  must contain no secrets, paths, tokens or personal data. Task titles are
  visible in public — never put secrets in them.
- **No secrets in the repo.** No tokens, passwords, keys or `.env` files —
  see `SECURITY.md`. `.gitignore` already excludes them; keep it that way.
- **Keep the fork attribution.** This project is a fork of
  [`yugienugraha/ruang`](https://github.com/yugienugraha/ruang) (MIT) —
  do not remove that credit from the README or LICENSE.
- **Commit style:** short imperative subject (`Add UFO beam colour`,
  `Fix twist direction on mobile`), one logical change per commit.

## Releases

Releases are tag-based: bump the version in `package.json`, then
`npm version <new-version> && git push origin main --follow-tags`. The
Release workflow lints, tests, builds and attaches the package to the
GitHub release.

## Questions?

Open a Discussion in the repository — that is also how `Galaxy Brain`
answers get marked as accepted.
