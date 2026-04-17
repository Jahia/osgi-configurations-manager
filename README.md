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
        -   Drag-and-drop reordering of properties and comments.
        -   Multiline text support with adaptive hover overlay for long values.
        -   **Comment Visibility**: Toggle comments on/off to focus on active properties.
        -   **Empty Line Visibility**: Toggle empty lines on/off, with the preference persisted per user.
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
    -   Automatic decryption of values for viewing (if authorized).
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
    -   Unsaved changes protection (confirmation modals).

## Configuration

You can filter the files exposed by the manager by creating/editing `org.jahia.modules.osgiconfigmanager.cfg` in your `karaf/etc` folder.

This configuration is:

-   exposed through OSGi Metatype
-   only visible to the `root` user
-   only creatable/editable by the `root` user when it does not exist yet

### Blacklist example

```properties
# Comma-separated list of filenames to hide from the manager
filteredFiles = my-secret-config.cfg, another-file.yml
```

### White list example

```properties
# Comma-separated list of filenames to expose in the manager
allowedFiles = org.apache.felix.eventadmin.impl.EventAdmin.cfg, org.apache.karaf.features.cfg
```

When `allowedFiles` is defined:

-   only the listed files are visible in the manager
-   only the listed files can be read, edited, uploaded, created or toggled through the tool
-   `filteredFiles` becomes effectively obsolete for the UI because the white list takes precedence

## Using Encrypted Properties in Java

When you encrypt a property in the UI, it is stored in the `.cfg` or `.yml` file with the prefix `ENC(...)`. To use these properties in your OSGi services, you need to decrypt them.

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
        String value = (String) properties.get("apiSecret");
        
        // Decrypt if it's an encrypted string
        if (value != null && value.startsWith("ENC(") && value.endsWith(")")) {
            String cipherText = value.substring(4, value.length() - 1);
            this.apiSecret = CryptoEngine.decryptString(cipherText);
        } else {
            this.apiSecret = value;
        }
    }
}
```

> [!NOTE]
> Ensure your module has access to the `org.jahia.modules.osgiconfigmanager.admin` package to use `CryptoEngine`.

## Installation

1.  Build the module:
    ```bash
    mvn clean install
    ```
2.  Run the Cypress end-to-end tests from the `tests` directory when needed:
    ```bash
    cd tests
    ./run-e2e-docker.sh
    ```
    or, to run Cypress locally against a locally exposed Jahia on `localhost:8080`:
    ```bash
    cd tests
    ./run-e2e-local.sh
    ```
3.  Deploy the generated JAR file (`target/osgi-configurations-manager-1.0.2-SNAPSHOT.jar`) to your Jahia instance.

## Usage

1.  Navigate to **Jahia Administration** > **Server** > **OSGi Configurations Manager**.
2.  Select a configuration file from the sidebar to edit it.
3.  Use **Create** to:
    - create a file manually,
    - create a file from an available Metatype PID,
    - or create a new factory instance from a factory PID.
4.  For `.cfg` and supported `.yml` files, switch to the raw editor to access Metatype-powered completion, hover documentation and property insertion.
5.  In the visual `.cfg` editor, use the dedicated `Add Property` dialog to pick Metatype-backed properties or create a custom one, and use the visibility toggles to hide/show comments and empty lines.
6.  Use the file-state badges in the sidebar and editor header to quickly identify whether a configuration is:
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

-   React
-   Jahia Moonstone UI
-   Monaco Editor
-   React i18next
-   Jahia Javascript Modules

## License

This project is licensed under the [MIT License](LICENSE).

## Third Party Licenses

This project includes code from [Monaco Editor](https://github.com/microsoft/monaco-editor), which is licensed under the [MIT License](https://opensource.org/licenses/MIT).

## Author

Created by **Dominique Gigon**. All code generated using vibe coding, don't blame me but the LLM 😉
