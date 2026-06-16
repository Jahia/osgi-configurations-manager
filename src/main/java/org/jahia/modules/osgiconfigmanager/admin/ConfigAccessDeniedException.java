package org.jahia.modules.osgiconfigmanager.admin;

import java.io.IOException;

/**
 * Raised when a configuration file or PID is blocked by the allow/deny filter or reserved for the
 * root user. Mapped to HTTP 403 by {@link OsgiConfigAction}.
 */
public class ConfigAccessDeniedException extends IOException {
    public ConfigAccessDeniedException(String message) {
        super(message);
    }
}
