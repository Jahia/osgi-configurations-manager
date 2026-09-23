package org.jahia.modules.osgiconfigmanager.graphql;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.jahia.modules.osgiconfigmanager.admin.ConfigConflictException;
import org.jahia.modules.osgiconfigmanager.admin.OsgiConfigService;
import org.jahia.services.content.JCRSessionWrapper;
import org.jahia.services.usermanager.JahiaUser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import java.util.Locale;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OsgiConfigManagerMutationTest {

    private OsgiConfigService service;
    private OsgiConfigManagerMutation mutation;
    private ListAppender<ILoggingEvent> audit;
    private Logger supportLogger;

    @BeforeEach
    void setUp() {
        service = mock(OsgiConfigService.class);
        JahiaUser user = mock(JahiaUser.class);
        when(user.getName()).thenReturn("alice");
        mutation = new OsgiConfigManagerMutation(service,
                new GqlCaller(user, mock(JCRSessionWrapper.class), Locale.GERMAN));

        supportLogger = (Logger) LoggerFactory.getLogger(OsgiConfigGqlSupport.class);
        audit = new ListAppender<>();
        audit.start();
        supportLogger.addAppender(audit);
    }

    @AfterEach
    void tearDown() {
        supportLogger.detachAppender(audit);
    }

    private boolean audited(String action, String file) {
        String expected = "[AUDIT] User: alice | Action: " + action + " | File: " + file;
        return audit.list.stream().anyMatch(e -> e.getFormattedMessage().equals(expected));
    }

    @Test
    @DisplayName("save writes rawContent only, as a non-root caller, and is audited")
    void save_writesRawContent() throws Exception {
        assertTrue(mutation.save("org.acme.cfg", "a = 1\n"));

        verify(service).saveFile("org.acme.cfg", Map.of("rawContent", "a = 1\n"), false);
        assertTrue(audited("save", "org.acme.cfg"));
    }

    @Test
    @DisplayName("toggle, delete, markAsDefault and create each reach their service method")
    void fileOperations_delegate() throws Exception {
        assertTrue(mutation.toggle("a.cfg"));
        assertTrue(mutation.delete("b.cfg"));
        assertTrue(mutation.markAsDefault("c.cfg"));
        assertTrue(mutation.create("d.cfg"));

        verify(service).toggleFileStatus("a.cfg", false);
        verify(service).deleteFile("b.cfg", false);
        verify(service).markAsDefaultConfiguration("c.cfg", false);
        verify(service).createFile("d.cfg", false);
        assertTrue(audited("delete", "b.cfg"));
    }

    @Test
    @DisplayName("createFromMetatype returns the created file name, for a plain or a factory PID")
    void createFromMetatype_returnsFilename() throws Exception {
        when(service.createFileFromMetatype("org.acme", Locale.GERMAN, false)).thenReturn("org.acme.cfg");
        when(service.createFactoryFileFromMetatype("org.acme.f", "one", Locale.GERMAN, false))
                .thenReturn("org.acme.f-one.cfg");

        assertEquals("org.acme.cfg", mutation.createFromMetatype("org.acme", null));
        assertEquals("org.acme.cfg", mutation.createFromMetatype("org.acme", "  "));
        assertEquals("org.acme.f-one.cfg", mutation.createFromMetatype("org.acme.f", "one"));
    }

    @Test
    @DisplayName("decrypt stays bound to the file the value comes from")
    void decrypt_isFileBound() throws Exception {
        when(service.decryptForFile("a.cfg", "ENC(x)", false)).thenReturn("plain");

        assertEquals("plain", mutation.decrypt("a.cfg", "ENC(x)"));
        verify(service, never()).decrypt(anyString());
    }

    @Test
    @DisplayName("encrypt returns the service's ciphertext")
    void encrypt_returnsCiphertext() throws Exception {
        when(service.encrypt("secret")).thenReturn("ENC(zz)");

        assertEquals("ENC(zz)", mutation.encrypt("secret"));
    }

    @Test
    @DisplayName("a service conflict surfaces as CONFLICT, with no server path")
    void conflict_isTranslated() throws Exception {
        doThrow(new ConfigConflictException("Target exists: /opt/jahia/karaf/etc/a.cfg.disabled"))
                .when(service).toggleFileStatus("a.cfg", false);

        OsgiConfigGqlException e = assertThrows(OsgiConfigGqlException.class, () -> mutation.toggle("a.cfg"));

        assertEquals("CONFLICT", e.getExtensions().get("code"));
        assertEquals("Target exists: <path>", e.getMessage());
    }

    @Test
    @DisplayName("setPreference refuses a key outside the allowlist without writing")
    void setPreference_disallowedKey_isBadRequest() throws Exception {
        OsgiConfigGqlException e = assertThrows(OsgiConfigGqlException.class,
                () -> mutation.setPreference("evil", "x"));

        assertEquals("BAD_REQUEST", e.getExtensions().get("code"));
        verify(service, never()).saveFile(anyString(), any(), anyBoolean());
    }
}
