package org.jahia.modules.osgiconfigmanager.admin;

import org.jahia.bin.ActionResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** {@code ?action=pluginProbe}: shapes only, and a well-formed answer with no probe at all. */
class OsgiConfigActionProbeTest {

    @Test
    @DisplayName("without a probe component the action answers active=false and touches no file")
    void inactiveWithoutProbe() throws Exception {
        ActionDispatchFixture fx = ActionDispatchFixture.authorized().get().getParam("action", "pluginProbe");
        OsgiConfigService service = mock(OsgiConfigService.class);

        ActionResult result = fx.action(service).doExecute(fx.request, fx.renderContext, null, fx.session, null, null);

        assertNull(result, "normal dispatch writes the body and returns null");
        assertTrue(fx.body().contains("\"active\":false"), fx.body());
        assertTrue(fx.body().contains(ConfigurationPluginProbe.PID));
        verifyNoInteractions(service);
    }

    @Test
    @DisplayName("with a probe component the action reports the delivered shapes and never a value")
    void reportsShapes() throws Exception {
        ActionDispatchFixture fx = ActionDispatchFixture.authorized().get().getParam("action", "pluginProbe");
        OsgiConfigService service = mock(OsgiConfigService.class);
        ConfigurationPluginProbe probe = mock(ConfigurationPluginProbe.class);
        when(probe.deliveredShapes()).thenReturn(Map.of("probe.secret", "plaintext", "probe.plain", "plaintext"));
        when(probe.receivedAt()).thenReturn("2026-09-21T10:00:00Z");

        OsgiConfigAction action = fx.action(service);
        action.setPluginProbe(probe);
        action.doExecute(fx.request, fx.renderContext, null, fx.session, null, null);

        String body = fx.body();
        assertTrue(body.contains("\"active\":true"), body);
        assertTrue(body.contains("\"probe.secret\":\"plaintext\""), body);
        assertTrue(body.contains("2026-09-21T10:00:00Z"), body);
        assertFalse(body.contains("ENC("), "no envelope, hence no value, is ever echoed");
    }

    @Test
    @DisplayName("unbinding the probe (its file was deleted) makes it inactive again")
    void unbindingDeactivates() throws Exception {
        // A fresh fixture per request: Jackson closes the response writer after the first body.
        ActionDispatchFixture fx = ActionDispatchFixture.authorized().get().getParam("action", "pluginProbe");
        ConfigurationPluginProbe probe = mock(ConfigurationPluginProbe.class);
        OsgiConfigAction action = fx.action(mock(OsgiConfigService.class));
        action.setPluginProbe(probe);
        action.unsetPluginProbe(probe);

        action.doExecute(fx.request, fx.renderContext, null, fx.session, null, null);

        assertTrue(fx.body().contains("\"active\":false"), fx.body());
    }
}
