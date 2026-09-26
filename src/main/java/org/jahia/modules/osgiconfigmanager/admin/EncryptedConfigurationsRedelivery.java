package org.jahia.modules.osgiconfigmanager.admin;

import org.osgi.service.cm.Configuration;
import org.osgi.service.cm.ConfigurationAdmin;
import org.osgi.service.cm.ConfigurationPlugin;
import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Collections;
import java.util.Dictionary;

/**
 * Delivers again, through the decryption plugin, every configuration holding {@code ENC(...)}
 * values, once the plugin is registered.
 *
 * <p>Configuration Admin consults plugins at delivery time only. A consumer bundle that starts
 * before this one receives its values as stored, and nothing re-delivers them when the plugin
 * appears. That is the ordinary case, not an accident: when this bundle is updated, Felix refreshes
 * its dependents and starts them again in bundle id order, and a consumer installed before the
 * manager starts first; the same holds at every restart of the server. The consumer then connects
 * with the {@code ENC(...)} string as its password, and no decryption error is logged because no
 * decryption was attempted.
 *
 * <p>{@link Configuration#update()} without arguments re-delivers the stored properties without
 * changing them, so the file is not rewritten and the cluster sees no new value.
 */
@Component(immediate = true)
public class EncryptedConfigurationsRedelivery {

    private static final Logger LOGGER = LoggerFactory.getLogger(EncryptedConfigurationsRedelivery.class);

    /** Only for the ordering: this component activates once the plugin is registered. */
    @Reference(target = "(component.name=org.jahia.modules.osgiconfigmanager.admin.EncryptedValuesConfigurationPlugin)")
    private ConfigurationPlugin plugin;

    @Reference
    private ConfigurationAdmin configurationAdmin;

    @Activate
    void activate() {
        int redelivered = redeliver(configurationAdmin);
        if (redelivered > 0) {
            LOGGER.info("[AUDIT] Delivered again {} configuration(s) holding ENC(...) values, now that the decryption plugin is registered",
                    redelivered);
        }
    }

    /** Re-delivers the configurations holding at least one envelope, the manager's own excepted. Returns their number. */
    static int redeliver(ConfigurationAdmin configurationAdmin) {
        Configuration[] configurations;
        try {
            configurations = configurationAdmin.listConfigurations(null);
        } catch (Exception e) {
            LOGGER.error("Could not list the configurations to deliver them again through the decryption plugin", e);
            return 0;
        }
        if (configurations == null) {
            return 0;
        }
        int redelivered = 0;
        for (Configuration configuration : configurations) {
            String pid = configuration.getPid();
            if (OsgiConfigService.SELF_CONFIG_PID.equals(pid) || !holdsEnvelope(configuration.getProperties())) {
                continue;
            }
            try {
                configuration.update();
                redelivered++;
            } catch (Exception e) {
                LOGGER.error("Could not deliver configuration {} again through the decryption plugin", pid, e);
            }
        }
        return redelivered;
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
