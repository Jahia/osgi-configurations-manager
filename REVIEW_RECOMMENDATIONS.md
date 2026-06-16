# Review Recommendations

Remaining recommendations from the multi-dimension blind re-review of `osgi-configurations-manager`
(branch `full-review`). The CRITICAL/HIGH security, i18n, code-quality, and accessibility items from
the first review have already been fixed; this file tracks what is **left to do**.

## Status snapshot (post-remediation)

| Dimension | Grade | Notes |
|---|---|---|
| Architecture | B | Thin-router dispatch, atomic filter snapshot, file-bound decrypt; two god-files remain |
| Security | B+ | All 5 CRITICALs fixed; remaining items MEDIUM/LOW |
| Code quality (SonarQube + lint) | B+ | Sonar gate **PASS**, 1 trivial issue (was 19); **no ESLint yet** |
| Ergonomy / UX | A− | i18n parity 186/186; review-before-save; toast dismiss; destructive delete |
| Accessibility (WCAG 2.2 AAA) | C | Landmarks, dialogs, listbox, keyboard reorder, live regions done; AAA gaps remain |
| Test coverage | C+ | Java 59 / Jest 66 / Cypress 20·20 green; **no coverage tooling wired** |
| Documentation | A− | README / SECURITY.md / ARCHITECTURE.md verified accurate |

SonarQube: Quality Gate **OK**, ratings A/A/A, 0% duplication, 1 open issue (S2629, trivial).

---

## Architecture

- **HIGH — Split `OsgiConfigService` (~1,500 lines).** It mixes filesystem CRUD, OSGi Metatype
  introspection (~half the file), `.cfg`/`.yml` codecs, allow/deny filtering, and crypto delegation.
  Extract `MetatypeIntrospector`, `ConfigFileCodec`, and `ConfigFileFilter` as separate
  `@Component` services injected into a slimmed facade. The inner context records already hint at
  the seams.
- **HIGH — Split `useOsgiConfigs.ts` (~990 lines).** Extract `useEditorMode` (raw/visual toggle +
  reconciliation), `useFileActions` (create/upload/delete/toggle modal builders), and a single
  `cryptoTree.ts` codec; keep `useOsgiConfigs` as a thin composition root.
- **MEDIUM — De-duplicate the decrypt/encrypt tree walk.** `decryptRecursive` / `encryptRecursive`
  are implemented ~3-4 times across `useOsgiConfigs.ts` with subtle divergence. Consolidate into one
  `decryptTree(node, filename)` / `encryptTree(node)` utility.
- **MEDIUM — Move domain logic out of the action.** `searchFiles` and preference JCR read/write
  live in `OsgiConfigAction`; move search into the service and extract a `UserPreferenceService`
  that owns the `PreferenceKeys` allowlist + JCR access.
- **MEDIUM — Typed request/response + status codes.** Replace the untyped `Map<String,Object>`
  protocol with typed records, and map service errors to proper HTTP codes (404 not-found,
  409 conflict, 403 denied) instead of collapsing every `IOException` to 400.

## Security

- **HIGH — Default encryption key.** When no key is configured the engine falls back to a built-in
  default (obfuscation only) and only logs a warning. Consider failing closed (refuse to produce new
  `ENC(...)` values, surface a UI warning) rather than silently writing breakable ciphertext.
- **HIGH — Cap POST body size before buffering.** `parseBody` reads the whole request into memory
  before the 5 MiB content cap is checked; reject on `Content-Length`/streamed size first.
- **MEDIUM — Read-side size cap.** `readFile` / `decryptForFile` / `markAsDefault` call
  `Files.readString` with no size guard; a large pre-existing file is read fully into heap. Pre-check
  `Files.size`.
- **MEDIUM — `.bak` lifecycle on toggle.** `deleteFile` removes the sibling `.bak`, but
  `toggleFileStatus` (rename to/from `.disabled`) leaves the old `.bak` behind. Clean it up too.
- **MEDIUM — Deep-search efficiency/DoS.** `searchFiles` calls full `readFile` (with metatype
  enrichment) for every file per request; add a raw-bytes-only matcher, a result cap, and early exit.
- **LOW — Legacy decrypt path.** Log a WARN whenever the legacy (pre-v2) decrypt path is used so
  operators can migrate; optionally add a "migration complete" flag to disable it.
- **LOW — `warnDefaultKeyOnce` race.** Use `AtomicBoolean.compareAndSet` instead of the
  non-atomic volatile check-then-set (currently can double-log, harmless).

## Code quality (SonarQube + lint)

- **HIGH — Add ESLint + a `lint` script.** The ~6,900-line frontend has no static analysis
  (`@typescript-eslint`, `eslint-plugin-react`/`react-hooks`); add it and wire `yarn lint` into CI.
- **MEDIUM — Extend SonarQube to the frontend.** Sonar currently analyzes Java only; add the
  TS/JS sources to the scan scope.
- **LOW — Remaining Sonar issue.** S2629 (logging argument invoked unconditionally) in
  `OsgiConfigService.updateConfig` — wrap the `.size()` logging in `LOGGER.isInfoEnabled()` or inline.
