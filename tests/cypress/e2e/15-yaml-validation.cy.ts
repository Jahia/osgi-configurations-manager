import {cleanupFiles} from './osgiTestUtils';

describe('OSGi Configurations Manager - YAML validation gate', () => {
    const yamlFile = 'org.jahia.modules.e2e-yaml-validation.yml';
    // Monaco's own shortcut: {selectall} selects the hidden textarea's text, not the document, so
    // the typed lines were inserted before the existing ones instead of replacing them.
    const selectAll = Cypress.platform === 'darwin' ? '{cmd}a' : '{ctrl}a';

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

        // Act: replace the content with broken YAML. A bare scalar following a mapping entry is a
        // parse error ("a document separator is expected"). We deliberately avoid brackets/quotes
        // because Monaco auto-closes those pairs, which would silently produce VALID YAML.
        cy.focusRawEditor();
        cy.get('.monaco-editor textarea').type(`${selectAll}{del}`, {force: true});
        cy.get('.monaco-editor textarea').type('foo: bar\nbaz', {force: true});

        // Assert: the editor reports invalid YAML, so Save stays disabled despite pending changes.
        cy.get('[data-cy="save-config-button"] button', {timeout: 30000}).should('be.disabled');

        // Act: fix the syntax.
        cy.get('.monaco-editor textarea').type(`${selectAll}{del}`, {force: true});
        cy.get('.monaco-editor textarea').type('foo: bar', {force: true});

        // Assert: valid YAML with pending changes re-enables Save.
        cy.get('[data-cy="save-config-button"] button', {timeout: 30000}).should('not.be.disabled');
    });

    it('underlines invalid YAML even when another module set MonacoEnvironment first', () => {
        // Arrange: another module bundling Monaco claims window.MonacoEnvironment before ours loads,
        // and its getWorker answers every label with a plain editor worker, which has no YAML
        // service. The manager's YAML worker used to come from that global, so live validation
        // stopped ("Missing requestHandler or method: doValidation") while the rest of the editor
        // kept working. A plain editor.worker.js stands in for that module's workers.
        const foreignWorkerUrl = '/modules/osgi-configurations-manager/javascript/apps/editor.worker.js';
        cy.upsertOsgiFile(yamlFile, 'valid: true\n');
        cy.openOsgiConfigManager({
            onBeforeLoad(win) {
                win.MonacoEnvironment = {getWorker: () => new win.Worker(foreignWorkerUrl)};
            }
        });
        cy.openOsgiFile(yamlFile);
        cy.get('[data-cy="raw-editor-toolbar"]', {timeout: 30000}).should('be.visible');
        cy.window().its('MonacoEnvironment.getWorker').should('be.a', 'function');

        // Act: append a bare scalar after the mapping (see the test above for why no brackets).
        cy.focusRawEditor();
        cy.get('.monaco-editor textarea').type(`${selectAll}{del}`, {force: true});
        cy.get('.monaco-editor textarea').type('foo: bar\nbaz', {force: true});

        // Assert: the YAML service ran: the error is underlined in the editor and Save is gated.
        cy.get('.monaco-editor .squiggly-error', {timeout: 30000}).should('exist');
        cy.get('[data-cy="save-config-button"] button').should('be.disabled');
        // jsErrorsLogger (support/e2e.js) spies the console as @errors and @warnings, but checks them
        // only at page load, before anything was typed.
        cy.get('@errors').should('not.have.been.calledWithMatch', /Missing requestHandler/);
        cy.get('@warnings').should('not.have.been.calledWithMatch', /Missing requestHandler/);
    });
});
