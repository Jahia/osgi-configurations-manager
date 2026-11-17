import {
    cleanupFiles,
    ManagerConfiguration,
    readManagerConfiguration,
    restoreManagerConfiguration,
    setVisualFormattingControls
} from './osgiTestUtils';

describe('OSGi Configurations Manager - CFG visual editor', () => {
    const visualEditorFile = 'org.jahia.modules.e2e-visual-editor.cfg';
    // The formatting controls follow a server option: each test sets it, and the manager's own
    // configuration is put back as found, so the result does not depend on the instance.
    let managerConfiguration: ManagerConfiguration | undefined;

    before(() => {
        cy.login();
        readManagerConfiguration().then(found => {
            managerConfiguration = found;
        });
    });

    after(() => {
        cy.login();
        restoreManagerConfiguration(managerConfiguration);
    });

    beforeEach(() => {
        cy.login();
        cleanupFiles([visualEditorFile]);
    });

    afterEach(() => {
        cleanupFiles([visualEditorFile]);
    });

    it('shows the visual editor footer actions and the main property/value headers', () => {
        setVisualFormattingControls(false);
        cy.upsertOsgiFile(visualEditorFile, 'alpha.key = alpha value\n');
        cy.openOsgiConfigManager();
        cy.openOsgiFile(visualEditorFile);
        cy.ensureVisualCfgMode();

        cy.get('[data-cy="cfg-editor-footer"]').should('be.visible');
        cy.get('[data-cy="cfg-add-property"] button').should('be.visible');
        cy.get('[data-cy="cfg-header-property"]').should('contain', 'Property');
        cy.get('[data-cy="cfg-header-value"]').should('contain', 'Value');
        cy.get('[data-cy="cfg-key-0"]').should('have.value', 'alpha.key');
        cy.get('[data-cy="cfg-value-0"]').should('have.value', 'alpha value');
        cy.get('[data-cy="cfg-add-comment"]').should('not.exist');
        cy.get('[data-cy="cfg-add-empty-line"]').should('not.exist');
        cy.get('[data-cy="cfg-toggle-comments"]').should('not.exist');
        cy.get('[data-cy="cfg-toggle-empty-lines"]').should('not.exist');
    });

    it('shows the formatting controls when the option is on', () => {
        setVisualFormattingControls(true);
        cy.upsertOsgiFile(visualEditorFile, 'alpha.key = alpha value\n');
        cy.openOsgiConfigManager();
        cy.openOsgiFile(visualEditorFile);
        cy.ensureVisualCfgMode();

        cy.get('[data-cy="cfg-add-comment"]').should('exist');
        cy.get('[data-cy="cfg-add-empty-line"]').should('exist');
        cy.get('[data-cy="cfg-toggle-comments"]').should('exist');
        cy.get('[data-cy="cfg-toggle-empty-lines"]').should('exist');
    });
});
