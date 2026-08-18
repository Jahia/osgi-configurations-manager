import {cleanupFiles} from './osgiTestUtils';

/**
 * S51 (G28) — encryption round-trip through the REAL backend (F20/D4). Validates the
 * client<->encrypt/decrypt/save/read cycle: a value encrypted by the backend is stored wrapped in
 * ENC(...) on disk, and decryptable back to the original plaintext for an authorized viewer.
 * (Cryptographic WEAKNESS is asserted separately in the JUnit CryptoEngine spec S1.)
 */
const ACTION_PATH = '/cms/render/default/en/sites/systemsite.osgiConfigManager.do';

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
        // encrypt via the backend
        cy.osgiRequest({method: 'POST', body: {action: 'encrypt', value: secret}})
            .its('body.encryptedValue').then(encrypted => {
                expect(encrypted, 'ENC envelope').to.match(/^ENC\(.+\)$/);

                // save a config carrying the encrypted value
                cy.upsertOsgiFile(file, `password = ${encrypted}\n`);

                // reading the file back shows the ENC(...) wrapper on disk (not the plaintext)
                cy.osgiRequest({method: 'GET', url: `${ACTION_PATH}?filename=${file}`})
                    .its('body.data.rawContent').should('contain', encrypted)
                    .and('not.contain', secret);

                // decrypt-on-view returns the original plaintext — naming the file the value was
                // just saved into, since decryption is file-bound
                cy.osgiRequest({method: 'POST', body: {action: 'decrypt', value: encrypted, filename: file}})
                    .its('body.decryptedValue').should('eq', secret);
            });
    });
});
