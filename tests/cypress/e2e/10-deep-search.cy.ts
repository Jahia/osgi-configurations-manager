import {cleanupFiles} from './osgiTestUtils';

describe('OSGi Configurations Manager - Deep content search', () => {
    // The marker lives in the file CONTENT only; it never appears in the filename, so a plain
    // filename filter must miss it and only the content (deep) search can surface it.
    const contentSearchFile = 'org.jahia.modules.e2e-deepsearch.cfg';
    const contentMarker = 'zzqqxx-content-marker';

    beforeEach(() => {
        cy.login();
        cleanupFiles([contentSearchFile]);
    });

    afterEach(() => {
        cleanupFiles([contentSearchFile]);
    });

    it('finds a file by its content only after enabling the deep-search toggle', () => {
        // Arrange
        cy.upsertOsgiFile(contentSearchFile, `unique.deep.token = ${contentMarker}\n`);
        cy.openOsgiConfigManager();

        const fileRow = `[data-cy="file-row-${encodeURIComponent(contentSearchFile)}"]`;

        // Assert (filename search): the marker is not part of the filename, so nothing matches.
        cy.filterOsgiFiles(contentMarker);
        cy.get(fileRow).should('not.exist');

        // Act: enable content search, then search the same marker again.
        cy.get('[data-cy="file-search-input"] input').clear();
        cy.get('[data-cy="deep-search-toggle-control"]')
            .find('input, button, [role="switch"]')
            .first()
            .click({force: true});
        cy.filterOsgiFiles(contentMarker);

        // Assert (content search): the file is now found by what is inside it.
        cy.get(fileRow, {timeout: 30000}).should('be.visible');
    });
});
