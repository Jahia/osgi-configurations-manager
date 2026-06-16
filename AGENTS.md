# AGENTS.md

Onboarding for AI coding agents (and humans) working on **osgi-configurations-manager**. Read this
before editing. It captures the architecture, the data-loss-risk invariants, and how to build and
test the module so changes don't regress silently.

User-facing feature documentation lives in [README.md](README.md); the security model lives in
[SECURITY.md](SECURITY.md). This file is the contributor/agent map.

---

## What this is

A Jahia 8.2 EE system module that manages Karaf OSGi configuration files (`.cfg`, `.yml`) in
`karaf/etc` from the Jahia Administration UI. Thin Java/OSGi backend + a React SPA.

- **Backend:** `src/main/java/org/jahia/modules/osgiconfigmanager/admin`
- **Frontend (source):** `src/javascript/osgiConfigManager/App` ← edit here
- **Frontend (built bundle):** `src/main/resources/javascript/apps` ← **generated, never edit/commit**
- **i18n:** `src/main/resources/javascript/locales/{en,fr,de,it,es,pt}.json`
- **Java unit tests:** `src/test/java` (JUnit 5 + Mockito)
- **Frontend unit tests:** colocated `*.test.{js,jsx,ts,tsx}` (Jest)
- **E2E tests:** `tests/cypress/e2e/*.cy.ts` (Cypress, against a Dockerized Jahia)

This repo has a CodeGraph index (`.codegraph/`). Prefer the CodeGraph MCP tools for exploration; run
`codegraph sync` before analysis. See the global rules in `~/.claude/CLAUDE.md`.

---

## Architecture

```
React SPA (src/javascript/osgiConfigManager/App)
  index.jsx ─ AppContent
    ├─ hooks/useOsgiConfigs.ts   orchestration/state (selection, load, save, mode switch, prefs)
    │    ├─ hooks/useProperties.ts   visual-editor property tree
    │    ├─ hooks/useFileActions.ts  toggle/delete/markAsDefault/upload/create
    │    ├─ hooks/useToast.tsx       notifications
    │    └─ hooks/useDialogA11y.ts   modal focus-trap/escape
    ├─ api/osgiService.ts        single typed HTTP client (only HTTP boundary)
    ├─ utils/configUtils.ts      .cfg parse/serialize, property-tree codec
    ├─ utils/cryptoTree.ts       decryptTree (in place) / encryptTree (immutable)
    └─ components/*              Sidebar, editors (Monaco/visual), modals
                  │ POST/GET  systemsite.osgiConfigManager.do  (JSON, X-Requested-With header)
OsgiConfigAction   thin router: authz + CSRF, dispatch per `action`
OsgiConfigService  filesystem CRUD, path safety, allow/deny filtering, Metatype introspection, codecs
ConfigFileFilter   allow/deny (exact + wildcard) published atomically as an immutable FilterConfig
ConfigFileCodec    .cfg (comment/empty-line aware) + .yml read/write
CryptoEngine       AES-256/GCM ENC(...) value encryption (configurable key, fails closed)
                  │ java.nio.file
            $karaf/etc/*.cfg | *.yml
```

### Backend action protocol

`OsgiConfigAction` dispatches a JSON `action` to a handler. Verbs:
`save`, `create`, `createFromMetatype`, `delete`, `toggle`, `markAsDefault`, `encrypt`, `decrypt`,
`getPreference`, `setPreference`, `availableMetatypes`, plus list (no action) and read (`filename=`).

Guards: authenticated + `canManageOsgiConfigurations`; state-changing calls require the
`X-Requested-With` header (CSRF); POST body + read size caps; path-traversal-safe filename
resolution; allow/deny filtering; the manager's own config is root-only; deep search is DoS-capped.

---

## Invariants & gotchas (do not regress these)

1. **Decrypt-in-memory model.** The visual property tree holds **decrypted plaintext**; `rawContent`
   and the on-disk file keep the `ENC(...)` ciphertext. `encryptTree` MUST run before serializing on
   save and on visual→raw switch. If any value fails to encrypt, the save/switch **aborts** (toast
   `notification.encryptError`) rather than persisting a secret as plaintext. Keep the two
   representations reconciled when touching the editor flow (`useOsgiConfigs.ts`, `cryptoTree.ts`).

2. **Fail-closed encryption.** `CryptoEngine` resolves the key from the
   `org.jahia.modules.osgiconfigmanager.encryption.key` system property or the
   `OSGI_CONFIG_MANAGER_ENCRYPTION_KEY` env var. With no key and without
   `...encryption.allowDefaultKey=true`, `OsgiConfigService.encrypt` **throws** — it never writes
   breakable ciphertext. Decryption of existing values always works (legacy `v2:` payloads included).

