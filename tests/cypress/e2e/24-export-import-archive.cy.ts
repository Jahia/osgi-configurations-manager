import {cleanupFiles} from './osgiTestUtils';

/**
 * Export several files into one password-sealed archive, then import it back. The archive carries
 * the encrypted values in clear under its password; the import encrypts them again for the target
 * file, so the value reads the same while its envelope is a new one.
 */
// Moonstone puts data-cy on the control itself or on a wrapper, depending on the component.
const field = (dataCy: string) => cy.get(`input[data-cy="${dataCy}"], [data-cy="${dataCy}"] input`).first();
const button = (dataCy: string) => cy.get(`button[data-cy="${dataCy}"], [data-cy="${dataCy}"] button`).first();

describe('OSGi Configurations Manager - Export and import archive', () => {
    const withSecret = 'org.jahia.modules.e2e-archive-a.cfg';
    const plain = 'org.jahia.modules.e2e-archive-b.yml';
    const password = 'an-archive-password-42';
    const secret = 'archived-secret-value';

    beforeEach(() => {
        cy.login();
        cleanupFiles([withSecret, plain]);
    });

    afterEach(() => {
        cleanupFiles([withSecret, plain]);
    });

    it('exports two files, then imports them with their secret encrypted again', () => {
        cy.osgiMutation('encrypt(value: $value, name: $name)', '($value: String!, $name: String!)', {value: secret, name: withSecret})
            .then(result => {
                const envelope = result.data.encrypt as string;
                cy.upsertOsgiFile(withSecret, `url = https://example.org\npassword = ${envelope}\n`);
                cy.upsertOsgiFile(plain, 'plain: value\n');
                cy.wrap(envelope).as('sourceEnvelope');
            });

        cy.intercept('POST', '**/modules/graphql', req => {
            if (JSON.stringify(req.body).includes('exportArchive')) {
                req.alias = 'exportArchive';
            }
        });

        cy.openOsgiConfigManager();
        button('export-archive-button').click();
        cy.get('[data-cy="archive-export-dialog"]').should('be.visible');
        field('archive-export-filter').type('e2e-archive');
        button('archive-export-select-shown').click();
        cy.get('[data-cy="archive-export-count"]').should('contain', '2');
        field('archive-export-password').type(password, {log: false});
        field('archive-export-password-confirm').type(password, {log: false});
        button('archive-export-confirm').click();

        cy.wait('@exportArchive').then(interception => {
            const answer = JSON.parse(interception.response.body.data.osgiConfigManager.exportArchive);
            expect(answer.files).to.eq(2);
            expect(answer.fileName).to.match(/\.ocmx$/);
            cy.wrap(answer.archive).as('archive');
        });
        cy.get('[data-cy="archive-export-dialog"]').should('not.exist');

        // The target: the two files are gone, then come back from the archive.
        cleanupFiles([withSecret, plain]);
        cy.get<string>('@archive').then(archive => {
            cy.get('[data-cy="upload-file-input"]').selectFile({
                contents: Cypress.Buffer.from(archive, 'base64'),
                fileName: 'export.ocmx'
            }, {force: true});
        });
        cy.get('[data-cy="archive-import-dialog"]').should('be.visible');
        field('archive-import-password').type(password, {log: false});
        button('archive-import-check').click();

        cy.get('[data-cy="archive-import-summary"]', {timeout: 30000}).should('be.focused');
        cy.get(`[data-cy="archive-import-file-${encodeURIComponent(withSecret)}"]`)
            .should('contain', 'New file')
            .and('contain', 'encrypted again with this server');
        button('archive-import-confirm').click();
        cy.get('[data-cy="archive-import-result"]', {timeout: 30000}).should('contain', 'Files imported: 2');
        button('archive-import-done').click();

        cy.readOsgiFile(plain).its('data.rawContent').should('eq', 'plain: value\n');
        cy.readOsgiFile(withSecret).its('data.rawContent').then(raw => {
            expect(raw).to.contain('url = https://example.org');
            expect(raw).not.to.contain(secret);
            const envelope = /password = (ENC\([^)]+\))/.exec(raw as string)[1];
            cy.get<string>('@sourceEnvelope').should('not.eq', envelope);
            cy.osgiMutation('decrypt(value: $value, name: $name)', '($value: String!, $name: String!)', {value: envelope, name: withSecret})
                .its('data.decrypt').should('eq', secret);
        });
    });

    it('refuses a wrong password on the password field', () => {
        cy.upsertOsgiFile(plain, 'plain: value\n');
        cy.osgiMutation('exportArchive(names: $names, password: $password)', '($names: [String!]!, $password: String!)', {names: [plain], password}).then(result => {
            const {archive} = JSON.parse(result.data.exportArchive as string);
            cy.openOsgiConfigManager();
            cy.get('[data-cy="upload-file-input"]').selectFile({
                contents: Cypress.Buffer.from(archive, 'base64'),
                fileName: 'export.ocmx'
            }, {force: true});
        });
        field('archive-import-password').type('not-the-password', {log: false});
        button('archive-import-check').click();
        cy.get('[data-cy="archive-import-dialog"]', {timeout: 30000}).should('contain', 'The password is not correct, or the archive is damaged. Check the password and try again.');
        field('archive-import-password')
            .should('have.attr', 'aria-invalid', 'true')
            .and('be.focused');
    });
});
