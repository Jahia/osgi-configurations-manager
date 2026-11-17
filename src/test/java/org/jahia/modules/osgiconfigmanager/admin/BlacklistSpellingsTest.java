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

    @ParameterizedTest
    @ValueSource(strings = {
            "org.acme.secret.cfg",
            "org.acme.secret-x.cfg",
            "org.acme.secret~x.cfg",
            "org.acme.secret-x.yml",
            "org.acme.secret~x.yml.disabled",
            "org.acme.secret-x.cfg.disabled",
            "ORG.ACME.SECRET-X.CFG",
            "org.acme.secret-x~y.cfg",
            "org.acme.secret~x-y.cfg"
    })
    @DisplayName("a wildcard entry covers the factory files of the PID it hides")
    void wildcardEntryCoversFactoryForms(String filename) {
        // FileInstall reads <pid>-<name>.cfg as a factory configuration of <pid>: with only
        // org.acme.secret.cfg refused, org.acme.secret-x.cfg created an instance of the hidden PID.
        ConfigFileFilter filter = filterWith("filteredFiles", "org.acme.secret.*");
        assertFalse(filter.isFilenameAllowed(filename, false), filename);
    }

    @ParameterizedTest
    @ValueSource(strings = {"org.acme.secret-x.yml", "org.acme.secret~x.yml", "org.acme.secret-x.yml.disabled"})
    @DisplayName("a wildcard inside the PID covers its factory files in the other extensions")
    void wildcardInsidePidCoversFactoryForms(String filename) {
        ConfigFileFilter filter = filterWith("filteredFiles", "org.*.secret.cfg");
        assertFalse(filter.isFilenameAllowed(filename, false), filename);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "org.acme.secretx.cfg",
            "org.acme.secretx-y.cfg",
            "org.acme.secrets~y.yml",
            "org.acme.other-secret.cfg",
            "org.acme-secret.cfg",
            "org.acme.cfg"
    })
    @DisplayName("a wildcard entry leaves the neighbours of the PID it hides visible")
    void wildcardEntryLeavesNeighboursVisible(String filename) {
        ConfigFileFilter filter = filterWith("filteredFiles", "org.acme.secret.*");
        assertTrue(filter.isFilenameAllowed(filename, false), filename);
    }

    @Test
    @DisplayName("the shipped rule shapes keep their meaning")
    void shippedRuleShapesKeepTheirMeaning() {
        ConfigFileFilter filter = filterWith("filteredFiles", "org.apache.*, jmx.*, org.acme.*.cfg");
        assertFalse(filter.isFilenameAllowed("org.apache.felix.eventadmin.impl.EventAdmin.cfg", false));
        assertFalse(filter.isFilenameAllowed("org.apache.felix.eventadmin.impl.EventAdmin-x.cfg", false));
        assertFalse(filter.isFilenameAllowed("jmx.acl.cfg", false));
        assertFalse(filter.isFilenameAllowed("jmx.acl.yml.disabled", false));
        assertFalse(filter.isFilenameAllowed("org.acme.secret.cfg", false));
        assertFalse(filter.isFilenameAllowed("org.acme.secret-x.yml", false));
        // The manager's own configuration follows its own rule, not the lists.
        assertFalse(filter.isFilenameAllowed("org.jahia.modules.osgiconfigmanager-x.yml", false));
        assertTrue(filter.isFilenameAllowed("org.jahia.modules.osgiconfigmanager.cfg", true));

        assertTrue(filter.isFilenameAllowed("org.apachex.cfg", false));
        assertTrue(filter.isFilenameAllowed("jmxremote.cfg", false));
        assertTrue(filter.isFilenameAllowed("org.jahia.modules.sam-probe.cfg", false));
        assertTrue(filter.isFilenameAllowed("org.acme.yml", false));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "org.apache.felix\nx.cfg",
            "org.apache.felix\rx.cfg",
            "org.apache.felix\u0085x.cfg",
            "org.apache.felix\u2028x.cfg",
            "org.apache.felix.eventadmin.impl.EventAdmin-x\ny.cfg"
    })
    @DisplayName("a line break in the name does not take it out of a wildcard entry")
    void wildcardEntryMatchesAcrossLineBreaks(String filename) {
        // '.' stops at a line terminator unless the pattern says otherwise, so "org.apache.*" let
        // through any name carrying one.
        ConfigFileFilter filter = filterWith("filteredFiles", "org.apache.*");
        assertFalse(filter.isFilenameAllowed(filename, false));
    }

    @Test
    @DisplayName("the whitelist stays exact: a wildcard entry does not grant the factory files")
    void whitelistIsNotWidened() {
        ConfigFileFilter filter = filterWith("allowedFiles", "org.acme.public.*");
        assertTrue(filter.isFilenameAllowed("org.acme.public.cfg", false));
        assertFalse(filter.isFilenameAllowed("org.acme.public-x.cfg", false));
        assertFalse(filter.isFilenameAllowed("org.acme.public~x.yml", false));
        assertFalse(filter.isFilenameAllowed("org.acme.public.a\nb.cfg", false));
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
