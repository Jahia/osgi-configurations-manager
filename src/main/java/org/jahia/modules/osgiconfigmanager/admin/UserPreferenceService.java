package org.jahia.modules.osgiconfigmanager.admin;

import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.JCRSessionWrapper;
import org.jahia.services.usermanager.JahiaUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.jcr.RepositoryException;
import java.util.Optional;

/**
 * Reads and writes the small set of per-user UI preferences (editor mode, comment/empty-line
 * visibility) on the user's JCR node. Owns the {@link PreferenceKeys} allowlist so the rest of the
 * code cannot persist or read arbitrary JCR properties through this path.
 */
final class UserPreferenceService {

    private static final Logger LOGGER = LoggerFactory.getLogger(UserPreferenceService.class);

    private UserPreferenceService() {
        // Utility class
    }

    /**
     * @return the stored preference value, or empty when the key is not on the allowlist or has not
     *         been set for this user.
     */
    static Optional<String> read(JCRSessionWrapper session, JahiaUser user, String key) throws RepositoryException {
        if (!PreferenceKeys.isAllowed(key)) {
            return Optional.empty();
        }

        LOGGER.info("[AUDIT] User: {} | Action: getPreference | Key: {}", user.getName(), key);
        String userPath = user.getLocalPath();
        if (session.nodeExists(userPath)) {
            JCRNodeWrapper userNode = session.getNode(userPath);
            if (userNode.hasProperty(key)) {
                return Optional.of(userNode.getProperty(key).getString());
            }
        }
        return Optional.empty();
    }

    /**
     * @return {@code false} when the key is not on the allowlist (the caller should respond 400);
     *         {@code true} once the (allowlisted) preference has been persisted.
     */
    static boolean write(JCRSessionWrapper session, JahiaUser user, String key, String value) throws RepositoryException {
        if (!PreferenceKeys.isAllowed(key)) {
            return false;
        }

        String userPath = user.getLocalPath();
        if (session.nodeExists(userPath)) {
            JCRNodeWrapper userNode = session.getNode(userPath);
            userNode.setProperty(key, value);
            session.save();
        }
        return true;
    }
}
