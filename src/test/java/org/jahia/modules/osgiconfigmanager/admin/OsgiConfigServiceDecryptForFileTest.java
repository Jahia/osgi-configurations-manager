package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * File-bound decryption.
 *
 * <p>{@code decrypt} will decrypt anything it is handed, which made the action exposing it a
 * decryption oracle: a caller holding an {@code ENC(...)} string obtained anywhere else — a backup,
 * a git history, a log — could have it decrypted whether or not they may see the file it came from,
 * because the allow/blacklist only gates reading files.
 *
 * <p>{@code decryptForFile} binds the two: same authorization path as reading the file, plus the
 * ciphertext must actually appear in it.
 */
class OsgiConfigServiceDecryptForFileTest {

    private static final String PLAINTEXT = "round-trip-payload";

    private OsgiConfigService serviceIn(Path etc) {
        System.setProperty("karaf.etc", etc.toString());
        return new OsgiConfigService();
    }

    @AfterEach
    void clearSecret() {
        CryptoEngine.configureSecret(null);
    }

    /** Writes a .cfg holding one ENC(...) value and returns that wrapped value. */
    private String writeEncryptedFile(OsgiConfigService service, Path etc, String filename) throws IOException {
        CryptoEngine.configureSecret("test-instance-secret".toCharArray());
        String wrapped = service.encrypt(PLAINTEXT);
        Files.write(etc.resolve(filename), ("sample.value = " + wrapped + "\n").getBytes(StandardCharsets.UTF_8));
        return wrapped;
    }

    @Test
    @DisplayName("decrypts a value that really belongs to the named file")
    void decryptsValueBelongingToFile(@TempDir Path etc) throws IOException {
        OsgiConfigService service = serviceIn(etc);
        String wrapped = writeEncryptedFile(service, etc, "org.example.db.cfg");

        assertEquals(PLAINTEXT, service.decryptForFile("org.example.db.cfg", wrapped, true));
    }

    @Test
    @DisplayName("refuses a value that does not appear in the named file — this is the oracle being closed")
    void refusesValueForeignToFile(@TempDir Path etc) throws IOException {
        OsgiConfigService service = serviceIn(etc);
        // The ciphertext is genuine and decryptable, but it lives in another file. Under the old
        // decrypt(value) entry point this call would have succeeded.
        String wrapped = writeEncryptedFile(service, etc, "org.example.secrets.cfg");
        Files.write(etc.resolve("org.example.other.cfg"), "unrelated = 1\n".getBytes(StandardCharsets.UTF_8));

        IOException error = assertThrows(IOException.class,
                () -> service.decryptForFile("org.example.other.cfg", wrapped, true));
        assertTrue(error.getMessage().contains("does not belong to"), error.getMessage());
    }

    @Test
    @DisplayName("refuses a blacklisted file, so decryption cannot bypass the read restriction")
    void refusesBlacklistedFile(@TempDir Path etc) throws IOException {
        OsgiConfigService service = serviceIn(etc);
        String wrapped = writeEncryptedFile(service, etc, "org.example.db.cfg");

        Map<String, Object> props = new HashMap<>();
        props.put("filteredFiles", "org.example.db.cfg");
        service.updateConfig(props);

        IOException error = assertThrows(IOException.class,
                () -> service.decryptForFile("org.example.db.cfg", wrapped, false));
        assertTrue(error.getMessage().contains("Access denied"), error.getMessage());
    }

    @Test
    @DisplayName("refuses a traversal filename")
    void refusesTraversalFilename(@TempDir Path etc) throws IOException {
        OsgiConfigService service = serviceIn(etc);
        String wrapped = writeEncryptedFile(service, etc, "org.example.db.cfg");

        assertThrows(IOException.class,
                () -> service.decryptForFile("../../etc/passwd", wrapped, true));
    }

    @Test
    @DisplayName("refuses a file that does not exist")
    void refusesMissingFile(@TempDir Path etc) throws IOException {
        OsgiConfigService service = serviceIn(etc);
        String wrapped = writeEncryptedFile(service, etc, "org.example.db.cfg");

        IOException error = assertThrows(IOException.class,
                () -> service.decryptForFile("org.example.absent.cfg", wrapped, true));
        assertTrue(error.getMessage().contains("File not found"), error.getMessage());
    }

    @Test
    @DisplayName("a null value stays null without touching the filesystem")
    void nullValueReturnsNull(@TempDir Path etc) throws IOException {
        OsgiConfigService service = serviceIn(etc);

        assertNull(service.decryptForFile("whatever.cfg", null, true));
    }
}
