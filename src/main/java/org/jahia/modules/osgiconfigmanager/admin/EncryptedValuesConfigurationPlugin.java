package org.jahia.modules.osgiconfigmanager.admin;

import org.osgi.framework.Constants;
import org.osgi.framework.ServiceReference;
import org.osgi.service.cm.ConfigurationPlugin;
import org.osgi.service.component.annotations.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Collections;
import java.util.Dictionary;

/**
 * Decrypts {@code ENC(...)} values on their way from Configuration Admin to the component that
 * owns the configuration, so a consumer module receives plaintext in its {@code @Activate} and
 * never touches {@link CryptoEngine} itself.
 *
 * <p>This is the standard {@link ConfigurationPlugin} extension point of the Configuration Admin
 * specification: Configuration Admin calls every registered plugin with a copy of the properties
 * right before delivering them to a {@code ManagedService}, a {@code ManagedServiceFactory} or, on
 * an R7 stack such as Jahia 8.2 (Felix ConfigAdmin 1.9 + SCR 2.1), a Declarative Services
 * component. Only the delivered copy is modified; the file on disk keeps its {@code ENC(...)}
 * values.
 *
 * <p>Two rules, both deliberate:
 * <ul>
 *   <li><b>An undecryptable value is delivered as stored, and an error is logged</b> naming the PID
 *       and the key. A value encrypted on another instance, or with a secret that has since
 *       changed, must not prevent the component from starting; its connection fails, and the log
 *       says why. Removing the key instead would make the failure look like a missing setting.</li>
 *   <li><b>The manager's own configuration is never processed.</b> It carries the secret every
 *       other value is decrypted with, so decrypting it with itself is meaningless, and a
 *       misconfigured {@code cryptoSecret} must not be able to lock the manager out.</li>
 * </ul>
 *
 * <p>Plugins are only consulted at delivery time. A component that started before this bundle
 * received its {@code ENC(...)} values raw and is not re-delivered when the plugin appears, so a
 * consumer must declare {@code Jahia-Depends: osgi-configurations-manager}.
 */
@Component(service = ConfigurationPlugin.class, immediate = true,
        property = ConfigurationPlugin.CM_RANKING + ":Integer=" + EncryptedValuesConfigurationPlugin.RANKING)
public class EncryptedValuesConfigurationPlugin implements ConfigurationPlugin {

    private static final Logger LOGGER = LoggerFactory.getLogger(EncryptedValuesConfigurationPlugin.class);

    /**
     * Within the [-1000, 1000] band where the specification allows a plugin to modify properties,
     * and after Felix's interpolation plugin, so a placeholder that resolves to an envelope is
     * decrypted too.
     */
    static final int RANKING = 900;

    static final String ENC_PREFIX = "ENC(";
    static final String ENC_SUFFIX = ")";

    @Override
    public void modifyConfiguration(ServiceReference<?> reference, Dictionary<String, Object> properties) {
        decryptValues(properties);
    }

    /**
     * Replaces every {@code ENC(...)} string (or string array element) of {@code properties} with
     * its plaintext, in place. Returns the number of values decrypted.
     *
     * <p>Package-private seam: the OSGi contract above is one line, the behaviour is here.
     */
    static int decryptValues(Dictionary<String, Object> properties) {
        if (properties == null) {
            return 0;
        }

        String pid = String.valueOf(properties.get(Constants.SERVICE_PID));
        if (OsgiConfigService.SELF_CONFIG_PID.equals(pid)) {
            LOGGER.debug("Skipping the manager's own configuration {}", pid);
            return 0;
        }

        int decrypted = 0;
        for (String key : Collections.list(properties.keys())) {
            Object value = properties.get(key);
            if (value instanceof String) {
                String plain = decryptOrKeep(pid, key, (String) value);
                if (plain != null) {
                    properties.put(key, plain);
                    decrypted++;
                }
            } else if (value instanceof String[]) {
                String[] values = ((String[]) value).clone();
                boolean changed = false;
                for (int i = 0; i < values.length; i++) {
                    String plain = decryptOrKeep(pid, key, values[i]);
                    if (plain != null) {
                        values[i] = plain;
                        changed = true;
                        decrypted++;
                    }
                }
                if (changed) {
                    properties.put(key, values);
                }
            }
        }

        if (decrypted > 0) {
            LOGGER.debug("Decrypted {} value(s) delivered to {}", decrypted, pid);
        }
        return decrypted;
    }

    static boolean isEnvelope(String value) {
        return value != null && value.length() > ENC_PREFIX.length() + ENC_SUFFIX.length()
                && value.startsWith(ENC_PREFIX) && value.endsWith(ENC_SUFFIX);
    }

    /** The plaintext when {@code value} is a decryptable envelope, {@code null} otherwise. */
    private static String decryptOrKeep(String pid, String key, String value) {
        if (!isEnvelope(value)) {
            return null;
        }
        String cipherText = value.substring(ENC_PREFIX.length(), value.length() - ENC_SUFFIX.length());
        try {
            return CryptoEngine.decryptString(cipherText);
        } catch (IllegalStateException e) {
            // Delivered as stored, on purpose: see the class comment. The value itself is never
            // logged, it is a secret even when we cannot read it.
            LOGGER.error("[AUDIT] Could not decrypt property '{}' of configuration {}: the value is delivered "
                    + "as stored. Check the encryption secret of this instance ({})", key, pid, e.getMessage());
            return null;
        }
    }
}
