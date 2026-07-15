package org.jahia.modules.osgiconfigmanager.admin;

import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.JCRSessionWrapper;
import org.jahia.services.render.RenderContext;
import org.jahia.services.usermanager.JahiaUser;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.PrintWriter;
import java.io.StringReader;
import java.io.StringWriter;
import java.util.Locale;

import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Reusable Mockito scaffold for driving {@link OsgiConfigAction#doExecute} without a container.
 *
 * <p>Wires the {@code RenderContext -> response/user}, {@code session.getNode("/").hasPermission}
 * gate, the request method / content-type / JSON body reader, and captures the JSON written back
 * to {@code response.getWriter()} in {@link #responseBody}. Built once, reused by the CSRF, authz,
 * audit, dispatch, error-leak and preference specs (G3/G4/G6/G14/G15/G16).</p>
 */
class ActionDispatchFixture {

    final HttpServletRequest request = mock(HttpServletRequest.class);
    final HttpServletResponse response = mock(HttpServletResponse.class);
    final RenderContext renderContext = mock(RenderContext.class);
    final JCRSessionWrapper session = mock(JCRSessionWrapper.class);
    final JCRNodeWrapper rootNode = mock(JCRNodeWrapper.class);
    final JCRNodeWrapper userNode = mock(JCRNodeWrapper.class);
    final JahiaUser user = mock(JahiaUser.class);
    final StringWriter responseBody = new StringWriter();

    ActionDispatchFixture(String username, boolean hasManagePermission) throws Exception {
        lenient().when(renderContext.getResponse()).thenReturn(response);
        lenient().when(renderContext.getUser()).thenReturn(user);
        lenient().when(user.getName()).thenReturn(username);
        lenient().when(user.getLocalPath()).thenReturn("/users/" + username);
        lenient().when(response.getWriter()).thenReturn(new PrintWriter(responseBody));
        lenient().when(session.getNode("/")).thenReturn(rootNode);
        lenient().when(rootNode.hasPermission("canManageOsgiConfigurations")).thenReturn(hasManagePermission);
        lenient().when(request.getLocale()).thenReturn(Locale.ENGLISH);
    }

    static ActionDispatchFixture authorized() throws Exception {
        return new ActionDispatchFixture("jdoe", true);
    }

    static ActionDispatchFixture unauthorized() throws Exception {
        return new ActionDispatchFixture("jdoe", false);
    }

    ActionDispatchFixture get() {
        when(request.getMethod()).thenReturn("GET");
        return this;
    }

    ActionDispatchFixture getParam(String name, String value) {
        when(request.getParameter(name)).thenReturn(value);
        return this;
    }

    ActionDispatchFixture postJson(String body) throws Exception {
        when(request.getMethod()).thenReturn("POST");
        when(request.getContentType()).thenReturn("application/json; charset=UTF-8");
        when(request.getReader()).thenReturn(new BufferedReader(new StringReader(body)));
        return this;
    }

    ActionDispatchFixture postWithContentType(String contentType, String body) throws Exception {
        when(request.getMethod()).thenReturn("POST");
        when(request.getContentType()).thenReturn(contentType);
        lenient().when(request.getReader()).thenReturn(new BufferedReader(new StringReader(body)));
        return this;
    }

    /** Build an Action bound to the supplied (mock or real) service. */
    OsgiConfigAction action(OsgiConfigService service) {
        OsgiConfigAction action = new OsgiConfigAction();
        action.setConfigService(service);
        return action;
    }

    String body() {
        return responseBody.toString();
    }
}
