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
const RAW_SECRET = 'typed-in-raw-mode-44';

// Monaco renders spaces as non-breaking spaces; the assertion retries until the editor has repainted.
const rawTextShould = (assertion: (text: string) => void) =>
    cy.get('.monaco-editor .view-lines', {timeout: 30000})
        .should($lines => assertion($lines.text().replace(/\u00a0/g, ' ')));

const revealSecret = (index: number) => {
    // The eye button is the only button of the value cell of an encrypted row.
    cy.get(`[data-cy="cfg-value-cell-${index}"] button`, {timeout: 30000}).first().click();
    return cy.get(`[data-cy="cfg-value-${index}"]`).should('have.attr', 'type', 'text');
};

/** The raw editor's rendered lines, in line order, with Monaco's rendering spaces normalized. */
const rawLines = ($lines: JQuery<HTMLElement>): string[] => $lines.toArray()
    .sort((a, b) => (parseFloat(a.style.top) || 0) - (parseFloat(b.style.top) || 0))
    .map(el => (el.textContent || '').replace(/[\u00a0\u2002\u2003]/g, ' ').replace(/[\u200b-\u200d\ufeff]/g, '').trim());

/**
 * Adds `line` at the end of the raw editor, which ends with an empty line (the raw text is written
 * with a trailing newline). Typing into Monaco after a forced click on its hidden textarea was not
 * reliable in CI: keys sent before the editor held the focus were lost, so `{end}{enter}` could
 * split or push down `password = ENC(...)`, and the visual mode then had no encrypted row 0 and
 * no eye button (the intermittent "cfg-value-cell-0 button" failure). So focus the editor, check
 * it holds the focus, jump to the end of the document with the platform's own shortcut, type, and
 * check the result, naming the lines seen if it is not the expected one.
 */
const addLineAtEnd = (line: string) => {
    cy.get('.monaco-editor textarea', {timeout: 30000}).focus();
    cy.get('.monaco-editor', {timeout: 10000}).should('have.class', 'focused');
    cy.get('.monaco-editor textarea').type(Cypress.platform === 'darwin' ? '{cmd}{downarrow}' : '{ctrl}{end}', {force: true});
    cy.get('.monaco-editor textarea').type(line, {force: true});
    cy.get('.monaco-editor .view-lines .view-line', {timeout: 30000}).should($lines => {
        const texts = rawLines($lines);
        const filled = texts.filter(text => text !== '');
        // Only the last line is checked: Monaco does not always render the long ENC(...) line in
        // the DOM, so its absence here proves nothing; the visual mode checks it afterwards.
        expect(filled[filled.length - 1], `raw editor lines: ${JSON.stringify(texts)}`).to.eq(line);
    });
};

const DECRYPT = ['decrypt(name: $name, value: $value)', '($name: String!, $value: String!)'] as const;

describe('OSGi Configurations Manager - Secrets survive the raw/visual round trip', () => {
    let onDiskCiphertext: string;

    beforeEach(() => {
        cy.login();
        cleanupFiles([FILE]);

        cy.osgiMutation('encrypt(value: $value, name: $name)', '($value: String!, $name: String!)', {value: SECRET, name: FILE})
            .its('data.encrypt').then((encrypted: string) => {
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

    it('raw editor: a value encrypted with the toolbar can be decrypted again and survives the switch to visual mode', () => {
        cy.ensureRawCfgMode();

        // Add a clear value on a second line; the cursor stays on that line.
        addLineAtEnd(`token = ${RAW_SECRET}`);

        cy.get('[data-cy="raw-editor-encrypt"] button').click();
        rawTextShould(text => {
            expect(text).to.include('token = ENC(');
            expect(text).not.to.include(RAW_SECRET);
        });

        // Not saved yet, so absent from the file: only the page can know its plaintext.
        cy.get('[data-cy="raw-editor-decrypt"] button').click();
        rawTextShould(text => expect(text).to.include(`token = ${RAW_SECRET}`));

        cy.get('[data-cy="raw-editor-encrypt"] button').click();
        rawTextShould(text => expect(text).not.to.include(RAW_SECRET));

        cy.ensureVisualCfgMode();
        revealSecret(0).should('have.value', SECRET);
        revealSecret(1).should('have.value', RAW_SECRET);
    });

    it('raw editor: Decrypt says so when the current line holds no ENC(...) value', () => {
        cy.ensureRawCfgMode();
        addLineAtEnd('plain = nothing-to-decrypt');

        cy.get('[data-cy="raw-editor-decrypt"] button').click();

        cy.assertToastContains('Place the cursor on a line holding an ENC(...) value');
        rawTextShould(text => expect(text).to.include('plain = nothing-to-decrypt'));
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
            cy.osgiMutation(...DECRYPT, {name: FILE, value: saved}).its('data.decrypt').should('eq', EDITED_SECRET);
        });
    });
});
