import {cleanupFiles} from './osgiTestUtils';

describe('OSGi Configurations Manager - Editor mode behavior', () => {
    const reserializeFile = 'org.jahia.modules.e2e-reserialize.cfg';
    const preferenceFile = 'org.jahia.modules.e2e-mode-pref.cfg';

    beforeEach(() => {
        cy.login();
        cleanupFiles([reserializeFile, preferenceFile]);
    });

    afterEach(() => {
        cleanupFiles([reserializeFile, preferenceFile]);
    });

    it('warns when switching to raw mode reformats the file', () => {
        // Arrange: tight `key=value` spacing that the visual model re-serializes as `key = value`,
        // so toggling a clean file to raw mode is a non-equivalent reformat.
        cy.upsertOsgiFile(reserializeFile, 'reserialize.key=value\n');
        cy.openOsgiConfigManager();
        cy.openOsgiFile(reserializeFile);
        cy.ensureVisualCfgMode();

        // Act: switch the clean file to raw mode.
        cy.ensureRawCfgMode();

        // Assert: the reformatting warning is surfaced.
        cy.assertToastContains('Switching editor mode reformatted comments, ordering or spacing');
    });

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
