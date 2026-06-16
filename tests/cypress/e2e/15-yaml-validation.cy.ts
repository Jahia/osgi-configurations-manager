import {cleanupFiles} from './osgiTestUtils';

describe('OSGi Configurations Manager - YAML validation gate', () => {
    const yamlFile = 'org.jahia.modules.e2e-yaml-validation.yml';

    beforeEach(() => {
        cy.login();
        cleanupFiles([yamlFile]);
    });

    afterEach(() => {
        cleanupFiles([yamlFile]);
    });

    it('disables Save while the raw YAML is syntactically invalid, then re-enables it once fixed', () => {
        // Arrange: a valid .yml opened in the Monaco raw editor.
        cy.upsertOsgiFile(yamlFile, 'valid: true\n');
        cy.openOsgiConfigManager();
        cy.openOsgiFile(yamlFile);
        cy.get('[data-cy="raw-editor-toolbar"]', {timeout: 30000}).should('be.visible');

        // Act: replace the content with broken YAML (an unclosed flow sequence).
        cy.get('.monaco-editor textarea', {timeout: 30000}).click({force: true});
        cy.get('.monaco-editor textarea').type('{selectall}{del}', {force: true});
        cy.get('.monaco-editor textarea').type('foo: [unclosed', {force: true});

        // Assert: the editor reports invalid YAML, so Save stays disabled despite pending changes.
        cy.get('[data-cy="save-config-button"] button', {timeout: 30000}).should('be.disabled');

        // Act: fix the syntax.
        cy.get('.monaco-editor textarea').type('{selectall}{del}', {force: true});
        cy.get('.monaco-editor textarea').type('foo: bar', {force: true});

        // Assert: valid YAML with pending changes re-enables Save.
        cy.get('[data-cy="save-config-button"] button', {timeout: 30000}).should('not.be.disabled');
    });
});
