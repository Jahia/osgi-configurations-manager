import {cleanupFiles, findAvailableMetatype} from './osgiTestUtils';

describe('OSGi Configurations Manager - Create configuration', () => {
    let createdFromMetatypeFilename: string | null = null;
    let createdFactoryFilename: string | null = null;
    const factoryInstanceIdentifier = 'e2e-factory';

    beforeEach(() => {
        cy.login();
        createdFromMetatypeFilename = null;
        createdFactoryFilename = null;
    });

    afterEach(() => {
        cleanupFiles([createdFromMetatypeFilename, createdFactoryFilename]);
    });

    it('creates a configuration from an available Metatype PID', () => {
        findAvailableMetatype(
            definition => !definition.factory && !definition.created,
            'an available simple Metatype definition'
        ).then(definition => {
            createdFromMetatypeFilename = definition.filename;

            cy.openOsgiConfigManager();
            cy.openCreateConfigDialog();
            cy.get('[data-cy="modal-create-tab-configuration"]').click();
            cy.get('[data-cy="modal-create-filter-input"]').type(definition.pid);
            cy.get(`[data-cy="modal-create-metatype-option-${encodeURIComponent(definition.pid)}"]`, {timeout: 30000}).click();
            cy.confirmModal();

            cy.get('[data-cy="selected-file-name"]', {timeout: 30000}).should('contain', definition.filename);
            cy.readOsgiFile(definition.filename)
                .its('data.rawContent')
                .should('contain', `# PID: ${definition.pid}`)
                .and('match', /# .+=/);
        });
    });

    it('creates a factory configuration instance from Metatype', () => {
        findAvailableMetatype(
            definition => Boolean(definition.factory),
            'an available factory Metatype definition'
        ).then(definition => {
            createdFactoryFilename = `${definition.pid}-${factoryInstanceIdentifier}.cfg`;

            cy.openOsgiConfigManager();
            cy.openCreateConfigDialog();
            cy.get('[data-cy="modal-create-tab-factory"]').click();
            cy.get('[data-cy="modal-create-filter-input"]').type(definition.pid);
            cy.get(`[data-cy="modal-create-factory-option-${encodeURIComponent(definition.pid)}"]`, {timeout: 30000}).click();
            cy.get('[data-cy="modal-create-factory-identifier-input"]').type(factoryInstanceIdentifier);
            cy.confirmModal();

            cy.get('[data-cy="selected-file-name"]', {timeout: 30000}).should('contain', createdFactoryFilename);
            cy.readOsgiFile(createdFactoryFilename)
                .its('data.rawContent')
                .should('contain', `# PID: ${definition.pid}`)
                .and('contain', `# Instance: ${factoryInstanceIdentifier}`);
        });
    });
});
