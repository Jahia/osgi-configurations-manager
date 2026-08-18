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
    @DisplayName("wildcard blacklist patterns are case-insensitive too")
    void wildcardBlacklistIsCaseInsensitive() {
        ConfigFileFilter filter = new ConfigFileFilter(OsgiConfigService.SELF_CONFIG_PID);
        filter.update(props("filteredFiles", "org.apache.*"));

        assertFalse(filter.isFilenameAllowed("org.apache.felix.cfg", false));
        // The exact-name path was made case-insensitive for SUPPORT-646 but wildcards were not, so
        // this request used to slip past the pattern — and on a case-insensitive filesystem (macOS,
        // Windows) it resolves to the very file the pattern was meant to hide.
        assertFalse(filter.isFilenameAllowed("ORG.APACHE.felix.cfg", false),
                "case variation must not bypass a wildcard blacklist entry");
        assertFalse(filter.isFilenameAllowed("Org.Apache.Felix.cfg", false),
                "case variation must not bypass a wildcard blacklist entry");
    }

    @Test
    @DisplayName("wildcard whitelist patterns admit case variations rather than denying them")
    void wildcardWhitelistIsCaseInsensitive() {
        ConfigFileFilter filter = new ConfigFileFilter(OsgiConfigService.SELF_CONFIG_PID);
        filter.update(props("allowedFiles", "org.jahia.*"));

        assertTrue(filter.isFilenameAllowed("org.jahia.something.cfg", false));
        // The whitelist direction is the mirror image: case-sensitivity denied legitimate access
        // instead of granting unintended access.
        assertTrue(filter.isFilenameAllowed("ORG.JAHIA.something.cfg", false),
                "a case variation of an allowed pattern must stay allowed");
        assertFalse(filter.isFilenameAllowed("com.example.other.cfg", false),
                "the whitelist must still exclude what it does not list");
    }

    @Test
    @DisplayName("wildcard matching stays anchored — it is not a substring test")
    void wildcardStaysAnchored() {
        ConfigFileFilter filter = new ConfigFileFilter(OsgiConfigService.SELF_CONFIG_PID);
        filter.update(props("filteredFiles", "org.apache.*"));

        // Case-insensitivity must not be confused with loosening the anchors: a name that merely
        // contains the prefix is not a match.
        assertTrue(filter.isFilenameAllowed("my-org.apache.thing.cfg", false),
                "the pattern is anchored at both ends, so a containing name is not filtered");
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
