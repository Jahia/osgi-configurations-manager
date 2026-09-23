package org.jahia.modules.osgiconfigmanager.graphql;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jahia.modules.osgiconfigmanager.admin.ConfigNotFoundException;
import org.jahia.modules.osgiconfigmanager.admin.ConfigurationPluginProbe;
import org.jahia.modules.osgiconfigmanager.admin.OsgiConfigService;
import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.JCRPropertyWrapper;
import org.jahia.services.content.JCRSessionWrapper;
import org.jahia.services.usermanager.JahiaUser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class OsgiConfigManagerQueryTest {

    private OsgiConfigService service;
    private JCRSessionWrapper session;
    private OsgiConfigManagerQuery query;
    private ListAppender<ILoggingEvent> audit;
    private Logger supportLogger;

    @BeforeEach
    void setUp() {
        service = mock(OsgiConfigService.class);
        session = mock(JCRSessionWrapper.class);
        JahiaUser user = mock(JahiaUser.class);
        when(user.getName()).thenReturn("root");
        when(user.getLocalPath()).thenReturn("/users/root");
        query = new OsgiConfigManagerQuery(service, new GqlCaller(user, session, Locale.FRENCH));

        supportLogger = (Logger) LoggerFactory.getLogger(OsgiConfigGqlSupport.class);
        audit = new ListAppender<>();
        audit.start();
        supportLogger.addAppender(audit);
    }

    @AfterEach
    void tearDown() {
        supportLogger.detachAppender(audit);
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

    @Test
    @DisplayName("a read is audited with the caller, since it can expose ENC values")
    void file_isAudited() throws Exception {
        when(service.readFile("a.cfg", Locale.FRENCH, true)).thenReturn(new LinkedHashMap<>());

        query.file("a.cfg");

        assertTrue(audit.list.stream().anyMatch(e ->
                e.getFormattedMessage().equals("[AUDIT] User: root | Action: read | File: a.cfg")));
    }

    @Test
    @DisplayName("an unexpected failure is reported generically")
    void file_unexpectedFailure_isInternal() throws Exception {
        when(service.readFile("a.cfg", Locale.FRENCH, true)).thenThrow(new IllegalStateException("detail /opt/x/y"));

        OsgiConfigGqlException e = assertThrows(OsgiConfigGqlException.class, () -> query.file("a.cfg"));

        assertEquals("INTERNAL", e.getExtensions().get("code"));
    }

    @Test
    @DisplayName("preference reads the value stored on the caller's own user node")
    void preference_allowedKey_readsCallerNode() throws Exception {
        JCRNodeWrapper userNode = mock(JCRNodeWrapper.class);
        JCRPropertyWrapper property = mock(JCRPropertyWrapper.class);
        when(session.nodeExists("/users/root")).thenReturn(true);
        when(session.getNode("/users/root")).thenReturn(userNode);
        when(userNode.hasProperty("osgiEditorMode")).thenReturn(true);
        when(userNode.getProperty("osgiEditorMode")).thenReturn(property);
        when(property.getString()).thenReturn("raw");

        assertEquals("raw", query.preference("osgiEditorMode"));
    }

    @Test
    @DisplayName("preference is null when the caller never stored it")
    void preference_unset_isNull() throws Exception {
        when(session.nodeExists("/users/root")).thenReturn(false);

        assertNull(query.preference("osgiEditorMode"));
    }

    @Test
    @DisplayName("the listing never lets a raw exception through")
    void files_unexpectedFailure_isInternal() {
        when(service.searchFiles("", Locale.FRENCH, true)).thenThrow(new IllegalStateException("/opt/secret/path"));

        OsgiConfigGqlException e = assertThrows(OsgiConfigGqlException.class, () -> query.files(null));

        assertEquals("INTERNAL", e.getExtensions().get("code"));
    }

    // ---- pluginProbe: shapes only, and a well-formed answer with no probe at all ----

    private OsgiConfigManagerQuery queryWithProbe(ConfigurationPluginProbe probe) {
        JahiaUser user = mock(JahiaUser.class);
        when(user.getName()).thenReturn("root");
        return new OsgiConfigManagerQuery(service, new GqlCaller(user, session, Locale.FRENCH), probe);
    }

    @Test
    @DisplayName("without a probe component pluginProbe answers active=false and touches no file")
    void pluginProbe_inactiveWithoutProbe() throws Exception {
        Map<?, ?> probe = new ObjectMapper().readValue(queryWithProbe(null).pluginProbe(), Map.class);

        assertEquals(Boolean.FALSE, probe.get("active"));
        assertEquals(ConfigurationPluginProbe.PID, probe.get("pid"));
        verifyNoInteractions(service);
    }

    @Test
    @DisplayName("with a probe component pluginProbe reports the delivered shapes and never a value")
    void pluginProbe_reportsShapes() {
        ConfigurationPluginProbe probe = mock(ConfigurationPluginProbe.class);
        when(probe.deliveredShapes()).thenReturn(Map.of("probe.secret", "plaintext", "probe.plain", "plaintext"));
        when(probe.receivedAt()).thenReturn("2026-09-21T10:00:00Z");

        String json = queryWithProbe(probe).pluginProbe();

        assertTrue(json.contains("\"active\":true"), json);
        assertTrue(json.contains("\"probe.secret\":\"plaintext\""), json);
        assertTrue(json.contains("2026-09-21T10:00:00Z"), json);
        assertFalse(json.contains("ENC("), "no envelope, hence no value, is ever echoed");
    }
}
