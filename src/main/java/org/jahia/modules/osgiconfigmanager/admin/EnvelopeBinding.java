package org.jahia.modules.osgiconfigmanager.admin;

import java.util.Dictionary;
import java.util.Locale;

/**
 * The configuration an encrypted value belongs to, as the additional authenticated data of its v3
 * envelope (SEC-603). It is the configuration file's name without its extension, {@code .disabled}
 * suffix or case, the same for every spelling Karaf applies to one configuration, so disabling,
 * re-enabling or switching between {@code .cfg} and {@code .yml} keeps the values readable, while a
 * value copied into another configuration no longer decrypts.
 */
final class EnvelopeBinding {

    static final String FILEINSTALL_FILENAME = "felix.fileinstall.filename";
    private static final String PREFIX = "osgi-config:";

    private EnvelopeBinding() {
    }

    /** The binding of a configuration file, from its name or path. */
    static String ofFile(String filenameOrPath) {
        String name = filenameOrPath;
        int slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
        if (slash >= 0) {
            name = name.substring(slash + 1);
        }
        return PREFIX + ConfigFileFilter.configurationStem(name);
    }

    /**
     * The binding of a configuration being delivered: from the file FileInstall read it from, else
     * from its PID (a configuration that has no file).
     */
    static String ofDelivered(Dictionary<String, Object> properties) {
        Object file = properties == null ? null : properties.get(FILEINSTALL_FILENAME);
        if (file != null && !String.valueOf(file).trim().isEmpty()) {
            return ofFile(String.valueOf(file).trim());
        }
        Object pid = properties == null ? null : properties.get("service.pid");
        return PREFIX + String.valueOf(pid).toLowerCase(Locale.ROOT);
    }
}
