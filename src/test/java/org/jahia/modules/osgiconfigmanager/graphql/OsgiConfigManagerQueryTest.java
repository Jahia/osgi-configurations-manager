package org.jahia.modules.osgiconfigmanager.graphql;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.jahia.modules.osgiconfigmanager.admin.ConfigNotFoundException;
import org.jahia.modules.osgiconfigmanager.admin.OsgiConfigService;
import org.jahia.services.content.JCRSessionWrapper;
import org.jahia.services.usermanager.JahiaUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OsgiConfigManagerQueryTest {

    private OsgiConfigService service;
    private OsgiConfigManagerQuery query;

    @BeforeEach
    void setUp() {
        service = mock(OsgiConfigService.class);
        JahiaUser user = mock(JahiaUser.class);
        when(user.getName()).thenReturn("root");
        query = new OsgiConfigManagerQuery(service, new GqlCaller(user, mock(JCRSessionWrapper.class), Locale.FRENCH));
    }

    private static Map<String, Object> fileEntry(String name) {
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("name", name);
        entry.put("path", "/opt/jahia/karaf/etc/" + name);
        entry.put("enabled", true);
        entry.put("type", "cfg");
        entry.put("configState", "USER");
        return entry;
    }

    @Test
    @DisplayName("files maps every listing entry, absolute path included")
    void files_mapsEntries() {
        when(service.searchFiles("", Locale.FRENCH, true)).thenReturn(List.of(fileEntry("a.cfg")));

        List<GqlConfigFile> files = query.files(null);

        assertEquals(1, files.size());
        GqlConfigFile file = files.get(0);
        assertEquals("a.cfg", file.getName());
        assertEquals("/opt/jahia/karaf/etc/a.cfg", file.getPath());
        assertTrue(file.getEnabled());
        assertEquals("cfg", file.getType());
        assertEquals("USER", file.getConfigState());
    }

    @Test
    @DisplayName("files passes the search term to the deep search")
    void files_withSearch_delegates() {
        when(service.searchFiles("needle", Locale.FRENCH, true)).thenReturn(List.of());

        query.files("needle");

        verify(service).searchFiles("needle", Locale.FRENCH, true);
    }

    @Test
    @DisplayName("uiConfig exposes the visual formatting flag")
    void uiConfig_mapsFlag() {
        when(service.getUiConfig()).thenReturn(Map.of("visualFormattingControlsEnabled", true));

        assertTrue(query.uiConfig().getVisualFormattingControlsEnabled());
    }

    @Test
    @DisplayName("file returns content, with properties and metatype as order-preserving JSON")
    void file_mapsContent() throws Exception {
        Map<String, Object> props = new LinkedHashMap<>();
        props.put("zeta", "1");
        props.put("alpha", "2");
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("configState", "MODULE");
        data.put("rawContent", "zeta = 1\nalpha = 2\n");
        data.put("pid", "org.acme");
        data.put("properties", props);
        when(service.readFile("org.acme.cfg", Locale.FRENCH, true)).thenReturn(data);

        GqlConfigFileContent content = query.file("org.acme.cfg");

        assertEquals("MODULE", content.getConfigState());
        assertEquals("zeta = 1\nalpha = 2\n", content.getRawContent());
        assertEquals("org.acme", content.getPid());
        assertEquals("{\"zeta\":\"1\",\"alpha\":\"2\"}", content.getProperties());
        assertNull(content.getMetatype());
    }

    @Test
    @DisplayName("file translates a missing file into NOT_FOUND")
    void file_missing_isNotFound() throws Exception {
        when(service.readFile("gone.cfg", Locale.FRENCH, true)).thenThrow(new ConfigNotFoundException("File not found: gone.cfg"));

        OsgiConfigGqlException e = assertThrows(OsgiConfigGqlException.class, () -> query.file("gone.cfg"));

        assertEquals("NOT_FOUND", e.getExtensions().get("code"));
    }

    @Test
    @DisplayName("availableMetatypes returns the service list as JSON")
    void availableMetatypes_isJson() throws Exception {
        Map<String, Object> def = new LinkedHashMap<>();
        def.put("pid", "org.acme");
        when(service.listAvailableMetatypeConfigurations(Locale.FRENCH, true)).thenReturn(List.of(def));

        String json = query.availableMetatypes();

        assertEquals(List.of(def), new ObjectMapper().readValue(json, List.class));
    }

    @Test
    @DisplayName("preference refuses a key outside the allowlist without reading anything")
    void preference_disallowedKey_isBadRequest() {
        OsgiConfigGqlException e = assertThrows(OsgiConfigGqlException.class, () -> query.preference("../../etc"));

        assertEquals("BAD_REQUEST", e.getExtensions().get("code"));
        verify(service, never()).listFiles(anyBoolean());
    }
}
