package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Characterization tests for the filesystem-facing behaviour of {@link OsgiConfigService}.
 *
 * <p>These lock the current behaviour of filename validation, configuration-state detection,
 * CRUD operations and the .cfg parse/serialize round-trip so the planned refactors (god-method
 * split, crypto hardening, error-handling changes) can be made without silent regressions.
 *
 * <p>The service reads {@code karaf.etc} once in its constructor, so the system property is set
 * to a per-test temp directory before the service is instantiated.
 */
class OsgiConfigServiceFilesystemTest {

    @TempDir
    Path etcDir;

    private OsgiConfigService service;

    @BeforeEach
    void setUp() {
        System.setProperty("karaf.etc", etcDir.toString());
        // These tests exercise encrypt() without a configured key, so opt into the built-in default
        // key explicitly (encrypt now fails closed otherwise).
        System.setProperty(CryptoEngine.ALLOW_DEFAULT_KEY_PROPERTY, "true");
        service = new OsgiConfigService();
    }

    @AfterEach
    void tearDown() {
        System.clearProperty(CryptoEngine.ALLOW_DEFAULT_KEY_PROPERTY);
    }

    private void writeConfig(String name, String content) throws IOException {
        Files.write(etcDir.resolve(name), content.getBytes(StandardCharsets.UTF_8));
    }

    // ---------------------------------------------------------------------
    // Filename validation / path-traversal defence
    // ---------------------------------------------------------------------

    @Nested
    @DisplayName("filename validation")
    class FilenameValidation {

        @ParameterizedTest(name = "rejects \"{0}\"")
        @ValueSource(strings = {
                "../evil.cfg",
                "../../etc/passwd.cfg",
                "foo/bar.cfg",
                "..\\evil.cfg",
                "/etc/passwd.cfg",
                "dir/../escape.cfg"
        })
        @DisplayName("createFile rejects traversal/multi-segment filenames")
        void createFile_traversalFilename_throwsInvalidFilename(String filename) {
            IOException ex = assertThrows(IOException.class, () -> service.createFile(filename, true));
            assertTrue(ex.getMessage().contains("Invalid configuration filename"),
                    "Unexpected message: " + ex.getMessage());
            assertFalse(Files.exists(etcDir.resolve("evil.cfg")), "No file must be created on rejection");
        }

        @ParameterizedTest(name = "rejects unsupported \"{0}\"")
        @ValueSource(strings = {"evil.txt", "config.properties", "notes.md", "archive.cfg.bak"})
        @DisplayName("createFile rejects unsupported extensions")
        void createFile_unsupportedExtension_throwsInvalidFilename(String filename) {
            IOException ex = assertThrows(IOException.class, () -> service.createFile(filename, true));
            assertTrue(ex.getMessage().contains("Invalid configuration filename"),
                    "Unexpected message: " + ex.getMessage());
        }

        @Test
        @DisplayName("createFile rejects blank filename")
        void createFile_blank_throwsInvalidFilename() {
            assertThrows(IOException.class, () -> service.createFile("   ", true));
        }

        @Test
        @DisplayName("readFile rejects a traversal filename before touching the filesystem")
        void readFile_traversalFilename_throwsInvalidFilename() {
            IOException ex = assertThrows(IOException.class,
                    () -> service.readFile("../../etc/passwd.cfg", null, true));
            assertTrue(ex.getMessage().contains("Invalid configuration filename"));
        }
    }

    // ---------------------------------------------------------------------
    // Configuration-state detection
    // ---------------------------------------------------------------------

    @Nested
    @DisplayName("config-state detection")
    class ConfigStateDetection {

        @Test
        @DisplayName("'# do not edit' header marks the file as MODULE")
        void detectConfigState_doNotEditHeader_returnsModule() throws IOException {
            writeConfig("state-module.cfg", "# do not edit\nkey = 1\n");

            assertEquals("MODULE", service.readFile("state-module.cfg", null, true).get("configState"));
        }

        @Test
        @DisplayName("'# default configuration' header marks the file as MODULE_DEFAULT")
        void detectConfigState_defaultConfigurationHeader_returnsModuleDefault() throws IOException {
            writeConfig("state-default.cfg", "# default configuration, can be edited\nkey = 1\n");

            assertEquals("MODULE_DEFAULT",
                    service.readFile("state-default.cfg", null, true).get("configState"));
        }

        @Test
        @DisplayName("a plain file is USER state")
        void detectConfigState_plainFile_returnsUser() throws IOException {
            writeConfig("state-user.cfg", "key = 1\n");

            assertEquals("USER", service.readFile("state-user.cfg", null, true).get("configState"));
        }
    }

    // ---------------------------------------------------------------------
    // CRUD: create / toggle / delete / markAsDefault
    // ---------------------------------------------------------------------

