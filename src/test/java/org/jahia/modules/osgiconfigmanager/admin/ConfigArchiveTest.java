package org.jahia.modules.osgiconfigmanager.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.osgi.framework.Version;
import org.osgi.service.metatype.AttributeDefinition;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The export archive: sealed with a password, carrying each file as stored and its secrets in clear,
 * re-encrypted on import for the target file with the target's secret.
 */
class ConfigArchiveTest {

    private static final char[] PASSWORD = "correct horse battery".toCharArray();
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @AfterEach
    void resetSecret() {
        CryptoEngine.configureSecret(null);
    }

    private static OsgiConfigService serviceIn(Path etc, Map<String, Object> config) {
        System.setProperty("karaf.etc", etc.toString());
        OsgiConfigService service = new OsgiConfigService();
        service.updateConfig(config);
        return service;
    }

    private static void write(Path etc, String name, String content) throws IOException {
        Files.write(etc.resolve(name), content.getBytes(StandardCharsets.UTF_8));
    }

    private static String read(Path etc, String name) throws IOException {
        return Files.readString(etc.resolve(name), StandardCharsets.UTF_8);
    }

    // ------------------------------------------------------------ codec

    @Test
    @DisplayName("an archive opens with its password, and only with it")
    void sealsAndOpens() throws IOException {
        byte[] payload = "{\"format\":1}".getBytes(StandardCharsets.UTF_8);
        byte[] sealed = ConfigArchiveCodec.seal(payload, PASSWORD);

        assertArrayEquals(payload, ConfigArchiveCodec.open(sealed, PASSWORD));
        IOException wrong = assertThrows(IOException.class,
                () -> ConfigArchiveCodec.open(sealed, "another password!".toCharArray()));
        assertEquals("The password is not correct, or the archive is damaged. Check the password and try again.", wrong.getMessage());
    }

    @Test
    @DisplayName("a changed byte, in the header or the ciphertext, fails like a wrong password")
    void tamperingFails() throws IOException {
        byte[] sealed = ConfigArchiveCodec.seal("{}".getBytes(StandardCharsets.UTF_8), PASSWORD);
        byte[] cipherTampered = sealed.clone();
        cipherTampered[cipherTampered.length - 1] ^= 1;
        assertThrows(ConfigArchiveCodec.ArchiveException.class, () -> ConfigArchiveCodec.open(cipherTampered, PASSWORD));

        byte[] saltTampered = sealed.clone();
        saltTampered[10] ^= 1;
        assertThrows(ConfigArchiveCodec.ArchiveException.class, () -> ConfigArchiveCodec.open(saltTampered, PASSWORD));
    }

    @Test
    @DisplayName("a crafted iteration count is refused before any key is derived")
    void refusesCraftedIterations() throws IOException {
        byte[] sealed = ConfigArchiveCodec.seal("{}".getBytes(StandardCharsets.UTF_8), PASSWORD);
        byte[] huge = sealed.clone();
        huge[5] = 0x7f; // the count's first byte: over two billion iterations
        IOException e = assertThrows(ConfigArchiveCodec.ArchiveException.class, () -> ConfigArchiveCodec.open(huge, PASSWORD));
        assertEquals("The archive is damaged", e.getMessage());
    }

    @Test
    @DisplayName("something else than an archive, and a short password, are refused with a reason")
    void refusesOtherInput() {
        assertThrows(ConfigArchiveCodec.ArchiveException.class,
                () -> ConfigArchiveCodec.open("key = value".getBytes(StandardCharsets.UTF_8), PASSWORD));
        IOException shortPassword = assertThrows(IOException.class,
                () -> ConfigArchiveCodec.seal(new byte[1], "short".toCharArray()));
        assertTrue(shortPassword.getMessage().contains("at least 12 characters"));
    }

