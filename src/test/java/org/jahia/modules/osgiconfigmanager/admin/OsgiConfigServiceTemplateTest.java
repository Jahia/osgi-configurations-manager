package org.jahia.modules.osgiconfigmanager.admin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.osgi.service.metatype.AttributeDefinition;
import org.osgi.service.metatype.ObjectClassDefinition;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** The .cfg template generated from a Metatype flags Password attributes as secrets to encrypt. */
class OsgiConfigServiceTemplateTest {

    private static AttributeDefinition attribute(String id, int type, String... defaults) {
        AttributeDefinition definition = mock(AttributeDefinition.class);
        when(definition.getID()).thenReturn(id);
        when(definition.getType()).thenReturn(type);
        when(definition.getDefaultValue()).thenReturn(defaults.length == 0 ? null : defaults);
        return definition;
    }

    @Test
    @DisplayName("a Password attribute gets a hint line, a String attribute does not")
    void passwordAttributesAreFlagged() {
        // Mocks are built before the OCD is stubbed: creating a mock inside a thenReturn(...)
        // argument interrupts the stubbing in progress and Mockito rejects it.
        AttributeDefinition user = attribute("jira.user", AttributeDefinition.STRING, "support-bot");
        AttributeDefinition token = attribute("jira.token", AttributeDefinition.PASSWORD);
        AttributeDefinition[] required = {user, token};

        ObjectClassDefinition ocd = mock(ObjectClassDefinition.class);
        when(ocd.getName()).thenReturn("Jira connection");
        when(ocd.getDescription()).thenReturn("Settings of the Jira client.");
        when(ocd.getAttributeDefinitions(ObjectClassDefinition.REQUIRED)).thenReturn(required);
        when(ocd.getAttributeDefinitions(ObjectClassDefinition.OPTIONAL)).thenReturn(null);

        String template = new OsgiConfigService().buildCfgTemplate("org.acme.jira", ocd, null);

        assertTrue(template.contains("# PID: org.acme.jira"));
        assertTrue(template.contains("# jira.user = support-bot"));
        assertTrue(template.contains(OsgiConfigService.PASSWORD_HINT_PREFIX + "jira.token" + OsgiConfigService.PASSWORD_HINT_SUFFIX),
                "the secret is named in the hint");
        assertTrue(template.contains("# jira.token = "));
        assertFalse(template.contains("jira.user" + OsgiConfigService.PASSWORD_HINT_SUFFIX), "plain attributes carry no hint");
    }
}