    @Nested
    @DisplayName("file operations")
    class FileOperations {

        @Test
        @DisplayName("createFile creates the file; creating it again fails")
        void createFile_thenAgain_throwsAlreadyExists() throws IOException {
            service.createFile("new.cfg", true);
            assertTrue(Files.exists(etcDir.resolve("new.cfg")));

            IOException ex = assertThrows(IOException.class, () -> service.createFile("new.cfg", true));
            assertTrue(ex.getMessage().contains("already exists"), "Unexpected message: " + ex.getMessage());
        }

        @Test
        @DisplayName("toggleFileStatus renames to .disabled and back")
        void toggleFileStatus_enabledThenDisabled_roundTrips() throws IOException {
            service.createFile("toggle.cfg", true);

            service.toggleFileStatus("toggle.cfg", true);
            assertTrue(Files.exists(etcDir.resolve("toggle.cfg.disabled")));
            assertFalse(Files.exists(etcDir.resolve("toggle.cfg")));

            service.toggleFileStatus("toggle.cfg.disabled", true);
            assertTrue(Files.exists(etcDir.resolve("toggle.cfg")));
            assertFalse(Files.exists(etcDir.resolve("toggle.cfg.disabled")));
        }

        @Test
        @DisplayName("deleteFile removes an existing file and is a no-op for a missing one")
        void deleteFile_existingAndMissing() throws IOException {
            service.createFile("del.cfg", true);

            service.deleteFile("del.cfg", true);
            assertFalse(Files.exists(etcDir.resolve("del.cfg")));

            assertDoesNotThrow(() -> service.deleteFile("ghost.cfg", true));
        }

        @Test
        @DisplayName("deleteFile also removes the sibling .bak backup")
        void deleteFile_alsoRemovesBackup() throws IOException {
            service.createFile("backed.cfg", true);
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("rawContent", "key = value\n");
            service.saveFile("backed.cfg", payload, true); // creates backed.cfg.bak from the empty original
            assertTrue(Files.exists(etcDir.resolve("backed.cfg.bak")), "precondition: backup exists");

            service.deleteFile("backed.cfg", true);

            assertFalse(Files.exists(etcDir.resolve("backed.cfg")));
            assertFalse(Files.exists(etcDir.resolve("backed.cfg.bak")), "backup must be removed on delete");
        }

        @Test
        @DisplayName("markAsDefault prepends the default-configuration comment and flips state to MODULE_DEFAULT")
        void markAsDefault_userFile_prependsCommentAndBecomesModuleDefault() throws IOException {
            writeConfig("promote.cfg", "key = value\n");

            service.markAsDefaultConfiguration("promote.cfg", true);

            String raw = (String) service.readFile("promote.cfg", null, true).get("rawContent");
            assertTrue(raw.startsWith("# default configuration"), "Header not prepended: " + raw);
            assertEquals("MODULE_DEFAULT",
                    service.readFile("promote.cfg", null, true).get("configState"));
        }

        @Test
        @DisplayName("markAsDefault refuses module-managed files")
        void markAsDefault_moduleFile_throws() throws IOException {
            writeConfig("locked.cfg", "# do not edit\nkey = 1\n");

            IOException ex = assertThrows(IOException.class,
                    () -> service.markAsDefaultConfiguration("locked.cfg", true));
            assertTrue(ex.getMessage().contains("Module-managed"), "Unexpected message: " + ex.getMessage());
        }
    }

    // ---------------------------------------------------------------------
    // Parse / serialize round-trips
    // ---------------------------------------------------------------------

    @Nested
    @DisplayName("parse / serialize")
    class ParseSerialize {

        @Test
        @DisplayName("saving rawContent writes it verbatim and reads back identically")
        void saveFile_rawContent_roundTripsByteForByte() throws IOException {
            String raw = "# header comment\nkey.one = value1\nkey.two = value2\n";
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("rawContent", raw);

            service.saveFile("raw.cfg", payload, true);

            assertEquals(raw, service.readFile("raw.cfg", null, true).get("rawContent"));
        }

        @Test
        @DisplayName("saving structured cfg entries serializes property/comment/empty lines")
        void saveFile_cfgEntries_serializesAllEntryTypes() throws IOException {
            List<Map<String, Object>> entries = new ArrayList<>();
            entries.add(entry("comment", null, "# hello"));
            entries.add(entry("property", "a", "1"));
            entries.add(entry("empty", null, null));

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("properties", entries);
            service.saveFile("entries.cfg", payload, true);

            assertEquals("# hello\na = 1\n\n",
                    service.readFile("entries.cfg", null, true).get("rawContent"));
        }

