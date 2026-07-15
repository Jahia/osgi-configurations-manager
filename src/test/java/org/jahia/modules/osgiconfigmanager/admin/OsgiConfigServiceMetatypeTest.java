package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * S19 (G12) — factory PID resolution by longest {@code <pid>-} prefix, and graceful degradation
 * when the MetaTypeService is absent (the common case in a unit context with no OSGi framework).
 */
class OsgiConfigServiceMetatypeTest {

    @Test
    @DisplayName("S19: an instance name resolves to the LONGEST matching factory prefix")
    void resolvesLongestFactoryPrefix() {
        OsgiConfigService service = new OsgiConfigService();
        String[] pids = {"com.acme", "com.acme.sub"};

        String match = service.findBestFactoryPidMatch(
                "com.acme.sub-inst1", pids, true, Collections.emptySet(), new HashSet<>(), null);

        assertEquals("com.acme.sub", match, "must pick com.acme.sub, not the shorter com.acme");
    }

    @Test
    @DisplayName("S19: a non-factory-capable PID does not match (needs declared-factory or MSF)")
    void nonFactoryPidDoesNotMatch() {
        OsgiConfigService service = new OsgiConfigService();
        String[] pids = {"com.acme.sub"};

        // declaredFactory=false and PID not in the ManagedServiceFactory set => no match
        String match = service.findBestFactoryPidMatch(
                "com.acme.sub-inst1", pids, false, Collections.emptySet(), new HashSet<>(), null);
        assertNull(match);

        // ...but if the PID is exposed as an MSF, it matches
        Set<String> msf = new HashSet<>();
        msf.add("com.acme.sub");
        String matchViaMsf = service.findBestFactoryPidMatch(
                "com.acme.sub-inst1", pids, false, msf, new HashSet<>(), null);
        assertEquals("com.acme.sub", matchViaMsf);
    }

    @Test
    @DisplayName("S19: null pids array returns the current best match unchanged")
    void nullPidsReturnsCurrentBest() {
        OsgiConfigService service = new OsgiConfigService();
        assertEquals("keep", service.findBestFactoryPidMatch(
                "x-1", null, true, Collections.emptySet(), new HashSet<>(), "keep"));
    }

    @Test
    @DisplayName("S19: with no MetaTypeService, metatype discovery returns empty without throwing")
    void degradesWhenMetaTypeServiceAbsent() {
        OsgiConfigService service = new OsgiConfigService(); // metaTypeService left null
        assertTrue(service.listAvailableMetatypeConfigurations(Locale.ENGLISH, true).isEmpty());
        assertTrue(service.listAvailableMetatypeConfigurations(Locale.ENGLISH).isEmpty());
    }
}
