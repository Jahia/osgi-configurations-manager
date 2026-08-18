import {cleanupFiles} from './osgiTestUtils';

describe('OSGi Configurations Manager - Review-before-save cancel', () => {
    const diffFile = 'org.jahia.modules.e2e-diff-cancel.cfg';

    beforeEach(() => {
        cy.login();
        cleanupFiles([diffFile]);
    });

    afterEach(() => {
        cleanupFiles([diffFile]);
    });

    it('aborts the save and keeps the file unchanged when the diff is cancelled', () => {
        // Arrange
        cy.upsertOsgiFile(diffFile, 'diff.key = original\n');
        cy.openOsgiConfigManager();
        cy.openOsgiFile(diffFile);
        cy.ensureVisualCfgMode();

        // Act: edit a value, trigger save, then cancel the review-before-save diff.
        cy.get('[data-cy="cfg-value-0"]').clear();
        cy.get('[data-cy="cfg-value-0"]').type('changed value');
        cy.get('[data-cy="save-config-button"] button').click();
        cy.get('[data-cy="diff-modal-cancel"] button', {timeout: 30000}).should('be.visible').click();

        // Assert: nothing was written, and the pending edit is still there to save.
        cy.readOsgiFile(diffFile)
            .its('data.rawContent')
            .should('contain', 'diff.key = original')
            .and('not.contain', 'changed value');
        cy.get('[data-cy="cfg-value-0"]').should('have.value', 'changed value');
        cy.get('[data-cy="save-config-button"] button').should('not.be.disabled');
    });
});
