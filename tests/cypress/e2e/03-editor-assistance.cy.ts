import {cleanupFiles, findAvailableMetatype, readOsgiFileBody} from './osgiTestUtils';

describe('OSGi Configurations Manager - Editor assistance', () => {
    const yamlFactoryInstanceIdentifier = 'e2e-yaml';
    let createdYamlFilename: string | null = null;

    beforeEach(() => {
        cy.login();
        createdYamlFilename = null;
    });

    afterEach(() => {
        cleanupFiles([createdYamlFilename]);
    });

    it('enables Metatype assistance in the raw YAML editor when the filename resolves to a PID', () => {
        findAvailableMetatype(
            definition => Boolean(definition.factory),
            'an available factory Metatype definition for YAML assistance'
        ).then(definition => {
            createdYamlFilename = `${definition.pid}-${yamlFactoryInstanceIdentifier}.yml`;

            cy.upsertOsgiFile(createdYamlFilename, '');
            cy.openOsgiConfigManager();
            cy.openOsgiFile(createdYamlFilename);

            cy.get('[data-cy="editor-add-metatype-property"]', {timeout: 30000}).should('not.be.disabled').click();
            cy.get('[data-cy="metatype-property-panel"]', {timeout: 30000}).should('be.visible');
            cy.get(`[data-cy="metatype-property-card-${encodeURIComponent(definition.properties[0].id)}"]`, {timeout: 30000}).should('be.visible');
            cy.get(`[data-cy="metatype-property-insert-${encodeURIComponent(definition.properties[0].id)}"]`).click();
            cy.get('[data-cy="save-config-button"] button').click();
            cy.assertToastContains('Configuration saved successfully');
            readOsgiFileBody(createdYamlFilename).then(body => {
                expect(body.error, `read error for ${createdYamlFilename}`).to.not.exist;
                expect(body.data?.rawContent, `raw content for ${createdYamlFilename}`).to.contain(definition.properties[0].id);
            });
        });
    });
});
