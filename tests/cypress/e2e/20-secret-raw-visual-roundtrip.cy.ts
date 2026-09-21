import {cleanupFiles} from './osgiTestUtils';

/**
 * A secret must stay readable when the editor goes visual -> raw -> visual.
 *
 * Decryption is file-bound on the server (the ciphertext must be present in the file) and
 * encryption uses a random IV. Re-encrypting an unchanged value on the way to raw mode therefore
 * produced a ciphertext that was not on disk, and the way back could not decrypt it: the eye button
 * showed the stored ENC(...) instead of the secret. The client now writes the on-disk ciphertext
 * back while the plaintext is unchanged, and remembers the pairs it produced itself.
 */
const FILE = 'org.jahia.modules.e2e-secret-roundtrip.cfg';
const SECRET = 'kept-across-modes-42';
const EDITED_SECRET = 'edited-before-save-43';

const revealSecret = (index: number) => {
    // The eye button is the only button of the value cell of an encrypted row.
    cy.get(`[data-cy="cfg-value-cell-${index}"] button`, {timeout: 30000}).first().click();
    return cy.get(`[data-cy="cfg-value-${index}"]`).should('have.attr', 'type', 'text');
};

describe('OSGi Configurations Manager - Secrets survive the raw/visual round trip', () => {
    let onDiskCiphertext: string;

    beforeEach(() => {
        cy.login();
        cleanupFiles([FILE]);

        cy.osgiRequest({method: 'POST', body: {action: 'encrypt', value: SECRET}})
            .its('body.encryptedValue').then(encrypted => {
                expect(encrypted, 'ENC envelope').to.match(/^ENC\(.+\)$/);
                onDiskCiphertext = encrypted;
                cy.upsertOsgiFile(FILE, `password = ${encrypted}\n`).its('status').should('eq', 200);
            });

        cy.openOsgiConfigManager();
        cy.openOsgiFile(FILE);
        cy.ensureVisualCfgMode();
    });

    afterEach(() => {
        cleanupFiles([FILE]);
    });

    it('shows the same secret after visual -> raw -> visual, and raw mode keeps the on-disk ciphertext', () => {
        revealSecret(0).should('have.value', SECRET);

        cy.ensureRawCfgMode();
        // The raw text carries the ciphertext that is on disk, not a freshly generated one.
        cy.get('.monaco-editor .view-lines', {timeout: 30000}).invoke('text')
            .should(text => expect(text).to.include(onDiskCiphertext));

        cy.ensureVisualCfgMode();
        revealSecret(0).should('have.value', SECRET);

        // Nothing changed, so nothing was rewritten on disk.
        cy.readOsgiFile(FILE).its('data.rawContent').should('contain', onDiskCiphertext);
    });

    it('keeps a secret edited but not saved yet readable across the round trip, then saves it encrypted', () => {
        revealSecret(0).clear().type(EDITED_SECRET);

        cy.ensureRawCfgMode();
        cy.get('.monaco-editor .view-lines', {timeout: 30000}).invoke('text')
            .should(text => {
                expect(text).to.include('ENC(');
                expect(text).not.to.include(EDITED_SECRET);
                expect(text).not.to.include(onDiskCiphertext);
            });

        cy.ensureVisualCfgMode();
        revealSecret(0).should('have.value', EDITED_SECRET);

        cy.get('[data-cy="save-config-button"] button').click();
        cy.confirmDiffSave();

        cy.readOsgiFile(FILE).its('data.rawContent').then(rawContent => {
            expect(rawContent).to.match(/^password = ENC\(.+\)\n$/);
            expect(rawContent).not.to.include(EDITED_SECRET);
            expect(rawContent).not.to.include(onDiskCiphertext);
            const saved = String(rawContent).trim().replace('password = ', '');
            cy.osgiRequest({method: 'POST', body: {action: 'decrypt', value: saved, filename: FILE}})
                .its('body.decryptedValue').should('eq', EDITED_SECRET);
        });
    });
});
