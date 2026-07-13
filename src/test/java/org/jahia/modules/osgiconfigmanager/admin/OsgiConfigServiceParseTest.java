package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * S16 (factory identifier validation), S17 (.cfg line parsing), S18 (SafeConstructor YAML).
 */
class OsgiConfigServiceParseTest {

    private OsgiConfigService newService(Path etc) {
        System.setProperty("karaf.etc", etc.toString());
        return new OsgiConfigService();
    }

    @Test
    @DisplayName("S16: validateFactoryIdentifier accepts a valid id")
    void factoryIdentifierValid(@TempDir Path etc) {
        OsgiConfigService service = newService(etc);
        assertDoesNotThrow(() -> service.validateFactoryIdentifier("my-instance_1.0"));
    }

    @ParameterizedTest
    @ValueSource(strings = {".leading", "a/b", "a\\b", "a:b", "bad space", "unicödé"})
    @DisplayName("S16: validateFactoryIdentifier rejects leading-dot, path chars, spaces, non-ASCII")
    void factoryIdentifierInvalid(String bad, @TempDir Path etc) {
        OsgiConfigService service = newService(etc);
        assertThrows(IOException.class, () -> service.validateFactoryIdentifier(bad));
    }

    @Test
    @DisplayName("S17: parseCfgLine splits on the earliest '=' / ':' separator")
    void parseCfgLineSeparators(@TempDir Path etc) {
        OsgiConfigService service = newService(etc);

        Map<String, String> eq = service.parseCfgLine("a=1");
        assertEquals("property", eq.get("type"));
        assertEquals("a", eq.get("key"));
        assertEquals("1", eq.get("value"));

        Map<String, String> colon = service.parseCfgLine("b:2");
        assertEquals("property", colon.get("type"));
        assertEquals("b", colon.get("key"));
        assertEquals("2", colon.get("value"));

        // earliest separator wins: '=' at index 3 beats ':' inside the URL
        Map<String, String> url = service.parseCfgLine("url=http://x:8080");
        assertEquals("url", url.get("key"));
        assertEquals("http://x:8080", url.get("value"));
    }

    @Test
    @DisplayName("S17: parseCfgLine treats '#' and separatorless lines as comments, blanks as empty")
    void parseCfgLineCommentsAndBlanks(@TempDir Path etc) {
        OsgiConfigService service = newService(etc);
        assertEquals("comment", service.parseCfgLine("# comment").get("type"));
        assertEquals("comment", service.parseCfgLine("noSeparatorLine").get("type"));
        assertEquals("empty", service.parseCfgLine("   ").get("type"));
    }

    @Test
    @DisplayName("S18: readYamlProperties parses safe YAML into key/values")
    void readYamlSafeDoc(@TempDir Path etc) throws IOException {
        OsgiConfigService service = newService(etc);
        Path yml = etc.resolve("safe.yml");
        Files.writeString(yml, "name: demo\ncount: 3\n", StandardCharsets.UTF_8);

        Object parsed = service.readYamlProperties(yml);
        assertEquals("demo", ((Map<?, ?>) parsed).get("name"));
        assertEquals(3, ((Map<?, ?>) parsed).get("count"));
    }

    @Test
    @DisplayName("S18: readYamlProperties (SafeConstructor) rejects global !!<class> tags")
    void readYamlRejectsGlobalTag(@TempDir Path etc) throws IOException {
        OsgiConfigService service = newService(etc);
        Path yml = etc.resolve("evil.yml");
        Files.writeString(yml, "payload: !!javax.script.ScriptEngineManager []\n", StandardCharsets.UTF_8);

        assertThrows(org.yaml.snakeyaml.error.YAMLException.class,
                () -> service.readYamlProperties(yml),
                "SafeConstructor must refuse arbitrary-object instantiation");
    }
}
