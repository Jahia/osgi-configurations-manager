package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The filtering rules used to be five separate mutable fields on OsgiConfigService, assigned one by
 * one in updateConfig and none of them volatile. A request thread could observe the new whitelist
 * alongside the old blacklist — and since the decision hinges on whether a whitelist is configured
 * at all, a torn read applies the wrong rule set entirely, which for a security filter can mean
 * exposing a file meant to be hidden.
 *
 * <p>ConfigFileFilter publishes the rules as one immutable snapshot behind a volatile reference, so
 * a single isFilenameAllowed call sees either the whole old configuration or the whole new one.
 *
 * <p>That property is deliberately NOT asserted here. Forcing the interleaving needed to observe a
 * torn read is not something a test can do reliably, and an attempt to approximate it — hammering
 * update() from one thread while another compares two separate calls — measures the wrong thing:
 * consistency ACROSS two calls is not what a snapshot provides, so such a test fails even against
 * the correct implementation. The cases below cover the filtering behaviour itself.
 */
class ConfigFileFilterTest {

    private static Map<String, Object> props(String key, String value) {
        Map<String, Object> map = new HashMap<>();
        map.put(key, value);
        return map;
    }


    @Test
    @DisplayName("exact-name matching stays case-insensitive (SUPPORT-646 bypass stays closed)")
    void exactMatchIsCaseInsensitive() {
        ConfigFileFilter filter = new ConfigFileFilter(OsgiConfigService.SELF_CONFIG_PID);
        filter.update(props("filteredFiles", "Foo.cfg"));

        assertFalse(filter.isFilenameAllowed("Foo.cfg", false));
        assertFalse(filter.isFilenameAllowed("foo.cfg", false), "case variation must not bypass");
        assertFalse(filter.isFilenameAllowed("FOO.CFG", false), "case variation must not bypass");
    }

    @Test
    @DisplayName("the manager's own configuration is visible to root only")
    void selfConfigurationIsRootOnly() {
        ConfigFileFilter filter = new ConfigFileFilter(OsgiConfigService.SELF_CONFIG_PID);
        String self = OsgiConfigService.SELF_CONFIG_PID + ".cfg";

        assertTrue(filter.isFilenameAllowed(self, true));
        assertFalse(filter.isFilenameAllowed(self, false));
        assertFalse(filter.isFilenameAllowed(self + OsgiConfigService.DISABLED_SUFFIX, false));
    }
}
