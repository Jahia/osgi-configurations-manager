package org.jahia.modules.osgiconfigmanager.admin;

import org.jahia.bin.ActionResult;
import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.JCRSessionWrapper;
import org.jahia.services.render.RenderContext;
import org.jahia.services.usermanager.JahiaUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringReader;
import java.io.StringWriter;
import java.util.Collections;
import java.util.Locale;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the HTTP-facing guards of {@link OsgiConfigAction}: authorization, the CSRF header
 * requirement, unknown-action handling and the preference-key allowlist. The happy paths are also
 * exercised end-to-end by the Cypress suite.
 */
class OsgiConfigActionTest {

    private OsgiConfigService configService;
    private OsgiConfigAction action;
    private HttpServletRequest req;
    private RenderContext renderContext;
    private JCRSessionWrapper session;
    private HttpServletResponse response;
    private StringWriter responseBody;

    @BeforeEach
    void setUp() throws Exception {
        configService = mock(OsgiConfigService.class);
        action = new OsgiConfigAction();
        action.setConfigService(configService);

        req = mock(HttpServletRequest.class);
        renderContext = mock(RenderContext.class);
        session = mock(JCRSessionWrapper.class);
        response = mock(HttpServletResponse.class);

        JahiaUser user = mock(JahiaUser.class);
        when(user.getName()).thenReturn("alice");
        when(renderContext.getUser()).thenReturn(user);
        when(renderContext.getResponse()).thenReturn(response);

        grantManagePermission(true);

        responseBody = new StringWriter();
        when(response.getWriter()).thenReturn(new PrintWriter(responseBody));
    }

    private void grantManagePermission(boolean granted) throws Exception {
        JCRNodeWrapper rootNode = mock(JCRNodeWrapper.class);
        when(session.getNode("/")).thenReturn(rootNode);
        when(rootNode.hasPermission("canManageOsgiConfigurations")).thenReturn(granted);
    }

    private ActionResult execute() throws Exception {
        return action.doExecute(req, renderContext, null, session, null, null);
    }

    private void stubPost(String body) throws Exception {
        when(req.getMethod()).thenReturn("POST");
        when(req.getHeader("X-Requested-With")).thenReturn("XMLHttpRequest");
        when(req.getReader()).thenReturn(new BufferedReader(new StringReader(body)));
    }

    @Test
    @DisplayName("returns 403 when the manage permission is missing")
    void doExecute_withoutPermission_returnsForbidden() throws Exception {
        grantManagePermission(false);

        ActionResult result = execute();

        assertEquals(HttpServletResponse.SC_FORBIDDEN, result.getResultCode());
    }

    @Test
    @DisplayName("rejects a POST without the CSRF header")
    void doExecute_postWithoutCsrfHeader_returns403() throws Exception {
        when(req.getMethod()).thenReturn("POST");
        when(req.getHeader("X-Requested-With")).thenReturn(null);

        execute();

        verify(response).setStatus(HttpServletResponse.SC_FORBIDDEN);
        assertTrue(responseBody.toString().contains("X-Requested-With"));
        verify(configService, never()).saveFile(any(), any(), anyBoolean());
    }

    @Test
    @DisplayName("rejects an unknown POST action with 400")
    void doExecute_unknownAction_returns400() throws Exception {
        stubPost("{\"action\":\"bogus\"}");

        execute();

        verify(response).setStatus(HttpServletResponse.SC_BAD_REQUEST);
        assertTrue(responseBody.toString().contains("Unknown action"));
    }

    @Test
    @DisplayName("rejects setPreference with a non-allowlisted key")
    void doExecute_setPreferenceDisallowedKey_returns400() throws Exception {
        stubPost("{\"action\":\"setPreference\",\"key\":\"j:password\",\"value\":\"x\"}");

        execute();

        verify(response).setStatus(HttpServletResponse.SC_BAD_REQUEST);
        assertTrue(responseBody.toString().contains("Unsupported preference key"));
        verify(session, never()).save();
    }

    @Test
    @DisplayName("dispatches a save to the service")
    void doExecute_save_callsService() throws Exception {
        stubPost("{\"action\":\"save\",\"filename\":\"x.cfg\",\"rawContent\":\"a=1\"}");

        execute();

        verify(configService).saveFile(eq("x.cfg"), any(), anyBoolean());
        assertTrue(responseBody.toString().contains("saved"));
    }

    // ------------------------------------------------------------------ GET dispatch

    @Test
    @DisplayName("GET with a filename reads the file and returns its data")
    void doExecute_getFile_returnsData() throws Exception {
        when(req.getMethod()).thenReturn("GET");
        when(req.getParameter("filename")).thenReturn("x.cfg");
        when(req.getLocale()).thenReturn(Locale.ENGLISH);
        when(configService.readFile(eq("x.cfg"), any(), anyBoolean()))
                .thenReturn(Collections.singletonMap("rawContent", "a=1"));

        execute();

        verify(configService).readFile(eq("x.cfg"), any(), anyBoolean());
        assertTrue(responseBody.toString().contains("rawContent"));
    }

