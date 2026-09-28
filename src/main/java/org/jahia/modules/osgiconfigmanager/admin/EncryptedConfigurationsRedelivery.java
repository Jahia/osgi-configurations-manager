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
 * <p>Configuration Admin consults plugins at delivery time only, and Service Component Runtime
 * keeps what it received. A consumer bundle that starts before this one receives its values as
 * stored, and nothing delivers them again when the plugin appears. That is the ordinary case, not
 * an accident: when this bundle is updated, Felix refreshes its dependents and starts them again in
 * bundle id order, and a consumer installed before the manager starts first; the same holds at
 * every restart of the server. The consumer then connects with the {@code ENC(...)} string as its
 * password, and no decryption error is logged because no decryption was attempted.
 *
 * <p>Two lighter ways were tried on a cluster and do not work: {@code Configuration.update()}
 * without arguments leaves the change count as it is, and SCR ignores it; disabling and enabling
 * the consumer components reuses the configuration SCR already holds. What works is what an
 * administrator does when saving the file: an update. Each configuration is written back with its
 * own stored properties, envelopes included, so the file content does not change, while the new
 * change count makes SCR fetch it again, through the plugin.
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
            LOGGER.info("[AUDIT] Delivered again {} configuration(s) holding ENC(...) values (stored values unchanged),"
                    + " so their consumers read them decrypted now that the plugin is registered", redelivered);
        }
    }

    /**
     * Writes back, unchanged, each configuration holding an envelope, the manager's own excepted.
     * Returns the number delivered again.
     */
    static int redeliver(ConfigurationAdmin configurationAdmin) {
        Configuration[] configurations;
        try {
            configurations = configurationAdmin.listConfigurations(null);
        } catch (Exception e) {
            LOGGER.error("Could not list the configurations holding ENC(...) values", e);
            return 0;
        }
        if (configurations == null) {
            return 0;
        }
        int redelivered = 0;
        for (Configuration configuration : configurations) {
            String pid = configuration.getPid();
            long changeCount = configuration.getChangeCount();
            Dictionary<String, Object> properties = configuration.getProperties();
            if (OsgiConfigService.SELF_CONFIG_PID.equals(pid) || !holdsEnvelope(properties)) {
                continue;
            }
            try {
                // Changed since it was read (FileInstall, an administrator, the cluster): that
                // update was delivered through the plugin already, and writing back the copy read
                // above would revert it, on disk and on the other nodes.
                if (changedSince(configurationAdmin, pid, changeCount)) {
                    LOGGER.info("Configuration {} changed while being delivered again; left as is", pid);
                    continue;
                }
                // The stored properties themselves (the plugin does not touch getProperties()),
                // felix.fileinstall.filename included so the configuration stays bound to its file.
                configuration.update(properties);
                redelivered++;
            } catch (Exception e) {
                LOGGER.error("Could not deliver configuration {} again through the decryption plugin", pid, e);
            }
        }
        return redelivered;
    }

    /** Whether the configuration's change count moved, read again from Configuration Admin. */
    static boolean changedSince(ConfigurationAdmin configurationAdmin, String pid, long changeCount) throws Exception {
        Configuration[] current = configurationAdmin.listConfigurations("(service.pid=" + escapeFilterValue(pid) + ")");
        return current == null || current.length == 0 || current[0].getChangeCount() != changeCount;
    }

    /** RFC 1960 escaping of a filter value. */
    static String escapeFilterValue(String value) {
        StringBuilder out = new StringBuilder(value.length());
        for (char c : value.toCharArray()) {
            if (c == '\\' || c == '*' || c == '(' || c == ')') {
                out.append('\\');
            }
            out.append(c);
        }
        return out.toString();
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
