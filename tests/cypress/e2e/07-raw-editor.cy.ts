import {cleanupFiles, findAvailableMetatype, readOsgiFileBody} from './osgiTestUtils';

describe('OSGi Configurations Manager - Raw editor', () => {
    const rawCfgFile = 'org.jahia.modules.e2e-raw-editor.cfg';
    let createdMetatypeCfgFilename: string | null = null;

    beforeEach(() => {
        cy.login();
        createdMetatypeCfgFilename = null;
    });

    afterEach(() => {
        cleanupFiles([rawCfgFile, createdMetatypeCfgFilename]);
    });

    it('saves a raw CFG change and can switch back to visual mode', () => {
        cy.upsertOsgiFile(rawCfgFile, '');
        cy.openOsgiConfigManager();
        cy.openOsgiFile(rawCfgFile);
        cy.ensureRawCfgMode();

        cy.get('[data-cy="raw-editor-toolbar"]').should('be.visible');
        cy.get('.monaco-editor textarea', {timeout: 30000}).click({force: true});
        cy.get('.monaco-editor textarea', {timeout: 30000}).type('alpha.key = alpha value', {force: true});

        cy.get('[data-cy="save-config-button"] button').click();
        cy.confirmDiffSave();
        cy.assertToastContains('Configuration saved successfully');

        readOsgiFileBody(rawCfgFile).then(body => {
            expect(body.error, `read error for ${rawCfgFile}`).to.not.exist;
            expect(body.data?.rawContent, `raw content for ${rawCfgFile}`).to.contain('alpha.key = alpha value');
        });

        cy.ensureVisualCfgMode();
        cy.get('[data-cy="cfg-editor-footer"]').should('be.visible');
    });

    it('offers Metatype assistance in raw CFG mode and persists the inserted property', () => {
        findAvailableMetatype(
            definition => !definition.factory && !definition.created && Array.isArray(definition.properties) && definition.properties.length > 0,
            'an available simple Metatype definition with properties for raw CFG assistance'
        ).then(definition => {
            createdMetatypeCfgFilename = definition.filename;

            cy.upsertOsgiFile(createdMetatypeCfgFilename, '');
            cy.openOsgiConfigManager();
            cy.openOsgiFile(createdMetatypeCfgFilename);
            cy.ensureRawCfgMode();

            cy.get('[data-cy="editor-add-metatype-property"]', {timeout: 30000}).should('not.be.disabled').click();
            cy.get('[data-cy="metatype-property-panel"]', {timeout: 30000}).should('be.visible');
            cy.get(`[data-cy="metatype-property-card-${encodeURIComponent(definition.properties[0].id)}"]`, {timeout: 30000}).should('be.visible');
            cy.get(`[data-cy="metatype-property-insert-${encodeURIComponent(definition.properties[0].id)}"]`).click();
            cy.get('[data-cy="save-config-button"] button').click();
            cy.confirmDiffSave();
            cy.assertToastContains('Configuration saved successfully');

            readOsgiFileBody(createdMetatypeCfgFilename).then(body => {
                expect(body.error, `read error for ${createdMetatypeCfgFilename}`).to.not.exist;
                expect(body.data?.rawContent, `raw content for ${createdMetatypeCfgFilename}`).to.contain(definition.properties[0].id);
            });
        });
    });
});
