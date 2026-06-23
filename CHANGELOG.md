# Changelog

All notable changes to the OSGi Configurations Manager module are documented in this file.

## [Unreleased]

### Security
- `CryptoEngine.encryptString` now **fails closed**: on a crypto error it throws instead of returning the original (plaintext) value, which previously risked storing a secret unencrypted. The `decrypt` read path degrades gracefully (logs and returns the value unchanged) so a corrupt `ENC(...)` payload does not fail the whole request.

### Changed
- Resolved the SonarQube quality-gate findings (gate now green): extracted duplicated string literals into constants (`comment`, `value`, `rawContent`, `status`), guarded an eagerly-evaluated error log (S2629), gave `CryptoEngine` a private constructor and convention-compliant constant names, and rethrow crypto failures with context (no log-and-throw).
- Refactored `OsgiConfigAction.doExecute` (cognitive complexity 73 → within limits) into focused, behavior-preserving handler methods (`handleGet`/`handlePost` + per-action helpers), with narrowed `throws` clauses (no generic `Exception`). Responses, status codes, audit logging, permission checks and JSON ordering are unchanged.

### Added
- `CryptoEngineTest` (encrypt/decrypt round-trip, per-call IV, fail-closed on malformed payload), bringing the Java test suite to 8.

### Notes
- The hardcoded obfuscation key in `CryptoEngine` is retained intentionally — it mirrors Jahia core's `org.jahia.misc.CryptoEngine` and changing it would break already-encrypted configuration values.
- Cypress E2E was not run in this review environment (no Jahia EE harness/license configured); the changes are backend-only and behavior-preserving — running `tests/` against a Jahia instance is recommended before release.
