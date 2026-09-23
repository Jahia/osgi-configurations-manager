import {cleanupFiles} from './osgiTestUtils';

/**
 * S51 (G28) — encryption round-trip through the REAL backend (F20/D4). Validates the
 * client<->encrypt/decrypt/save/read cycle: a value encrypted by the backend is stored wrapped in
 * ENC(...) on disk, and decryptable back to the original plaintext for an authorized viewer.
 * (Cryptographic WEAKNESS is asserted separately in the JUnit CryptoEngine spec S1.)
 */
describe('OSGi Configurations Manager - Encryption round-trip', () => {
    const file = 'org.jahia.modules.e2e-encryption-roundtrip.cfg';
    const secret = 'top-secret-value-42';

    beforeEach(() => {
        cy.login();
        cleanupFiles([file]);
    });

    afterEach(() => {
        cleanupFiles([file]);
    });

    it('wraps a saved value as ENC(...) on disk and decrypts back to plaintext', () => {
        // Encrypt via the backend
        cy.osgiMutation('encrypt(value: $value)', '($value: String!)', {value: secret})
            .its('data.encrypt').then(encrypted => {
                expect(encrypted, 'ENC envelope').to.match(/^ENC\(.+\)$/);

                // Save a config carrying the encrypted value
                cy.upsertOsgiFile(file, `password = ${encrypted}\n`);

                // Reading the file back shows the ENC(...) wrapper on disk (not the plaintext)
                cy.readOsgiFile(file)
                    .its('data.rawContent').should('contain', encrypted)
                    .and('not.contain', secret);

                // Decrypt-on-view returns the original plaintext — naming the file the value was
                // just saved into, since decryption is file-bound
                const decryptFields = 'decrypt(name: $name, value: $value)';
                cy.osgiMutation(decryptFields, '($name: String!, $value: String!)', {name: file, value: encrypted})
                    .its('data.decrypt').should('eq', secret);
            });
    });
});
