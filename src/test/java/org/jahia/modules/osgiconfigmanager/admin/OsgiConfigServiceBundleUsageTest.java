package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * {@code findBundleUsage} walks the same authorization path as {@code readFile}: a file the caller
 * may not read does not reveal which bundles use it either.
 */
class OsgiConfigServiceBundleUsageTest {

    private OsgiConfigService serviceIn(Path etc, Map<String, Object> config) {
        System.setProperty("karaf.etc", etc.toString());
        OsgiConfigService service = new OsgiConfigService();
        service.updateConfig(config);
        return service;
    }

    private static void write(Path etc, String name) throws IOException {
        Files.write(etc.resolve(name), "key = value\n".getBytes(StandardCharsets.UTF_8));
    }

    @Test
    @DisplayName("an allowed, existing file is looked up; outside OSGi nothing uses it")
    void allowedFileOutsideOsgiIsEmpty(@TempDir Path etc) throws IOException {
        write(etc, "org.example.cfg");

        assertTrue(serviceIn(etc, Map.of()).findBundleUsage("org.example.cfg", false).isEmpty());
    }

    @Test
    @DisplayName("a blacklisted file is refused, in any spelling of its configuration")
    void blacklistedFileIsRefused(@TempDir Path etc) throws IOException {
        write(etc, "org.example.secret.cfg");
        OsgiConfigService service = serviceIn(etc, Map.of("filteredFiles", "org.example.secret.cfg"));

        assertThrows(ConfigAccessDeniedException.class, () -> service.findBundleUsage("org.example.secret.cfg", false));
        assertThrows(ConfigAccessDeniedException.class, () -> service.findBundleUsage("org.example.secret.CFG", false));
    }

    @Test
    @DisplayName("the manager's own configuration is reserved to root")
    void selfConfigurationIsRootOnly(@TempDir Path etc) throws IOException {
        write(etc, OsgiConfigService.SELF_CONFIG_PID + ".cfg");
        OsgiConfigService service = serviceIn(etc, Map.of());

        assertThrows(ConfigAccessDeniedException.class,
                () -> service.findBundleUsage(OsgiConfigService.SELF_CONFIG_PID + ".cfg", false));
        assertTrue(service.findBundleUsage(OsgiConfigService.SELF_CONFIG_PID + ".cfg", true).isEmpty());
    }

    @Test
    @DisplayName("a factory file that escapes a wildcard rule is refused for the factory PID it configures")
    void factoryFileEscapingWildcardIsRefused(@TempDir Path etc) throws IOException {
        write(etc, "org.acme.secret-x.cfg");
        OsgiConfigService service = serviceIn(etc, Map.of("filteredFiles", "org.acme.secret.*"));

        // The wildcard is matched on the file name, which it does not cover...
        assertTrue(service.isFilenameAllowed("org.acme.secret-x.cfg", false));
        // ...but the file configures the factory org.acme.secret, which it hides.
        ConfigAccessDeniedException denied = assertThrows(ConfigAccessDeniedException.class,
                () -> service.findBundleUsage("org.acme.secret-x.cfg", false));
        assertEquals("Access denied: org.acme.secret-x.cfg is blacklisted or reserved.", denied.getMessage());
        assertThrows(ConfigAccessDeniedException.class, () -> service.findBundleUsage("org.acme.secret-x.cfg", true),
                "a black list applies to root as for reads");
    }

    @Test
    @DisplayName("the manager's own factory form is refused to a delegated admin, allowed to root")
    void selfFactoryFormIsRootOnly(@TempDir Path etc) throws IOException {
        String selfFactoryFile = OsgiConfigService.SELF_CONFIG_PID + "~second.cfg";
        write(etc, selfFactoryFile);
        OsgiConfigService service = serviceIn(etc, Map.of());

        assertThrows(ConfigAccessDeniedException.class, () -> service.findBundleUsage(selfFactoryFile, false));
        assertTrue(service.findBundleUsage(selfFactoryFile, true).isEmpty());
    }

    @Test
    @DisplayName("under a white list, a granted factory instance is not refused for its factory PID")
    void whitelistedFactoryInstanceIsAllowed(@TempDir Path etc) throws IOException {
        write(etc, "org.acme.mail-smtp.cfg");
        OsgiConfigService service = serviceIn(etc, Map.of("allowedFiles", "org.acme.mail-smtp.cfg"));

        assertTrue(service.findBundleUsage("org.acme.mail-smtp.cfg", false).isEmpty());
    }

    @Test
    @DisplayName("a missing file is NOT_FOUND, and a path is not a file name")
    void missingOrInvalidFile(@TempDir Path etc) {
        OsgiConfigService service = serviceIn(etc, Map.of());

        assertThrows(ConfigNotFoundException.class, () -> service.findBundleUsage("org.gone.cfg", false));
        assertThrows(IOException.class, () -> service.findBundleUsage("../etc/passwd.cfg", false));
    }
}
