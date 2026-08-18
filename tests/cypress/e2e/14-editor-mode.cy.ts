import {cleanupFiles} from './osgiTestUtils';

describe('OSGi Configurations Manager - Editor mode behavior', () => {
    const preferenceFile = 'org.jahia.modules.e2e-mode-pref.cfg';

    beforeEach(() => {
        cy.login();
        cleanupFiles([preferenceFile]);
    });

    afterEach(() => {
        cleanupFiles([preferenceFile]);
    });

    // The full-review branch (#17) also had a case asserting a toast when switching a clean file
    // to raw mode reformats it. That warning does not exist in this codebase — "reformat" appears
    // nowhere in the sources or the locale bundles, only on #17 — so the case was dropped rather
    // than left asserting an unimplemented feature.

    it('persists the chosen editor mode across a page reload', () => {
        // Arrange
        cy.upsertOsgiFile(preferenceFile, 'pref.key = value\n');
        cy.openOsgiConfigManager();
        cy.openOsgiFile(preferenceFile);

        // Act: select raw mode (persisted server-side as a user preference), then reload.
        cy.ensureRawCfgMode();
        cy.reload();
        cy.get('[data-cy="osgi-config-manager"]', {timeout: 60000}).should('be.visible');
        cy.openOsgiFile(preferenceFile);

        // Assert: raw mode is restored without re-selecting it.
        cy.get('[data-cy="editor-mode-toggle"]', {timeout: 30000})
            .should('have.attr', 'data-mode', 'raw');

        // Cleanup: restore the visual default so later specs start from a known mode.
        cy.ensureVisualCfgMode();
    });
});
