import {cleanupFiles, findAvailableMetatype} from './osgiTestUtils';

/**
 * Property-level operations in the visual CFG editor.
 *
 * Salvaged from the full-review branch (#17). Its third case there exercised a keyboard reorder
 * handle (`cfg-reorder-*`) that does not exist in this codebase, so it is deliberately not carried
 * over — it would test a feature that is not implemented rather than guard existing behaviour.
 */
describe('OSGi Configurations Manager - CFG property operations', () => {
    const propsFile = 'org.jahia.modules.e2e-cfg-props.cfg';
    let metatypeBackedFile: string | null = null;

    beforeEach(() => {
        cy.login();
        metatypeBackedFile = null;
        cleanupFiles([propsFile]);
    });

    afterEach(() => {
        cleanupFiles([propsFile, metatypeBackedFile]);
    });

    it('deletes a property row after confirmation and persists the removal', () => {
        // Arrange: two properties so we can verify the right one is removed.
        cy.upsertOsgiFile(propsFile, 'del.one = first\ndel.two = second\n');
        cy.openOsgiConfigManager();
        cy.openOsgiFile(propsFile);
        cy.ensureVisualCfgMode();
        cy.get('[data-cy="cfg-key-0"]', {timeout: 30000}).should('have.value', 'del.one');

        // Act: delete the first row and confirm the prompt.
        cy.get('[data-cy="cfg-delete-0"]').click({force: true});
        cy.get('[data-cy="modal-dialog"]', {timeout: 30000}).should('be.visible');
        cy.contains('Delete Property').should('be.visible');
        cy.confirmModal();

        // Assert (UI): the surviving property shifts up into row 0.
        cy.get('[data-cy="cfg-key-0"]', {timeout: 30000}).should('have.value', 'del.two');

        // Assert (persistence): saving drops the deleted key from disk.
        cy.get('[data-cy="save-config-button"] button').click();
        cy.assertToastContains('Configuration saved successfully');
        cy.readOsgiFile(propsFile)
            .its('data.rawContent')
            .should('contain', 'del.two = second')
            .and('not.contain', 'del.one');
    });

    it('inserts a Metatype property via the visual picker and shows its info affordance', () => {
        findAvailableMetatype(
            definition => !definition.factory && !definition.created &&
                Array.isArray(definition.properties) && definition.properties.length > 0,
            'an available simple Metatype definition with properties'
        ).then(definition => {
            metatypeBackedFile = definition.filename;
            const propertyId = definition.properties[0].id;

            // Arrange: an empty file whose name resolves to a PID with Metatype metadata.
            cy.upsertOsgiFile(metatypeBackedFile, '');
            cy.openOsgiConfigManager();
            cy.openOsgiFile(metatypeBackedFile);
            cy.ensureVisualCfgMode();

            // Act: "Add Property" opens the Metatype-aware picker (not the plain prompt) because the
            // PID exposes declared properties.
            cy.get('[data-cy="cfg-add-property"] button').click();
            cy.get('[data-cy="cfg-metatype-property-dialog"]', {timeout: 30000}).should('be.visible');
            cy.get('[data-cy="cfg-metatype-property-search"]').type(propertyId);
            cy.get(`[data-cy="cfg-metatype-property-option-${encodeURIComponent(propertyId)}"]`, {timeout: 30000}).click();

            // Assert: the property is inserted and the Metatype info indicator appears for the known key.
            cy.get('[data-cy="cfg-key-0"]', {timeout: 30000}).should('have.value', propertyId);
            cy.get('[data-cy="cfg-metatype-info-0"]').should('be.visible');
        });
    });
});
