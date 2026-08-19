# OSGi Configurations Manager

A Jahia module to manage OSGi configurations directly from the Jahia Administration interface. This tool provides a user-friendly way to view, edit, create, and delete OSGi configuration files (`.cfg`, `.yml`).

## Features

-   **File Management**:
    -   View list of all OSGi configuration files.
    -   Create new configuration files.
    -   Delete existing configuration files.
    -   Enable/Disable configurations (renaming to/from `.disabled`).
    -   **Advanced Search**: Filter configurations by name or perform a **Deep Search** looking into the file content.
    -   **File Filtering**:
        -   Blacklist specific files from the UI.
        -   Optionally switch to a white list and expose only an explicit subset of configuration files.
        -   When a white list is defined, it takes precedence over the black list.
        -   The manager's own configuration file is only visible and editable for the `root` user.

-   **Configuration Editing**:
    -   **Visual Editor**: Structured view for `.cfg` files.
        -   Supports adding, modifying, and deleting properties.
        -   Drag-and-drop reordering of properties and comments, with a keyboard-accessible
            handle (focus a row's handle and use the arrow keys).
        -   Multiline text support with adaptive hover overlay for long values.
        -   **Comment and Empty Line Controls**:
            -   Hidden by default to keep the visual editor focused on editable properties.
            -   Can be re-enabled through the OSGi module configuration with `visualFormattingControlsEnabled=true`.
            -   When enabled, comment and empty-line visibility preferences are persisted per user.
        -   **Metatype assistance for `.cfg`**:
            -   `Add Property` opens a searchable Metatype-aware picker when metadata is available.
            -   The same field can also create a custom property not declared in Metatype.
            -   Property hovers expose descriptions, type, optionality, defaults and allowed values.
    -   **Raw Editor**: Integrated **Monaco Editor** for advanced raw YAML or Properties editing with syntax highlighting and validation.
        -   **Metatype assistance for `.cfg`**:
            -   Show available properties, descriptions, defaults and allowed values.
            -   Add properties from a dedicated side panel.
            -   Hover documentation and completion on keys and values.
            -   Light warning when a property is not declared in the PID Metatype.
        -   **Metatype assistance for `.yml`**:
            -   Same side panel and hover support when a Metatype can be resolved.
            -   Root-level completion and validation for YAML keys and simple values.
            -   First version intentionally limited to top-level YAML assistance.

 -   **Metatype-aware Creation Flows**:
    -   Create a configuration file from a PID exposed by OSGi Metatype when no file exists yet.
    -   Generated files are prefilled with commented default values and Metatype context.
    -   Create factory configuration instances with an explicit identifier.
    -   Display existing factory instances to avoid naming collisions.
    -   Use a tabbed creation dialog for:
        -   manual file creation
        -   creation from a simple PID
        -   creation of a factory instance

-   **Security & Traceability**:
    -   **Encryption**: Support for encrypted values using a custom CryptoEngine.
    -   Toggle encryption on properties directly from the UI.
    -   Decryption for viewing is authorized per file: a value is only decrypted for a user who may
        read the file it actually appears in.
    -   **Review before save**: saving shows the raw diff of what is about to be written and requires
        an explicit confirmation.
    -   Saves are capped at 5 MiB of raw content.
    -   **Audit Logging**: Every sensitive action (save, delete, toggle) is logged with the username of the performer for security auditing.
    -   **Safe Disable Flow**: Disabling a configuration now shows a warning dialog before renaming to `.disabled`.
    -   **Jahia Configuration State Awareness**:
        -   Distinguish `MODULE`, `MODULE_DEFAULT`, and `USER` configurations in the UI.
        -   Show a dedicated warning when editing module-managed files whose changes may be overwritten.
        -   Allow marking eligible user-managed files as `MODULE_DEFAULT` directly from the UI.

-   **User Experience**:
    -   Built with **Jahia Moonstone** design system for a native look and feel.
    -   **Internationalization (i18n)**: Fully translated in English 🇬🇧, French 🇫🇷, German 🇩🇪, Italian 🇮🇹, Spanish 🇪🇸, and Portuguese 🇵🇹.
    -   Responsive layout with sticky headers and optimized scrolling.
    -   Unsaved changes protection (confirmation modals) across file switching, create, upload, refresh, disable and mark-as-default flows.
    -   Accessible dialogs: both modals are exposed as dialogs to assistive technology, with focus
        moved into the dialog and returned on close.

## Configuration

You can filter the files exposed by the manager by creating/editing `org.jahia.modules.osgiconfigmanager.cfg` in your `karaf/etc` folder.

When the module ships a default configuration, place it in your module project under `src/main/resources/META-INF/configurations/org.jahia.modules.osgiconfigmanager.cfg`.

This configuration is:

-   exposed through OSGi Metatype
-   only visible to the `root` user
-   only creatable/editable by the `root` user when it does not exist yet

### Blacklist example

```properties
# default configuration, can be edited
# Comma-separated list of filenames or wildcard patterns to hide from the manager
filteredFiles = my-secret-config.cfg, another-file.yml, org.apache.*, jmx.*
```

### White list example

```properties
# Comma-separated list of filenames or wildcard patterns to expose in the manager
allowedFiles = org.apache.felix.eventadmin.impl.EventAdmin.cfg, org.apache.karaf.features.cfg, org.jahia.*
```

### Visual formatting controls

```properties
# Optional: re-enable comment and empty-line controls in the visual .cfg editor
visualFormattingControlsEnabled = true
```

When `allowedFiles` is defined:

-   only the listed files are visible in the manager
-   only the listed files can be read, edited, uploaded, created or toggled through the tool
-   `filteredFiles` becomes effectively obsolete for the UI because the white list takes precedence

## Using Encrypted Properties in Java

When you encrypt a property in the UI, it is stored in the `.cfg` or `.yml` file with the prefix `ENC(...)`. To use these properties in your OSGi services, you need to decrypt them.

> [!IMPORTANT]
> `CryptoEngine.decryptString` **fails closed**: it throws `IllegalStateException` rather than handing
> back a value that might still be ciphertext. Handle that — an uncaught throw inside `@Activate`
> leaves your component unable to start. It also throws on a `null` argument.

### Example

```java
package org.my.module;

import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Modified;
import org.jahia.modules.osgiconfigmanager.admin.CryptoEngine;
import java.util.Map;

@Component(service = MyService.class, immediate = true, configurationPid = "org.my.config")
public class MyService {

    private String apiSecret;

    @Activate
    @Modified
    public void update(Map<String, Object> properties) {
        this.apiSecret = decryptIfNeeded((String) properties.get("apiSecret"));
    }

    private String decryptIfNeeded(String value) {
        if (value == null || !value.startsWith("ENC(") || !value.endsWith(")")) {
            return value;
        }
        String cipherText = value.substring(4, value.length() - 1);
        try {
            return CryptoEngine.decryptString(cipherText);
        } catch (IllegalStateException e) {
            // Decide what your component should do with an unusable secret. Refusing to start, as
            // here, is usually safer than running with a half-configured service.
            throw new IllegalStateException("Could not decrypt apiSecret for org.my.config", e);
        }
    }
}
```

> [!NOTE]
> Ensure your module has access to the `org.jahia.modules.osgiconfigmanager.admin` package to use `CryptoEngine`.

### Portability between instances

New values are encrypted with a **per-instance** secret — either operator-provided through the
module's own OSGi configuration, or generated and persisted on first use. A `.cfg` copied from one
instance to another therefore cannot be decrypted on arrival. The manager handles this by showing the
value still wrapped in `ENC(...)` rather than failing the page, but a consumer module reading it will
hit the throw above. Re-enter such secrets on the target instance, or set the same operator-provided
secret on both.

## Installation

1.  Build the module:
    ```bash
    export JAVA_HOME=$(/usr/libexec/java_home -v 17)
    mvn clean install
    ```
2.  Run the Cypress end-to-end tests from the `tests` directory when needed. Both wrappers need a
    Jahia EE licence; point `JAHIA_LICENSE_FILE` at yours, since the built-in default is a path that
    only exists on the original author's machine. See [tests/README.md](tests/README.md) for the
    full set of options.
    ```bash
    cd tests
    ./run-e2e-docker.sh
    ```
    or, to run Cypress locally against a locally exposed Jahia on `localhost:8080`:
    ```bash
    cd tests
    ./run-e2e-local.sh
    ```
3.  Optionally run the same Maven + Sonar validation used during development:
    ```bash
    export JAVA_HOME=$(/usr/libexec/java_home -v 17)
    mvn clean install sonar:sonar
    ```
4.  Deploy the generated JAR file from `target/` (`osgi-configurations-manager-<version>.jar`) to
    your Jahia instance.

## Calling the endpoint directly

If you script against the module instead of using the UI, state-changing `POST`s must carry both:

-   an `X-Requested-With` header (any value), or the request is rejected with **403**
-   an `application/json` content type, or the request is rejected with **415**

Both are CSRF defences: a browser cannot attach a non-safelisted header to a forged cross-origin
request. Beyond that, the endpoint answers **404** for a missing file, **409** for a conflict such as
creating a file that already exists, and **403** when the caller may not touch the file.

## Usage

1.  Navigate to **Jahia Administration** > **Server** > **OSGi Configurations Manager**.
2.  Use the global header actions to **New**, **Import** or **Refresh** the configuration list.
3.  Select a configuration file from the sidebar to edit it.
4.  Use **New** to:
    - create a file manually,
    - create a file from an available Metatype PID,
    - or create a new factory instance from a factory PID.
5.  Use the file toolbar to disable/enable a configuration, mark it as default, download it, delete it, or switch between **Visual Edit** and **Raw Edit**.
6.  For `.cfg` and supported `.yml` files, switch to the raw editor to access Metatype-powered completion, hover documentation and property insertion.
7.  In the visual `.cfg` editor, use the dedicated `Add Property` dialog to pick Metatype-backed properties or create a custom one.
8.  If `visualFormattingControlsEnabled=true` is configured, the visual `.cfg` editor also exposes comment and empty-line controls in the footer.
9.  Use the file-state badges in the sidebar and editor header to quickly identify whether a configuration is:
    - module-managed (`MODULE`)
    - a module default whose local changes are preserved (`MODULE_DEFAULT`)
    - or instance-managed (`USER`)

## Metatype-backed Editing

When the selected file can be matched to an OSGi Metatype definition, the raw editor can use that metadata to improve editing:

-   property discovery through the **Add Property** button
-   inline completion on keys and values
-   tooltip documentation on hover
-   default values and allowed values surfaced in the side panel
-   warnings for unknown keys without blocking save

This works best for `.cfg` files and for `.yml` files whose filename can still be matched to a PID or factory PID.

The visual `.cfg` editor also consumes the same Metatype metadata when available:

-   searchable property picker instead of a free-text-only prompt
-   inline hover documentation on known property names
-   support for both Metatype-backed properties and custom free-form properties

## Metatype-backed Creation

The creation dialog can query the live OSGi runtime and list:

-   simple PID configurations that exist in Metatype but do not yet have a file
-   factory PID configurations, with their existing instances

Creating from Metatype generates a `.cfg` file with:

-   the PID header
-   the optional factory instance identifier
-   commented properties filled with default values when they exist

This makes it possible to bootstrap a valid configuration from the contract declared by the bundle instead of starting from an empty file.

## Technologies

-   React with TypeScript
-   Jahia Moonstone UI
-   Monaco Editor
-   React i18next
-   Jahia Javascript Modules

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

This project is licensed under the [MIT License](LICENSE).

## Third Party Licenses

This project includes code from [Monaco Editor](https://github.com/microsoft/monaco-editor), which is licensed under the [MIT License](https://opensource.org/licenses/MIT).

## Author

Created by **Dominique Gigon**. All code generated using vibe coding, don't blame me but the LLM 😉
