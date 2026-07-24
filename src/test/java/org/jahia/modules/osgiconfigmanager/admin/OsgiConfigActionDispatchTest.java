package org.jahia.modules.osgiconfigmanager.admin;

import org.jahia.bin.ActionResult;
import org.jahia.services.content.JCRPropertyWrapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * S21 (CSRF guard), S22-companion (authz gate), S23 (error leak), S25 (preferences),
 * S26 (GET dispatch), S27 (POST routing) — unit-level dispatch tests over the mocked Action surface.
 */
class OsgiConfigActionDispatchTest {

    // ---- S22 companion: permission gate ----

    @Test
    @DisplayName("S22: user WITHOUT canManageOsgiConfigurations gets 403 and no dispatch")
    void unauthorizedUserForbidden() throws Exception {
        ActionDispatchFixture fx = ActionDispatchFixture.unauthorized().get();
        OsgiConfigService service = mock(OsgiConfigService.class);

        ActionResult result = fx.action(service).doExecute(fx.request, fx.renderContext, null, fx.session, null, null);

        assertEquals(HttpServletResponse.SC_FORBIDDEN, result.getResultCode());
        verifyNoInteractions(service);
    }

    @Test
    @DisplayName("S22: authorized user dispatches the GET listing")
    void authorizedUserDispatches() throws Exception {
        ActionDispatchFixture fx = ActionDispatchFixture.authorized().get();
        OsgiConfigService service = mock(OsgiConfigService.class);
        when(service.getUiConfig()).thenReturn(new LinkedHashMap<>());
        when(service.listFiles(false)).thenReturn(List.of(Map.of("name", "demo.cfg")));

        ActionResult result = fx.action(service).doExecute(fx.request, fx.renderContext, null, fx.session, null, null);

        assertNull(result, "normal dispatch writes to the response and returns null");
        verify(service).listFiles(false);
        assertTrue(fx.body().contains("demo.cfg"));
    }

    // ---- S21: CSRF JSON-content-type guard ----

    @Test
    @DisplayName("S21: form-encoded POST is rejected 415 with no side effect")
    void formEncodedPostRejected() throws Exception {
        ActionDispatchFixture fx = ActionDispatchFixture.authorized()
                .postWithContentType("application/x-www-form-urlencoded",
                        "{\"action\":\"delete\",\"filename\":\"x.cfg\"}");
        OsgiConfigService service = mock(OsgiConfigService.class);

        ActionResult result = fx.action(service).doExecute(fx.request, fx.renderContext, null, fx.session, null, null);

        assertEquals(HttpServletResponse.SC_UNSUPPORTED_MEDIA_TYPE, result.getResultCode());
        verify(service, never()).deleteFile(any(), anyBoolean());
    }

    @Test
    @DisplayName("S21: application/json POST passes the guard and dispatches")
    void jsonPostPassesGuard() throws Exception {
        ActionDispatchFixture fx = ActionDispatchFixture.authorized()
                .postJson("{\"action\":\"delete\",\"filename\":\"x.cfg\"}");
        OsgiConfigService service = mock(OsgiConfigService.class);

        ActionResult result = fx.action(service).doExecute(fx.request, fx.renderContext, null, fx.session, null, null);

        assertNull(result);
        verify(service).deleteFile("x.cfg", false);
    }

    @Test
    @DisplayName("S21: a Content-Type whose MEDIA TYPE is not application/json is rejected 415, "
            + "even if the header text contains \"application/json\" as a parameter")
    void nonJsonMediaTypeRejectedRegardlessOfParameters() throws Exception {
        // The media type is the essence before ';'; parameters are not part of it. Each of these has
        // media type text/plain, so the guard must reject it with no service side effect — a substring
        // match on the raw header would wrongly let them through.
        for (String contentType : List.of(
                "text/plain;application/json",
                "text/plain; charset=application/json",
                "text/plain")) {
            ActionDispatchFixture fx = ActionDispatchFixture.authorized()
                    .postWithContentType(contentType, "{\"action\":\"save\",\"filename\":\"x.cfg\",\"rawContent\":\"k=v\"}");
            OsgiConfigService service = mock(OsgiConfigService.class);

            ActionResult result = fx.action(service).doExecute(fx.request, fx.renderContext, null, fx.session, null, null);

            assertEquals(HttpServletResponse.SC_UNSUPPORTED_MEDIA_TYPE, result.getResultCode(),
                    "Content-Type '" + contentType + "' must be rejected 415");
            verify(service, never()).saveFile(any(), any(), anyBoolean());
        }
    }

