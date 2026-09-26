package org.jahia.modules.osgiconfigmanager.admin;

import org.osgi.framework.BundleContext;
import org.osgi.service.cm.Configuration;
import org.osgi.service.cm.ConfigurationAdmin;
import org.osgi.service.cm.ConfigurationPlugin;
import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;
import org.osgi.service.component.runtime.ServiceComponentRuntime;
import org.osgi.service.component.runtime.dto.ComponentDescriptionDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Dictionary;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Restarts, once the decryption plugin is registered, every Declarative Services component of
 * another bundle that reads a configuration holding {@code ENC(...)} values, so that it reads them
 * again, decrypted.
 *
 * <p>Configuration Admin consults plugins at delivery time only. A consumer bundle that starts
 * before this one receives its values as stored, and nothing delivers them again when the plugin
 * appears. That is the ordinary case, not an accident: when this bundle is updated, Felix refreshes
 * its dependents and starts them again in bundle id order, and a consumer installed before the
 * manager starts first; the same holds at every restart of the server. The consumer then connects
 * with the {@code ENC(...)} string as its password, and no decryption error is logged because no
 * decryption was attempted.
 *
 * <p>{@code Configuration.update()} without arguments does not help: Service Component Runtime
 * ignores an update that leaves the change count as it was. Disabling and enabling the component
 * makes it read its configuration anew, through the plugin, without touching the file or the
 * cluster copy.
 */
@Component(immediate = true)
public class EncryptedConfigurationsRedelivery {

    private static final Logger LOGGER = LoggerFactory.getLogger(EncryptedConfigurationsRedelivery.class);

    /** Only for the ordering: this component activates once the plugin is registered. */
    @Reference(target = "(component.name=org.jahia.modules.osgiconfigmanager.admin.EncryptedValuesConfigurationPlugin)")
    private ConfigurationPlugin plugin;

    @Reference
    private ConfigurationAdmin configurationAdmin;

    @Reference
    private ServiceComponentRuntime componentRuntime;

    @Activate
    void activate(BundleContext context) {
        Set<String> pids = encryptedPids(configurationAdmin);
        List<ComponentDescriptionDTO> consumers = consumersOf(componentRuntime.getComponentDescriptionDTOs(), pids,
                context.getBundle().getBundleId());
        int restarted = restart(componentRuntime, consumers);
        if (restarted > 0) {
            LOGGER.info("[AUDIT] Restarted {} component(s) reading ENC(...) values, so they read them decrypted now that the plugin is registered",
                    restarted);
        }
    }

    /** The PIDs and factory PIDs of the configurations holding an envelope, the manager's own excepted. */
    static Set<String> encryptedPids(ConfigurationAdmin configurationAdmin) {
        Set<String> pids = new LinkedHashSet<>();
        Configuration[] configurations;
        try {
            configurations = configurationAdmin.listConfigurations(null);
        } catch (Exception e) {
            LOGGER.error("Could not list the configurations holding ENC(...) values", e);
            return pids;
        }
        if (configurations == null) {
            return pids;
        }
        for (Configuration configuration : configurations) {
            String pid = configuration.getPid();
            if (OsgiConfigService.SELF_CONFIG_PID.equals(pid) || !holdsEnvelope(configuration.getProperties())) {
                continue;
            }
            pids.add(pid);
            if (configuration.getFactoryPid() != null) {
                pids.add(configuration.getFactoryPid());
            }
        }
        return pids;
    }

    /** The components of other bundles configured by one of {@code pids}. */
    static List<ComponentDescriptionDTO> consumersOf(Collection<ComponentDescriptionDTO> descriptions, Set<String> pids, long ownBundleId) {
        List<ComponentDescriptionDTO> consumers = new ArrayList<>();
        if (descriptions == null || pids.isEmpty()) {
            return consumers;
        }
        for (ComponentDescriptionDTO description : descriptions) {
            if (description.bundle != null && description.bundle.id == ownBundleId) {
                continue;
            }
            String[] configurationPids = description.configurationPid == null ? new String[0] : description.configurationPid;
            for (String configurationPid : configurationPids) {
                if (pids.contains(configurationPid)) {
                    consumers.add(description);
                    break;
                }
            }
        }
        return consumers;
    }

    /** Disables then enables each enabled component, without waiting. Returns the number restarted. */
    static int restart(ServiceComponentRuntime componentRuntime, List<ComponentDescriptionDTO> consumers) {
        int restarted = 0;
        for (ComponentDescriptionDTO description : consumers) {
            if (!componentRuntime.isComponentEnabled(description)) {
                continue;
            }
            try {
                componentRuntime.disableComponent(description).onResolve(() -> componentRuntime.enableComponent(description));
                restarted++;
            } catch (Exception e) {
                LOGGER.error("Could not restart component {}, which may still hold ENC(...) values", description.name, e);
            }
        }
        return restarted;
    }

    static boolean holdsEnvelope(Dictionary<String, Object> properties) {
        if (properties == null) {
            return false;
        }
        for (Object value : Collections.list(properties.elements())) {
            if (value instanceof String && EncryptedValuesConfigurationPlugin.isEnvelope((String) value)) {
                return true;
            }
            if (value instanceof String[]) {
                for (String element : (String[]) value) {
                    if (EncryptedValuesConfigurationPlugin.isEnvelope(element)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}
