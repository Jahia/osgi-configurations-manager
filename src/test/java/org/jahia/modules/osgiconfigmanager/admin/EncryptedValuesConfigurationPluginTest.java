package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.osgi.framework.Constants;

import java.util.Dictionary;
import java.util.Hashtable;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The ConfigurationPlugin that hands consumers plaintext. The OSGi contract is one call; what
 * matters is what it does to the dictionary, so the tests drive the package-private seam.
 */
class EncryptedValuesConfigurationPluginTest {

    private static final String SECRET_A = "instance-a-secret";
    private static final String SECRET_B = "instance-b-secret";

    @BeforeEach
    void useSecretA() {
        CryptoEngine.configureSecret(SECRET_A.toCharArray());
    }

    @AfterEach
    void clearSecret() {
        CryptoEngine.configureSecret(null);
    }

    private static String enc(String plaintext) {
        return "ENC(" + CryptoEngine.encryptString(plaintext) + ")";
    }

    private static Dictionary<String, Object> configuration(String pid) {
        Dictionary<String, Object> properties = new Hashtable<>();
        properties.put(Constants.SERVICE_PID, pid);
        return properties;
    }

    @Test
    @DisplayName("an ENC(...) value is replaced by its plaintext in the delivered dictionary")
    void envelopeIsDecrypted() {
        Dictionary<String, Object> properties = configuration("org.acme.jira");
        properties.put("jira.token", enc("s3cr3t-token"));
        properties.put("jira.url", "https://jira.example.org");

        int decrypted = EncryptedValuesConfigurationPlugin.decryptValues(properties);

        assertEquals(1, decrypted);
        assertEquals("s3cr3t-token", properties.get("jira.token"));
        assertEquals("https://jira.example.org", properties.get("jira.url"), "plaintext values are untouched");
        assertEquals("org.acme.jira", properties.get(Constants.SERVICE_PID), "framework properties are untouched");
    }

    @Test
    @DisplayName("the plugin entry point delegates to the seam")
    void modifyConfigurationDelegates() {
        Dictionary<String, Object> properties = configuration("org.acme.jira");
        properties.put("jira.token", enc("through-the-contract"));

        new EncryptedValuesConfigurationPlugin().modifyConfiguration(null, properties);

        assertEquals("through-the-contract", properties.get("jira.token"));
    }

    @Test
    @DisplayName("an undecryptable value is delivered as stored, without throwing")
    void undecryptableValueIsKept() {
        Dictionary<String, Object> properties = configuration("org.acme.jira");
        String foreign = enc("encrypted-elsewhere");
        properties.put("jira.token", foreign);
        properties.put("jira.url", "https://jira.example.org");

        // Same envelope, another instance's secret: the realistic failure.
        CryptoEngine.configureSecret(SECRET_B.toCharArray());
        int decrypted = assertDoesNotThrow(() -> EncryptedValuesConfigurationPlugin.decryptValues(properties));

        assertEquals(0, decrypted);
        assertEquals(foreign, properties.get("jira.token"), "the key stays, with its stored value");
        assertEquals("https://jira.example.org", properties.get("jira.url"), "the rest of the configuration is delivered");
    }

    @Test
    @DisplayName("a malformed envelope is delivered as stored, without throwing")
    void malformedEnvelopeIsKept() {
        Dictionary<String, Object> properties = configuration("org.acme.jira");
        properties.put("jira.token", "ENC(not-base64-at-all)");

        assertDoesNotThrow(() -> EncryptedValuesConfigurationPlugin.decryptValues(properties));
        assertEquals("ENC(not-base64-at-all)", properties.get("jira.token"));
    }

    @Test
    @DisplayName("the manager's own configuration is never processed")
    void selfConfigurationIsSkipped() {
        Dictionary<String, Object> properties = configuration(OsgiConfigService.SELF_CONFIG_PID);
        String envelope = enc("would-be-decrypted-elsewhere");
        properties.put("cryptoSecret", envelope);

        assertEquals(0, EncryptedValuesConfigurationPlugin.decryptValues(properties));
        assertEquals(envelope, properties.get("cryptoSecret"));
    }

    @Test
    @DisplayName("string arrays are decrypted element by element")
    void stringArraysAreHandled() {
        Dictionary<String, Object> properties = configuration("org.acme.multi");
        properties.put("tokens", new String[] {enc("one"), "plain", enc("two")});

        assertEquals(2, EncryptedValuesConfigurationPlugin.decryptValues(properties));
        assertArrayEquals(new String[] {"one", "plain", "two"}, (String[]) properties.get("tokens"));
    }

    @Test
    @DisplayName("non-string values and a null dictionary are left alone")
    void otherTypesAndNullAreIgnored() {
        Dictionary<String, Object> properties = configuration("org.acme.typed");
        properties.put("port", 3306);
        properties.put("enabled", Boolean.TRUE);

        assertEquals(0, EncryptedValuesConfigurationPlugin.decryptValues(properties));
        assertEquals(3306, properties.get("port"));
        assertEquals(Boolean.TRUE, properties.get("enabled"));
        assertEquals(0, EncryptedValuesConfigurationPlugin.decryptValues(null));
    }

    @Test
    @DisplayName("only a complete ENC(...) wrapper counts as an envelope")
    void envelopeDetection() {
        assertTrue(EncryptedValuesConfigurationPlugin.isEnvelope("ENC(abc)"));
        assertFalse(EncryptedValuesConfigurationPlugin.isEnvelope("ENC()"), "an empty wrapper is not a value");
        assertFalse(EncryptedValuesConfigurationPlugin.isEnvelope("ENC(abc"));
        assertFalse(EncryptedValuesConfigurationPlugin.isEnvelope("enc(abc)"));
        assertFalse(EncryptedValuesConfigurationPlugin.isEnvelope("plain"));
        assertFalse(EncryptedValuesConfigurationPlugin.isEnvelope(null));
    }
}
