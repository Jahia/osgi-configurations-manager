import {cleanupFiles} from './osgiTestUtils';

describe('OSGi Configurations Manager - Selected file header', () => {
    const headerFile = 'org.jahia.modules.e2e-header-layout-check.cfg';

    beforeEach(() => {
        cy.login();
        cleanupFiles([headerFile]);
    });

    afterEach(() => {
        cleanupFiles([headerFile]);
    });

    it('displays the selected file information and main actions in the right header', () => {
        cy.upsertOsgiFile(headerFile, 'header.layout = true\n');
        cy.openOsgiConfigManager();
        cy.openOsgiFile(headerFile);

        cy.get('[data-cy="selected-file-name"]', {timeout: 30000})
            .should('be.visible')
            .and('contain', headerFile);
        cy.get('[data-cy="config-state-badge-user"]').should('be.visible');
        cy.get('[data-cy="header-actions-row"]').should('be.visible');
        cy.get('[data-cy="selected-file-toolbar"]').should('be.visible');
        cy.get('[data-cy="editor-mode-dropdown"] [role="listbox"]').should('be.visible');
        cy.get('[data-cy="cancel-config-button"] button').should('be.disabled');
        cy.get('[data-cy="save-config-button"] button').should('be.disabled');
        cy.ensureVisualCfgMode();
        cy.get('[data-cy="editor-mode-toggle"]').should('have.attr', 'data-mode', 'visual');
    });
});
