package org.jahia.modules.osgiconfigmanager.graphql;

import org.jahia.modules.osgiconfigmanager.admin.ConfigAccessDeniedException;
import org.jahia.modules.osgiconfigmanager.admin.ConfigConflictException;
import org.jahia.modules.osgiconfigmanager.admin.ConfigNotFoundException;
import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.JCRSessionFactory;
import org.jahia.services.content.JCRSessionWrapper;
import org.jahia.services.usermanager.JahiaUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.Locale;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The security core of the GraphQL API: who may call it, which request shapes a mutation accepts,
 * and what an error is allowed to tell the client.
 */
class OsgiConfigGqlSupportTest {

    private JCRSessionFactory factory;
    private JCRSessionWrapper session;
    private JCRNodeWrapper rootNode;
    private JCRNodeWrapper systemSite;
    private JahiaUser user;

    @BeforeEach
    void setUp() throws Exception {
        factory = mock(JCRSessionFactory.class);
        session = mock(JCRSessionWrapper.class);
        rootNode = mock(JCRNodeWrapper.class);
        systemSite = mock(JCRNodeWrapper.class);
        user = mock(JahiaUser.class);

        lenient().when(user.getName()).thenReturn("alice");
        lenient().when(factory.getCurrentUser()).thenReturn(user);
        lenient().when(factory.getCurrentUserSession()).thenReturn(session);
        lenient().when(session.getNode("/")).thenReturn(rootNode);
        lenient().when(session.getNode("/sites/systemsite")).thenReturn(systemSite);
        lenient().when(rootNode.hasPermission("canManageOsgiConfigurations")).thenReturn(true);
        lenient().when(systemSite.hasPermission("admin")).thenReturn(true);
    }

    private static String code(OsgiConfigGqlException e) {
        return (String) e.getExtensions().get("code");
    }

    // ---- authorize ----

    @Test
    @DisplayName("authorize returns the caller when both Action-era permissions are granted")
    void authorize_withBothPermissions_returnsCaller() {
        GqlCaller caller = OsgiConfigGqlSupport.authorize(factory, Locale.FRENCH);

        assertSame(user, caller.getUser());
        assertSame(session, caller.getSession());
        assertEquals(Locale.FRENCH, caller.getLocale());
        assertFalse(caller.isRoot());
    }

    @Test
    @DisplayName("authorize flags root so the root-only self-configuration PID stays reachable")
    void authorize_root_isRoot() {
        when(user.getName()).thenReturn("root");

        assertTrue(OsgiConfigGqlSupport.authorize(factory, Locale.ENGLISH).isRoot());
    }

    @Test
    @DisplayName("authorize refuses the guest user")
    void authorize_guest_isForbidden() {
        when(user.getName()).thenReturn("guest");

        OsgiConfigGqlException e = assertThrows(OsgiConfigGqlException.class,
                () -> OsgiConfigGqlSupport.authorize(factory, Locale.ENGLISH));
        assertEquals("FORBIDDEN", code(e));
    }

    @Test
    @DisplayName("authorize refuses a request with no current user")
    void authorize_noUser_isForbidden() {
        when(factory.getCurrentUser()).thenReturn(null);

        OsgiConfigGqlException e = assertThrows(OsgiConfigGqlException.class,
                () -> OsgiConfigGqlSupport.authorize(factory, Locale.ENGLISH));
        assertEquals("FORBIDDEN", code(e));
    }

    @Test
    @DisplayName("SEC-138: authorize refuses a system session even though it reports every permission")
    void authorize_systemSession_isForbidden() {
        when(session.isSystem()).thenReturn(true);

        OsgiConfigGqlException e = assertThrows(OsgiConfigGqlException.class,
                () -> OsgiConfigGqlSupport.authorize(factory, Locale.ENGLISH));
        assertEquals("FORBIDDEN", code(e));
    }

    @Test
    @DisplayName("authorize refuses a caller without canManageOsgiConfigurations")
    void authorize_withoutManagePermission_isForbidden() {
        when(rootNode.hasPermission("canManageOsgiConfigurations")).thenReturn(false);

        OsgiConfigGqlException e = assertThrows(OsgiConfigGqlException.class,
                () -> OsgiConfigGqlSupport.authorize(factory, Locale.ENGLISH));
        assertEquals("FORBIDDEN", code(e));
    }