    @Test
    @DisplayName("S21: application/json with a charset parameter still passes the guard")
    void jsonWithCharsetParameterPasses() throws Exception {
        ActionDispatchFixture fx = ActionDispatchFixture.authorized()
                .postWithContentType("application/json; charset=UTF-8",
                        "{\"action\":\"delete\",\"filename\":\"x.cfg\"}");
        OsgiConfigService service = mock(OsgiConfigService.class);

        ActionResult result = fx.action(service).doExecute(fx.request, fx.renderContext, null, fx.session, null, null);

        assertNull(result);
        verify(service).deleteFile("x.cfg", false);
    }

    // ---- S27: POST routing ----

    @Test
    @DisplayName("S27: each action string routes to the matching service method (isRootUser=false for jdoe)")
    void postRoutesToServiceMethods() throws Exception {
        routeAndVerify("{\"action\":\"save\",\"filename\":\"a.cfg\",\"rawContent\":\"k=v\"}",
                (s) -> verifyNoException(() -> verify(s).saveFile(eq("a.cfg"), any(), eq(false))));
        routeAndVerify("{\"action\":\"toggle\",\"filename\":\"a.cfg\"}",
                (s) -> verifyNoException(() -> verify(s).toggleFileStatus("a.cfg", false)));
        routeAndVerify("{\"action\":\"markAsDefault\",\"filename\":\"a.cfg\"}",
                (s) -> verifyNoException(() -> verify(s).markAsDefaultConfiguration("a.cfg", false)));
        routeAndVerify("{\"action\":\"create\",\"filename\":\"a.cfg\"}",
                (s) -> verifyNoException(() -> verify(s).createFile("a.cfg", false)));
        routeAndVerify("{\"action\":\"encrypt\",\"value\":\"secret\"}",
                (s) -> verifyNoException(() -> verify(s).encrypt("secret")));
        routeAndVerify("{\"action\":\"decrypt\",\"value\":\"ENC(x)\"}",
                (s) -> verifyNoException(() -> verify(s).decrypt("ENC(x)")));
    }

    @Test
    @DisplayName("S27: createFromMetatype with an identifier routes to the factory creator")
    void createFromMetatypeFactory() throws Exception {
        ActionDispatchFixture fx = ActionDispatchFixture.authorized()
                .postJson("{\"action\":\"createFromMetatype\",\"pid\":\"com.acme\",\"instanceIdentifier\":\"inst1\"}");
        OsgiConfigService service = mock(OsgiConfigService.class);
        when(service.createFactoryFileFromMetatype(eq("com.acme"), eq("inst1"), any(Locale.class), eq(false)))
                .thenReturn("com.acme-inst1.cfg");

        fx.action(service).doExecute(fx.request, fx.renderContext, null, fx.session, null, null);

        verify(service).createFactoryFileFromMetatype(eq("com.acme"), eq("inst1"), any(Locale.class), eq(false));
    }

    @Test
    @DisplayName("S27: an unknown action returns 400, not a silent 200")
    void unknownActionIsBadRequest() throws Exception {
        ActionDispatchFixture fx = ActionDispatchFixture.authorized()
                .postJson("{\"action\":\"nope\",\"filename\":\"a.cfg\"}");
        OsgiConfigService service = mock(OsgiConfigService.class);

        fx.action(service).doExecute(fx.request, fx.renderContext, null, fx.session, null, null);

        verify(fx.response).setStatus(HttpServletResponse.SC_BAD_REQUEST);
        assertTrue(fx.body().contains("Unknown action"));
    }

    // ---- S26: GET dispatch shapes ----

    @Test
    @DisplayName("S26: GET ?filename= reads one file")
    void getReadsSingleFile() throws Exception {
        ActionDispatchFixture fx = ActionDispatchFixture.authorized().get();
        when(fx.request.getParameter("filename")).thenReturn("demo.cfg");
        OsgiConfigService service = mock(OsgiConfigService.class);
        when(service.readFile(eq("demo.cfg"), any(Locale.class), eq(false)))
                .thenReturn(Map.of("rawContent", "k=v"));

        fx.action(service).doExecute(fx.request, fx.renderContext, null, fx.session, null, null);

        verify(service).readFile(eq("demo.cfg"), any(Locale.class), eq(false));
        assertTrue(fx.body().contains("data"));
    }

    @Test
    @DisplayName("S26: GET ?action=availableMetatypes lists metatypes")
    void getAvailableMetatypes() throws Exception {
        ActionDispatchFixture fx = ActionDispatchFixture.authorized().get();
        when(fx.request.getParameter("action")).thenReturn("availableMetatypes");
        OsgiConfigService service = mock(OsgiConfigService.class);
        when(service.listAvailableMetatypeConfigurations(any(Locale.class), eq(false)))
                .thenReturn(List.of(Map.of("pid", "com.acme")));

        fx.action(service).doExecute(fx.request, fx.renderContext, null, fx.session, null, null);

        verify(service).listAvailableMetatypeConfigurations(any(Locale.class), eq(false));
        assertTrue(fx.body().contains("metatypes"));
    }

