import {cleanupFiles} from './osgiTestUtils';

describe('OSGi Configurations Manager - Config lifecycle', () => {
    const createdFile = 'org.jahia.modules.e2e-create.cfg';
    const toggledFile = 'org.jahia.modules.e2e-toggle.cfg';
    const deletedFile = 'org.jahia.modules.e2e-delete.cfg';
    const uploadedFile = 'osgi-upload.cfg';
    const invalidFile = 'org.jahia.modules.invalid-name.txt';
    const managedFiles = [createdFile, toggledFile, deletedFile, uploadedFile, invalidFile];

    const openEditableCfgFile = (filename: string, rawContent = 'toggle.key = initial\n') => {
        cy.upsertOsgiFile(filename, rawContent);
        cy.openOsgiConfigManager();
        cy.openOsgiFile(filename);
        cy.ensureVisualCfgMode();
    };

    const updateFirstCfgValue = (value: string) => {
        cy.get('[data-cy="cfg-value-0"]').clear();
        cy.get('[data-cy="cfg-value-0"]').type(value);
    };

    beforeEach(() => {
        cy.login();
        cleanupFiles(managedFiles);
    });

    afterEach(() => {
        cleanupFiles(managedFiles);
    });

    it('creates a cfg file from the UI and persists a property', () => {
        cy.openOsgiConfigManager();
        cy.createManualOsgiFile(createdFile);
        cy.ensureVisualCfgMode();

        cy.get('[data-cy="cfg-add-property"] button').click();
        cy.get('[data-cy="modal-prompt-input"]').type('sample.key');
        cy.confirmModal();

        cy.get('[data-cy="cfg-key-0"]', {timeout: 30000}).should('have.value', 'sample.key');
        cy.get('[data-cy="cfg-value-0"]').clear();
        cy.get('[data-cy="cfg-value-0"]').type('sample value');

        cy.get('[data-cy="save-config-button"] button').click();
        cy.confirmDiffSave();
        cy.assertToastContains('Configuration saved successfully');

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
        cy.confirmModal();
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

    it('warns about unsaved changes before disabling a configuration', () => {
        openEditableCfgFile(toggledFile);

        updateFirstCfgValue('updated value');
        cy.get('[data-cy="toggle-file-switch"] button').click();

        cy.get('[data-cy="modal-dialog"]', {timeout: 30000}).should('be.visible');
        cy.contains('You have unsaved changes').should('be.visible');

        cy.confirmModal();
        cy.get('[data-cy="modal-dialog"]', {timeout: 30000}).should('be.visible');
        cy.contains('Disable configuration').should('be.visible');

        cy.cancelModal();
        cy.get('[data-cy="selected-file-name"]', {timeout: 30000}).should('contain', toggledFile);
        cy.get('[data-cy="cfg-value-0"]').should('have.value', 'updated value');
    });

    it('warns about unsaved changes before marking a configuration as default', () => {
        openEditableCfgFile(createdFile, 'default.key = initial\n');

        updateFirstCfgValue('updated value');
        cy.get('[data-cy="mark-as-default-button"] button').click();

        cy.get('[data-cy="modal-dialog"]', {timeout: 30000}).should('be.visible');
        cy.contains('You have unsaved changes').should('be.visible');

        cy.confirmModal();
        cy.get('[data-cy="modal-dialog"]', {timeout: 30000}).should('be.visible');
        cy.contains('Mark as default configuration').should('be.visible');

        cy.cancelModal();
        cy.get('[data-cy="selected-file-name"]', {timeout: 30000}).should('contain', createdFile);
        cy.get('[data-cy="cfg-value-0"]').should('have.value', 'updated value');
    });

    it('deletes a configuration from the UI after confirmation', () => {
        cy.upsertOsgiFile(deletedFile, 'delete.me = true\n');
        cy.openOsgiConfigManager();
        cy.openOsgiFile(deletedFile);

        cy.get('[data-cy="delete-file-button"] button').click();
        cy.confirmModal();

        cy.assertToastContains(`Deleted ${deletedFile}`);
        cy.listOsgiFiles().then(files => {
            expect(files.map(file => file.name)).not.to.include(deletedFile);
        });
    });

    it('keeps a configuration when the delete confirmation is cancelled', () => {
        cy.upsertOsgiFile(deletedFile, 'delete.me = true\n');
        cy.openOsgiConfigManager();
        cy.openOsgiFile(deletedFile);

        cy.get('[data-cy="delete-file-button"] button').click();
        cy.cancelModal();

        cy.get('[data-cy="selected-file-name"]', {timeout: 30000}).should('contain', deletedFile);
        cy.listOsgiFiles().then(files => {
            expect(files.map(file => file.name)).to.include(deletedFile);
        });
    });

    it('uploads a cfg file and persists its content', () => {
        cy.openOsgiConfigManager();

        cy.get('input[type="file"][accept=".yml,.cfg"]').selectFile('cypress/fixtures/osgi-upload.cfg', {force: true});

        cy.assertToastContains(`Uploaded ${uploadedFile}`);
        cy.get('[data-cy="selected-file-name"]', {timeout: 30000}).should('contain', uploadedFile);
        cy.readOsgiFile(uploadedFile)
            .its('data.rawContent')
            .should('contain', 'upload.key = uploaded value');
    });

    it('warns about unsaved changes before uploading a file', () => {
        openEditableCfgFile(createdFile, 'upload.guard = initial\n');

        updateFirstCfgValue('updated value');
        cy.get('[data-cy="upload-file-button"] button').click();

        cy.get('[data-cy="modal-dialog"]', {timeout: 30000}).should('be.visible');
        cy.contains('You have unsaved changes').should('be.visible');

        cy.confirmModal();
        cy.get('[data-cy="upload-file-input"]', {timeout: 30000}).selectFile('cypress/fixtures/osgi-upload.cfg', {force: true});

        cy.assertToastContains(`Uploaded ${uploadedFile}`);
        cy.get('[data-cy="selected-file-name"]', {timeout: 30000}).should('contain', uploadedFile);
    });

    it('warns about unsaved changes before refreshing the file list', () => {
        openEditableCfgFile(createdFile, 'refresh.guard = initial\n');

        updateFirstCfgValue('updated value');
        cy.get('[data-cy="refresh-files-button"] button').click();

        cy.get('[data-cy="modal-dialog"]', {timeout: 30000}).should('be.visible');
        cy.contains('You have unsaved changes').should('be.visible');

        cy.confirmModal();
        cy.get('[data-cy="selected-file-name"]', {timeout: 30000}).should('contain', createdFile);
        cy.get('[data-cy="cfg-value-0"]', {timeout: 30000}).should('have.value', 'initial');
    });

    it('warns about unsaved changes before opening the create dialog', () => {
        openEditableCfgFile(createdFile, 'create.guard = initial\n');

        updateFirstCfgValue('updated value');
        cy.get('[data-cy="create-file-button"] button').click();

        cy.get('[data-cy="modal-dialog"]', {timeout: 30000}).should('be.visible');
        cy.contains('You have unsaved changes').should('be.visible');

        cy.confirmModal();
        cy.get('[data-cy="modal-dialog"]', {timeout: 30000}).should('be.visible');
        cy.get('[data-cy="modal-create-manual-input"]').should('be.visible');

        cy.cancelModal();
        cy.get('[data-cy="selected-file-name"]', {timeout: 30000}).should('contain', createdFile);
    });

    it('rejects an invalid filename extension during creation', () => {
        cy.openOsgiConfigManager();
        cy.openCreateConfigDialog();
        cy.get('[data-cy="modal-create-manual-input"]').type(invalidFile);
        cy.confirmModal();

        cy.listOsgiFiles().then(files => {
            expect(files.map(file => file.name)).not.to.include(invalidFile);
        });
        cy.get('[data-cy="selected-file-name"]').should('not.exist');
    });
});
