package org.jahia.modules.osgiconfigmanager.admin;

import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.ConfigurationPolicy;
import org.osgi.service.component.annotations.Deactivate;
import org.osgi.service.component.annotations.Modified;
import org.osgi.service.metatype.annotations.AttributeDefinition;
import org.osgi.service.metatype.annotations.AttributeType;
import org.osgi.service.metatype.annotations.Designate;
import org.osgi.service.metatype.annotations.ObjectClassDefinition;

import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * A consumer that exists to be observed. It has its own PID and receives its configuration the way
 * any other module does, through Declarative Services, so what it sees is exactly what a real
 * consumer would see after {@link EncryptedValuesConfigurationPlugin} ran.
 *
 * <p>Create {@code org.jahia.modules.osgiconfigmanager.probe.cfg}, put an {@code ENC(...)} value
 * in it, and ask {@code ?action=pluginProbe}: the answer says, key by key, whether the delivered
 * value was plaintext or still an envelope. The values themselves are never exposed, only their
 * shape. With {@link ConfigurationPolicy#REQUIRE} the component, and the probe service with it,
 * exists only while the file does.
 */
@Component(service = ConfigurationPluginProbe.class, immediate = true,
        configurationPid = ConfigurationPluginProbe.PID, configurationPolicy = ConfigurationPolicy.REQUIRE)
@Designate(ocd = ConfigurationPluginProbe.Config.class)
public class ConfigurationPluginProbe {

    static final String PID = "org.jahia.modules.osgiconfigmanager.probe";
    static final String SHAPE_PLAINTEXT = "plaintext";
    static final String SHAPE_ENCRYPTED = "encrypted";

    @ObjectClassDefinition(name = "OSGi Configurations Manager - decryption probe",
            description = "Diagnostic configuration. Encrypt probe.secret in the manager, then call the "
                    + "pluginProbe action to check that modules receive decrypted values. "
                    + "Delete this file when you are done.")
    public @interface Config {

        @AttributeDefinition(name = "Probe secret", type = AttributeType.PASSWORD, required = false,
                description = "Any value. Encrypt it with the manager: the probe reports whether it was "
                        + "delivered decrypted.")
        String probe_secret() default "";

        @AttributeDefinition(name = "Probe plain value", required = false,
                description = "A control value that stays in clear.")
        String probe_plain() default "";
    }

    private volatile Map<String, String> deliveredShapes = Collections.emptyMap();
    private volatile String receivedAt;

    @Activate
    @Modified
    public void activate(Map<String, Object> properties) {
        deliveredShapes = describe(properties);
        receivedAt = Instant.now().toString();
    }

    @Deactivate
    public void deactivate() {
        deliveredShapes = Collections.emptyMap();
        receivedAt = null;
    }

    /** Key -> {@code plaintext} | {@code encrypted}, for the properties of the last delivery. */
    public Map<String, String> deliveredShapes() {
        return deliveredShapes;
    }

    public String receivedAt() {
        return receivedAt;
    }

    /**
     * Package-private seam. Framework properties ({@code service.*}, {@code felix.*}) are left out;
     * everything else is reported by shape only.
     */
    static Map<String, String> describe(Map<String, Object> properties) {
        Map<String, String> shapes = new LinkedHashMap<>();
        if (properties == null) {
            return Collections.unmodifiableMap(shapes);
        }
        for (Map.Entry<String, Object> entry : properties.entrySet()) {
            String key = entry.getKey();
            if (key == null || key.startsWith("service.") || key.startsWith("felix.") || key.startsWith("component.")) {
                continue;
            }
            Object value = entry.getValue();
            boolean encrypted = value instanceof String && EncryptedValuesConfigurationPlugin.isEnvelope((String) value);
            shapes.put(key, encrypted ? SHAPE_ENCRYPTED : SHAPE_PLAINTEXT);
        }
        return Collections.unmodifiableMap(shapes);
    }
}
