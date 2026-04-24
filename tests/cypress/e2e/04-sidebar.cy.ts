import {cleanupFiles} from './osgiTestUtils';

describe('OSGi Configurations Manager - Sidebar', () => {
    const longSidebarFilename = 'org.jahia.modules.e2e-this-is-a-very-long-sidebar-configuration-filename-that-should-overflow-the-available-space-for-preview-testing.cfg';

    beforeEach(() => {
        cy.login();
        cleanupFiles([longSidebarFilename]);
    });

    afterEach(() => {
        cleanupFiles([longSidebarFilename]);
    });

    it('keeps a long filename accessible in the filtered sidebar list', () => {
        cy.upsertOsgiFile(longSidebarFilename, 'sidebar.preview = true\n');
        cy.openOsgiConfigManager();
        cy.filterOsgiFiles('e2e-this-is-a-very-long-sidebar');

        cy.get(`[data-cy="file-row-${encodeURIComponent(longSidebarFilename)}"]`, {timeout: 30000})
            .should('be.visible')
            .click();

        cy.get(`[data-cy="sidebar-file-status-${encodeURIComponent(longSidebarFilename)}"]`).should('be.visible');
        cy.get('[data-cy="selected-file-name"]', {timeout: 30000})
            .and('contain', longSidebarFilename);
        cy.get('[data-cy="config-state-badge-user"]').should('be.visible');
    });
});
