package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.IOException;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * S5 + S6 (G5) — path-traversal defense: {@code validateFilename} (layer 1) and the
 * {@code resolveConfigPath} etc-prefix guard (layer 2).
 */
class OsgiConfigServicePathTest {

    private OsgiConfigService newServicePointedAt(Path etc) {
        System.setProperty("karaf.etc", etc.toString());
        return new OsgiConfigService();
    }

    @ParameterizedTest
    @ValueSource(strings = {"../secret.cfg", "..\\secret.cfg", "/etc/passwd", "a/b.cfg", "foo.txt", "foo", " "})
    @DisplayName("S5: validateFilename rejects traversal / absolute / multi-segment / bad-extension names")
    void validateFilenameRejectsUnsafe(String bad, @TempDir Path etc) {
        OsgiConfigService service = newServicePointedAt(etc);
        assertThrows(IOException.class, () -> service.validateFilename(bad),
                "must reject unsafe filename: [" + bad + "]");
    }

    @Test
    @DisplayName("S5: validateFilename rejects null and empty")
    void validateFilenameRejectsNullAndEmpty(@TempDir Path etc) {
        OsgiConfigService service = newServicePointedAt(etc);
        assertThrows(IOException.class, () -> service.validateFilename(null));
        assertThrows(IOException.class, () -> service.validateFilename(""));
    }

    @ParameterizedTest
    @ValueSource(strings = {"foo.cfg", "foo.cfg.disabled", "foo.yml", "foo.yml.disabled"})
    @DisplayName("S5: validateFilename accepts the four supported extensions")
    void validateFilenameAcceptsSupported(String good, @TempDir Path etc) {
        OsgiConfigService service = newServicePointedAt(etc);
        assertDoesNotThrow(() -> assertEquals(good, service.validateFilename(good)));
    }

    @Test
    @DisplayName("S6: resolveConfigPath resolves a legitimate name under the etc dir")
    void resolveConfigPathResolvesLegitimateName(@TempDir Path etc) throws IOException {
        OsgiConfigService service = newServicePointedAt(etc);
        Path resolved = service.resolveConfigPath("demo.cfg");
        Path expected = etc.toAbsolutePath().normalize().resolve("demo.cfg");
        assertEquals(expected, resolved);
        assertTrue(resolved.startsWith(etc.toAbsolutePath().normalize()),
                "resolved path must stay inside the etc dir");
    }

    @Test
    @DisplayName("S6: resolveConfigPath rejects a name that would escape the etc dir (layer-1 already blocks '..')")
    void resolveConfigPathRejectsEscape(@TempDir Path etc) {
        OsgiConfigService service = newServicePointedAt(etc);
        // Any escaping name is stopped by validateFilename (called inside resolveConfigPath);
        // the startsWith(etcPath) guard is the independent second layer.
        assertThrows(IOException.class, () -> service.resolveConfigPath("../evil.cfg"));
        assertThrows(IOException.class, () -> service.resolveConfigPath("/etc/passwd"));
    }
}
