package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * The deep search the file sidebar offers: it matches on the file NAME or on its CONTENT, both
 * case-insensitively. It used to live in the Action; it moved here so the GraphQL layer carries
 * no logic of its own.
 */
class OsgiConfigServiceSearchTest {

    private OsgiConfigService newServicePointedAt(Path etc) throws IOException {
        System.setProperty("karaf.etc", etc.toString());
        Files.writeString(etc.resolve("org.acme.alpha.cfg"), "token = Needle-42\n", StandardCharsets.UTF_8);
        Files.writeString(etc.resolve("org.acme.beta.cfg"), "token = hay\n", StandardCharsets.UTF_8);
        Files.writeString(etc.resolve("needle.names.yml"), "a: 1\n", StandardCharsets.UTF_8);
        return new OsgiConfigService();
    }

    private static List<String> names(List<Map<String, Object>> files) {
        return files.stream().map(f -> (String) f.get("name")).sorted().collect(Collectors.toList());
    }

    @Test
    @DisplayName("matches on file content, case-insensitively")
    void searchFiles_matchesContent(@TempDir Path etc) throws IOException {
        OsgiConfigService service = newServicePointedAt(etc);

        List<Map<String, Object>> found = service.searchFiles("needle-42", Locale.ENGLISH, true);

        assertEquals(List.of("org.acme.alpha.cfg"), names(found));
    }

    @Test
    @DisplayName("matches on file name, case-insensitively")
    void searchFiles_matchesName(@TempDir Path etc) throws IOException {
        OsgiConfigService service = newServicePointedAt(etc);

        List<Map<String, Object>> found = service.searchFiles("NEEDLE", Locale.ENGLISH, true);

        assertEquals(List.of("needle.names.yml", "org.acme.alpha.cfg"), names(found));
    }

    @Test
    @DisplayName("returns nothing when neither name nor content matches")
    void searchFiles_noMatch(@TempDir Path etc) throws IOException {
        OsgiConfigService service = newServicePointedAt(etc);

        assertEquals(List.of(), names(service.searchFiles("absent", Locale.ENGLISH, true)));
    }

    @Test
    @DisplayName("an empty search is the plain listing")
    void searchFiles_emptySearch_listsEverything(@TempDir Path etc) throws IOException {
        OsgiConfigService service = newServicePointedAt(etc);

        assertEquals(names(service.listFiles(true)), names(service.searchFiles("", Locale.ENGLISH, true)));
        assertEquals(names(service.listFiles(true)), names(service.searchFiles(null, Locale.ENGLISH, true)));
    }
}
