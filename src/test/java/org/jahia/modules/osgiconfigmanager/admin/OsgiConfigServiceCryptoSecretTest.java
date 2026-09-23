package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The manager's own {@code cryptoSecret} is the passphrase {@code ENC(...)} values are encrypted
 * with. It is declared as Password so the editor masks it, which also made the editor encrypt it by
 * default; stored as {@code ENC(...)} the literal envelope silently became the passphrase, because
 * the plugin skips the manager's PID on purpose. These tests pin the two guards: a save carrying an
 * encrypted passphrase is refused before anything touches the disk, and a value that reaches the
 * file anyway is ignored in favour of the generated per-instance secret.
 */
class OsgiConfigServiceCryptoSecretTest {

    private static final String SELF_FILE = "org.jahia.modules.osgiconfigmanager.cfg";
    private static final String PLAINTEXT = "round-trip-payload";

    private OsgiConfigService serviceIn(Path etc) {
        System.setProperty("karaf.etc", etc.toString());
        return new OsgiConfigService();
    }

    private static Map<String, Object> configWithSecret(String secret) {
        Map<String, Object> properties = new HashMap<>();
        properties.put("cryptoSecret", secret);
        return properties;
    }

    private static Map<String, Object> rawContent(String content) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("rawContent", content);
        return payload;
    }

    @AfterEach
    void clearSecret() {
        CryptoEngine.configureSecret(null);
    }

    @Test
    @DisplayName("an ENC(...) cryptoSecret is ignored: values stay readable with the generated secret")
    void encryptedPassphraseIsIgnored(@TempDir Path etc) {
        OsgiConfigService service = serviceIn(etc);
        service.updateConfig(configWithSecret(""));
        String wrapped = service.encrypt(PLAINTEXT);

        service.updateConfig(configWithSecret("ENC(v2:not-a-passphrase)"));

        assertEquals(PLAINTEXT, service.decrypt(wrapped), "the generated per-instance secret is still in use");
    }

    @Test
    @DisplayName("a clear-text cryptoSecret becomes the passphrase for new values")
    void clearPassphraseIsUsed(@TempDir Path etc) {
        OsgiConfigService service = serviceIn(etc);
        service.updateConfig(configWithSecret(""));
        String wrappedWithGeneratedSecret = service.encrypt(PLAINTEXT);

        service.updateConfig(configWithSecret("operator-passphrase"));

        // Encrypted under the previous key: handed back unchanged rather than failing the read.
        assertEquals(wrappedWithGeneratedSecret, service.decrypt(wrappedWithGeneratedSecret));
        String rewrapped = service.encrypt(PLAINTEXT);
        assertNotEquals(wrappedWithGeneratedSecret, rewrapped);
        assertEquals(PLAINTEXT, service.decrypt(rewrapped));
    }

    @Test
    @DisplayName("saving the manager's configuration with cryptoSecret = ENC(...) is refused and creates nothing")
    void refusesEncryptedPassphraseInRawContent(@TempDir Path etc) {
        OsgiConfigService service = serviceIn(etc);

        IOException refusal = assertThrows(IOException.class, () -> service.saveFile(SELF_FILE,
                rawContent("filteredFiles = org.apache.*\ncryptoSecret = ENC(v2:abc)\n")));

        assertEquals(OsgiConfigService.CRYPTO_SECRET_ENCRYPTED_MESSAGE, refusal.getMessage());
        assertFalse(Files.exists(etc.resolve(SELF_FILE)), "a refused save leaves no file behind");
    }

    @Test
    @DisplayName("the refusal also covers the disabled copy and the ':' separator")
    void refusesEncryptedPassphraseInDisabledCopy(@TempDir Path etc) {
        OsgiConfigService service = serviceIn(etc);

        assertThrows(IOException.class, () -> service.saveFile(SELF_FILE + ".disabled",
                rawContent("  cryptoSecret: ENC(v2:abc)\n")));
        assertFalse(Files.exists(etc.resolve(SELF_FILE + ".disabled")));
    }

    @Test
    @DisplayName("the refusal covers the structured entries payload as well as rawContent")
    void refusesEncryptedPassphraseInEntries(@TempDir Path etc) {
        OsgiConfigService service = serviceIn(etc);
        Map<String, Object> entry = new HashMap<>();
        entry.put("type", "property");
        entry.put("key", "cryptoSecret");
        entry.put("value", "ENC(v2:abc)");
        List<Map<String, Object>> entries = new ArrayList<>();
        entries.add(entry);
        Map<String, Object> payload = new HashMap<>();
        payload.put("properties", entries);

        assertThrows(IOException.class, () -> service.saveFile(SELF_FILE, payload));
        assertFalse(Files.exists(etc.resolve(SELF_FILE)));
    }

    @Test
    @DisplayName("a clear-text cryptoSecret is saved as it is")
    void acceptsClearPassphrase(@TempDir Path etc) throws IOException {
        OsgiConfigService service = serviceIn(etc);

        service.saveFile(SELF_FILE, rawContent("cryptoSecret = operator-passphrase\n"));

        String saved = Files.readString(etc.resolve(SELF_FILE), StandardCharsets.UTF_8);
        assertTrue(saved.contains("cryptoSecret = operator-passphrase"));
    }

    @Test
    @DisplayName("another module's property named cryptoSecret may be encrypted like any other secret")
    void otherFilesAreNotConcerned(@TempDir Path etc) throws IOException {
        OsgiConfigService service = serviceIn(etc);

        service.saveFile("org.example.other.cfg", rawContent("cryptoSecret = ENC(v2:abc)\n"));

        assertTrue(Files.exists(etc.resolve("org.example.other.cfg")));
    }

    @Test
    @DisplayName("only the manager's own cryptoSecret counts as the passphrase")
    void passphraseIsBoundToTheManagerPid(@TempDir Path etc) {
        OsgiConfigService service = serviceIn(etc);

        assertTrue(service.isEncryptionPassphrase(OsgiConfigService.SELF_CONFIG_PID, "cryptoSecret"));
        assertFalse(service.isEncryptionPassphrase(OsgiConfigService.SELF_CONFIG_PID, "filteredFiles"));
        assertFalse(service.isEncryptionPassphrase("org.acme.jira", "cryptoSecret"));
    }
}
