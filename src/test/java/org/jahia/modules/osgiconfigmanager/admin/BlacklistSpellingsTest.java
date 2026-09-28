package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * A blacklist entry hides a configuration in every spelling Karaf applies to its PID (sibling of
 * SEC-525): blacklisting org.jahia.bundles.api.security.cfg must not leave the .yml spelling open.
 */
class BlacklistSpellingsTest {

    private static ConfigFileFilter filterWith(String key, String value) {
        ConfigFileFilter filter = new ConfigFileFilter(OsgiConfigService.SELF_CONFIG_PID);
        Map<String, Object> props = new HashMap<>();
        props.put(key, value);
        filter.update(props);
        return filter;
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "org.jahia.bundles.api.security.cfg",
            "org.jahia.bundles.api.security.yml",
            "org.jahia.bundles.api.security.yml.disabled",
            "ORG.JAHIA.BUNDLES.API.SECURITY.YML",
            "org.jahia.bundles.api.security-extra.cfg",
            "org.jahia.bundles.api.security~extra.yml"
    })
    @DisplayName("an exact blacklist entry refuses every spelling of its PID")
    void exactEntryCoversEverySpelling(String filename) {
        ConfigFileFilter filter = filterWith("filteredFiles", "org.jahia.bundles.api.security.cfg");
        assertFalse(filter.isFilenameAllowed(filename, false), filename);
    }

    @Test
    @DisplayName("a wildcard entry naming one extension covers the others")
    void wildcardEntryCoversOtherExtensions() {
        ConfigFileFilter filter = filterWith("filteredFiles", "org.acme.*.cfg");
        assertFalse(filter.isFilenameAllowed("org.acme.secret.cfg", false));
        assertFalse(filter.isFilenameAllowed("org.acme.secret.yml", false));
        assertFalse(filter.isFilenameAllowed("org.acme.secret.yml.disabled", false));
    }

    @Test
    @DisplayName("neighbouring configurations stay visible")
    void neighboursStayVisible() {
        ConfigFileFilter filter = filterWith("filteredFiles", "org.jahia.bundles.api.security.cfg");
        assertTrue(filter.isFilenameAllowed("org.jahia.bundles.api.securityx.cfg", false));
        assertTrue(filter.isFilenameAllowed("org.jahia.bundles.api.authorization.yml", false));
        assertTrue(filter.isFilenameAllowed("org.jahia.support.externaltools.jira.cfg", false));
    }
}
