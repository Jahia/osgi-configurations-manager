# Changelog

All notable changes to the OSGi Configurations Manager module are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

This entry covers the full-review and hardening campaign. Every item below is on `main`; the
pull-request numbers are the merged changes that carry them.

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
