# Architecture

A Jahia 8.2 system module that manages the OSGi configuration files (`.cfg`, `.yml`) in Karaf's
`etc/` directory from the Jahia administration UI. It has a thin Java/OSGi backend and a React SPA.

```
┌──────────────────────────────────────────────────────────────────────┐
│ React SPA  (src/javascript/osgiConfigManager/App)                       │
│   index.jsx ─ AppContent                                                │
│     ├─ hooks/useOsgiConfigs.ts   orchestration/state                    │
│     │     ├─ hooks/useProperties.ts   visual-editor property tree        │
│     │     ├─ hooks/useToast.tsx       notifications                      │
│     │     └─ hooks/useDialogA11y.ts   modal focus-trap/escape            │
│     ├─ api/osgiService.ts        single typed HTTP client                │
│     ├─ utils/configUtils.ts      .cfg parse/serialize, tree codec        │
│     └─ components/*              Sidebar, editors (Monaco/visual), modals │
└───────────────────────────────┬────────────────────────────────────────┘
                                 │ POST/GET  systemsite.osgiConfigManager.do
                                 │ JSON in / JSON out, X-Requested-With header
┌───────────────────────────────▼────────────────────────────────────────┐
│ OsgiConfigAction   thin router: authz + CSRF, dispatch to handlers       │
│ OsgiConfigService  filesystem CRUD, path safety, allow/deny filtering,   │
│                    OSGi Metatype introspection, .cfg/.yml codecs         │
│ CryptoEngine       AES-256/GCM value encryption (configurable key)       │
│ PreferenceKeys     allowlist for user-preference JCR keys                │
└───────────────────────────────┬────────────────────────────────────────┘
                                 │ java.nio.file
                          $karaf.etc/*.cfg | *.yml
```

## Backend (`src/main/java/org/jahia/modules/osgiconfigmanager/admin`)

- **`OsgiConfigAction`** — a single Jahia `Action` exposed at `*.osgiConfigManager.do`. It enforces
  authorization and the CSRF header, then dispatches each `action` (save/toggle/delete/create/
  createFromMetatype/encrypt/decrypt/get|setPreference) to a focused handler. Responses are JSON
  written via Jackson (order-preserving). See [SECURITY.md](SECURITY.md) for the guard details.
- **`OsgiConfigService`** — all filesystem access and domain logic: list/read/save/create/delete/
  toggle, path-traversal-safe filename resolution, blacklist/whitelist matching (exact + wildcard,
  published atomically as an immutable `FilterConfig`), `MODULE`/`MODULE_DEFAULT`/`USER` state
  detection from the file header, OSGi Metatype/factory-PID introspection, and `.cfg`/`.yml`
  parsing & serialization.
- **`CryptoEngine`** — reversible `ENC(...)` value encryption. Key is resolved from configuration
  (system property / env var) with a legacy fallback for backward compatibility.

## Frontend (`src/javascript/osgiConfigManager/App`)

- **`useOsgiConfigs`** orchestrates file listing, selection, loading, editing, save (with a
  review-before-save diff), encryption toggling and user preferences.
- **Dual representation:** a file is held both as raw text (`rawContent`, what is on disk, with
  `ENC(...)` left intact) and as a parsed property tree (decrypted in memory for editing). The two
  are reconciled on mode switch and on save; `configUtils.ts` is the codec.
- **`osgiService.ts`** is the only HTTP boundary — a single typed client; every mutating call sends
  the `X-Requested-With` CSRF header and the `decrypt` call is bound to its file.

## Build & tests

- Maven `bundle` packaging; `frontend-maven-plugin` builds the React app into
  `src/main/resources/javascript/apps` during `generate-resources` (those bundles are generated, not
  tracked).
- **Java unit tests** (JUnit 5 + Mockito) under `src/test/java`. **Frontend unit tests** (Jest) are
  colocated with the source. **E2E** (Cypress) live in `tests/` and run against a Dockerized Jahia.
- Build with JDK 17 (bytecode target is Java 11). See [README.md](README.md).
