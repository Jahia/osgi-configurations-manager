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
 * S4 (G2) — CHARACTERIZATION: saving over an existing file leaves a UI-invisible {@code .bak}
 * sibling that still contains the previous (possibly secret) content.
 *
 * <p>This documents the leak. The Stage-7 product fix should purge / restrict the {@code .bak};
 * at that point the existence + readability assertions here get inverted. The
 * "invisible to listFiles()" assertion stays true either way.</p>
 */
class OsgiConfigServiceBackupTest {

    private OsgiConfigService newServicePointedAt(Path etc) {
        // The etc dir is captured in the CONSTRUCTOR, so the sysprop MUST be set first.
        System.setProperty("karaf.etc", etc.toString());
        return new OsgiConfigService();
    }

    @Test
    @DisplayName("S4: save leaves a readable .bak containing the prior secret, invisible to listFiles()")
    void saveLeavesReadableBackupWithPriorSecret(@TempDir Path etc) throws Exception {
        // CHARACTERIZATION — invert .bak existence/readability after Stage-7 purge fix
        // Arrange
        OsgiConfigService service = newServicePointedAt(etc);
        Path original = etc.resolve("demo.cfg");
        String priorSecret = "password=ENC(super-secret-value)";
        Files.writeString(original, priorSecret, StandardCharsets.UTF_8);

        // Act: overwrite via rawContent (the frontend save path)
        Map<String, Object> content = new LinkedHashMap<>();
        content.put("rawContent", "password=new-value");
        service.saveFile("demo.cfg", content, true);

        // Assert
        Path backup = etc.resolve("demo.cfg.bak");
        assertTrue(Files.exists(backup), "a .bak sibling is written before overwrite");
        assertTrue(Files.isReadable(backup), ".bak is readable");
        assertTrue(Files.readString(backup, StandardCharsets.UTF_8).contains("super-secret-value"),
                ".bak still holds the prior secret");

        // ...and it is NOT a supported extension, so it never appears in the UI listing
        List<String> listed = service.listFiles(true).stream()
                .map(m -> (String) m.get("name"))
                .collect(Collectors.toList());
        assertFalse(listed.contains("demo.cfg.bak"), ".bak must not be surfaced by listFiles()");
        // ...and it is not even an addressable config filename (unsupported extension), so no
        // normal read/save op can reach it through validateFilename.
        assertThrows(java.io.IOException.class, () -> service.validateFilename("demo.cfg.bak"),
                ".bak is not a supported config extension");
    }
}