    @Test
    @DisplayName("a payload that would expand past the cap is refused, not loaded")
    void refusesDecompressionBomb() throws IOException {
        byte[] zeros = new byte[ConfigArchiveCodec.MAX_PAYLOAD_BYTES + 1];
        byte[] sealed = ConfigArchiveCodec.seal(zeros, PASSWORD);
        IOException e = assertThrows(ConfigArchiveCodec.ArchiveException.class, () -> ConfigArchiveCodec.open(sealed, PASSWORD));
        assertEquals("The archive is too large once expanded", e.getMessage());
    }

    // ------------------------------------------------------------ export and import

    @Test
    @DisplayName("a secret travels in clear inside the sealed archive and is re-encrypted for the target")
    void roundTripReEncryptsSecrets(@TempDir Path source, @TempDir Path target) throws IOException {
        CryptoEngine.configureSecret("source-instance-secret".toCharArray());
        OsgiConfigService from = serviceIn(source, Map.of());
        String envelope = from.encrypt("s3cr3t-value", "org.example.cfg");
        write(source, "org.example.cfg", "# kept as is\nurl = https://example.org\npassword = " + envelope + "\n");
        write(source, "org.other.yml", "plain: value\n");

        Map<String, Object> exported = from.exportArchive(List.of("org.example.cfg", "org.other.yml"), PASSWORD, false);
        assertEquals(2, exported.get("files"));
        assertTrue(((List<?>) exported.get("warnings")).isEmpty());
        assertTrue(String.valueOf(exported.get("fileName")).endsWith(".ocmx"));
        String archive = (String) exported.get("archive");
        assertFalse(new String(Base64.getDecoder().decode(archive), StandardCharsets.ISO_8859_1).contains("s3cr3t-value"),
                "the archive is sealed: the secret is not readable in it");

        // Another instance, with another secret.
        CryptoEngine.configureSecret("target-instance-secret".toCharArray());
        OsgiConfigService to = serviceIn(target, Map.of());
        Map<String, Object> result = to.importArchive(archive, PASSWORD, List.of("org.example.cfg", "org.other.yml"), false);
        assertEquals(List.of("org.example.cfg", "org.other.yml"), result.get("imported"));
        assertTrue(((List<?>) result.get("failed")).isEmpty());

        String imported = read(target, "org.example.cfg");
        assertTrue(imported.startsWith("# kept as is\nurl = https://example.org\npassword = ENC("));
        assertFalse(imported.contains(envelope), "the source's envelope is replaced");
        assertFalse(imported.contains("s3cr3t-value"), "the secret is not written in clear");
        String newEnvelope = imported.substring(imported.indexOf("ENC("), imported.lastIndexOf(')') + 1);
        assertEquals("s3cr3t-value", to.decryptIn(newEnvelope, "org.example.cfg"));
        assertEquals("plain: value\n", read(target, "org.other.yml"));
    }

    @Test
    @DisplayName("only the chosen files are written")
    void importsOnlyChosenFiles(@TempDir Path source, @TempDir Path target) throws IOException {
        OsgiConfigService from = serviceIn(source, Map.of());
        write(source, "org.a.cfg", "a = 1\n");
        write(source, "org.b.cfg", "b = 2\n");
        String archive = (String) from.exportArchive(List.of("org.a.cfg", "org.b.cfg"), PASSWORD, false).get("archive");

        OsgiConfigService to = serviceIn(target, Map.of());
        to.importArchive(archive, PASSWORD, List.of("org.b.cfg"), false);

        assertFalse(Files.exists(target.resolve("org.a.cfg")));
        assertEquals("b = 2\n", read(target, "org.b.cfg"));
    }

