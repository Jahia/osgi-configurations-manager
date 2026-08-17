import {cleanupFiles} from './osgiTestUtils';

describe('OSGi Configurations Manager - Mark as default', () => {
    const defaultedFile = 'org.jahia.modules.e2e-mark-default.cfg';

    beforeEach(() => {
        cy.login();
        cleanupFiles([defaultedFile]);
    });

    afterEach(() => {
        cleanupFiles([defaultedFile]);
    });

    it('marks a USER configuration as default and writes the header', () => {
        // Arrange: a clean USER-state .cfg with no unsaved changes (the only state in which
        // "Mark as Default" is enabled).
        cy.upsertOsgiFile(defaultedFile, 'default.key = value\n');
        cy.openOsgiConfigManager();
        cy.openOsgiFile(defaultedFile);

        // Act: complete the confirmation flow (the lifecycle spec only exercises the cancel path).
        cy.get('[data-cy="mark-as-default-button"] button', {timeout: 30000})
            .should('not.be.disabled')
            .click();
        cy.get('[data-cy="modal-dialog"]', {timeout: 30000}).should('be.visible');
        cy.contains('Mark as default configuration').should('be.visible');
        cy.confirmModal();

        // Assert: success toast, the persisted header, and the state badge flipping to "Default".
        cy.assertToastContains('is now marked as default configuration');
        cy.readOsgiFile(defaultedFile)
            .its('data.rawContent')
            .should('contain', '# default configuration');
        cy.get('[data-cy="config-state-badge-module_default"]', {timeout: 30000}).should('be.visible');
    });
});
