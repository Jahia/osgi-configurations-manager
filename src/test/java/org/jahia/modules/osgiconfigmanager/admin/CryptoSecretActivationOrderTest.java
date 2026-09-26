package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The operator's {@code cryptoSecret} is applied when {@link OsgiConfigService} activates. When that
 * component was delayed, it activated only once someone opened the admin screen: after a restart, or
 * on a cluster node nobody browsed, the ConfigurationPlugin decrypted with the node's generated secret
 * and every value encrypted with {@code cryptoSecret} was delivered as stored (seen on a two-node
 * cluster, where only one node could decrypt). The Declarative Services annotations have class
 * retention and the descriptors are generated at packaging time, so this guards the source.
 */
class CryptoSecretActivationOrderTest {

    private static String source(String className) throws IOException {
        return new String(Files.readAllBytes(Paths.get("src/main/java/org/jahia/modules/osgiconfigmanager/admin/" + className + ".java")),
                StandardCharsets.UTF_8);
    }

    @Test
    @DisplayName("the plugin holds a mandatory reference to OsgiConfigService, so the secret is applied before it decrypts")
    void pluginReferencesTheSecretHolder() throws IOException {
        String plugin = source("EncryptedValuesConfigurationPlugin");
        assertTrue(Pattern.compile("@Reference\\s+private OsgiConfigService \\w+;").matcher(plugin).find(),
                "EncryptedValuesConfigurationPlugin must keep a static, mandatory @Reference to OsgiConfigService");
    }

    @Test
    @DisplayName("OsgiConfigService is immediate")
    void serviceIsImmediate() throws IOException {
        String service = source("OsgiConfigService");
        assertTrue(Pattern.compile("@Component\\([^)]*immediate = true[^)]*\\)\\s*@Designate").matcher(service).find(),
                "OsgiConfigService must be declared immediate = true");
    }
}
