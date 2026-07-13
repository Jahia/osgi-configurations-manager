package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * S7 (reverse direction), S12 (edge/NEG cases), S13 (self-config root-only) — allow/blacklist
 * boundary. All driven through public {@code updateConfig}/{@code isFilenameAllowed} plus the
 * package-private self-config seams.
 */
class OsgiConfigServiceAllowlistTest {

    private OsgiConfigService serviceWith(Map<String, Object> props) {
        OsgiConfigService service = new OsgiConfigService();
        service.updateConfig(props);
        return service;
    }

    private Map<String, Object> props(String key, String value) {
        Map<String, Object> p = new HashMap<>();
        p.put(key, value);
        return p;
    }

    @Test
    @DisplayName("S7-reverse: a '.disabled' blacklist entry also blocks its base filename")
    void disabledBlacklistEntryBlocksBase() {
        OsgiConfigService service = serviceWith(props("filteredFiles", "x.cfg.disabled"));
        assertFalse(service.isFilenameAllowed("x.cfg.disabled", true));
        assertFalse(service.isFilenameAllowed("x.cfg", true), "de-.disabled direction must also be blocked");
    }

    @Test
    @DisplayName("S12: exact-name blacklist is CASE-SENSITIVE (documents the bypass)")
    void exactBlacklistIsCaseSensitive() {
        OsgiConfigService service = serviceWith(props("filteredFiles", "Foo.cfg"));
        assertFalse(service.isFilenameAllowed("Foo.cfg", false), "exact case is blocked");
        assertTrue(service.isFilenameAllowed("foo.cfg", false),
                "different case slips past the case-sensitive Set.contains check");
    }

    @Test
    @DisplayName("S12: whitespace around CSV entries is trimmed and honored")
    void whitespaceEntriesAreTrimmed() {
        OsgiConfigService service = serviceWith(props("filteredFiles", " foo.cfg , bar.cfg "));
        assertFalse(service.isFilenameAllowed("foo.cfg", true));
        assertFalse(service.isFilenameAllowed("bar.cfg", true));
        assertTrue(service.isFilenameAllowed("baz.cfg", true));
    }

    @Test
    @DisplayName("S12: no allow/blacklist configured => everything is allowed")
    void emptyConfigAllowsEverything() {
        OsgiConfigService service = serviceWith(new HashMap<>());
        assertTrue(service.isFilenameAllowed("anything.cfg", true));
        assertTrue(service.isFilenameAllowed("org.apache.karaf.features.cfg", true));
    }

    @Test
    @DisplayName("S12: a '*'-only blacklist blocks all files")
    void wildcardOnlyBlacklistBlocksAll() {
        OsgiConfigService service = serviceWith(props("filteredFiles", "*"));
        assertFalse(service.isFilenameAllowed("foo.cfg", true));
        assertFalse(service.isFilenameAllowed("bar.yml", true));
    }

    @Test
    @DisplayName("S13: self-config filename is blocked for non-root across every op, allowed for root")
    void selfConfigFilenameIsRootOnly() {
        OsgiConfigService service = serviceWith(new HashMap<>());
        assertFalse(service.isFilenameAllowed("org.jahia.modules.osgiconfigmanager.cfg", false));
        assertFalse(service.isFilenameAllowed("org.jahia.modules.osgiconfigmanager.cfg.disabled", false));
        assertTrue(service.isFilenameAllowed("org.jahia.modules.osgiconfigmanager.cfg", true));
        assertTrue(service.isFilenameAllowed("org.jahia.modules.osgiconfigmanager.cfg.disabled", true));
    }

    @Test
    @DisplayName("S13: self-config PID is reserved for root (ensurePidAllowed / isSelfConfigurationPid)")
    void selfConfigPidIsRootOnly() {
        OsgiConfigService service = serviceWith(new HashMap<>());
        assertTrue(service.isSelfConfigurationPid("org.jahia.modules.osgiconfigmanager"));
        assertFalse(service.isSelfConfigurationPid("org.jahia.modules.other"));
        assertThrows(java.io.IOException.class,
                () -> service.ensurePidAllowed("org.jahia.modules.osgiconfigmanager", false));
        assertDoesNotThrow(
                () -> service.ensurePidAllowed("org.jahia.modules.osgiconfigmanager", true));
        assertDoesNotThrow(
                () -> service.ensurePidAllowed("org.jahia.modules.other", false));
    }
}