        @Test
        @DisplayName("cfg parser keeps a value that contains a colon (e.g. a URL)")
        void readFile_propertyValueWithColon_preservedAfterEquals() throws IOException {
            writeConfig("url.cfg", "endpoint = http://host:8080/path\n");

            @SuppressWarnings("unchecked")
            List<Map<String, String>> properties =
                    (List<Map<String, String>>) service.readFile("url.cfg", null, true).get("properties");

            Map<String, String> first = properties.get(0);
            assertEquals("property", first.get("type"));
            assertEquals("endpoint", first.get("key"));
            assertEquals("http://host:8080/path", first.get("value"));
        }

        private Map<String, Object> entry(String type, String key, String value) {
            Map<String, Object> e = new LinkedHashMap<>();
            e.put("type", type);
            if (key != null) {
                e.put("key", key);
            }
            if (value != null) {
                e.put("value", value);
            }
            return e;
        }
    }

    @Nested
    @DisplayName("file-bound decryption")
    class FileBoundDecryption {

        @Test
        @DisplayName("decryptForFile returns plaintext when the ciphertext is in the authorized file")
        void decryptForFile_valueInAuthorizedFile_returnsPlaintext() throws IOException {
            String enc = service.encrypt("a-secret");
            writeConfig("secrets.cfg", "password = " + enc + "\n");

            assertEquals("a-secret", service.decryptForFile("secrets.cfg", enc, true));
        }

        @Test
        @DisplayName("decryptForFile refuses ciphertext that does not occur in the file (no oracle)")
        void decryptForFile_valueNotInFile_throws() throws IOException {
            String enc = service.encrypt("a-secret");
            writeConfig("other.cfg", "key = value\n");

            IOException ex = assertThrows(IOException.class, () -> service.decryptForFile("other.cfg", enc, true));
            assertTrue(ex.getMessage().contains("does not belong"), "Unexpected message: " + ex.getMessage());
        }

        @Test
        @DisplayName("decryptForFile refuses a file blocked by the blacklist")
        void decryptForFile_blacklistedFile_throwsAccessDenied() throws IOException {
            Map<String, Object> filter = new LinkedHashMap<>();
            filter.put("filteredFiles", "blocked.cfg");
            service.updateConfig(filter);

            String enc = service.encrypt("a-secret");
            writeConfig("blocked.cfg", "password = " + enc + "\n");

            IOException ex = assertThrows(IOException.class, () -> service.decryptForFile("blocked.cfg", enc, true));
            assertTrue(ex.getMessage().contains("denied"), "Unexpected message: " + ex.getMessage());
        }
    }

    @Test
    @DisplayName("saveFile rejects rawContent larger than the size cap")
    void saveFile_oversizedRawContent_throws() {
        String tooBig = "x".repeat(OsgiConfigService.MAX_RAW_CONTENT_BYTES + 1);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("rawContent", tooBig);

        IOException ex = assertThrows(IOException.class, () -> service.saveFile("too-big.cfg", payload, true));
        assertTrue(ex.getMessage().contains("maximum allowed size"), "Unexpected message: " + ex.getMessage());
        assertFalse(Files.exists(etcDir.resolve("too-big.cfg")), "Oversized content must not be written");
    }

    @Nested
    @DisplayName("deep search")
    class DeepSearch {

        @Test
        @DisplayName("matches on filename")
        void searchFiles_nameMatch_returnsFile() throws IOException {
            writeConfig("alpha.cfg", "x = 1\n");
            writeConfig("beta.cfg", "y = 2\n");

            List<Map<String, Object>> results = service.searchFiles("alpha", true);

            assertEquals(1, results.size());
            assertEquals("alpha.cfg", results.get(0).get("name"));
        }

        @Test
        @DisplayName("matches on raw content when the name does not match")
        void searchFiles_contentMatch_returnsFile() throws IOException {
            writeConfig("alpha.cfg", "secret.token = hunter2\n");
            writeConfig("beta.cfg", "y = 2\n");

            List<Map<String, Object>> results = service.searchFiles("hunter2", true);

            assertEquals(1, results.size());
            assertEquals("alpha.cfg", results.get(0).get("name"));
        }

        @Test
        @DisplayName("returns the full listing for an empty query")
        void searchFiles_emptyQuery_returnsAll() throws IOException {
            writeConfig("alpha.cfg", "x = 1\n");
            writeConfig("beta.cfg", "y = 2\n");

            assertEquals(2, service.searchFiles("", true).size());
        }

        @Test
        @DisplayName("returns nothing when neither name nor content matches")
        void searchFiles_noMatch_returnsEmpty() throws IOException {
            writeConfig("alpha.cfg", "x = 1\n");

            assertTrue(service.searchFiles("zzz-not-present", true).isEmpty());
        }
    }
}
