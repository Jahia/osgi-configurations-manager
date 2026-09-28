package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * SEC-525: the manager's own configuration (file filter, cryptoSecret) is reserved for root in every
 * spelling Karaf applies to its PID, not only {@code org.jahia.modules.osgiconfigmanager.cfg}.
 */
class SelfConfigurationGuardTest {

    private final ConfigFileFilter filter = new ConfigFileFilter(OsgiConfigService.SELF_CONFIG_PID);

    @ParameterizedTest
    @ValueSource(strings = {
            "org.jahia.modules.osgiconfigmanager.cfg",
            "org.jahia.modules.osgiconfigmanager.cfg.disabled",
            "org.jahia.modules.osgiconfigmanager.yml",
            "org.jahia.modules.osgiconfigmanager.yml.disabled",
            "org.jahia.modules.osgiconfigmanager.CFG",
            "ORG.JAHIA.MODULES.OSGICONFIGMANAGER.Yml",
            // factory forms: Declarative Services would activate another instance of the manager's component
            "org.jahia.modules.osgiconfigmanager-other.cfg",
            "org.jahia.modules.osgiconfigmanager~other.yml",
            "org.jahia.modules.osgiconfigmanager-other.cfg.disabled"
    })
    @DisplayName("every spelling of the manager's configuration is refused to a non-root caller and allowed to root")
    void reservedInEverySpelling(String filename) {
        assertFalse(filter.isFilenameAllowed(filename, false), filename);
        assertTrue(filter.isFilenameAllowed(filename, true), filename);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "org.jahia.modules.osgiconfigmanagerx.cfg",
            "org.jahia.modules.jahiacsrfguard-osgi-configurations-manager.cfg",
            "org.jahia.bundles.api.authorization-osgi-configurations-manager.yml",
            "org.jahia.support.externaltools.jira.cfg"
    })
    @DisplayName("other configurations are not caught by the reservation")
    void otherConfigurationsAreNotReserved(String filename) {
        assertTrue(filter.isFilenameAllowed(filename, false), filename);
    }

    @Test
    @DisplayName("the PID guard covers the factory instances of the manager's PID")
    void pidGuardCoversFactoryInstances() {
        OsgiConfigService service = new OsgiConfigService();
        assertTrue(service.isSelfConfigurationPid(OsgiConfigService.SELF_CONFIG_PID));
        assertTrue(service.isSelfConfigurationPid(OsgiConfigService.SELF_CONFIG_PID + "~other"));
        assertTrue(service.isSelfConfigurationPid(OsgiConfigService.SELF_CONFIG_PID + ".3f2a9c10-1b2c-4d5e-8f90-a1b2c3d4e5f6"));
        assertFalse(service.isSelfConfigurationPid(OsgiConfigService.SELF_CONFIG_PID + ".probe"),
                "the probe the module ships is another PID");
        assertFalse(service.isSelfConfigurationPid("org.jahia.modules.osgiconfigmanagerx"));
        assertFalse(service.isSelfConfigurationPid(null));
    }
}
