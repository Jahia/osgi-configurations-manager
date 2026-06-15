package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Locks the JCR preference-key allowlist that prevents arbitrary property read/write
 * on a user's node (CRIT-4).
 */
class PreferenceKeysTest {

    @ParameterizedTest(name = "allows \"{0}\"")
    @ValueSource(strings = {"osgiEditorMode", "osgiShowComments", "osgiShowEmptyLines"})
    @DisplayName("editor-UI preference keys are allowed")
    void isAllowed_knownKeys_returnTrue(String key) {
        assertTrue(PreferenceKeys.isAllowed(key));
    }

    @ParameterizedTest(name = "rejects \"{0}\"")
    @ValueSource(strings = {"j:password", "j:email", "j:groups", "jcr:primaryType", "arbitrary", "OSGIEDITORMODE"})
    @DisplayName("system/injection property names are rejected")
    void isAllowed_unknownOrSensitiveKeys_returnFalse(String key) {
        assertFalse(PreferenceKeys.isAllowed(key));
    }

    @Test
    @DisplayName("null and empty keys are rejected")
    void isAllowed_nullOrEmpty_returnFalse() {
        assertFalse(PreferenceKeys.isAllowed(null));
        assertFalse(PreferenceKeys.isAllowed(""));
    }
}