    @Test
    @DisplayName("authorize keeps the Action's admin requirement on systemsite")
    void authorize_withoutAdminOnSystemSite_isForbidden() {
        when(systemSite.hasPermission("admin")).thenReturn(false);

        OsgiConfigGqlException e = assertThrows(OsgiConfigGqlException.class,
                () -> OsgiConfigGqlSupport.authorize(factory, Locale.ENGLISH));
        assertEquals("FORBIDDEN", code(e));
    }

    @Test
    @DisplayName("authorize fails closed when the repository cannot be read")
    void authorize_repositoryError_isForbidden() throws Exception {
        when(factory.getCurrentUserSession()).thenThrow(new javax.jcr.RepositoryException("down"));

        OsgiConfigGqlException e = assertThrows(OsgiConfigGqlException.class,
                () -> OsgiConfigGqlSupport.authorize(factory, Locale.ENGLISH));
        assertEquals("FORBIDDEN", code(e));
    }

    // ---- requireCsrfSafe ----

    private HttpServletRequest request(String requestedWith, String contentType) {
        HttpServletRequest req = mock(HttpServletRequest.class);
        lenient().when(req.getHeader("X-Requested-With")).thenReturn(requestedWith);
        lenient().when(req.getContentType()).thenReturn(contentType);
        return req;
    }

    @Test
    @DisplayName("a JSON mutation carrying X-Requested-With is accepted")
    void csrf_jsonWithHeader_passes() {
        OsgiConfigGqlSupport.requireCsrfSafe(request("XMLHttpRequest", "application/json; charset=UTF-8"));
    }

    @Test
    @DisplayName("a mutation without X-Requested-With is refused")
    void csrf_missingHeader_isForbidden() {
        OsgiConfigGqlException e = assertThrows(OsgiConfigGqlException.class,
                () -> OsgiConfigGqlSupport.requireCsrfSafe(request(null, "application/json")));
        assertEquals("FORBIDDEN", code(e));
    }

    @Test
    @DisplayName("CORS-simple media types are refused, including one that merely contains application/json")
    void csrf_simpleMediaTypes_areRefused() {
        for (String contentType : new String[]{"text/plain", "text/plain;application/json",
                "multipart/form-data; boundary=x", "application/x-www-form-urlencoded", null}) {
            OsgiConfigGqlException e = assertThrows(OsgiConfigGqlException.class,
                    () -> OsgiConfigGqlSupport.requireCsrfSafe(request("XMLHttpRequest", contentType)),
                    String.valueOf(contentType));
            assertEquals("UNSUPPORTED_MEDIA_TYPE", code(e), String.valueOf(contentType));
        }
    }

    @Test
    @DisplayName("a mutation with no HTTP request behind it is refused")
    void csrf_noRequest_isForbidden() {
        OsgiConfigGqlException e = assertThrows(OsgiConfigGqlException.class,
                () -> OsgiConfigGqlSupport.requireCsrfSafe(null));
        assertEquals("FORBIDDEN", code(e));
    }

    // ---- translate ----

    @Test
    @DisplayName("typed service exceptions keep their meaning as an error code")
    void translate_typedExceptions_mapToCodes() {
        assertEquals("NOT_FOUND", code(OsgiConfigGqlSupport.translate(new ConfigNotFoundException("x"))));
        assertEquals("CONFLICT", code(OsgiConfigGqlSupport.translate(new ConfigConflictException("x"))));
        assertEquals("FORBIDDEN", code(OsgiConfigGqlSupport.translate(new ConfigAccessDeniedException("x"))));
        assertEquals("BAD_REQUEST", code(OsgiConfigGqlSupport.translate(new IOException("too big"))));
    }

    @Test
    @DisplayName("a controlled error keeps its reason but never an absolute server path")
    void translate_controlledError_stripsPaths() {
        OsgiConfigGqlException e = OsgiConfigGqlSupport.translate(
                new ConfigNotFoundException("File not found: /opt/jahia/karaf/etc/x.cfg"));

        assertEquals("File not found: <path>", e.getMessage());
    }

    @Test
    @DisplayName("an unexpected error is reported generically")
    void translate_unexpectedError_isGeneric() {
        OsgiConfigGqlException e = OsgiConfigGqlSupport.translate(
                new IllegalStateException("secret detail at /opt/jahia/data"));

        assertEquals("INTERNAL", code(e));
        assertFalse(e.getMessage().contains("secret"));
    }
}
