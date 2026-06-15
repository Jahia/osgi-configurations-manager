package org.jahia.modules.osgiconfigmanager.admin;

import java.util.Set;

/**
 * Allowlist of JCR property names this module is permitted to read/write on a user's node.
 *
 * <p>Preference keys arrive from the client request body/query string. Without an allowlist an
 * authenticated user could read or overwrite arbitrary JCR properties on their own node
 * (e.g. {@code j:password}, {@code j:email}). Only the editor-UI preferences below are accepted.
 */
final class PreferenceKeys {

    static final Set<String> ALLOWED = Set.of(
            "osgiEditorMode",
            "osgiShowComments",
            "osgiShowEmptyLines"
    );

    private PreferenceKeys() {
        // Utility class
    }

    static boolean isAllowed(String key) {
        return key != null && ALLOWED.contains(key);
    }
}