    @Test
    @DisplayName("S26: GET ?action=getPreference reads the caller's own user-node property")
    void getPreference() throws Exception {
        ActionDispatchFixture fx = ActionDispatchFixture.authorized().get();
        when(fx.request.getParameter("action")).thenReturn("getPreference");
        when(fx.request.getParameter("key")).thenReturn("osgiCM.showComments");
        when(fx.session.nodeExists("/users/jdoe")).thenReturn(true);
        when(fx.session.getNode("/users/jdoe")).thenReturn(fx.userNode);
        when(fx.userNode.hasProperty("osgiCM.showComments")).thenReturn(true);
        JCRPropertyWrapper prop = mock(JCRPropertyWrapper.class);
        when(prop.getString()).thenReturn("true");
        when(fx.userNode.getProperty("osgiCM.showComments")).thenReturn(prop);
        OsgiConfigService service = mock(OsgiConfigService.class);

        fx.action(service).doExecute(fx.request, fx.renderContext, null, fx.session, null, null);

        assertTrue(fx.body().contains("true"));
    }

    // ---- S25: setPreference writes a client-named property on the caller's own node ----

    @Test
    @DisplayName("S25 (fixed): setPreference rejects an adversarial namespaced key (400) and writes nothing")
    void setPreferenceRejectsInvalidKey() throws Exception {
        ActionDispatchFixture fx = ActionDispatchFixture.authorized()
                .postJson("{\"action\":\"setPreference\",\"key\":\"j:someInternal\",\"value\":\"x\"}");
        when(fx.session.nodeExists("/users/jdoe")).thenReturn(true);
        when(fx.session.getNode("/users/jdoe")).thenReturn(fx.userNode);
        OsgiConfigService service = mock(OsgiConfigService.class);

        fx.action(service).doExecute(fx.request, fx.renderContext, null, fx.session, null, null);

        // the 'j:'-prefixed key is rejected — no property is written and the session is not saved
        verify(fx.response).setStatus(HttpServletResponse.SC_BAD_REQUEST);
        verify(fx.userNode, never()).setProperty(anyString(), anyString());
        verify(fx.session, never()).save();
    }

    @Test
    @DisplayName("S25 (fixed): setPreference writes a valid plain key on the caller's own node and saves")
    void setPreferenceWritesValidKey() throws Exception {
        ActionDispatchFixture fx = ActionDispatchFixture.authorized()
                .postJson("{\"action\":\"setPreference\",\"key\":\"osgiCM.showComments\",\"value\":\"true\"}");
        when(fx.session.nodeExists("/users/jdoe")).thenReturn(true);
        when(fx.session.getNode("/users/jdoe")).thenReturn(fx.userNode);
        OsgiConfigService service = mock(OsgiConfigService.class);

        fx.action(service).doExecute(fx.request, fx.renderContext, null, fx.session, null, null);

        verify(fx.userNode).setProperty("osgiCM.showComments", "true");
        verify(fx.session).save();
    }

    // ---- S23: error responses no longer leak internal filesystem paths ----

    @Test
    @DisplayName("S23 (fixed): a handled failure keeps the reason but strips the internal path (500)")
    void errorDoesNotLeakInternalPath() throws Exception {
        ActionDispatchFixture fx = ActionDispatchFixture.authorized().get();
        when(fx.request.getParameter("filename")).thenReturn("missing.cfg");
        OsgiConfigService service = mock(OsgiConfigService.class);
        when(service.readFile(eq("missing.cfg"), any(Locale.class), eq(false)))
                .thenThrow(new IOException("File not found: /opt/karaf/etc/missing.cfg"));

        fx.action(service).doExecute(fx.request, fx.renderContext, null, fx.session, null, null);

        verify(fx.response).setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        String body = fx.body();
        assertTrue(body.toLowerCase(Locale.ROOT).contains("not found"), "the actionable reason is preserved");
        assertFalse(body.contains("/opt/karaf/etc/missing.cfg"), "the internal filesystem path must be stripped");
    }

    // ---- helpers ----

    private interface ServiceAssertion {
        void run(OsgiConfigService service) throws Exception;
    }

    private void routeAndVerify(String jsonBody, ServiceAssertion assertion) throws Exception {
        ActionDispatchFixture fx = ActionDispatchFixture.authorized().postJson(jsonBody);
        OsgiConfigService service = mock(OsgiConfigService.class);
        fx.action(service).doExecute(fx.request, fx.renderContext, null, fx.session, null, null);
        assertion.run(service);
    }

    private void verifyNoException(RunnableWithException r) {
        try {
            r.run();
        } catch (Exception e) {
            throw new AssertionError(e);
        }
    }

    private interface RunnableWithException {
        void run() throws Exception;
    }
}