    @Test
    @DisplayName("GET availableMetatypes lists metatype configurations")
    void doExecute_getAvailableMetatypes_listsMetatypes() throws Exception {
        when(req.getMethod()).thenReturn("GET");
        when(req.getParameter("action")).thenReturn("availableMetatypes");
        when(req.getLocale()).thenReturn(Locale.ENGLISH);
        when(configService.listAvailableMetatypeConfigurations(any(), anyBoolean()))
                .thenReturn(Collections.emptyList());

        execute();

        verify(configService).listAvailableMetatypeConfigurations(any(), anyBoolean());
        assertTrue(responseBody.toString().contains("metatypes"));
    }

    @Test
    @DisplayName("GET without parameters lists files and ui config")
    void doExecute_getList_returnsFiles() throws Exception {
        when(req.getMethod()).thenReturn("GET");
        when(configService.getUiConfig()).thenReturn(Collections.emptyMap());
        when(configService.listFiles(anyBoolean())).thenReturn(Collections.<Map<String, Object>>emptyList());

        execute();

        verify(configService).listFiles(anyBoolean());
        assertTrue(responseBody.toString().contains("files"));
    }

    // ----------------------------------------------------------------- POST verbs

    @Test
    @DisplayName("dispatches toggle / delete / markAsDefault and reports status")
    void doExecute_toggleDeleteMarkDefault_callServiceAndReportStatus() throws Exception {
        stubPost("{\"action\":\"toggle\",\"filename\":\"x.cfg\"}");
        execute();
        verify(configService).toggleFileStatus(eq("x.cfg"), anyBoolean());
        assertTrue(responseBody.toString().contains("toggled"));

        setUp();
        stubPost("{\"action\":\"delete\",\"filename\":\"x.cfg\"}");
        execute();
        verify(configService).deleteFile(eq("x.cfg"), anyBoolean());
        assertTrue(responseBody.toString().contains("deleted"));

        setUp();
        stubPost("{\"action\":\"markAsDefault\",\"filename\":\"x.cfg\"}");
        execute();
        verify(configService).markAsDefaultConfiguration(eq("x.cfg"), anyBoolean());
        assertTrue(responseBody.toString().contains("updated"));
    }

    @Test
    @DisplayName("encrypt returns the encrypted value in the response")
    void doExecute_encrypt_returnsEncryptedValue() throws Exception {
        when(configService.encrypt("plain")).thenReturn("ENC(cipher)");
        stubPost("{\"action\":\"encrypt\",\"value\":\"plain\"}");

        execute();

        verify(configService).encrypt("plain");
        assertTrue(responseBody.toString().contains("ENC(cipher)"));
    }

    @Test
    @DisplayName("decrypt delegates to the file-bound decryption")
    void doExecute_decrypt_callsDecryptForFile() throws Exception {
        when(configService.decryptForFile(eq("x.cfg"), eq("ENC(cipher)"), anyBoolean())).thenReturn("plain");
        stubPost("{\"action\":\"decrypt\",\"filename\":\"x.cfg\",\"value\":\"ENC(cipher)\"}");

        execute();

        verify(configService).decryptForFile(eq("x.cfg"), eq("ENC(cipher)"), anyBoolean());
        assertTrue(responseBody.toString().contains("plain"));
    }

    // ---------------------------------------------------------------- error mapping

    @Test
    @DisplayName("maps a domain IOException to 400 with the safe message")
    void doExecute_serviceThrowsIOException_returns400WithMessage() throws Exception {
        when(configService.encrypt(anyString()))
                .thenThrow(new IOException("Encryption key is not configured"));
        stubPost("{\"action\":\"encrypt\",\"value\":\"plain\"}");

        execute();

        verify(response).setStatus(HttpServletResponse.SC_BAD_REQUEST);
        assertTrue(responseBody.toString().contains("Encryption key is not configured"));
    }

    @Test
    @DisplayName("maps an unexpected RuntimeException to 500 with a generic message")
    void doExecute_serviceThrowsRuntime_returns500Generic() throws Exception {
        when(configService.encrypt(anyString())).thenThrow(new RuntimeException("boom with /internal/path"));
        stubPost("{\"action\":\"encrypt\",\"value\":\"plain\"}");

        execute();

        verify(response).setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        String body = responseBody.toString();
        assertTrue(body.contains("An internal error occurred"));
        assertTrue(!body.contains("/internal/path"), "Internal detail must not leak to the client");
    }

    @Test
    @DisplayName("rejects an oversized POST body before buffering it")
    void doExecute_oversizedBody_returns400() throws Exception {
        when(req.getMethod()).thenReturn("POST");
        when(req.getHeader("X-Requested-With")).thenReturn("XMLHttpRequest");
        when(req.getContentLength()).thenReturn((6 * 1024 * 1024));
        when(req.getReader()).thenReturn(new BufferedReader(new StringReader("{}")));

        execute();

        verify(response).setStatus(HttpServletResponse.SC_BAD_REQUEST);
        assertTrue(responseBody.toString().contains("maximum allowed size"));
        verify(configService, never()).saveFile(any(), any(), anyBoolean());
    }
}
