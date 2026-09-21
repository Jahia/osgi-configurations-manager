import {cleanupFiles} from './osgiTestUtils';

/**
 * A Metatype attribute of type Password is a secret by declaration. Creating a file from its PID
 * writes a hint next to it, and adding it from the visual editor's picker starts the row encrypted,
 * so the typed value lands on disk as ENC(...) without the user ticking anything.
 * Uses the module's own probe PID, whose probe.secret attribute is declared as Password.
 */
const PROBE_PID = 'org.jahia.modules.osgiconfigmanager.probe';
const PROBE_FILE = `${PROBE_PID}.cfg`;
const SECRET = 'typed-in-the-editor-42';

describe('OSGi Configurations Manager - Password attributes are encrypted by default', () => {
    beforeEach(() => {
        cy.login();
        cleanupFiles([PROBE_FILE]);
    });

    afterEach(() => {
        cleanupFiles([PROBE_FILE]);
    });

    it('flags the Password attribute in the generated template', () => {
        cy.osgiRequest({method: 'POST', body: {action: 'createFromMetatype', pid: PROBE_PID}})
            .its('status').should('eq', 200);

        cy.readOsgiFile(PROBE_FILE).its('data.rawContent')
            .should('contain', `# PID: ${PROBE_PID}`)
            .and('contain', '# probe.secret is a secret')
            .and('not.contain', '# probe.plain is a secret');
    });

    it('adds a Password attribute from the picker already encrypted and saves it as ENC(...)', () => {
        cy.osgiRequest({method: 'POST', body: {action: 'createFromMetatype', pid: PROBE_PID}})
            .its('status').should('eq', 200);

        cy.openOsgiConfigManager();
        cy.openOsgiFile(PROBE_FILE);
        cy.ensureVisualCfgMode();

        cy.get('[data-cy="cfg-add-property"] button').click();
        cy.get('[data-cy="cfg-metatype-property-dialog"]', {timeout: 30000}).should('be.visible');
        cy.get('[data-cy="cfg-metatype-property-search"]').type('probe.secret');
        cy.get(`[data-cy="cfg-metatype-property-option-${encodeURIComponent('probe.secret')}"]`, {timeout: 30000}).click();

        // Locate the inserted row by its key, whatever index the template's comment lines gave it.
        cy.get('[data-cy^="cfg-key-"]', {timeout: 30000})
            .filter((_, element) => (element as HTMLInputElement).value === 'probe.secret')
            .should('have.length', 1)
            .invoke('attr', 'data-cy')
            .then(dataCy => {
                const index = String(dataCy).replace('cfg-key-', '');

                cy.get(`[data-cy="cfg-encrypted-${index}"]`).then($checkbox => {
                    const $input = $checkbox.is('input') ? $checkbox : $checkbox.find('input');
                    expect($input.prop('checked'), 'encryption enabled by default').to.eq(true);
                });

                cy.get(`[data-cy="cfg-value-${index}"]`).clear().type(SECRET);
            });

        cy.get('[data-cy="save-config-button"] button').click();
        cy.confirmDiffSave();
        cy.assertToastContains('Configuration saved successfully');

        cy.readOsgiFile(PROBE_FILE).its('data.rawContent')
            .should('match', /probe\.secret\s*=\s*ENC\(.+\)/)
            .and('not.contain', SECRET);
    });
});
