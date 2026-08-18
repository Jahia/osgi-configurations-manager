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
    @DisplayName("CHARACTERIZATION: the pom header and the LICENSE file still disagree")
    void licenseDeclarationsStillDisagree() throws IOException {
        String pom = read("pom.xml");
        String readme = read("README.md");
        String license = read("LICENSE");

        boolean pomIsDualGpl = pom.contains("DUAL LICENSING") || pom.contains("GPL");
        boolean readmeIsMit = readme.contains("MIT License");
        boolean licenseIsMit = license.startsWith("MIT License");

        // This records an unresolved inconsistency rather than a desired state: pom.xml carries
        // Jahia's standard dual GPL/JSEL header while LICENSE and the README declare MIT. Which one
        // is authoritative is the owner's call, not something a test should decide — so if you
        // reconcile them, this test is expected to fail. Update it to assert the outcome you chose.
        assertTrue(pomIsDualGpl, "pom header still advertises GPL/JSEL dual licensing");
        assertTrue(readmeIsMit && licenseIsMit, "README and LICENSE still declare MIT");
    }
}
