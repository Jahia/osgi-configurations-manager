package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.osgi.framework.dto.BundleDTO;
import org.osgi.service.cm.Configuration;
import org.osgi.service.cm.ConfigurationAdmin;
import org.osgi.service.component.runtime.ServiceComponentRuntime;
import org.osgi.service.component.runtime.dto.ComponentDescriptionDTO;
import org.osgi.util.promise.Promise;

import java.util.Arrays;
import java.util.Hashtable;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Components that read ENC(...) values before the plugin existed are restarted to read them decrypted. */
class EncryptedConfigurationsRedeliveryTest {

    private static Configuration configuration(String pid, String factoryPid, Object... keyValues) {
        Configuration configuration = mock(Configuration.class);
        when(configuration.getPid()).thenReturn(pid);
        when(configuration.getFactoryPid()).thenReturn(factoryPid);
        Hashtable<String, Object> properties = new Hashtable<>();
        for (int i = 0; i < keyValues.length; i += 2) {
            properties.put((String) keyValues[i], keyValues[i + 1]);
        }
        when(configuration.getProperties()).thenReturn(properties);
        return configuration;
    }

    private static ComponentDescriptionDTO component(String name, long bundleId, String... pids) {
        ComponentDescriptionDTO description = new ComponentDescriptionDTO();
        description.name = name;
        description.configurationPid = pids;
        description.bundle = new BundleDTO();
        description.bundle.id = bundleId;
        return description;
    }

    @Test
    @DisplayName("the PIDs and factory PIDs of configurations holding an envelope, the manager's own excepted")
    void encryptedPids() throws Exception {
        Configuration[] all = {
                configuration("org.acme.jira", null, "jira.url", "https://jira", "jira.token", "ENC(abc)"),
                configuration("org.acme.database~licenses", "org.acme.database", "hosts", new String[] {"a", "ENC(def)"}),
                configuration("org.acme.plain", null, "url", "https://x"),
                configuration(OsgiConfigService.SELF_CONFIG_PID, null, "cryptoSecret", "ENC(xyz)")};
        ConfigurationAdmin admin = mock(ConfigurationAdmin.class);
        when(admin.listConfigurations(null)).thenReturn(all);

        assertEquals(new LinkedHashSet<>(Arrays.asList("org.acme.jira", "org.acme.database~licenses", "org.acme.database")),
                EncryptedConfigurationsRedelivery.encryptedPids(admin));
        assertTrue(EncryptedConfigurationsRedelivery.encryptedPids(mock(ConfigurationAdmin.class)).isEmpty(), "nothing listed");
    }

    @Test
    @DisplayName("the consumers are the other bundles' components configured by one of those PIDs")
    void consumers() {
        Set<String> pids = new LinkedHashSet<>(Arrays.asList("org.acme.jira", "org.acme.database"));
        ComponentDescriptionDTO jira = component("JiraServiceImpl", 260, "org.acme.jira");
        ComponentDescriptionDTO database = component("DatabaseServiceImpl", 260, "org.acme.database");
        ComponentDescriptionDTO slack = component("SlackServiceImpl", 260, "org.acme.slack");
        ComponentDescriptionDTO own = component("OsgiConfigService", 265, "org.acme.jira");
        List<ComponentDescriptionDTO> consumers = EncryptedConfigurationsRedelivery.consumersOf(
                Arrays.asList(jira, database, slack, own), pids, 265);
        assertEquals(Arrays.asList(jira, database), consumers);
    }

    @Test
    @SuppressWarnings("unchecked")
    @DisplayName("each enabled consumer is disabled, then enabled once the disable is done")
    void restartsEnabledOnes() {
        ServiceComponentRuntime runtime = mock(ServiceComponentRuntime.class);
        ComponentDescriptionDTO enabled = component("JiraServiceImpl", 260, "org.acme.jira");
        ComponentDescriptionDTO disabled = component("HubspotServiceImpl", 260, "org.acme.hubspot");
        when(runtime.isComponentEnabled(enabled)).thenReturn(true);
        when(runtime.isComponentEnabled(disabled)).thenReturn(false);
        Promise<Void> promise = mock(Promise.class);
        when(runtime.disableComponent(enabled)).thenReturn(promise);

        assertEquals(1, EncryptedConfigurationsRedelivery.restart(runtime, Arrays.asList(enabled, disabled)));

        verify(runtime, never()).disableComponent(disabled);
        verify(runtime, never()).enableComponent(any());
        ArgumentCaptor<Runnable> callback = ArgumentCaptor.forClass(Runnable.class);
        verify(promise).onResolve(callback.capture());
        callback.getValue().run();
        verify(runtime).enableComponent(enabled);
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
