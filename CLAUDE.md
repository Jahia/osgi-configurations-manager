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

- **Access is decided once, in the GraphQL namespace field, on the caller's own session.**
  `OsgiConfigGqlSupport.authorize` refuses guest and any system session (on which `hasPermission` is
  always true: that is how SEC-138 bypassed the old `.do` Action), then requires
  `canManageOsgiConfigurations` on `/` **and** `admin` on `/sites/systemsite`, the Action's two
  requirements. The containers behind `Query.osgiConfigManager` / `Mutation.osgiConfigManager` trust
  the `GqlCaller` they are given, so a new operation must be added *under* a namespace, never as a
  root field or a separate endpoint.
- **Only `OsgiConfigGqlException` reaches the client.** The provider renders any other exception
  with its raw message, which here means absolute server paths, so every failure goes through
  `OsgiConfigGqlSupport.translate`.
- **Encryption fails closed.** `CryptoEngine.encryptBound` throws rather than returning its input,
  because returning the input on error meant persisting a secret in clear.
- **Every encrypted value is bound to its configuration (SEC-603).** A v3 envelope carries
  `EnvelopeBinding` (the file name without extension, `.disabled` or case) as AES-GCM additional
  authenticated data, and both decryption paths check it: `decryptForFile` with the named file, the
  ConfigurationPlugin with the delivered configuration's `felix.fileinstall.filename`. Without it, a
  value copied into a file the caller may write was decrypted there, by the operation or into a
  component that sends it out. Never add an encrypt or decrypt path that skips the binding.
- **Unbound values are refused once the instance migrated.** `EnvelopeMigration` binds the v2 and
  legacy values once, then writes `.osgi-config-manager.envelopes`; from then on `CryptoEngine`
  refuses unbound values. Re-running the migration later would bind a value planted after it, so it
  runs only while the marker is absent.
- **Decryption degrades on read, but only in the service.** `OsgiConfigService.decryptForFile` hands the
  value back untouched when it cannot be decrypted, so a config copied from another instance does not
  turn a page load into a 500. `CryptoEngine.decryptBound` itself still throws — the leniency is
  deliberately confined to the read path.
- **Decryption is bound to the file the value comes from.** `decryptForFile` walks the same
  authorization path as `readFile` and additionally requires the value to occur in that file's raw
  content, so the endpoint cannot be used as an oracle for a value the caller may not read.
- **Filter matching is case-insensitive**, for exact names and `*` wildcards alike. Both halves must
  agree; when only exact names were case-insensitive, wildcard rules were bypassable.
- **A filename guard compares the configuration, not one spelling of its file (SEC-525, SEC-602).**
  Karaf applies `<pid>.cfg`, `<pid>.yml`, their `.disabled` copies, any case and the factory forms
  `<pid>-*` / `<pid>~*` to the same PID. The manager's own configuration and every blacklist entry go
  through `ConfigFileFilter.isConfigurationFileOf`; comparing a literal file name reopened the bypass
  twice. The whitelist stays exact on purpose: widening it grants access.
- **Visual ↔ raw round-trips must preserve `_order`.** The visual `.cfg` editor reserializes through
  the raw representation, so dropping the recorded key order reorders or loses the user's lines on
  save.
- **Saves are guarded**: content must be present, and raw content is capped at 5 MiB.
- **The `ConfigurationPlugin` delivers an undecryptable value as stored and never processes the
  manager's own PID.** Removing the key would disguise a wrong secret as a missing setting, and the
  manager's configuration carries the secret everything else is decrypted with. It modifies only the
  delivered copy, never the file.
- **Configurations holding `ENC(...)` are delivered again at the manager's start.** Consumers start
  before the manager after its update and at every restart, and receive raw values. Only a real
  update makes SCR fetch a configuration again (`update()` without arguments and a component restart
  both reuse what it holds), so `EncryptedConfigurationsRedelivery` writes each one back with its own
  stored properties, and skips one whose change count moved meanwhile, to not revert a newer update.
- **Every view that displays the values of a file masks its secrets through `utils/secretMask`.**
  The visual editor, the raw editor and the review-before-save diff share one rule (Password in the
  Metatype, or a secret-looking name on a text attribute) and one parser, so a value masked in one
  view is masked in the others: before it, the raw editor and the diff showed in clear what the
  visual editor masked. A new view of file content uses the same module, and masking never changes
  the text that is saved.
- **The decryption probe reports shapes, never values.** The `pluginProbe` query says `plaintext` or
  `encrypted` per key; echoing a value would turn the probe into a decryption oracle.
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

The API is `/modules/graphql`, which is **not CSRF-safe on its own**: the servlet will parse the JSON
inside a `text/plain` body, a type a cross-site form can send without a preflight. So the mutation
namespace refuses, before touching the repository, any request without an `X-Requested-With` header
(`FORBIDDEN`) or whose *parsed* media type is not `application/json` (`UNSUPPORTED_MEDIA_TYPE`).
`text/plain;application/json` is text/plain. Both are CSRF defences; keep them on any new mutation.
Errors come back as HTTP 200 with the outcome in `errors[0].extensions.code`, not as a status code.

## Code navigation

This repo has a CodeGraph index (`.codegraph/`); follow the CodeGraph rules in `~/.claude/CLAUDE.md`
(run `codegraph sync` first, query via the MCP tools, and spawn an Explore agent for broad
exploration rather than dumping source into the main session).
