package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.osgi.service.cm.Configuration;
import org.osgi.service.cm.ConfigurationAdmin;

import java.io.IOException;
import java.util.Dictionary;
import java.util.Hashtable;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Configurations holding ENC(...) values are written back unchanged once the plugin is registered:
 * an update with the stored properties, which bumps the change count so SCR fetches them again.
 */
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
    @DisplayName("writes back, with their own stored properties, the configurations holding an envelope")
    void writesBackEncryptedOnly() throws Exception {
        Configuration jira = configuration("org.acme.jira", "jira.url", "https://jira", "jira.token", "ENC(abc)",
                "felix.fileinstall.filename", "file:/karaf/etc/org.acme.jira.cfg");
        Configuration db = configuration("org.acme.database~licenses", "hosts", new String[] {"a", "ENC(def)"});
        Configuration plain = configuration("org.acme.plain", "url", "https://x");
        Configuration self = configuration(OsgiConfigService.SELF_CONFIG_PID, "cryptoSecret", "ENC(xyz)");
        Configuration[] all = {jira, db, plain, self};
        ConfigurationAdmin admin = mock(ConfigurationAdmin.class);
        when(admin.listConfigurations(null)).thenReturn(all);

        assertEquals(2, EncryptedConfigurationsRedelivery.redeliver(admin));

        Dictionary<String, Object> stored = jira.getProperties();
        verify(jira).update(stored);
        assertSame(stored, jira.getProperties());
        assertEquals("ENC(abc)", stored.get("jira.token"), "the envelope is written back as stored, not decrypted");
        assertEquals("file:/karaf/etc/org.acme.jira.cfg", stored.get("felix.fileinstall.filename"));
        verify(db).update(db.getProperties());
        verify(plain, never()).update(any());
        verify(self, never()).update(any());
        verify(jira, never()).update();
    }

    @Test
    @DisplayName("a failing update does not stop the others; nothing to list is not an error")
    void resilient() throws Exception {
        Configuration broken = configuration("org.acme.broken", "token", "ENC(a)");
        doThrow(new IOException("store")).when(broken).update(any());
        Configuration next = configuration("org.acme.next", "token", "ENC(b)");
        Configuration[] all = {broken, next};
        ConfigurationAdmin admin = mock(ConfigurationAdmin.class);
        when(admin.listConfigurations(null)).thenReturn(all);

        assertEquals(1, EncryptedConfigurationsRedelivery.redeliver(admin));
        verify(next).update(next.getProperties());
        assertEquals(0, EncryptedConfigurationsRedelivery.redeliver(mock(ConfigurationAdmin.class)));
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
