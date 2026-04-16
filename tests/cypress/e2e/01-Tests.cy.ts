describe('OSGi Configurations Manager', () => {
    const createdFile = 'org.jahia.modules.e2e-create.cfg';
    const toggledFile = 'org.jahia.modules.e2e-toggle.cfg';
    const deletedFile = 'org.jahia.modules.e2e-delete.cfg';
    const uploadedFile = 'osgi-upload.cfg';
    const invalidFile = 'org.jahia.modules.invalid-name.txt';
    const factoryInstanceIdentifier = 'e2e-factory';
    const yamlFactoryInstanceIdentifier = 'e2e-yaml';
    const testFiles = [createdFile, toggledFile, deletedFile, uploadedFile, invalidFile];
    let createdFromMetatypeFilename: string | null = null;
    let createdFactoryFilename: string | null = null;
    let createdYamlFilename: string | null = null;

    const getAvailableMetatypes = () => cy.osgiRequest({
        method: 'GET',
        url: '/cms/render/default/en/sites/systemsite.osgiConfigManager.do?action=availableMetatypes'
    }).its('body.metatypes');

    beforeEach(() => {
        cy.login();
        createdFromMetatypeFilename = null;
        createdFactoryFilename = null;
        createdYamlFilename = null;
        testFiles.forEach(filename => cy.cleanupOsgiFile(filename));
    });

    afterEach(() => {
        testFiles.forEach(filename => cy.cleanupOsgiFile(filename));
        if (createdFromMetatypeFilename) {
            cy.cleanupOsgiFile(createdFromMetatypeFilename);
        }
        if (createdFactoryFilename) {
            cy.cleanupOsgiFile(createdFactoryFilename);
        }
        if (createdYamlFilename) {
            cy.cleanupOsgiFile(createdYamlFilename);
        }
    });

    it('loads the administration application and its sidebar', () => {
        cy.openOsgiConfigManager();

        cy.get('[data-cy="file-search-input"] input').should('be.visible');
        cy.get('[data-cy^="file-row-"]')
            .its('length')
            .should('be.greaterThan', 0);
    });

    it('creates a cfg file from the UI and persists a property', () => {
        cy.openOsgiConfigManager();

        cy.get('[data-cy="create-file-button"] button').click();
        cy.get('[data-cy="modal-create-manual-input"]').type(createdFile);
        cy.get('[data-cy="modal-confirm-button"] button').click();

        cy.get('[data-cy="selected-file-name"]', {timeout: 30000}).should('contain', createdFile);
        cy.ensureVisualCfgMode();

        cy.get('[data-cy="cfg-add-property"] button').click();
        cy.get('[data-cy="modal-prompt-input"]').type('sample.key');
        cy.get('[data-cy="modal-confirm-button"] button').click();

        cy.get('[data-cy="cfg-key-0"]', {timeout: 30000}).should('have.value', 'sample.key');
        cy.get('[data-cy="cfg-value-0"]').clear();
        cy.get('[data-cy="cfg-value-0"]').type('sample value');

        cy.get('[data-cy="save-config-button"] button').click();
        cy.get('[data-cy="toast-message"]', {timeout: 30000}).should('contain', 'Configuration saved successfully');

        cy.readOsgiFile(createdFile)
            .its('data.rawContent')
            .should('contain', 'sample.key = sample value');
    });

    it('toggles a configuration between enabled and disabled states', () => {
        cy.upsertOsgiFile(toggledFile, 'toggle.key = initial\n');
        cy.openOsgiConfigManager();
        cy.openOsgiFile(toggledFile);

        cy.get('[data-cy="toggle-file-switch"]')
            .find('button, input, [role="switch"]')
            .first()
            .click({force: true});
        cy.get('[data-cy="modal-dialog"]', {timeout: 30000}).should('be.visible');
        cy.get('[data-cy="modal-confirm-button"] button').click();
        cy.get('[data-cy="selected-file-name"]', {timeout: 30000}).should('contain', `${toggledFile}.disabled`);
        cy.readOsgiFile(`${toggledFile}.disabled`)
            .its('data.rawContent')
            .should('contain', 'toggle.key = initial');

        cy.get('[data-cy="toggle-file-switch"]')
            .find('button, input, [role="switch"]')
            .first()
            .click({force: true});
        cy.get('[data-cy="modal-dialog"]').should('not.exist');
        cy.get('[data-cy="selected-file-name"]', {timeout: 30000}).should('contain', toggledFile);
        cy.readOsgiFile(toggledFile)
            .its('data.rawContent')
            .should('contain', 'toggle.key = initial');
    });

    it('deletes a configuration from the UI after confirmation', () => {
        cy.upsertOsgiFile(deletedFile, 'delete.me = true\n');
        cy.openOsgiConfigManager();
        cy.openOsgiFile(deletedFile);

        cy.get('[data-cy="delete-file-button"] button').click();
        cy.get('[data-cy="modal-confirm-button"] button').click();

        cy.get('[data-cy="toast-message"]', {timeout: 30000}).should('contain', `Deleted ${deletedFile}`);
        cy.listOsgiFiles().then(files => {
            expect(files.map(file => file.name)).not.to.include(deletedFile);
        });
    });

    it('uploads a cfg file and persists its content', () => {
        cy.openOsgiConfigManager();

        cy.get('input[type="file"][accept=".yml,.cfg"]').selectFile('cypress/fixtures/osgi-upload.cfg', {force: true});

        cy.get('[data-cy="toast-message"]', {timeout: 30000}).should('contain', `Uploaded ${uploadedFile}`);
        cy.get('[data-cy="selected-file-name"]', {timeout: 30000}).should('contain', uploadedFile);
        cy.readOsgiFile(uploadedFile)
            .its('data.rawContent')
            .should('contain', 'upload.key = uploaded value');
    });

    it('rejects an invalid filename extension during creation', () => {
        cy.openOsgiConfigManager();

        cy.get('[data-cy="create-file-button"] button').click();
        cy.get('[data-cy="modal-create-manual-input"]').type(invalidFile);
        cy.get('[data-cy="modal-confirm-button"] button').click();

        cy.listOsgiFiles().then(files => {
            expect(files.map(file => file.name)).not.to.include(invalidFile);
        });
        cy.get('[data-cy="selected-file-name"]').should('not.exist');
    });

    it('creates a configuration from an available Metatype PID', () => {
        getAvailableMetatypes().then((definitions: any[]) => {
            const definition = definitions.find(item => !item.factory && !item.created);
            expect(definition, 'an available simple Metatype definition').to.exist;
            createdFromMetatypeFilename = definition.filename;

            cy.openOsgiConfigManager();
            cy.get('[data-cy="create-file-button"] button').click();
            cy.get('[data-cy="modal-create-tab-configuration"]').click();
            cy.get('[data-cy="modal-create-filter-input"]').type(definition.pid);
            cy.get(`[data-cy="modal-create-metatype-option-${encodeURIComponent(definition.pid)}"]`, {timeout: 30000}).click();
            cy.get('[data-cy="modal-confirm-button"] button').click();

            cy.get('[data-cy="selected-file-name"]', {timeout: 30000}).should('contain', definition.filename);
            cy.readOsgiFile(definition.filename)
                .its('data.rawContent')
                .should('contain', `# PID: ${definition.pid}`)
                .and('match', /# .+=/);
        });
    });

    it('creates a factory configuration instance from Metatype', () => {
        getAvailableMetatypes().then((definitions: any[]) => {
            const definition = definitions.find(item => item.factory);
            expect(definition, 'an available factory Metatype definition').to.exist;
            createdFactoryFilename = `${definition.pid}-${factoryInstanceIdentifier}.cfg`;

            cy.openOsgiConfigManager();
            cy.get('[data-cy="create-file-button"] button').click();
            cy.get('[data-cy="modal-create-tab-factory"]').click();
            cy.get('[data-cy="modal-create-filter-input"]').type(definition.pid);
            cy.get(`[data-cy="modal-create-factory-option-${encodeURIComponent(definition.pid)}"]`, {timeout: 30000}).click();
            cy.get('[data-cy="modal-create-factory-identifier-input"]').type(factoryInstanceIdentifier);
            cy.get('[data-cy="modal-confirm-button"] button').click();

            cy.get('[data-cy="selected-file-name"]', {timeout: 30000}).should('contain', createdFactoryFilename);
            cy.readOsgiFile(createdFactoryFilename)
                .its('data.rawContent')
                .should('contain', `# PID: ${definition.pid}`)
                .and('contain', `# Instance: ${factoryInstanceIdentifier}`);
        });
    });

    it('enables Metatype assistance in the raw YAML editor when the filename resolves to a PID', () => {
        getAvailableMetatypes().then((definitions: any[]) => {
            const definition = definitions.find(item => item.factory);
            expect(definition, 'an available factory Metatype definition for YAML assistance').to.exist;
            createdYamlFilename = `${definition.pid}-${yamlFactoryInstanceIdentifier}.yml`;

            cy.upsertOsgiFile(createdYamlFilename, '');
            cy.openOsgiConfigManager();
            cy.openOsgiFile(createdYamlFilename);

            cy.get('[data-cy="editor-add-metatype-property"]', {timeout: 30000}).should('not.be.disabled').click();
            cy.get('[data-cy="metatype-property-panel"]', {timeout: 30000}).should('be.visible');
            cy.get(`[data-cy="metatype-property-card-${encodeURIComponent(definition.properties[0].id)}"]`, {timeout: 30000}).should('be.visible');
            cy.get(`[data-cy="metatype-property-insert-${encodeURIComponent(definition.properties[0].id)}"]`).click();
            cy.get('[data-cy="save-config-button"] button').click();
            cy.get('[data-cy="toast-message"]', {timeout: 30000}).should('contain', 'Configuration saved successfully');
            cy.readOsgiFile(createdYamlFilename).then((body: any) => {
                expect(body.error, `read error for ${createdYamlFilename}`).to.not.exist;
                expect(body.data?.rawContent, `raw content for ${createdYamlFilename}`).to.contain(definition.properties[0].id);
            });
        });
    });
});