- **LOW — `getFileType` uses `contains` not `endsWith`.** Use `endsWith` with the normalized
  extensions (mirrors `isSupportedConfigFilename`).
- **LOW — `toLowerCase()` without `Locale.ROOT`** in the search/listing comparisons.

## Ergonomy / UX

- **HIGH — Add a `beforeunload` guard.** Unsaved-changes protection is thorough *inside* the app but
  closing the tab / browser navigation / reload silently discards edits. Register a `beforeunload`
  handler keyed on `hasUnsaved`.
- **MEDIUM — Silent visual↔raw reserialization.** Switching modes regenerates `rawContent` from the
  property tree and silently re-baselines when clean, so hand-authored comments/ordering/formatting
  can be rewritten without a diff or dirty flag. Detect non-equivalent reserialization and warn (or
  preserve original bytes).
- **MEDIUM — Surface crypto failures.** Decrypt/encrypt failures are only `console.error`'d; a user
  can save believing a value is encrypted when it persisted as plaintext. Route through `toastError`.
- **LOW — Styling consistency.** `Editor.jsx` (legacy fallback editor) and `DiffModal.tsx` hardcode
  hex colors instead of Moonstone CSS tokens; will not theme correctly.

## Accessibility (WCAG 2.2 AAA)

- **CRITICAL — Single `<main>` landmark.** The editor `Paper` has `role="main"` while `LayoutContent`
  may emit its own; ensure exactly one. Re-check the sidebar `navigation` + inner `listbox` nesting.
- **CRITICAL — `useDialogA11y` focus fallback.** Add `tabIndex={-1}` to the focus-trap container
  (overlay div / Paper) so programmatic `focus()` reliably lands when no focusable child exists.
- **CRITICAL — `Editor.jsx` double-click to edit (SC 2.1.1).** The YAML/tree editor enters edit mode
  only via `onDoubleClick`; add an Enter/Space keyboard path (or a real edit button).
- **HIGH — Heading hierarchy (SC 2.4.10).** The editor panel has no `<h2>`; render the selected
  filename as `component="h2"`; use a real `<caption>`/`<th scope>` for the cfg table.
- **HIGH — Always-mounted live regions (SC 4.1.3).** `StatusBanner` is mounted with its content, so
  the initial announcement is unreliable; keep an empty live region mounted and inject text.
- **HIGH — Label the inline `.cfg` textareas (SC 1.3.1/3.3.2).** `AutoResizeTextArea` has no
  `aria-label`; pass a context label (key/value/comment).
- **HIGH — `OverflowPreviewText` (SC 1.4.13).** Hover-only tooltip; add focus trigger + `role`/
  `aria-describedby`, or expose the full filename via accessible text.
- **HIGH — `CreateOptionCard` role.** Uses `role=button` + `aria-pressed` for a single-select list;
  use `role=radio`/`radiogroup` or `role=option`/`listbox` with `aria-selected`.
- **MEDIUM — Verify AAA contrast (≥7:1 text) and focus-appearance** for accent/diff colors; the
  3px file-status bar likely fails non-text contrast.
- **MEDIUM — `prefers-reduced-motion`** — the DiffModal backdrop still has `transition: all`.

## Test coverage

- **CRITICAL — Wire coverage tooling.** Add `jacoco-maven-plugin` and `jest --coverage` with
  threshold gates; the 80% rule is currently unenforceable. No coverage is measured today.
- **HIGH — `useOsgiConfigs` crypto round-trip + mode switch.** Test decrypt-on-load (ENC → plaintext
  in `properties`, raw stays encrypted), encrypt-on-save, and `handleToggleRawMode` both directions.
- **HIGH — `OsgiConfigActionTest` GET dispatch + remaining POST verbs.** Add file-read, metatypes,
  preference-read, list dispatch, and toggle/delete/markAsDefault/create/encrypt happy paths +
  IOException→400 / Exception→500 mapping.
- **MEDIUM — `detectConfigStateFromRawContent`** (client-side state detector) has no test.
- **MEDIUM — `handleUploadFile`** conflict/rename/unsupported-extension flow is Cypress-only.
- **MEDIUM — Encryption E2E.** No Cypress spec encrypts a value, verifies `ENC(...)` on disk, and
  confirms it displays decrypted on reopen. Add `markAsDefault` success + deep-search + non-root
  visibility specs.

## Documentation

- **MEDIUM — Document the Jest unit suite in the README.** Installation only mentions Cypress; add
  the frontend unit-test command.
- **LOW — Scrub `backlog.md`** of the internal absolute path (`/Users/dgigon/...`) before any public
  release.
- **LOW — Add a "gotchas" note** in `ARCHITECTURE.md` for the visual↔raw reserialization +
  decrypt-in-memory model (the main data-loss-risk path).
- **LOW — Lead with "configure the encryption key before first encrypt"** as an operational
  imperative in the README.

---

*Generated from the blind re-review (architecture, security, code quality, ergonomy, accessibility,
test coverage, documentation). Severities are the reviewers' own ratings.*
