# Changelog

All notable changes to the OSGi Configurations Manager module are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **`cryptoSecret` is applied before the first value is decrypted.** `OsgiConfigService`, which reads
  it, was a delayed component: it activated only when the admin screen was used. Until then, after a
  restart or on a cluster node nobody browsed, the ConfigurationPlugin decrypted with the node's
  generated secret and every value encrypted with `cryptoSecret` was delivered as stored
  (`[AUDIT] Could not decrypt property ...`), so the consumers' connections failed on that node only.
  The service is now immediate and the plugin holds a mandatory reference to it, so it registers
  only once the secret is in place.
- **Configurations delivered before the plugin existed are delivered again through it.** A consumer
  that starts before this bundle receives its `ENC(...)` values as stored, and Configuration Admin
  never re-delivers them when the plugin appears. It is the usual order, not a race: after an update
  of this module Felix restarts its dependents in bundle id order, and a consumer installed earlier
  starts first; the same at every server restart. The consumer then used the envelope as its
  password, with no decryption error in the log. Once the plugin is registered, every configuration
  holding an envelope (the manager's own excepted) is re-delivered with `Configuration.update()`,
  which changes neither the file nor the cluster copy.

## [1.1.0] - 2026-09-23

### Added

- **Consumers receive decrypted values without any crypto code.** The module now registers an
  OSGi `ConfigurationPlugin` (`EncryptedValuesConfigurationPlugin`) that Configuration Admin
  consults before delivering a configuration to its component, and that replaces every `ENC(...)`
  string (or string-array element) by its plaintext in the delivered copy. The file on disk is not
  modified. A value that cannot be decrypted is delivered as stored and an `[AUDIT]` error names the
  PID and the key, so a component still starts and the log says why its secret is unusable. The
  manager's own configuration is never processed. Consumers declare
  `Jahia-Depends: osgi-configurations-manager` and receive their configuration through Declarative
  Services; the README section *Consuming encrypted values from your module* replaces the previous
  `decryptIfNeeded` recipe, which keeps working.
- **A decryption probe** under the PID `org.jahia.modules.osgiconfigmanager.probe`
  (`ConfigurationPolicy.REQUIRE`) and a `pluginProbe` GraphQL query (under `osgiConfigManager`)
  that reports, key by key, whether the probe received `plaintext` or an `encrypted` envelope. Values are never returned. It exists so
  an operator can prove on a given instance that the plugin applies to DS components.
- **Metatype `Password` attributes are treated as secrets.** A `.cfg` created from a PID carries a
  hint line next to each Password attribute, and the visual editor's property picker inserts such a
  property with encryption already enabled, so the value typed next is written as `ENC(...)` on save
  unless the user unticks the box.

### Changed

- **The module's API moved from the `osgiConfigManager.do` Action to GraphQL.** The admin app now
  calls `/modules/graphql`, under one namespace, `Query.osgiConfigManager` and
  `Mutation.osgiConfigManager`, with every former action nested under it (see "Calling the API
  directly" in the README). The Action's request path was the one SEC-138 went through: a valid
  `form-token` made Render promote it to a system action on a system session.
- **Access is decided once, in the namespace field, on the caller's own session.** Guest and system
  sessions are refused; `canManageOsgiConfigurations` on `/` and `admin` on `/sites/systemsite`,
  the Action's two requirements, are both kept.
- **Mutations keep their CSRF defences.** `/modules/graphql` is not CSRF-safe on its own, so a
  mutation without `X-Requested-With`, or whose parsed media type is not `application/json`, is
  refused before anything is read or written.
- **Errors carry a code instead of an HTTP status.** They come back as HTTP 200 with
  `errors[0].extensions.code` set to `NOT_FOUND`, `CONFLICT`, `FORBIDDEN`, `BAD_REQUEST`,
  `UNSUPPORTED_MEDIA_TYPE` or `INTERNAL`. Messages are still stripped of server paths.
- The module now depends on `graphql-dxm-provider`, which every Jahia 8.2 ships, and ships a
  security-filter scope, `karaf/etc/org.jahia.bundles.api.authorization-osgi-configurations-manager.yml`.
  Jahia denies every API no scope grants, so this grants the `osgiConfigManager` namespace and the
  module's own types, and nothing else, to privileged users on same-origin requests. The module's
  own permission checks still apply on top of it.

### Removed

- **`/cms/render/*/sites/systemsite.osgiConfigManager.do`**, together with the CSRFGuard whitelist
  (`org.jahia.modules.jahiacsrfguard-osgi-configurations-manager.cfg`) that exempted it.

  **Am I impacted?** Only if you call that URL yourself: a script, a CI job or another module. The
  admin UI is updated with the module and needs nothing. If you do, move each call to the
  corresponding field and check `errors[0].extensions.code` instead of the HTTP status:

  | Old request | GraphQL |
  |---|---|
  | `GET …do` / `?search=` | `query { osgiConfigManager { files(search:) { … } uiConfig { … } } }` |
  | `GET …do?filename=` | `file(name:)` |
  | `GET …do?action=availableMetatypes` | `availableMetatypes` |
  | `GET …do?action=getPreference&key=` | `preference(key:)` |
  | `GET …do?action=pluginProbe` | `pluginProbe` (a JSON string) |
  | `POST {action: save / toggle / delete / markAsDefault / create, filename}` | `mutation { osgiConfigManager { save(name:, rawContent:) … } }` |
  | `POST {action: createFromMetatype, pid, instanceIdentifier}` | `createFromMetatype(pid:, instanceIdentifier:)` |
  | `POST {action: encrypt / decrypt, value, filename}` | `encrypt(value:)`, `decrypt(name:, value:)` |
  | `POST {action: setPreference, key, value}` | `setPreference(key:, value:)` |

  Keep sending `X-Requested-With` and `Content-Type: application/json` on mutations. A deployed
  `karaf/etc/org.jahia.modules.jahiacsrfguard-osgi-configurations-manager.cfg` left over from an
  earlier version is harmless (the URL it whitelists no longer exists) and can be deleted.

### Fixed

- **The manager's own `cryptoSecret` can no longer be encrypted.** It is declared as Password so
  the editor masks it, and the Password default of this release would have inserted it with
  *Encrypted* ticked; stored as `ENC(...)`, the literal envelope silently became the passphrase
  (the plugin skips the manager's PID on purpose), so every later value was encrypted with a key
  nobody chose and the envelope itself was unreadable. The picker now inserts `cryptoSecret` in
  clear text, the generated template says why, a save of `org.jahia.modules.osgiconfigmanager.cfg`
  carrying `cryptoSecret = ENC(...)` is refused before anything touches the disk, and a value that
  reaches the file anyway is ignored with an `[AUDIT]` error in favour of the generated
  per-instance secret.
- **A secret survives the raw/visual round trip.** Switching a `.cfg` to raw mode re-encrypted every
  in-memory plaintext, and a fresh IV made the resulting `ENC(...)` differ from the one on disk.
  Since 1.0.5 decryption is bound to the file the value comes from, so switching back to visual
  mode could not decrypt that new ciphertext and the eye button showed the stored envelope instead
  of the secret (the server logged `Encrypted value does not belong to <file>`). A decrypted leaf
  now keeps the ciphertext it came from and writes it back unchanged while its plaintext is
  unchanged, and the page remembers every ciphertext/plaintext pair it has produced, so a value
  encrypted in the visual editor and not saved yet, or produced by the raw editor's *Encrypt*
  button, stays readable across mode switches and through the raw editor's *Decrypt* button
  without a server round trip. Both buttons now say when they do nothing: no `ENC(...)` on the
  current line, or a value the server refuses or cannot decrypt. Loading a file or switching to
  visual mode warns how many values stayed encrypted (not in the saved file, or encrypted with
  another secret) instead of silently showing their envelope.
### Fixed (development)

- **`jest --coverage` ran again.** The global `minimatch` 3.1.4 resolution was forced onto consumers
  that need 9.x/10.x, so every suite failed under coverage. It is now pinned per consumer, each on a
  patched release of its own major.
- `coverage/` is no longer tracked, and the Cypress project lints clean.

## [1.0.6] - 2026-09-22

### Security

- **The action refuses to run on a system session or for the guest user (SEC-138).** A request
  carrying a valid Jahia `form-token` is promoted to a system action, which skips the action's
  declared requirements (authenticated user, `admin` permission) and passes it a system JCR session.
  On that session the `canManageOsgiConfigurations` check always succeeds. So an anonymous caller
  could get past every authorization gate, and 1.0.5's Content-Type and `X-Requested-With` checks
  did not help, because the attacker sets those headers itself. The action now answers 403, with an
  `[AUDIT] Rejected osgiConfigManager …` line, whenever its session is a system session or the caller
  is `guest`. It does this before reading or writing anything, for GET and POST alike.

  **Am I impacted by the change?** Only if something calls `*.osgiConfigManager.do` with a
  `form-token`, or anonymously. The admin UI does neither, and no upgrade step is needed.

### Documentation

- **Cluster note**: the generated secret file is node-local while `.cfg` files are replicated, so
  `cryptoSecret` must be set in the manager's configuration before the first value is encrypted on a
  cluster.

- **The `.cfg` multiline rules are documented** in a new README section. 1.0.5 made the visual
  editor write valid continuations, but nothing told a reader what it writes or why — which
  matters because raw mode applies none of it. The section covers the trailing `\`, the
  alignment, the `\#` / `\!` escaping that keeps Karaf from dropping a line, and the fact that a
  continued line is read back joined by a single space rather than as several lines.

## [1.0.5] - 2026-09-07

This entry covers the full-review and hardening campaign, plus the multiline `.cfg` fixes that came
out of running it on a live instance. The pull-request numbers are the merged changes that carry
each item.

### Security

- **Fail-closed encryption.** `CryptoEngine.encryptString` throws on a crypto error instead of
  returning its input, which previously risked persisting a secret in clear. The `decrypt` read path
  degrades gracefully — it logs and hands the value back untouched — so a value encrypted on another
  instance (a config copied between environments) no longer turns the whole request into a 500.
- **Decryption bound to its file** (#90). `decrypt` used to accept any ciphertext from any caller.
  `decryptForFile` now walks the same authorization path as `readFile` and additionally requires the
  value to actually occur in that file's raw content, so a permitted user cannot use the endpoint as
  an oracle for a value they cannot read.
- **Preference keys restricted to an allowlist** (#88). The stored-preference endpoint validated key
  names by shape (a regex), which admitted unintended keys. `PreferenceKeys.isAllowed` replaces it
  with an explicit list.
- **CSRF: `X-Requested-With` required on every mutating POST** (#93). Complements the existing
  `application/json` media-type requirement as defence in depth.
- **Filename filtering hardened** (#97). Blacklist matching is case-insensitive, so a blacklisted
  name cannot be slipped through by changing its case.
- Zero open Dependabot alerts, down from 13 at the start of the campaign.

### Fixed

- **A multiline value written from the visual `.cfg` editor is no longer destroyed** (#115). The
  editor deliberately allows newlines in a value, but the value was serialized verbatim — which a
  `.cfg` cannot express. The continued line, having no `=` separator, was read back as a comment and
  the next save prefixed it with `# `, silently losing the tail of the value. Every continued line
  now carries its trailing `\`.
- **Continued lines are lined up under the start of the value** (#115), and the separator is written
  as `name = value` whatever the file used. The visual editor has no "format" button, so saving is
  the only moment this layout can be applied. It is cosmetic: a properties reader discards a
  continuation line's leading whitespace.
- **A `#` opening a continued line is escaped** (#115). Karaf reads a `.cfg` with
  `org.apache.felix.utils.properties`, which treats `#` or `!` as a comment marker whenever it is
  the first non-whitespace character of a line — including mid-continuation — and discards that
  whole line. Indenting does not protect it; escaping does. Note this differs from
  `java.util.Properties`, which keeps the line in every such case.
- **Wildcard filter patterns are matched case-insensitively** (#104), closing the other half of the
  SUPPORT-646 bypass: exact names were already case-insensitive, so `filteredFiles = org.apache.*`
  still let `ORG.APACHE.felix.cfg` through on a case-insensitive filesystem.

### Added

- **Cypress end-to-end suite** (#38, #76, #83, #87, #91) — 18 spec files, 42 cases, covering the app shell, the
  configuration lifecycle, both editors, authorization, path traversal, the encryption round-trip,
  download, deep search, mark-as-default, YAML validation, CFG property operations and the
  diff-cancel path. The suite was never run before this campaign; it is now green end to end.
- **A CI workflow** (#35, #79) running Jest and `mvn verify` on JDK 17, and a **weekly e2e workflow**
  (#83, #94, #96) running the Cypress suite against the public `jahia/jahia-ee` image.
- **Review-before-save diff modal** — saving shows the raw diff and requires confirmation.
- **Keyboard-accessible CFG row reordering** (#84) and **accessible modal dialogs** (#89).
- **Typed HTTP outcomes** (#100): not-found, conflict and access-denied map to 404, 409 and 403
  instead of collapsing into a generic 500.
- **Java and frontend test suites** (#87, #91, #99) — 144 Java tests and 106 Jest tests, up from 8.
  #99 closed two real gaps the salvaged tests exposed: a missing null-content guard and a missing
  raw-content size limit on save.

### Changed

- **`OsgiConfigAction.doExecute` decomposed** (#40) from 228 lines (cognitive complexity 73) into
  named per-action handlers, clearing the SonarQube quality gate. Responses, status codes, audit
  logging, permission checks and JSON ordering are unchanged.
- **`OsgiConfigService` split by responsibility** — `UserPreferenceService` (#95),
  `ConfigFileFilter` (#97) and `ConfigFileCodec` (#98) — taking the class from 1580 to 1380 lines.
  `ConfigFileFilter` also replaced five mutable, non-volatile fields with one immutable snapshot
  published behind `volatile`, so a single filtering call can no longer observe a half-applied
  configuration change.
- **Crypto tree traversal unified** (#92). Four duplicated recursions had diverged — two of them
  swallowed errors and one dropped `_order` — and are now one `cryptoTree` module.
- **File-level actions extracted** into `useFileActions` (#101), taking `useOsgiConfigs` from 916 to
  683 lines. The unsaved-changes guarding stays in `index.jsx`, which wraps these handlers.
- **Build moved to JDK 17** (#79) with Java 11 still the target, unblocking two dependency bumps
  (#80), and the frontend moved to TypeScript 6 (#81).
- **Licensing reconciled on MIT.** `pom.xml` carried Jahia's dual GPL/JSEL header, inherited from
  the module archetype, while `LICENSE` and the README declared MIT — and no pom in the chain
  declared a licence at all, so consumers had no machine-readable answer. MIT is authoritative: the
  header is aligned, `<licenses>` now declares MIT, and `tests/package.json` no longer points at a
  `LICENSE.txt` that does not exist. A test asserts all five declarations agree.
- **Dependabot reconfigured** (#35, #60, #75) onto the four real ecosystems, with minor/patch and
  major grouped separately per ecosystem so lockfile rewrites stop invalidating each other.

### Notes

- `monaco-editor` is deliberately held at the 0.52 line (#60). Version 0.53 dropped
  `./esm/vs/editor/editor.worker.js` from its exports map, but `monaco-worker-manager` — pulled in by
  `monaco-yaml`, whose latest release has not adapted — still imports that exact path, so the webpack
  build fails. Remove the `ignore` entry in `.github/dependabot.yml` once `monaco-yaml` catches up.
- The hardcoded obfuscation key in `CryptoEngine` is retained intentionally: it mirrors Jahia core's
  `org.jahia.misc.CryptoEngine`, and changing it would break already-encrypted configuration values.
- `ConfigFileFilter`'s snapshot guarantees consistency *within* a single filtering call. Two
  successive calls may legitimately observe different configurations; that is by design, not a race.
