package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** The probe reports the shape of what it received, never the values. */
class ConfigurationPluginProbeTest {

    @Test
    @DisplayName("each delivered property is reported as plaintext or encrypted, framework keys excluded")
    void describesShapesOnly() {
        Map<String, Object> delivered = new LinkedHashMap<>();
        delivered.put("service.pid", ConfigurationPluginProbe.PID);
        delivered.put("felix.fileinstall.filename", "file:/etc/probe.cfg");
        delivered.put("component.name", "probe");
        delivered.put("probe.secret", "ENC(still-an-envelope)");
        delivered.put("probe.plain", "hello");

        Map<String, String> shapes = ConfigurationPluginProbe.describe(delivered);

        assertEquals(2, shapes.size(), "framework properties are not reported");
        assertEquals(ConfigurationPluginProbe.SHAPE_ENCRYPTED, shapes.get("probe.secret"));
        assertEquals(ConfigurationPluginProbe.SHAPE_PLAINTEXT, shapes.get("probe.plain"));
        assertFalse(shapes.containsValue("hello"), "no value leaves the probe");
        assertFalse(shapes.containsValue("ENC(still-an-envelope)"));
    }

    @Test
    @DisplayName("activation records the delivery, deactivation forgets it")
    void lifecycle() {
        ConfigurationPluginProbe probe = new ConfigurationPluginProbe();
        assertTrue(probe.deliveredShapes().isEmpty());
        assertNull(probe.receivedAt());

        probe.activate(Map.of("probe.secret", "decrypted-by-the-plugin"));
        assertEquals(ConfigurationPluginProbe.SHAPE_PLAINTEXT, probe.deliveredShapes().get("probe.secret"));
        assertNotNull(probe.receivedAt());

        probe.deactivate();
        assertTrue(probe.deliveredShapes().isEmpty());
        assertNull(probe.receivedAt());
    }

    @Test
    @DisplayName("a null delivery is described as empty")
    void nullDelivery() {
        assertTrue(ConfigurationPluginProbe.describe(null).isEmpty());
    }
}
