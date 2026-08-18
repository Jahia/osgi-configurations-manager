package org.jahia.modules.osgiconfigmanager.admin;

import java.io.IOException;

/**
 * Raised when an operation would collide with an existing file (create/rename target already
 * exists). Mapped to HTTP 409 by {@link OsgiConfigAction}.
 */
public class ConfigConflictException extends IOException {
    public ConfigConflictException(String message) {
        super(message);
    }
}
