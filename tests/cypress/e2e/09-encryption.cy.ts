import {cleanupFiles} from './osgiTestUtils';

/**
 * Encryption coverage.
 *
 * The test Jahia container configures NO encryption key (no `...encryption.key` system property /
 * `OSGI_CONFIG_MANAGER_ENCRYPTION_KEY` env var) and does NOT opt into the insecure built-in default
 * key (`...encryption.allowDefaultKey=true`). The module is therefore expected to FAIL CLOSED: it
 * must refuse to write `ENC(...)` ciphertext and must abort the save instead of silently persisting
 * a secret as plaintext. That fail-closed guarantee is the security-critical behavior and is what we
 * assert here.
 *
 * The encrypt/decrypt happy-path round-trip is intentionally NOT covered: producing a valid
 * `ENC(...)` value through the UI requires a configured key, so it cannot run deterministically in
 * the default container. To exercise it, start Jahia with
 * `-Dorg.jahia.modules.osgiconfigmanager.encryption.allowDefaultKey=true` (or a real
 * `...encryption.key`) and add a round-trip spec that encrypts, saves, reloads, and reads back the
 * decrypted-in-memory value.
 */
describe('OSGi Configurations Manager - Encryption (fail-closed)', () => {
    const secretFile = 'org.jahia.modules.e2e-encryption.cfg';

    beforeEach(() => {
        cy.login();
        cleanupFiles([secretFile]);
    });

    afterEach(() => {
        cleanupFiles([secretFile]);
    });

    it('refuses to encrypt and cancels the save when no server key is configured', () => {
        // Arrange: a plaintext value the user flags as a secret in the visual editor.
        cy.upsertOsgiFile(secretFile, 'secret.key = plain-secret\n');
        cy.openOsgiConfigManager();
        cy.openOsgiFile(secretFile);
        cy.ensureVisualCfgMode();

        // Act: toggle the per-row "encrypt" checkbox, then attempt to save.
        cy.get('[data-cy="cfg-encrypted-0"]', {timeout: 30000}).click({force: true});
        cy.get('[data-cy="save-config-button"] button').click();

        // Assert: the save is aborted with the fail-closed toast — no diff modal, no ENC(...) on disk.
        cy.assertToastContains('Could not encrypt one or more values');
        cy.get('[data-cy="diff-modal-confirm"]').should('not.exist');
        cy.readOsgiFile(secretFile)
            .its('data.rawContent')
            .should('contain', 'plain-secret')
            .and('not.contain', 'ENC(');
    });
});
