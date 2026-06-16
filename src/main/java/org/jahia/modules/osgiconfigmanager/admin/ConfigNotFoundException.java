package org.jahia.modules.osgiconfigmanager.admin;

import java.io.IOException;

/**
 * Raised when an operation targets a configuration file that does not exist. Mapped to HTTP 404 by
 * {@link OsgiConfigAction}. Extends {@link IOException} so existing {@code throws IOException}
 * signatures and callers keep working.
 */
public class ConfigNotFoundException extends IOException {
    public ConfigNotFoundException(String message) {
        super(message);
    }
}
