# Security Policy

## Reporting a Vulnerability

Security information can be found in our [security.txt file](https://academy.jahia.com/.well-known/security.txt).

## Security model

This module manages arbitrary `.cfg` / `.yml` files in Karaf's `etc/` directory, so access is tightly controlled.

### Authorization

- The action requires an authenticated user with the `admin` permission **and** the
  `canManageOsgiConfigurations` permission (checked on every request).
- The manager's own configuration (`org.jahia.modules.osgiconfigmanager.cfg`) is only visible and
  editable by the `root` user.
- Visibility/editability of all other files is constrained by the `filteredFiles` (blacklist) and
  `allowedFiles` (whitelist) settings; the whitelist takes precedence when set.

### Request protection

- **CSRF:** state-changing requests (POST) must carry the `X-Requested-With` header. Browsers cannot
  set this non-safelisted header on a cross-origin request without a CORS preflight (which is not
  granted), so a forged cross-site request is rejected (`403`). The bundled CSRFGuard configuration
  whitelists the action URL precisely because this header-based defense replaces token injection
  (which does not cover `fetch`).
- **Path traversal:** filenames are validated (no `/`, `\`, `..`, absolute or multi-segment paths)
  and the resolved path is verified to stay within `karaf/etc`.
- **Request size:** raw configuration content is capped (5 MiB) to prevent disk-exhaustion writes.
- **Preferences:** the JCR property names used for UI preferences are restricted to a fixed
  allowlist, so the endpoint cannot read or write arbitrary node properties.
- **Error messages:** domain validation errors return a safe message; unexpected errors return a
  generic message and are logged server-side only.

### Encrypted values

- Values encrypted in the UI are stored as `ENC(...)`. Encryption uses AES-256/GCM with a
  PBKDF2-derived key. **Configure a strong key** via the
  `org.jahia.modules.osgiconfigmanager.encryption.key` system property or the
  `OSGI_CONFIG_MANAGER_ENCRYPTION_KEY` environment variable — see the README. Without it, a built-in
  default key is used (obfuscation only) and a warning is logged at startup.
- The `decrypt` endpoint is bound to a file: it authorizes the named file and verifies the ciphertext
  actually occurs in it before decrypting, so it cannot be used as a generic decryption oracle.

### Auditing

Sensitive actions (`save`, `toggle`, `delete`, `markAsDefault`, `create`, `createFromMetatype`,
`encrypt`, `decrypt`, `getPreference`, `setPreference`) are logged with the acting username under the
`[AUDIT]` marker (secret values are never logged) to the standard Jahia/Karaf logs.
