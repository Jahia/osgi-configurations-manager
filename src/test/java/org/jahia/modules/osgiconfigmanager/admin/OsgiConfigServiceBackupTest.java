package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * S4 (G2) — post-fix (SUPPORT-646): saving over an existing file no longer leaves a secret-bearing
 * {@code .bak} sibling. The transient recovery copy is PURGED after a successful write, so no
 * readable plaintext/secret persists in karaf/etc. The "invisible to listFiles() / not an
 * addressable config filename" assertions remain true either way.
 */
class OsgiConfigServiceBackupTest {

    private OsgiConfigService newServicePointedAt(Path etc) {
        // The etc dir is captured in the CONSTRUCTOR, so the sysprop MUST be set first.
        System.setProperty("karaf.etc", etc.toString());
        return new OsgiConfigService();
    }

    @Test
    @DisplayName("S4 (fixed): save purges the .bak so no readable plaintext secret persists after a successful write")
    void saveDoesNotLeaveSecretBearingBackup(@TempDir Path etc) throws Exception {
        // Arrange
        OsgiConfigService service = newServicePointedAt(etc);
        Path original = etc.resolve("demo.cfg");
        String priorSecret = "password=ENC(super-secret-value)";
        Files.writeString(original, priorSecret, StandardCharsets.UTF_8);

        // Act: overwrite via rawContent (the frontend save path)
        Map<String, Object> content = new LinkedHashMap<>();
        content.put("rawContent", "password=new-value");
        service.saveFile("demo.cfg", content, true);

        // Assert: the new content is written...
        assertTrue(Files.readString(original, StandardCharsets.UTF_8).contains("new-value"));

        // ...and NO .bak lingers holding the prior secret.
        Path backup = etc.resolve("demo.cfg.bak");
        assertFalse(Files.exists(backup), "the transient .bak must be purged after a successful save");

        // Prove no readable file in etc still holds the prior secret.
        try (java.util.stream.Stream<Path> files = Files.list(etc)) {
            boolean anySecretLeft = files.filter(Files::isRegularFile).anyMatch(p -> {
                try {
                    return Files.readString(p, StandardCharsets.UTF_8).contains("super-secret-value");
                } catch (java.io.IOException e) {
                    return false;
                }
            });
            assertFalse(anySecretLeft, "no readable file in karaf/etc may still contain the prior secret");
        }

        // The .bak extension remains unsupported / un-addressable regardless.
        List<String> listed = service.listFiles(true).stream()
                .map(m -> (String) m.get("name"))
                .collect(Collectors.toList());
        assertFalse(listed.contains("demo.cfg.bak"), ".bak must not be surfaced by listFiles()");
        assertThrows(java.io.IOException.class, () -> service.validateFilename("demo.cfg.bak"),
                ".bak is not a supported config extension");
    }
}