    @Test
    @DisplayName("a value this instance cannot decrypt is exported as is, with a warning")
    void undecryptableValueIsExportedAsIs(@TempDir Path source) throws IOException {
        CryptoEngine.configureSecret("another-instance-secret".toCharArray());
        OsgiConfigService other = serviceIn(source, Map.of());
        String foreign = other.encrypt("foreign", "org.example.cfg");
        write(source, "org.example.cfg", "token = " + foreign + "\n");

        CryptoEngine.configureSecret("this-instance-secret".toCharArray());
        OsgiConfigService from = serviceIn(source, Map.of());
        Map<String, Object> exported = from.exportArchive(List.of("org.example.cfg"), PASSWORD, false);

        List<?> warnings = (List<?>) exported.get("warnings");
        assertEquals(1, warnings.size());
        assertEquals(Map.of("name", "org.example.cfg", "undecryptable", 1), warnings.get(0));

        Map<String, Object> preview = from.previewArchiveImport((String) exported.get("archive"), PASSWORD, false);
        Map<?, ?> file = (Map<?, ?>) ((List<?>) preview.get("files")).get(0);
        assertEquals(0, file.get("secrets"));
        assertEquals(1, file.get("undecryptable"));
    }

    @Test
    @DisplayName("the manager's own configuration is never exported, and never imported")
    void managerConfigurationIsExcluded(@TempDir Path etc) throws IOException {
        String self = OsgiConfigService.SELF_CONFIG_PID + ".cfg";
        write(etc, self, "cryptoSecret = do-not-leak\n");
        OsgiConfigService service = serviceIn(etc, Map.of());

        assertThrows(ConfigAccessDeniedException.class, () -> service.exportArchive(List.of(self), PASSWORD, true));
        assertThrows(ConfigAccessDeniedException.class,
                () -> service.exportArchive(List.of(OsgiConfigService.SELF_CONFIG_PID + "-copy.yml"), PASSWORD, true));
    }

    @Test
    @DisplayName("export authorizes each file as a read: a blacklisted one is refused")
    void exportRespectsTheBlacklist(@TempDir Path etc) throws IOException {
        write(etc, "org.example.secret.cfg", "key = value\n");
        OsgiConfigService service = serviceIn(etc, Map.of("filteredFiles", "org.example.secret.cfg"));

        assertThrows(ConfigAccessDeniedException.class,
                () -> service.exportArchive(List.of("org.example.secret.cfg"), PASSWORD, false));
    }

    @Test
    @DisplayName("import refuses, file by file, what a save would refuse; the rest is written")
    void importRefusesPerFile(@TempDir Path source, @TempDir Path target) throws IOException {
        OsgiConfigService from = serviceIn(source, Map.of());
        write(source, "org.example.secret.cfg", "key = value\n");
        write(source, "org.allowed.cfg", "key = value\n");
        String archive = (String) from.exportArchive(List.of("org.example.secret.cfg", "org.allowed.cfg"), PASSWORD, false)
                .get("archive");

        OsgiConfigService to = serviceIn(target, Map.of("filteredFiles", "org.example.secret.cfg"));
        Map<String, Object> preview = to.previewArchiveImport(archive, PASSWORD, false);
        Map<?, ?> refused = (Map<?, ?>) ((List<?>) preview.get("files")).get(0);
        assertEquals(false, refused.get("allowed"));
        assertEquals("NOT_PERMITTED", refused.get("refusal"));

        Map<String, Object> result = to.importArchive(archive, PASSWORD, List.of("org.example.secret.cfg", "org.allowed.cfg"), false);
        assertEquals(List.of("org.allowed.cfg"), result.get("imported"));
        assertEquals(1, ((List<?>) result.get("failed")).size());
        assertFalse(Files.exists(target.resolve("org.example.secret.cfg")));
    }

    @Test
    @DisplayName("the preview says create or overwrite, and names the other files of the same configuration")
    void previewActions(@TempDir Path source, @TempDir Path target) throws IOException {
        OsgiConfigService from = serviceIn(source, Map.of());
        write(source, "org.new.cfg", "a = 1\n");
        write(source, "org.existing.cfg", "a = 1\n");
        String archive = (String) from.exportArchive(List.of("org.new.cfg", "org.existing.cfg"), PASSWORD, false).get("archive");

        write(target, "org.existing.cfg", "a = 0\n");
        write(target, "org.new.yml", "a: 0\n");
        Map<String, Object> preview = serviceIn(target, Map.of()).previewArchiveImport(archive, PASSWORD, false);
        List<?> files = (List<?>) preview.get("files");
        Map<?, ?> created = (Map<?, ?>) files.get(0);
        Map<?, ?> overwritten = (Map<?, ?>) files.get(1);
        assertEquals("CREATE", created.get("action"));
        assertEquals(List.of("org.new.yml"), created.get("sameConfiguration"));
        assertEquals("OVERWRITE", overwritten.get("action"));
        assertEquals("a = 0\n", read(target, "org.existing.cfg"), "the preview writes nothing");
    }

