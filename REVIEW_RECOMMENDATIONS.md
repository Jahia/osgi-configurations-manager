# Review Recommendations

Tracking for the multi-dimension blind re-review of `osgi-configurations-manager` (branch
`full-review`). The bulk of the recommendations have now been **implemented**; this file records
what was done and the few items intentionally left as tracked follow-ups.

## Status snapshot (after implementation)

| Dimension | Grade | Notes |
|---|---|---|
| Architecture | B+ | Thin-router dispatch; search + preferences moved to services; crypto tree-walk deduped; `ConfigFileFilter` + `ConfigFileCodec` extracted; typed HTTP errors. Metatype introspection still in the service (see below). |
| Security | A− | Fail-closed encryption key; POST + read size caps; `.bak` cleanup on toggle; deep-search DoS guards; legacy-decrypt WARN; CSRF + file-bound decrypt retained. |
| Code quality (SonarQube + lint) | A− | JaCoCo gate wired (ratchet); ESLint config + `lint` script added; S2629 / `endsWith` / `Locale.ROOT` fixed. |
| Ergonomy / UX | A | full i18n parity across all 6 locales; review-before-save; `beforeunload` guard; crypto-failure toasts; reserialization warning. |
| Accessibility (WCAG 2.2 AAA) | B+ | Single landmark; dialog focus fallback; keyboard edit path; `<h2>` heading; always-mounted live region; field labels; focus-accessible overflow text; option/listbox roles; AAA-contrast diff + status bar; reduced-motion. |
| Test coverage | B− | Java 79 / Jest 82 green; coverage **measured + gated** (JaCoCo ≥0.42, jest 33/20/27/31, ratcheting). |
| Documentation | A | README/SECURITY/ARCHITECTURE updated (fail-closed key, gotchas, Jest/coverage/lint); internal path scrubbed. |

## Done in this pass

- **Security:** fail-closed default key (`allowDefaultKey` escape hatch) + `isUsingDefaultKey`;
  AtomicBoolean warn-once; legacy-decrypt WARN; read-side + POST-body size caps; `.bak` cleanup on
  toggle; deep-search raw-bytes matcher + result cap.
- **Architecture:** `decryptTree`/`encryptTree` codec (`utils/cryptoTree.ts`) replacing 4 inline
  copies; deep search moved into `OsgiConfigService`; `UserPreferenceService` (owns allowlist + JCR);
  typed `ConfigNotFound`/`Conflict`/`AccessDenied` exceptions mapped to 404/409/403; `ConfigFileFilter`
  and `ConfigFileCodec` extracted from the service; `useFileActions` + shared `osgiTypes` extracted
  from `useOsgiConfigs` (~990 → ~676 lines).
- **Code quality / tooling:** JaCoCo (`prepare-agent`/`report`/`check`) + jest `--coverage` thresholds
  + `test:coverage`/`lint`/`lint:fix` scripts + ESLint config.
- **Ergonomy:** `beforeunload` guard; encrypt/decrypt failures surfaced as toasts (save aborts on
  encrypt failure); visual↔raw reserialization warning; Moonstone tokens for diff/status colors.
- **Accessibility:** see the snapshot row — all listed CRITICAL/HIGH items addressed.
- **Tests:** `cryptoTree`, `detectConfigStateFromRawContent`, decrypt-on-load + mode-switch (Jest);
  action GET/POST dispatch, error mapping, body cap, preference get/set, deep search, fail-closed
  encrypt (Java).
- **Docs:** README (fail-closed key first; Jest/coverage/lint steps), SECURITY, ARCHITECTURE (gotchas
  + cryptoTree), `backlog.md` path scrub.

## Remaining follow-ups

- **HIGH — Extract `MetatypeIntrospector` from `OsgiConfigService`.** The OSGi MetaType / factory-PID
  introspection (~half the remaining file) is the last large unit. It is intentionally **not** split
  yet: it has no unit coverage (it requires a live OSGi container / `MetaTypeService`), so a safe
  extraction should land **together with integration tests** that exercise it in a running Jahia,
  rather than as a blind move. `ConfigFileFilter` + `ConfigFileCodec` are already extracted.
- **MEDIUM — Raise the coverage ratchets toward 80%.** `jacoco.line.coverage.min` (0.42) and the jest
  thresholds are ratchets set just under current coverage; the gap is dominated by the metatype paths
  above. Raise them as integration/unit tests for those paths are added.
- **LOW — Typed request/response records.** HTTP status codes are now correct; replacing the untyped
  `Map<String,Object>` protocol with records is a further (optional) refinement.
- **LOW — Editor.jsx (legacy tree editor) full token pass.** The primary editors (Monaco / `CfgEditor`)
  and dialogs are tokenized; the rarely-used generic tree fallback still has a few inline values.

---

*Severities are the reviewers' own ratings. Java 79 + Jest 82 tests green; Cypress E2E selectors
unaffected by these changes (verified — no reliance on the changed roles/markup).*
