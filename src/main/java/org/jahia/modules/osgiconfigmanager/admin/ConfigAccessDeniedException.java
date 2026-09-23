package org.jahia.modules.osgiconfigmanager.admin;

import java.io.IOException;

/**
 * Raised when a configuration file or PID is blocked by the allow/deny filter or reserved for the
 * root user. Reported by the GraphQL API with the code {@code FORBIDDEN}.
 */
public class ConfigAccessDeniedException extends IOException {
    public ConfigAccessDeniedException(String message) {
        super(message);
    }
}
