package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Guards the module version and licence declarations against drift between manifests. Surefire runs
 * with {@code ${project.basedir}} as the working directory, so they are read relative to it.
 *
 * <p>This class used to assert the opposite of what it now does: it pinned the fact that pom.xml,
 * package.json and README.md all carried <em>different</em> versions, on the assumption that a later
 * stage would reconcile them. That made it a trap — it failed against anyone who fixed the drift, and
 * it required the README to keep quoting a version, which is what let the README fall three patch
 * releases behind in the first place.
 *
 * <p>The drift is now removed at the source instead of tracked: the README refers to the built jar
 * without naming a version, so pom.xml is the single place the module version appears and there is
 * nothing left to keep in sync.
 */
class VersionConsistencyTest {

    private String read(String relative) throws IOException {
        Path p = Paths.get(relative);
        return Files.readString(p, StandardCharsets.UTF_8);
    }

    private String find(String content, String regex) {
        Matcher m = Pattern.compile(regex).matcher(content);
        return m.find() ? m.group(1) : null;
    }

    @Test
    @DisplayName("the README does not hardcode the module version, so it cannot drift from the pom")
    void readmeDoesNotDuplicateTheModuleVersion() throws IOException {
        String pom = read("pom.xml");
        String readme = read("README.md");

        String mavenVersion = find(pom,
                "<artifactId>osgi-configurations-manager</artifactId>\\s*<version>([^<]+)</version>");
        assertNotNull(mavenVersion, "the pom must declare the module version");

        String readmeJarVersion = find(readme,
                "osgi-configurations-manager-([0-9][^.]*\\.[0-9]+\\.[0-9]+[^.]*)\\.jar");
        assertNull(readmeJarVersion,
                "the README must refer to the jar without a version — write "
                        + "osgi-configurations-manager-<version>.jar, not a pinned number, so it "
                        + "cannot fall behind the pom as it previously did");
    }

    @Test
    @DisplayName("every manifest declares MIT, and the GPL/JSEL header is gone for good")
    void licenceIsMitEverywhere() throws IOException {
        String pom = read("pom.xml");
        String readme = read("README.md");
        String license = read("LICENSE");
        String rootPkg = read("package.json");
        String testsPkg = read("tests/package.json");

        // pom.xml used to carry Jahia's dual GPL/JSEL header, inherited from the module archetype,
        // while LICENSE and the README declared MIT. MIT is authoritative. No plugin in the pom
        // chain generates or checks this header, so nothing restores it: only a copy-paste from
        // another Jahia module would, which is what this assertion is here to catch.
        assertFalse(pom.contains("DUAL LICENSING") || pom.contains("JSEL"),
                "the pom must not reintroduce the dual GPL/JSEL header — MIT is authoritative");

        // Neither this pom nor anything it inherits declared a licence at all, so consumers had no
        // machine-readable answer. It is declared now; keep it declared.
        assertTrue(pom.contains("<name>MIT License</name>"),
                "the pom must declare MIT in <licenses>");

        assertTrue(license.startsWith("MIT License"), "LICENSE must be the MIT text");
        assertTrue(readme.contains("MIT License"), "the README must declare MIT");

        String rootPkgLicense = find(rootPkg, "\"license\"\\s*:\\s*\"([^\"]+)\"");
        assertEquals("MIT", rootPkgLicense, "package.json must declare MIT");

        // tests/package.json pointed at "LICENSE IN LICENSE.txt" — a file that does not exist; the
        // licence lives in LICENSE.
        String testsPkgLicense = find(testsPkg, "\"license\"\\s*:\\s*\"([^\"]+)\"");
        assertEquals("MIT", testsPkgLicense, "tests/package.json must declare MIT");
    }
}
