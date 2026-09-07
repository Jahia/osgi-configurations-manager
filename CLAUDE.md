# CLAUDE.md

Project guidance for Claude Code and other AI agents.

## Where things are documented

- **What the module does, and how to build, test and deploy it**: [README.md](README.md)
- **How to run the Cypress E2E suite**, including the Docker and local-node paths:
  [tests/README.md](tests/README.md)
- **What changed and why**: [CHANGELOG.md](CHANGELOG.md)
- **Reporting a vulnerability**: [SECURITY.md](SECURITY.md) — a reporting policy only; it does not
  describe the module's security model, which lives in the invariants below and in the code comments
  they point to.

## Invariants — do not weaken these without reading why they exist

Each of these closed a real defect. The code carries a comment at each site explaining the case; if
a change appears to require relaxing one, that comment is the thing to read first.

- **Encryption fails closed.** `CryptoEngine.encryptString` throws rather than returning its input,
  because returning the input on error meant persisting a secret in clear.
- **Decryption degrades on read, but only in the service.** `OsgiConfigService.decrypt` hands the
  value back untouched when it cannot be decrypted, so a config copied from another instance does not
  turn a page load into a 500. `CryptoEngine.decryptString` itself still throws — the leniency is
  deliberately confined to the read path.
- **Decryption is bound to the file the value comes from.** `decryptForFile` walks the same
  authorization path as `readFile` and additionally requires the value to occur in that file's raw
  content, so the endpoint cannot be used as an oracle for a value the caller may not read.
- **Filter matching is case-insensitive**, for exact names and `*` wildcards alike. Both halves must
  agree; when only exact names were case-insensitive, wildcard rules were bypassable.
- **Visual ↔ raw round-trips must preserve `_order`.** The visual `.cfg` editor reserializes through
  the raw representation, so dropping the recorded key order reorders or loses the user's lines on
  save.
- **Saves are guarded**: content must be present, and raw content is capped at 5 MiB.
- **`ConfigFileFilter` publishes one immutable snapshot behind a `volatile` reference.** This
  guarantees consistency *within* a single `isFilenameAllowed` call. Two successive calls may
  legitimately see different configurations — that is by design, and a test asserting otherwise fails
  against the correct implementation.

## What a green build does not prove

Three checks pass on code that is broken in the browser, and each cost real time to learn:

- **`ci.yml` never starts Cypress.** It runs Jest and `mvn verify`. A change touching `tests/`
  or the compiled bundle can show a green tick and be completely broken. The e2e workflow is the
  only check that means anything there: `gh workflow run e2e.yml --ref <branch>`.
- **The bundle can fail only at runtime.** Babel 8's automatic JSX runtime compiled imports of
  `react/jsx-runtime`, which Jahia's app-shell does not share, so the build succeeded and the app
  died on first render. React version was irrelevant — the subpath is simply not shared.
  `babel.config.js` pins `runtime: 'classic'` and `babel-config.test.js` guards it.
- **A long e2e run means failures, not a hang.** This suite takes ~10 minutes. Failures cost
  retries, screenshots and videos, so a broken run stretches to 20-45. Do not read 20 minutes as
  "stuck"; read it as "specs are failing".

Related trap: **a config change with no effect usually means a second config is winning.** The
webpack rule used to declare inline `babel-loader` options that shadowed `babel.config.js`
entirely. When an edit provably changes nothing, compare the built artefact against `main` before
theorising — `unzip -p <jar> <chunk>` settled it in one command.

## Mutating requests

State-changing POSTs must carry both an `X-Requested-With` header (any value) and an
`application/json` content type. A missing header is a 403, a wrong media type a 415. Both are CSRF
defences; keep them on any new mutating endpoint.

## Code navigation

This repo has a CodeGraph index (`.codegraph/`); follow the CodeGraph rules in `~/.claude/CLAUDE.md`
(run `codegraph sync` first, query via the MCP tools, and spawn an Explore agent for broad
exploration rather than dumping source into the main session).