    @Test
    @DisplayName("the preview names a secret stored in clear, and leaves it as it is")
    void previewFlagsClearSecrets(@TempDir Path source, @TempDir Path target) throws IOException {
        OsgiConfigService from = serviceIn(source, Map.of());
        write(source, "org.example.cfg", "api.token = in-clear\nlabel = public\npasswordMinLength = 8\n");
        String archive = (String) from.exportArchive(List.of("org.example.cfg"), PASSWORD, false).get("archive");

        OsgiConfigService to = serviceIn(target, Map.of());
        Map<?, ?> file = (Map<?, ?>) ((List<?>) to.previewArchiveImport(archive, PASSWORD, false).get("files")).get(0);
        assertEquals(List.of("api.token", "passwordMinLength"), file.get("clearSecrets"),
                "without a Metatype, the name decides, as in the editor");
        to.importArchive(archive, PASSWORD, List.of("org.example.cfg"), false);
        assertTrue(read(target, "org.example.cfg").contains("api.token = in-clear"));
    }

    @Test
    @DisplayName("an archive file whose listed secret is not in its text plants nothing")
    void ignoresSecretsNotInTheFile(@TempDir Path target) throws Exception {
        String payload = MAPPER.writeValueAsString(Map.of("format", 1, "files", List.of(Map.of(
                "name", "org.example.cfg",
                "content", "key = value\n",
                "secrets", List.of(Map.of("envelope", "ENC(v3:x:y:z)", "value", "planted"))))));
        String archive = Base64.getEncoder().encodeToString(
                ConfigArchiveCodec.seal(payload.getBytes(StandardCharsets.UTF_8), PASSWORD));

        CryptoEngine.configureSecret("target-instance-secret".toCharArray());
        OsgiConfigService to = serviceIn(target, Map.of());
        Map<?, ?> file = (Map<?, ?>) ((List<?>) to.previewArchiveImport(archive, PASSWORD, false).get("files")).get(0);
        assertEquals(0, file.get("secrets"));
        to.importArchive(archive, PASSWORD, List.of("org.example.cfg"), false);
        assertEquals("key = value\n", read(target, "org.example.cfg"));
    }

    @Test
    @DisplayName("an archive file with a path in its name is refused")
    void refusesPathsInNames(@TempDir Path target) throws Exception {
        String payload = MAPPER.writeValueAsString(Map.of("format", 1, "files", List.of(
                Map.of("name", "../escape.cfg", "content", "key = value\n"))));
        String archive = Base64.getEncoder().encodeToString(
                ConfigArchiveCodec.seal(payload.getBytes(StandardCharsets.UTF_8), PASSWORD));

        OsgiConfigService to = serviceIn(target, Map.of());
        Map<?, ?> file = (Map<?, ?>) ((List<?>) to.previewArchiveImport(archive, PASSWORD, false).get("files")).get(0);
        assertEquals("INVALID_NAME", file.get("refusal"));
        Map<String, Object> result = to.importArchive(archive, PASSWORD, List.of("../escape.cfg"), false);
        assertTrue(((List<?>) result.get("imported")).isEmpty());
        assertFalse(Files.exists(target.getParent().resolve("escape.cfg")));
    }

    @Test
    @DisplayName("a failed file never tells the client a server path")
    void failureMessagesHidePaths() {
        assertEquals("The file could not be written",
                ConfigArchive.clientMessage(new java.nio.file.AccessDeniedException("/opt/jahia/karaf/etc/org.a.cfg")));
        assertEquals("The file could not be written", ConfigArchive.clientMessage(new IllegalStateException("Encryption failed")));
        assertEquals("Import denied: org.a.cfg (NOT_PERMITTED)",
                ConfigArchive.clientMessage(new ConfigAccessDeniedException("Import denied: org.a.cfg (NOT_PERMITTED)")));
    }

