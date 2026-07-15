import {cleanupFiles} from './osgiTestUtils';

/**
 * G30 — fills the Cypress gaps Stage 4 downgraded from S45/S46/S49:
 *  - F5  Deep Search returns a CONTENT match (unique token present only in the body).
 *  - F23 MODULE and MODULE_DEFAULT state badges actually render for appropriately-headered files.
 *  - F25 a clean Refresh reloads the listing (not merely the dirty-guard path).
 */
describe('OSGi Configurations Manager - Deep search, state badges & refresh', () => {
    const token = 'zzuniquebodytoken1234';
    const contentFile = 'org.jahia.modules.e2e-deep-search-body.cfg';
    const otherFile = 'org.jahia.modules.e2e-deep-search-other.cfg';
    const moduleFile = 'org.jahia.modules.e2e-state-module.cfg';
    const moduleDefaultFile = 'org.jahia.modules.e2e-state-module-default.cfg';
    const refreshFile = 'org.jahia.modules.e2e-refresh-target.cfg';
    const all = [contentFile, otherFile, moduleFile, moduleDefaultFile, refreshFile];

    beforeEach(() => {
        cy.login();
        cleanupFiles(all);
    });

    afterEach(() => {
        cleanupFiles(all);
    });

    it('F5: deep search matches on file CONTENT, not just the name', () => {
        cy.upsertOsgiFile(contentFile, `some.key = ${token}\n`);
        cy.upsertOsgiFile(otherFile, 'some.key = unrelated\n');
        cy.openOsgiConfigManager();

        cy.get('[data-cy="deep-search-toggle-control"]').click();
        cy.get('[data-cy="file-search-input"] input').clear().type(token);

        cy.get(`[data-cy="file-row-${encodeURIComponent(contentFile)}"]`, {timeout: 30000})
            .should('be.visible');
        cy.get(`[data-cy="file-row-${encodeURIComponent(otherFile)}"]`).should('not.exist');
    });

    it('F23: MODULE and MODULE_DEFAULT badges render for headered files', () => {
        cy.upsertOsgiFile(moduleFile, '# DO NOT EDIT\nkey = value\n');
        cy.upsertOsgiFile(moduleDefaultFile, '# default configuration, can be edited\nkey = value\n');
        cy.openOsgiConfigManager();

        cy.openOsgiFile(moduleFile);
        cy.get('[data-cy="config-state-badge-module"]', {timeout: 30000}).should('be.visible');

        cy.openOsgiFile(moduleDefaultFile);
        cy.get('[data-cy="config-state-badge-module_default"]', {timeout: 30000}).should('be.visible');
    });

    it('F25: a clean Refresh reloads the file listing', () => {
        cy.openOsgiConfigManager();
        // create a new file AFTER the initial load, via the API
        cy.upsertOsgiFile(refreshFile, 'refresh.me = true\n');

        cy.get('[data-cy="refresh-files-button"]').click();
        cy.filterOsgiFiles('e2e-refresh-target');
        cy.get(`[data-cy="file-row-${encodeURIComponent(refreshFile)}"]`, {timeout: 30000})
            .should('be.visible');
    });
});
