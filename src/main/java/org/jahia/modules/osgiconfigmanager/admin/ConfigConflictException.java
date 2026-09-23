package org.jahia.modules.osgiconfigmanager.admin;

import java.io.IOException;

/**
 * Raised when an operation would collide with an existing file (create/rename target already
 * exists). Reported by the GraphQL API with the code {@code CONFLICT}.
 */
public class ConfigConflictException extends IOException {
    public ConfigConflictException(String message) {
        super(message);
    }
}
