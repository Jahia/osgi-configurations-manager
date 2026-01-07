# OSGi Configurations Manager

A Jahia module to manage OSGi configurations directly from the Jahia Administration interface. This tool provides a user-friendly way to view, edit, create, and delete OSGi configuration files (`.cfg`, `.yml`).

## Features

-   **File Management**:
    -   View list of all OSGi configuration files.
    -   Create new configuration files.
    -   Delete existing configuration files.
    -   Enable/Disable configurations (renaming to/from `.disabled`).
    -   Search/Filter configurations by name.

-   **Configuration Editing**:
    -   **Tree View**: CFG files using a structured tree view.
        -   Supports adding, modifying, and deleting properties.
        -   Multiline text support with adaptive hover overlay for long values.
    -   **Raw Editor**: Integrated **Monaco Editor** for advanced raw YAML editing with syntax highlighting and validation.

-   **Security**:
    -   Support for encrypted values (Jasypt).
    -   Toggle encryption on properties directly from the UI.
    -   Automatic decryption of values for viewing (if authorized).

-   **User Experience**:
    -   Built with **Jahia Moonstone** design system for a native look and feel.
    -   **Internationalization (i18n)**: Fully translated in English 🇬🇧, French 🇫🇷, German 🇩🇪, Italian 🇮🇹, and Spanish 🇪🇸.
    -   Responsive layout with sticky headers and optimized scrolling.
    -   Unsaved changes protection (confirmation modals).

## Installation

1.  Build the module:
    ```bash
    mvn clean install
    ```
2.  Deploy the generated JAR file (`target/osgi-configurations-manager-1.0.0-SNAPSHOT.jar`) to your Jahia instance.

## Usage

1.  Navigate to **Jahia Administration** > **Server** > **OSGi Configurations Manager**.
2.  Select a configuration file from the sidebar to edit it.

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
