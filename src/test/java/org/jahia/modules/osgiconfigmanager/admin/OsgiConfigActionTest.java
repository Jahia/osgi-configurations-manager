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
import java.io.PrintWriter;
import java.io.StringReader;
import java.io.StringWriter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
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
}
