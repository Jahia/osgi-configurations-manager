package org.jahia.modules.osgiconfigmanager.admin;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * S24 (G6) — CHARACTERIZATION of the audit-attribution gap.
 *
 * <p>State-changing actions (save/delete/toggle/markAsDefault/create) log {@code [AUDIT] User: ...}
 * at INFO; the two most sensitive disclosure paths, {@code decrypt}/{@code encrypt} (and
 * {@code setPreference}), log only the generic un-attributed line; {@code read} logs its
 * {@code [AUDIT]} line only at DEBUG (effectively off in production). Stage-7 flips the decrypt
 * branch to an attributed INFO {@code [AUDIT]} line.</p>
 */
class OsgiConfigActionAuditTest {

    private Logger auditLogger;
    private ListAppender<ILoggingEvent> appender;

    @BeforeEach
    void attachAppender() {
        auditLogger = (Logger) LoggerFactory.getLogger(OsgiConfigAction.class);
        auditLogger.setLevel(Level.DEBUG);
        appender = new ListAppender<>();
        appender.start();
        auditLogger.addAppender(appender);
    }

    @AfterEach
    void detachAppender() {
        auditLogger.detachAppender(appender);
    }

    private void dispatch(String jsonBody) throws Exception {
        ActionDispatchFixture fx = ActionDispatchFixture.authorized().postJson(jsonBody);
        OsgiConfigService service = mock(OsgiConfigService.class);
        fx.action(service).doExecute(fx.request, fx.renderContext, null, fx.session, null, null);
    }

    private List<ILoggingEvent> events() {
        return appender.list;
    }

    private boolean hasInfoAudit(String action) {
        return events().stream().anyMatch(e -> e.getLevel() == Level.INFO
                && e.getFormattedMessage().contains("[AUDIT] User: jdoe | Action: " + action));
    }

    @Test
    @DisplayName("S24: save/delete/toggle/markAsDefault/create each emit an attributed [AUDIT] INFO line")
    void stateChangingActionsAreAudited() throws Exception {
        for (String action : List.of("save", "delete", "toggle", "markAsDefault", "create")) {
            appender.list.clear();
            dispatch("{\"action\":\"" + action + "\",\"filename\":\"a.cfg\"}");
            assertTrue(hasInfoAudit(action), action + " must log an attributed [AUDIT] INFO line");
        }
    }

    @Test
    @DisplayName("S24: decrypt/encrypt/setPreference are logged WITHOUT [AUDIT] or username")
    void sensitiveActionsAreUnattributed() throws Exception {
        for (String body : List.of(
                "{\"action\":\"decrypt\",\"value\":\"ENC(x)\"}",
                "{\"action\":\"encrypt\",\"value\":\"secret\"}",
                "{\"action\":\"setPreference\",\"key\":\"k\",\"value\":\"v\"}")) {
            appender.list.clear();
            dispatch(body);
            boolean anyAudit = events().stream()
                    .anyMatch(e -> e.getFormattedMessage().contains("[AUDIT]"));
            boolean anyUsername = events().stream()
                    .anyMatch(e -> e.getFormattedMessage().contains("jdoe"));
            assertFalse(anyAudit, "CHARACTERIZATION: sensitive action must currently NOT be [AUDIT]-tagged: " + body);
            assertFalse(anyUsername, "CHARACTERIZATION: sensitive action must currently NOT carry the username: " + body);
        }
    }

    @Test
    @DisplayName("S24: GET read logs its [AUDIT] line only at DEBUG, never INFO")
    void readIsDebugOnly() throws Exception {
        ActionDispatchFixture fx = ActionDispatchFixture.authorized().get();
        when(fx.request.getParameter("filename")).thenReturn("demo.cfg");
        OsgiConfigService service = mock(OsgiConfigService.class);
        when(service.readFile(org.mockito.ArgumentMatchers.eq("demo.cfg"),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.eq(false)))
                .thenReturn(java.util.Map.of("rawContent", "k=v"));

        fx.action(service).doExecute(fx.request, fx.renderContext, null, fx.session, null, null);

        boolean debugAudit = events().stream().anyMatch(e -> e.getLevel() == Level.DEBUG
                && e.getFormattedMessage().contains("[AUDIT]") && e.getFormattedMessage().contains("read"));
        boolean infoAudit = events().stream().anyMatch(e -> e.getLevel() == Level.INFO
                && e.getFormattedMessage().contains("[AUDIT]"));
        assertTrue(debugAudit, "read is audited only at DEBUG");
        assertFalse(infoAudit, "read must not produce an INFO [AUDIT] line (effectively off in prod)");
    }
}
