# Security Policy

## Reporting a vulnerability

**Do not open a public issue for a security problem.** Please report it
privately by email:

- **richkeyrick@gmail.com**

Include a description of the issue, steps to reproduce it, and the impact
you expect. You will get a reply once the report has been reviewed. Please
give the maintainers a chance to fix it before disclosing it publicly.

## What is protected here

- **Admin access** is guarded by an access code (scrypt hash only; the code
  itself is never stored or logged), an `HttpOnly`, `SameSite=Strict`
  session cookie, and a lockout backoff after 5 wrong attempts. The server
  binds `127.0.0.1` only — it is not directly reachable from the internet.
- **Public mode** exposes only `GET /api/office` and `GET /api/access`:
  agent names, positions, work states, task titles and the viewer count.
  It must never contain secrets, file paths, tokens or personal data.
- **The server is read-only by design**: it never writes to the task
  ledger or to Hermes, runs no shell command from browser input, and has
  no file-upload or command-execution endpoint. The only writes are its
  own optional access-code and profile-lock files.
- **Secrets do not belong in this repository.** No tokens, passwords, API
  keys or `.env` files — `.gitignore` excludes them. If you find one
  committed by accident, report it the same way as a vulnerability.

## Supported versions

Only the latest release on `main` receives security fixes. If you run an
older release, please update first and check whether the issue still
reproduces.
