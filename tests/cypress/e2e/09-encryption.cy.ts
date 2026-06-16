import {cleanupFiles} from './osgiTestUtils';

/**
 * Encryption round-trip coverage.
 *
 * The test Jahia container opts into the built-in default encryption key via
 * `-Dorg.jahia.modules.osgiconfigmanager.encryption.allowDefaultKey=true` (passed as `CATALINA_OPTS`
 * in docker-compose.yml) so encryption is operational and the full UI round-trip can be exercised:
 * mark a value encrypted → save → the value is persisted as `ENC(...)` ciphertext on disk → reopen →
 * it is transparently decrypted in memory and shown as plaintext again.
 *
 * The complementary FAIL-CLOSED behavior (refusing to encrypt when no key is configured and the
 * insecure default has NOT been opted into) is covered at the unit level by
 * `CryptoEngineTest.serviceEncrypt_defaultKeyNotAllowed_failsClosed()`; it cannot coexist with this
 * spec because the JVM-wide `allowDefaultKey` flag is mutually exclusive between the two states.
 */
describe('OSGi Configurations Manager - Encryption round-trip', () => {
    const secretFile = 'org.jahia.modules.e2e-encryption.cfg';
    const plaintext = 'plain-secret-value';

    const readEncryptedValueInput = () =>
        cy.get('[data-cy="cfg-value-0"]', {timeout: 30000}).then($el => {
            const input = $el.is('input') ? $el : $el.find('input');
            return input.val();
        });

    beforeEach(() => {
        cy.login();
        cleanupFiles([secretFile]);
    });

    afterEach(() => {
        cleanupFiles([secretFile]);
    });

    it('encrypts a value on save and decrypts it transparently on reload', () => {
        // Arrange: a plaintext value the user flags as a secret in the visual editor.
        cy.upsertOsgiFile(secretFile, `secret.key = ${plaintext}\n`);
        cy.openOsgiConfigManager();
        cy.openOsgiFile(secretFile);
        cy.ensureVisualCfgMode();

        // Act: toggle the per-row "encrypt" checkbox and save.
        cy.get('[data-cy="cfg-encrypted-0"]', {timeout: 30000}).click({force: true});
        cy.get('[data-cy="save-config-button"] button').click();
        cy.confirmDiffSave();
        cy.assertToastContains('Configuration saved successfully');

        // Assert (at rest): the value is stored as ENC(...) ciphertext, never as plaintext.
        cy.readOsgiFile(secretFile)
            .its('data.rawContent')
            .should('contain', 'secret.key = ENC(')
            .and('not.contain', plaintext);

        // Act: reopen the file from disk so the decrypt-in-memory path runs on load.
        cy.openOsgiConfigManager();
        cy.openOsgiFile(secretFile);
        cy.ensureVisualCfgMode();

        // Assert (on load): the row is still flagged encrypted, and the plaintext is recovered in
        // memory for editing. Recovering the exact plaintext is itself proof that decrypt-on-load
        // succeeded (a failure would leave the ENC(...) ciphertext or an empty value).
        cy.get('[data-cy="cfg-encrypted-0"]', {timeout: 30000}).then($el => {
            const input = $el.is('input') ? $el : $el.find('input');
            expect(input.prop('checked')).to.eq(true);
        });
        readEncryptedValueInput().should('eq', plaintext);
    });
});
