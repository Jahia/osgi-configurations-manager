import {cleanupFiles} from './osgiTestUtils';

/**
 * A secret stored in clear text is masked in every view, like the Felix web console masks a
 * Password attribute: the visual editor, the raw editor and the review-before-save diff. It is the
 * case of every module that cannot read ENC(...). The value stays as it is in the file, and each
 * view has its button to show it.
 */
const FILE = 'org.jahia.modules.e2e-secrets-masked.cfg';
const SECRET = 'clear-secret-value-51';
const NEW_SECRET = 'changed-secret-value-52';
const CONTENT = `service.url = https://example.org\ndb.password = ${SECRET}\napi.token = token-value-53\n`;

describe('OSGi Configurations Manager - Secrets stored in clear text are masked everywhere', () => {
    beforeEach(() => {
        cy.login();
        cleanupFiles([FILE]);
        cy.upsertOsgiFile(FILE, CONTENT).its('status').should('eq', 200);
        cy.openOsgiConfigManager();
        cy.openOsgiFile(FILE);
    });

    afterEach(() => {
        cleanupFiles([FILE]);
    });

    it('visual editor: masks the secret names, not the others, and the eye shows the value', () => {
        cy.ensureVisualCfgMode();

        cy.get('[data-cy="cfg-value-0"]', {timeout: 30000}).should('have.value', 'https://example.org')
            .should('not.have.attr', 'type', 'password');
        cy.get('[data-cy="cfg-value-1"]').should('have.attr', 'type', 'password').and('have.value', SECRET);
        cy.get('[data-cy="cfg-value-2"]').should('have.attr', 'type', 'password');
        // Masked, not encrypted.
        cy.get('[data-cy="cfg-encrypted-1"]').then($checkbox => {
            const $input = $checkbox.is('input') ? $checkbox : $checkbox.find('input');
            expect($input.prop('checked'), 'encryption left off').to.eq(false);
        });

        cy.get('[data-cy="cfg-value-cell-1"] button').first().click();
        cy.get('[data-cy="cfg-value-1"]').should('have.attr', 'type', 'text');

        // The filter does not find a row by the value of a secret.
        cy.get('[data-cy="cfg-filter"] input').type(SECRET);
        cy.get('[data-cy="cfg-row-1"]').should('not.exist');
    });

    it('raw editor: the values are drawn masked, the text is untouched, and the toolbar shows them', () => {
        cy.ensureRawCfgMode();

        cy.get('.monaco-editor .view-lines', {timeout: 30000}).should('contain.text', 'db.password');
        cy.get('.monaco-editor .ocm-masked-secret', {timeout: 30000}).should('have.length.at.least', 2)
            .each($span => expect(getComputedStyle($span[0]).color).to.eq('rgba(0, 0, 0, 0)'));
        cy.get('.monaco-editor .ocm-masked-secret').then($spans => {
            const masked = $spans.toArray().map(span => span.textContent).join('');
            expect(masked).to.include(SECRET);
            expect(masked).not.to.include('https://example.org');
        });

        cy.get('[data-cy="raw-editor-toggle-secrets"]').should('have.attr', 'data-state', 'masked')
            .find('button').should('contain.text', '2').click();
        cy.get('[data-cy="raw-editor-toggle-secrets"]').should('have.attr', 'data-state', 'visible');
        cy.get('.monaco-editor .ocm-masked-secret').should('not.exist');

        cy.get('[data-cy="raw-editor-toggle-secrets"] button').click();
        cy.get('.monaco-editor .ocm-masked-secret').should('have.length.at.least', 2);
    });

    it('review before save: the diff masks the old and the new secret, and shows them on request', () => {
        cy.ensureVisualCfgMode();
        cy.get('[data-cy="cfg-value-1"]', {timeout: 30000}).clear();
        cy.get('[data-cy="cfg-value-1"]').type(NEW_SECRET);
        cy.get('[data-cy="save-config-button"] button').click();

        cy.get('[data-cy="diff-modal"]', {timeout: 30000}).should('be.visible')
            .and('contain.text', 'db.password = •')
            .and('not.contain.text', SECRET)
            .and('not.contain.text', NEW_SECRET);

        cy.get('[data-cy="diff-modal-toggle-secrets"] button').click();
        cy.get('[data-cy="diff-modal"]').should('contain.text', NEW_SECRET).and('contain.text', SECRET);

        cy.confirmDiffSave();
        // Masking is a display matter: the file holds the value as typed.
        cy.readOsgiFile(FILE).its('data.rawContent').should('contain', `db.password = ${NEW_SECRET}`);
    });
});
