package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.osgi.service.cm.Configuration;
import org.osgi.service.cm.ConfigurationAdmin;

import java.io.IOException;
import java.util.Hashtable;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Configurations delivered before the plugin existed are delivered again, unchanged, through it. */
class EncryptedConfigurationsRedeliveryTest {

    private static Configuration configuration(String pid, Object... keyValues) {
        Configuration configuration = mock(Configuration.class);
        when(configuration.getPid()).thenReturn(pid);
        Hashtable<String, Object> properties = new Hashtable<>();
        for (int i = 0; i < keyValues.length; i += 2) {
            properties.put((String) keyValues[i], keyValues[i + 1]);
        }
        when(configuration.getProperties()).thenReturn(properties);
        return configuration;
    }

    @Test
    @DisplayName("only the configurations holding an envelope are delivered again, the manager's own excepted")
    void redeliversEncryptedOnly() throws Exception {
        Configuration jira = configuration("org.acme.jira", "jira.url", "https://jira", "jira.token", "ENC(abc)");
        Configuration db = configuration("org.acme.database~licenses", "hosts", new String[] {"a", "ENC(def)"});
        Configuration plain = configuration("org.acme.plain", "url", "https://x");
        Configuration self = configuration(OsgiConfigService.SELF_CONFIG_PID, "cryptoSecret", "ENC(xyz)");
        ConfigurationAdmin admin = mock(ConfigurationAdmin.class);
        when(admin.listConfigurations(null)).thenReturn(new Configuration[] {jira, db, plain, self});

        assertEquals(2, EncryptedConfigurationsRedelivery.redeliver(admin));

        verify(jira).update();
        verify(db).update();
        verify(plain, never()).update();
        verify(self, never()).update();
        verify(jira, never()).update(any());
    }

    @Test
    @DisplayName("a failing update does not stop the others; nothing to list is not an error")
    void resilient() throws Exception {
        Configuration broken = configuration("org.acme.broken", "token", "ENC(a)");
        doThrow(new IOException("store")).when(broken).update();
        Configuration next = configuration("org.acme.next", "token", "ENC(b)");
        ConfigurationAdmin admin = mock(ConfigurationAdmin.class);
        when(admin.listConfigurations(null)).thenReturn(new Configuration[] {broken, next});
        assertEquals(1, EncryptedConfigurationsRedelivery.redeliver(admin));
        verify(next).update();

        ConfigurationAdmin empty = mock(ConfigurationAdmin.class);
        assertEquals(0, EncryptedConfigurationsRedelivery.redeliver(empty));
    }

    @Test
    @DisplayName("an envelope is ENC(...) with content, nothing else")
    void envelopes() {
        Hashtable<String, Object> properties = new Hashtable<>();
        properties.put("a", "ENC()");
        properties.put("b", "prefix ENC(x)");
        assertFalse(EncryptedConfigurationsRedelivery.holdsEnvelope(properties));
        properties.put("c", "ENC(x)");
        assertTrue(EncryptedConfigurationsRedelivery.holdsEnvelope(properties));
        assertFalse(EncryptedConfigurationsRedelivery.holdsEnvelope(null));
    }
}