    // ------------------------------------------------------------ comparisons

    @Test
    @DisplayName("bundle versions compare the target against the archive")
    void comparesBundleVersions() {
        assertEquals(ConfigArchive.SAME, ConfigArchive.compareVersions("3.7.0.SNAPSHOT", Version.parseVersion("3.7.0.SNAPSHOT")));
        assertEquals(ConfigArchive.OLDER, ConfigArchive.compareVersions("3.7.0", Version.parseVersion("3.6.2")));
        assertEquals(ConfigArchive.NEWER, ConfigArchive.compareVersions("3.7.0", Version.parseVersion("3.7.1")));
        assertEquals(ConfigArchive.DIFFERENT, ConfigArchive.compareVersions("not-a-version", Version.parseVersion("1.0.0")));
    }

    @Test
    @DisplayName("Jahia versions compare on their four numbers")
    void comparesJahiaVersions() {
        assertEquals(ConfigArchive.SAME, ConfigArchive.compareJahiaVersions("8.2.3.2", "8.2.3.2"));
        assertEquals(ConfigArchive.OLDER, ConfigArchive.compareJahiaVersions("8.2.3.2", "8.2.2.3"));
        assertEquals(ConfigArchive.NEWER, ConfigArchive.compareJahiaVersions("8.2.2.3", "8.2.3.0"));
        assertEquals(ConfigArchive.NEWER, ConfigArchive.compareJahiaVersions("8.2.3", "8.2.3.1"));
    }

    @Test
    @DisplayName("the archive records the Jahia version, and the preview compares it with this one")
    void recordsAndComparesJahiaVersion(@TempDir Path source) throws IOException {
        OsgiConfigService from = serviceIn(source, Map.of());
        write(source, "org.a.cfg", "a = 1\n");
        String archive = (String) from.exportArchive(List.of("org.a.cfg"), PASSWORD, false).get("archive");
        Map<?, ?> jahia = (Map<?, ?>) from.previewArchiveImport(archive, PASSWORD, false).get("jahia");
        assertEquals(ConfigArchive.jahiaVersion(), jahia.get("archiveVersion"));
        assertEquals(ConfigArchive.jahiaVersion(), jahia.get("targetVersion"));
        assertEquals(ConfigArchive.jahiaVersion() == null ? ConfigArchive.UNKNOWN : ConfigArchive.SAME, jahia.get("comparison"));
    }

    @Test
    @DisplayName("a Password attribute is a secret whatever its name; a number never is")
    void secretRuleFollowsTheMetatype() {
        assertTrue(ConfigArchive.isSecret("label", Map.of("label", AttributeDefinition.PASSWORD)));
        assertFalse(ConfigArchive.isSecret("tokenExpiry", Map.of("tokenExpiry", AttributeDefinition.INTEGER)));
        assertTrue(ConfigArchive.isSecret("client.secret", null));
        assertFalse(ConfigArchive.isSecret("label", null));
    }

    @Test
    @DisplayName("keys are read from .cfg lines and from a YAML mapping")
    void readsKeys() {
        assertEquals(Map.of("a", "1", "b", "x = y"), ConfigArchive.valuesOf("org.x.cfg", "# c\na = 1\nb = x = y\n"));
        assertEquals(List.of("a", "nested"), List.copyOf(ConfigArchive.valuesOf("org.x.yml", "a: 1\nnested:\n  b: 2\n").keySet()));
        assertNotEquals(0, ConfigArchive.envelopesIn("k = ENC(v3:a:b:c)\nj = ENC(v3:a:b:c)").size());
        assertEquals(1, ConfigArchive.envelopesIn("k = ENC(v3:a:b:c)\nj = ENC(v3:a:b:c)").size());
    }
}
