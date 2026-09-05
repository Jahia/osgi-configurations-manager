import {cleanupFiles, findAvailableMetatype} from './osgiTestUtils';

/**
 * Property-level operations in the visual CFG editor.
 *
 * Salvaged from the full-review branch (#17). The keyboard-reorder case was held back until the
 * handle actually existed here; it now does, so it is covered again.
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
        cy.confirmDiffSave();
        cy.assertToastContains('Configuration saved successfully');
        cy.readOsgiFile(propsFile)
            .its('data.rawContent')
            .should('contain', 'del.two = second')
            .and('not.contain', 'del.one');
    });

    it('keeps a multiline value attached to its property instead of commenting the tail', () => {
        // Regression: the visual editor deliberately allows newlines in a value (preventNewlines is
        // set on the key field only), but toCfgFormat wrote them out raw. The continued line then
        // had no "=" separator, so it came back as a comment — and the next save prefixed it with
        // "# ", silently losing the tail of the value. A .cfg needs a trailing "\\" to continue.
        cy.upsertOsgiFile(propsFile, 'multi.key = first\n');
        cy.openOsgiConfigManager();
        cy.openOsgiFile(propsFile);
        cy.ensureVisualCfgMode();
        cy.get('[data-cy="cfg-value-0"]', {timeout: 30000}).should('have.value', 'first');

        // Act: add a second line to the value, exactly as a user would.
        cy.get('[data-cy="cfg-value-0"]').clear();
        cy.get('[data-cy="cfg-value-0"]').type('first{enter}second');

        cy.get('[data-cy="save-config-button"] button').click();
        cy.confirmDiffSave();
        cy.assertToastContains('Configuration saved successfully');

        // Assert (persistence): the marker is on disk, the tail was not commented out, and the
        // continued line is lined up under the start of the value.
        cy.readOsgiFile(propsFile).its('data.rawContent').then((raw: string) => {
            const indent = ' '.repeat('multi.key = '.length);

            expect(raw, 'the continued line must carry the trailing backslash')
                .to.contain('multi.key = first \\');
            expect(raw, 'the tail must still be there').to.contain('second');
            expect(raw, 'the tail must NOT have become a comment').not.to.contain('# second');
            expect(raw, 'the continued line must be aligned under the value')
                .to.contain(`\n${indent}second`);
        });

        // Assert (reload): it comes back as one property, not a property followed by a comment.
        cy.openOsgiConfigManager();
        cy.openOsgiFile(propsFile);
        cy.ensureVisualCfgMode();
        cy.get('[data-cy="cfg-key-0"]', {timeout: 30000}).should('have.value', 'multi.key');
        cy.get('[data-cy="cfg-key-1"]').should('not.exist');
    });

    it('reorders property rows with the keyboard handle', () => {
        // Arrange
        cy.upsertOsgiFile(propsFile, 're.one = first\nre.two = second\n');
        cy.openOsgiConfigManager();
        cy.openOsgiFile(propsFile);
        cy.ensureVisualCfgMode();
        cy.get('[data-cy="cfg-key-0"]', {timeout: 30000}).should('have.value', 're.one');

        // Act: move the second row up via its reorder handle (Arrow Up).
        cy.get('[data-cy="cfg-reorder-1"]').focus();
        cy.get('[data-cy="cfg-reorder-1"]').trigger('keydown', {key: 'ArrowUp'});

        // Assert: the two rows swapped.
        cy.get('[data-cy="cfg-key-0"]', {timeout: 30000}).should('have.value', 're.two');
        cy.get('[data-cy="cfg-key-1"]').should('have.value', 're.one');
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
