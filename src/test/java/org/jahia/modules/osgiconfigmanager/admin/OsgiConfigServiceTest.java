package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OsgiConfigServiceTest {

    @Test
    void exactBlacklistAlsoBlocksDisabledVariant() {
        OsgiConfigService service = new OsgiConfigService();

        Map<String, Object> properties = new HashMap<>();
        properties.put("filteredFiles", "my.cfg");
        service.updateConfig(properties);

        assertFalse(service.isFilenameAllowed("my.cfg", true));
        assertFalse(service.isFilenameAllowed("my.cfg.disabled", true));
        assertTrue(service.isFilenameAllowed("other.cfg", true));
    }

    @Test
    void wildcardBlacklistBlocksMatchingPrefixes() {
        OsgiConfigService service = new OsgiConfigService();

        Map<String, Object> properties = new HashMap<>();
        properties.put("filteredFiles", "org.apache.*, jmx.*");
        service.updateConfig(properties);

        assertFalse(service.isFilenameAllowed("org.apache.karaf.features.cfg", true));
        assertFalse(service.isFilenameAllowed("jmx.acl.cfg", true));
        assertFalse(service.isFilenameAllowed("org.apache.karaf.features.cfg.disabled", true));
        assertTrue(service.isFilenameAllowed("org.jahia.modules.foo.cfg", true));
    }

    @Test
    void wildcardWhitelistAllowsOnlyMatchingFiles() {
        OsgiConfigService service = new OsgiConfigService();

        Map<String, Object> properties = new HashMap<>();
        properties.put("allowedFiles", "org.jahia.*");
        service.updateConfig(properties);

        assertTrue(service.isFilenameAllowed("org.jahia.modules.foo.cfg", true));
        assertTrue(service.isFilenameAllowed("org.jahia.modules.foo.cfg.disabled", true));
        assertFalse(service.isFilenameAllowed("org.apache.karaf.features.cfg", true));
    }

    @Test
    void whitelistWithOnlyWildcardsStillActsAsWhitelist() {
        OsgiConfigService service = new OsgiConfigService();

        Map<String, Object> properties = new HashMap<>();
        properties.put("allowedFiles", "org.jahia.*");
        properties.put("filteredFiles", "org.apache.*");
        service.updateConfig(properties);

        assertFalse(service.isFilenameAllowed("org.apache.karaf.features.cfg", true));
        assertFalse(service.isFilenameAllowed("other.cfg", true));
        assertTrue(service.isFilenameAllowed("org.jahia.modules.foo.cfg", true));
    }

    @Test
    void wildcardWhitelistSupportsFactoryCandidates() {
        OsgiConfigService service = new OsgiConfigService();

        Map<String, Object> properties = new HashMap<>();
        properties.put("allowedFiles", "org.jahia.factory.*");
        service.updateConfig(properties);

        assertTrue(service.hasWhitelistedFactoryCandidate("org.jahia.factory.service"));
        assertFalse(service.hasWhitelistedFactoryCandidate("org.apache.factory.service"));
    }

    @Test
    void selfConfigurationIsOnlyVisibleToRootUser() {
        OsgiConfigService service = new OsgiConfigService();

        assertTrue(service.isFilenameAllowed("org.jahia.modules.osgiconfigmanager.cfg", true));
        assertTrue(service.isFilenameAllowed("org.jahia.modules.osgiconfigmanager.cfg.disabled", true));
        assertFalse(service.isFilenameAllowed("org.jahia.modules.osgiconfigmanager.cfg", false));
        assertFalse(service.isFilenameAllowed("org.jahia.modules.osgiconfigmanager.cfg.disabled", false));
    }

    @Test
    void selfConfigurationStaysRootOnlyEvenWhenWhitelisted() {
        OsgiConfigService service = new OsgiConfigService();

        Map<String, Object> properties = new HashMap<>();
        properties.put("allowedFiles", "org.jahia.modules.osgiconfigmanager.cfg");
        service.updateConfig(properties);

        assertTrue(service.isFilenameAllowed("org.jahia.modules.osgiconfigmanager.cfg", true));
        assertFalse(service.isFilenameAllowed("org.jahia.modules.osgiconfigmanager.cfg", false));
    }
}
