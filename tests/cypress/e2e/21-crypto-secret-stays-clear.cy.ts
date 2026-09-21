import {cleanupFiles} from './osgiTestUtils';

/**
 * The manager's own cryptoSecret is the passphrase ENC(...) values are encrypted with. It is
 * declared as Password so the editor masks it, but it is the one secret that must never be
 * encrypted: there would be nothing left to decrypt it with, and the plugin skips the manager's PID
 * on purpose, so a stored ENC(...) envelope would silently become the passphrase.
 *
 * The manager's configuration file is shared state of the instance: when it already exists, the
 * spec only performs a refused save (which must leave it untouched) and a picker check; when it
 * does not, the spec creates it from the Metatype and removes it afterwards.
 */
const SELF_PID = 'org.jahia.modules.osgiconfigmanager';
const SELF_FILE = `${SELF_PID}.cfg`;
const ENCRYPTED_PASSPHRASE_CONTENT = 'filteredFiles = org.apache.*, jmx.*\ncryptoSecret = ENC(v2:not-a-passphrase)\n';

describe('OSGi Configurations Manager - cryptoSecret stays in clear text', () => {
    let createdForThisSpec = false;
    let contentBefore: string | null = null;

    beforeEach(() => {
        cy.login();
        createdForThisSpec = false;
        contentBefore = null;

        cy.listOsgiFiles().then((files: Array<{name: string}>) => {
            if (files.some(file => file.name === SELF_FILE)) {
                cy.readOsgiFile(SELF_FILE).its('data.rawContent').then(rawContent => {
                    contentBefore = String(rawContent);
                });
            } else {
                cy.osgiRequest({method: 'POST', body: {action: 'createFromMetatype', pid: SELF_PID}})
                    .its('status').should('eq', 200);
                createdForThisSpec = true;
            }
        });
    });

    afterEach(() => {
        if (createdForThisSpec) {
            cleanupFiles([SELF_FILE]);
        }
    });

    it('refuses to save the manager configuration with an encrypted cryptoSecret and leaves the file as it was', () => {
        cy.readOsgiFile(SELF_FILE).its('data.rawContent').then(rawContent => {
            const before = String(rawContent);
            if (createdForThisSpec) {
                expect(before, 'the template explains the passphrase must stay clear')
                    .to.include('# cryptoSecret is the encryption passphrase itself');
            }

            cy.osgiRequest({
                method: 'POST',
                body: {action: 'save', filename: SELF_FILE, rawContent: ENCRYPTED_PASSPHRASE_CONTENT}
            }).then(response => {
                expect(response.status, 'refused').to.be.at.least(400);
                expect(String(response.body?.error)).to.include('cryptoSecret');
            });

            cy.readOsgiFile(SELF_FILE).its('data.rawContent').should('eq', before);
        });
    });

    it('inserts cryptoSecret from the picker with encryption unticked', () => {
        if (contentBefore !== null && /^\s*cryptoSecret\s*[=:]/m.test(contentBefore)) {
            // Already configured on this instance: the picker hides existing keys, nothing to pick.
            cy.log('cryptoSecret already present in the manager configuration, picker check skipped');
            return;
        }

        cy.openOsgiConfigManager();
        cy.openOsgiFile(SELF_FILE);
        cy.ensureVisualCfgMode();

        cy.get('[data-cy="cfg-add-property"] button').click();
        cy.get('[data-cy="cfg-metatype-property-dialog"]', {timeout: 30000}).should('be.visible');
        cy.get('[data-cy="cfg-metatype-property-search"]').type('cryptoSecret');
        cy.get(`[data-cy="cfg-metatype-property-option-${encodeURIComponent('cryptoSecret')}"]`, {timeout: 30000}).click();

        cy.get('[data-cy^="cfg-key-"]', {timeout: 30000})
            .filter((_, element) => (element as HTMLInputElement).value === 'cryptoSecret')
            .should('have.length', 1)
            .invoke('attr', 'data-cy')
            .then(dataCy => {
                const index = String(dataCy).replace('cfg-key-', '');

                cy.get(`[data-cy="cfg-encrypted-${index}"]`).then($checkbox => {
                    const $input = $checkbox.is('input') ? $checkbox : $checkbox.find('input');
                    expect($input.prop('checked'), 'encryption left off for the passphrase').to.eq(false);
                });
            });
        // Nothing is saved: the file keeps whatever it held before.
    });
});
