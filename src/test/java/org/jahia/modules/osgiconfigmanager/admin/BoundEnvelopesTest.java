package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Hashtable;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * SEC-603: an encrypted value is bound to the configuration it was made for. Copied into a file the
 * caller may write, it is neither decrypted by the manager nor delivered decrypted by the plugin; the
 * one-time migration binds the existing values, after which unbound ones are refused.
 */
class BoundEnvelopesTest {

    @TempDir
    Path etc;
    private String previousEtc;

    @BeforeEach
    void setUp() {
        previousEtc = System.getProperty("karaf.etc");
        System.setProperty("karaf.etc", etc.toString());
        CryptoEngine.configureSecret("test-instance-secret".toCharArray());
        CryptoEngine.resetUnboundState();
    }

    @AfterEach
    void tearDown() {
        CryptoEngine.configureSecret(null);
        CryptoEngine.resetUnboundState();
        if (previousEtc == null) {
            System.clearProperty("karaf.etc");
        } else {
            System.setProperty("karaf.etc", previousEtc);
        }
    }

    private static String inner(String wrapped) {
        return wrapped.substring("ENC(".length(), wrapped.length() - 1);
    }

    private void write(String name, String content) throws IOException {
        Files.write(etc.resolve(name), content.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    @DisplayName("a v3 value decrypts in its configuration only, whatever the spelling of the file")
    void boundToItsConfiguration() {
        String envelope = CryptoEngine.encryptBound("s3cret", EnvelopeBinding.ofFile("org.acme.secretstore.cfg"));
        assertTrue(envelope.startsWith("v3:"));
        assertEquals("s3cret", CryptoEngine.decryptBound(envelope, EnvelopeBinding.ofFile("org.acme.secretstore.yml")));
        assertEquals("s3cret", CryptoEngine.decryptBound(envelope, EnvelopeBinding.ofFile("ORG.ACME.SECRETSTORE.cfg.disabled")));
        assertThrows(IllegalStateException.class,
                () -> CryptoEngine.decryptBound(envelope, EnvelopeBinding.ofFile("org.acme.scratch.cfg")));
        assertThrows(IllegalStateException.class, () -> CryptoEngine.decryptString(envelope),
                "the unbound API cannot open a bound value");
    }

    @Test
    @DisplayName("the binding of a delivered configuration comes from its file")
    void bindingOfDeliveredConfiguration() {
        Hashtable<String, Object> properties = new Hashtable<>();
        properties.put("service.pid", "org.acme.database~licenses");
        properties.put(EnvelopeBinding.FILEINSTALL_FILENAME, "file:/opt/jahia/karaf/etc/org.acme.database-licenses.cfg");
        assertEquals(EnvelopeBinding.ofFile("org.acme.database-licenses.cfg"), EnvelopeBinding.ofDelivered(properties));
        properties.remove(EnvelopeBinding.FILEINSTALL_FILENAME);
        assertEquals("osgi-config:org.acme.database~licenses", EnvelopeBinding.ofDelivered(properties));
    }

    @Test
    @DisplayName("a value planted in a file the caller may write is not decrypted by the decrypt operation")
    void plantedValueIsNotDecrypted() throws IOException {
        OsgiConfigService service = new OsgiConfigService();
        Map<String, Object> filter = new LinkedHashMap<>();
        filter.put("filteredFiles", "org.acme.secretstore.cfg");
        service.updateConfig(filter);
        String stolen = service.encrypt("s3cret", "org.acme.secretstore.cfg");
        write("org.acme.secretstore.cfg", "token = " + stolen + "\n");

        // The delegated administrator copies the envelope into a file they may write, then asks for it.
        write("org.acme.scratch.cfg", "x = " + stolen + "\n");
        String answer = service.decryptForFile("org.acme.scratch.cfg", stolen, false);
        assertNotEquals("s3cret", answer, "SEC-603: the planted value must not come back in clear");
        assertEquals(stolen, answer, "the value is handed back as stored");

        // Where the operator lets someone read the file it belongs to, it still decrypts.
        service.updateConfig(new LinkedHashMap<>(java.util.Collections.singletonMap("filteredFiles", "")));
        assertEquals("s3cret", service.decryptForFile("org.acme.secretstore.cfg", stolen, false));
    }

    @Test
    @DisplayName("a value planted in another configuration is delivered as stored by the plugin")
    void plantedValueIsNotDeliveredDecrypted() {
        String stolen = "ENC(" + CryptoEngine.encryptBound("s3cret", EnvelopeBinding.ofFile("org.acme.secretstore.cfg")) + ")";
        Hashtable<String, Object> planted = new Hashtable<>();
        planted.put("service.pid", "org.jahia.support.externaltools.jira");
        planted.put(EnvelopeBinding.FILEINSTALL_FILENAME, "file:/karaf/etc/org.jahia.support.externaltools.jira.cfg");
        planted.put("jira.url", "https://attacker.example");
        planted.put("jira.token", stolen);
        EncryptedValuesConfigurationPlugin.decryptValues(planted);
        assertEquals(stolen, planted.get("jira.token"), "SEC-603: not sent in clear to the attacker's URL");

        Hashtable<String, Object> own = new Hashtable<>();
        own.put("service.pid", "org.acme.secretstore");
        own.put(EnvelopeBinding.FILEINSTALL_FILENAME, "file:/karaf/etc/org.acme.secretstore.cfg");
        own.put("token", stolen);
        EncryptedValuesConfigurationPlugin.decryptValues(own);
        assertEquals("s3cret", own.get("token"));
    }

    @Test
    @DisplayName("the migration binds the existing values in place, keeps the files as written, then refuses unbound values")
    @SuppressWarnings("deprecation")
    void migrationBindsThenRefusesUnbound() throws IOException {
        String v2 = "ENC(" + CryptoEngine.encryptString("db-password") + ")";
        String cfg = "# Database\n# keep this comment\nhost = db.example.org\npassword = " + v2 + "\n\n# trailer\n";
        write("org.acme.database-licenses.cfg", cfg);
        write("org.acme.slack.yml", "slack:\n  # the bot token\n  token: \"" + "ENC(" + CryptoEngine.encryptString("xoxb") + ")\"\n");
        write("org.jahia.modules.osgiconfigmanager.cfg", "cryptoSecret = test-instance-secret\n");
        write("org.acme.foreign.cfg", "token = ENC(v2:AAAA:BBBBBBBBBBBBBBBB:CCCC)\n");
        write("org.acme.template.cfg", "# token is a secret: keep it encrypted (ENC(...))\n# token = ENC(v2:AAAA:BBBBBBBBBBBBBBBB:CCCC)\n  ! other = ENC(abc)\n");
        write("notes.txt", "token = " + v2 + "\n");

        EnvelopeMigration.Result result = EnvelopeMigration.runOnce(etc, OsgiConfigService.SELF_CONFIG_PID);

        assertEquals(2, result.rebound);
        assertEquals(1, result.undecryptable);
        assertFalse(result.rewrittenFiles.contains("org.acme.template.cfg"), "comment hints are not values");
        assertTrue(result.rewrittenFiles.contains("org.acme.database-licenses.cfg"));
        String migrated = new String(Files.readAllBytes(etc.resolve("org.acme.database-licenses.cfg")), StandardCharsets.UTF_8);
        assertTrue(migrated.startsWith("# Database\n# keep this comment\nhost = db.example.org\npassword = ENC(v3:"), migrated);
        assertTrue(migrated.endsWith(")\n\n# trailer\n"), "the rest of the file is untouched");
        String bound = migrated.substring(migrated.indexOf("ENC(") + 4, migrated.indexOf(")", migrated.indexOf("ENC(")));
        assertEquals("db-password", CryptoEngine.decryptBound(bound, EnvelopeBinding.ofFile("org.acme.database-licenses.cfg")));
        assertTrue(new String(Files.readAllBytes(etc.resolve("org.acme.slack.yml")), StandardCharsets.UTF_8).contains("# the bot token"));
        assertEquals("token = " + v2 + "\n", new String(Files.readAllBytes(etc.resolve("notes.txt")), StandardCharsets.UTF_8),
                "not a configuration file");
        assertTrue(Files.exists(CryptoEngine.migrationMarkerPath()));

        // From now on an unbound value, planted after the migration, is refused.
        assertThrows(IllegalStateException.class, () -> CryptoEngine.decryptBound(inner(v2), EnvelopeBinding.ofFile("org.acme.scratch.cfg")));
        CryptoEngine.resetUnboundState();
        assertFalse(CryptoEngine.unboundAccepted(), "the marker keeps the refusal across restarts");
        assertEquals(0, EnvelopeMigration.runOnce(etc, OsgiConfigService.SELF_CONFIG_PID).rebound, "runs once");
    }
}
