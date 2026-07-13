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

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * S53 (G31) — CHARACTERIZATION of the current version + license drift across pom.xml,
 * package.json and README.md. Surefire runs with {@code ${project.basedir}} as the working
 * directory, so the manifests are read relative to it.
 *
 * <p>The Stage-7 alignment flips these assertions to equality once the versions/licenses are
 * reconciled.</p>
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
    @DisplayName("S53: Maven, npm and README versions currently DIVERGE")
    void versionsDiverge() throws IOException {
        String pom = read("pom.xml");
        String pkg = read("package.json");
        String readme = read("README.md");

        String mavenVersion = find(pom,
                "<artifactId>osgi-configurations-manager</artifactId>\\s*<version>([^<]+)</version>");
        String npmVersion = find(pkg, "\"version\"\\s*:\\s*\"([^\"]+)\"");
        String readmeJarVersion = find(readme, "osgi-configurations-manager-([0-9][^.]*\\.[0-9]+\\.[0-9]+[^.]*)\\.jar");

        assertTrue(mavenVersion != null && npmVersion != null && readmeJarVersion != null,
                "all three version strings must be locatable");
        // CHARACTERIZATION: Stage-7 makes these three equal.
        assertNotEquals(mavenVersion, npmVersion, "Maven vs npm version currently differ");
        assertNotEquals(mavenVersion, readmeJarVersion, "Maven vs README JAR version currently differ");
    }

    @Test
    @DisplayName("S53: pom declares GPL/JSEL while README/LICENSE declare MIT")
    void licenseInconsistent() throws IOException {
        String pom = read("pom.xml");
        String readme = read("README.md");
        String license = read("LICENSE");

        boolean pomIsDualGpl = pom.contains("DUAL LICENSING") || pom.contains("GPL");
        boolean readmeIsMit = readme.contains("MIT License");
        boolean licenseIsMit = license.startsWith("MIT License");

        // CHARACTERIZATION: Stage-7 reconciles the pom header with the MIT LICENSE/README.
        assertTrue(pomIsDualGpl, "pom header currently advertises GPL/JSEL dual licensing");
        assertTrue(readmeIsMit && licenseIsMit, "README and LICENSE currently declare MIT");
    }
}
