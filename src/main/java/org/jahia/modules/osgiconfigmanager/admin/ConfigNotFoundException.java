package org.jahia.modules.osgiconfigmanager.admin;

import java.io.IOException;

/**
 * Raised when an operation targets a configuration file that does not exist. Reported by the
 * GraphQL API with the code {@code NOT_FOUND}. Extends {@link IOException} so existing {@code throws IOException}
 * signatures and callers keep working.
 */
public class ConfigNotFoundException extends IOException {
    public ConfigNotFoundException(String message) {
        super(message);
    }
}