3. **Visual ↔ raw reserialization can rewrite bytes.** Switching to the visual editor and back
   regenerates `rawContent` from the tree via `configUtils.toCfgFormat`, which can rewrite
   hand-authored comments, key order and spacing even with no "edit". The hook warns on a
   non-equivalent regen of a clean file (`notification.reserializeWarning`). **Raw text is the source
   of truth for byte-exact content** — prefer raw mode when formatting must be preserved.

4. **Default-config header rule (Jahia).** A module's shipped default
   `src/main/resources/META-INF/configurations/<PID>.cfg` MUST start with
   `# default configuration` or Jahia's extender overwrites the deployed `karaf/etc` file on every
   start and loses user edits.

5. **JCR import is once-per-version.** Initial content (`src/main/import`) imports only once per
   module version; bump the version when import content changes.

6. **`osgiService.ts` is the only HTTP boundary.** Every mutating call sends `X-Requested-With`;
   `decrypt` is bound to its file (not a generic oracle). Don't add fetch calls elsewhere.

---

## Build & test

Bytecode target is Java 11, but the toolchain + SonarQube scanner need **JDK 17**.

```bash
# Build + Java unit tests (JaCoCo coverage gate runs at verify)
export JAVA_HOME=/path/to/jdk-17        # e.g. /usr/local/graalvm or /usr/lib/jvm/java-17-openjdk
mvn clean install

# Frontend (host Node, no Jahia needed)
yarn install
yarn test                 # Jest unit suite
yarn test:coverage        # Jest with the coverage-threshold ratchet
yarn lint                 # ESLint over src/javascript

# Maven + Sonar (project key = <groupId>:<artifactId> from pom.xml)
mvn clean install sonar:sonar
```

The React app is built into `src/main/resources/javascript/apps` by `frontend-maven-plugin` during
`generate-resources`. Those bundles are generated — don't hand-edit or commit them.

### End-to-end (Cypress)

Specs: `tests/cypress/e2e/*.cy.ts`. Custom commands: `tests/cypress/support/commands.js`
(`upsertOsgiFile`, `openOsgiFile`, `ensureVisualCfgMode`/`ensureRawCfgMode`, `confirmModal`,
`confirmDiffSave`, `readOsgiFile`, `listOsgiFiles`, `getAvailableMetatypes`, `assertToastContains`…).

```bash
cd tests
./run-e2e-docker.sh        # full Dockerized cycle (build image + boot Jahia + run specs)
./run-e2e-local.sh         # run Cypress locally against a Jahia on localhost:8080
# CI primitives used by the above: ./ci.build.sh then ./ci.startup.sh
```

E2E gotchas:

- **License + env:** `tests/.env` must define `JAHIA_LICENSE` (and `SUPER_USER_PASSWORD`). It is
  **gitignored — never read, print, or commit it.** Licenses live under `~/apps/license-*.xml`.
- **`results/` writability:** the cypress container (user-namespace-remapped on Docker Desktop)
  writes `results/` as a non-host uid; clean leftover files via a throwaway root container, not host
  `chmod`. `results/test_success` = `success` is the authoritative pass marker.
- **CSRF:** any direct `cy.request` to the action endpoint needs `X-Requested-With` (already in the
  `osgiRequest` helper). UI saves that change content go through the review-before-save diff — use
  `cy.confirmDiffSave()` (or `[data-cy="diff-modal-cancel"]`).
- **Encryption in the test container:** the Jahia service in `docker-compose.yml` sets
  `CATALINA_OPTS=-Dorg.jahia.modules.osgiconfigmanager.encryption.allowDefaultKey=true` so encryption
  is operational and `09-encryption.cy.ts` exercises the full round-trip (encrypt → save → `ENC(...)`
  at rest → reload → decrypted-in-memory). The complementary **fail-closed** behavior is covered at
  the unit level (`CryptoEngineTest.serviceEncrypt_defaultKeyNotAllowed_failsClosed`) — it can't share
  a container with the round-trip because `allowDefaultKey` is a JVM-wide flag.
- **Selector convention:** tests select by `data-cy`. When you add UI, add a stable `data-cy`;
  dynamic ones are `data-cy={`name-${id}`}` (e.g. `cfg-row-0`, `cfg-delete-0`,
  `file-row-<encoded-name>`). Toast text is asserted against the **English** `notification.*` strings
  in `locales/en.json` — keep those in sync.

---

## Conventions

- **Commits:** Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`).
  Commit after each logical change; work on a feature branch, not the default branch.
- **Coding style:** small focused files (<800 lines), immutable updates, explicit error handling,
  semantic HTML + WCAG-minded a11y, design tokens over hardcoded values. Project rule files live in
  `.claude/rules/ecc/`.
- **i18n parity:** every user-facing string is a key present in all six locale files.
- **Tests first:** add/extend Jest (frontend), JUnit (backend) and a Cypress spec for new
  user-facing behavior; keep the coverage ratchets green.
