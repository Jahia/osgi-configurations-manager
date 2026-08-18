import {createUser, deleteUser, grantRoles} from '@jahia/cypress';
import {cleanupFiles} from './osgiTestUtils';

/**
 * S22 (G3) + S21e (G4) — authorization negatives and the CSRF JSON-content-type guard through the
 * REAL Jahia security filter + Action servlet.
 *
 * D5 — the tool now ships src/main/import/roles.xml with the server-role
 * `osgi-configurations-manager-administrator` (carries `canManageOsgiConfigurations`). The scoped
 * users are provisioned HERE, in a before() hook, because the module (and hence its roles.xml) is
 * installed AFTER the provisioning manifest runs — so the role only exists once tests start.
 *   - AUTHORIZED_USER: server-administrator (passes the Action's required "admin") + the module role.
 *   - NEGATIVE_USER:   server-administrator only — passes "admin" but WITHOUT canManageOsgiConfigurations.
 */
const AUTHORIZED_USER = 'osgiAuthorizedUser';
const NEGATIVE_USER = 'osgiPlainAdminUser';
const PASSWORD = 'OsgiPerm9PwdTest';
const MODULE_ROLE = 'osgi-configurations-manager-administrator';
const SERVER_ADMIN_ROLE = 'server-administrator';

const STATE_CHANGING = [
    {action: 'save', body: {action: 'save', filename: 'authz-probe.cfg', rawContent: 'k=v'}},
    {action: 'toggle', body: {action: 'toggle', filename: 'authz-probe.cfg'}},
    {action: 'delete', body: {action: 'delete', filename: 'authz-probe.cfg'}},
    {action: 'markAsDefault', body: {action: 'markAsDefault', filename: 'authz-probe.cfg'}},
    {action: 'create', body: {action: 'create', filename: 'authz-probe.cfg'}},
    {action: 'encrypt', body: {action: 'encrypt', value: 'secret'}},
    // deliberately no filename: the permission check runs before any dispatch, so this must be
    // refused as 403 rather than reaching the file-bound validation
    {action: 'decrypt', body: {action: 'decrypt', value: 'ENC(x)'}}
];

describe('OSGi Configurations Manager - Authorization', () => {
    before(() => {
        cy.login();
        createUser(AUTHORIZED_USER, PASSWORD);
        createUser(NEGATIVE_USER, PASSWORD);
        // both are server administrators (so both pass the Action's required "admin" permission)
        grantRoles('/', [SERVER_ADMIN_ROLE], AUTHORIZED_USER, 'USER');
        grantRoles('/', [SERVER_ADMIN_ROLE], NEGATIVE_USER, 'USER');
        // only the authorized user additionally receives canManageOsgiConfigurations (module role)
        grantRoles('/', [MODULE_ROLE], AUTHORIZED_USER, 'USER');
    });

    after(() => {
        cy.login();
        deleteUser(AUTHORIZED_USER);
        deleteUser(NEGATIVE_USER);
    });

    describe('user WITHOUT canManageOsgiConfigurations', () => {
        beforeEach(() => {
            cy.login(NEGATIVE_USER, PASSWORD);
        });

        it('is denied the GET listing (403)', () => {
            cy.osgiRequest({method: 'GET'}).its('status').should('eq', 403);
        });

        it('is denied every state-changing action (403, no side effect)', () => {
            STATE_CHANGING.forEach(({action, body}) => {
                cy.osgiRequest({method: 'POST', body}).then(res => {
                    expect(res.status, `action ${action} must be forbidden`).to.eq(403);
                });
            });
        });
    });

    describe('user WITH canManageOsgiConfigurations', () => {
        const probe = 'authz-allowed-probe.cfg';

        beforeEach(() => {
            cy.login(AUTHORIZED_USER, PASSWORD);
            cleanupFiles([probe]);
        });

        afterEach(() => {
            cleanupFiles([probe]);
        });

        it('can list, create, read, save, and decrypt a value from its own file (D4)', () => {
            cy.osgiRequest({method: 'GET'}).its('status').should('eq', 200);
            cy.osgiRequest({method: 'POST', body: {action: 'create', filename: probe}})
                .its('status').should('eq', 200);
            cy.osgiRequest({method: 'GET', url: `/cms/render/default/en/sites/systemsite.osgiConfigManager.do?filename=${probe}`})
                .its('status').should('eq', 200);

            // Decryption is FILE-BOUND: the caller names the file the ciphertext came from, and the
            // service requires the value to actually be in it. Round-trip a REAL value — the engine
            // fails loudly on a malformed ENC(...) rather than returning it unchanged.
            cy.osgiRequest({method: 'POST', body: {action: 'encrypt', value: 'probe-secret'}})
                .then(res => {
                    expect(res.status, 'authorized user may encrypt').to.eq(200);
                    const wrapped = res.body.encryptedValue;

                    // Store it in the probe file, so it genuinely belongs there.
                    cy.osgiRequest({
                        method: 'POST',
                        body: {action: 'save', filename: probe, rawContent: `sample.value = ${wrapped}\n`}
                    }).its('status').should('eq', 200);

                    cy.osgiRequest({method: 'POST', body: {action: 'decrypt', value: wrapped, filename: probe}})
                        .then(dec => {
                            expect(dec.status, 'authorized user may decrypt a value from that file').to.eq(200);
                            expect(dec.body.decryptedValue).to.eq('probe-secret');
                        });
                });
        });

        it('cannot decrypt a value that does not belong to the named file (no oracle)', () => {
            // The ciphertext is genuine and the caller is authorized, but it is not in this file.
            // Before decryption was file-bound this succeeded, which made the action usable to
            // decrypt any ENC(...) obtained elsewhere — a backup, a log, a git history.
            cy.osgiRequest({method: 'POST', body: {action: 'create', filename: probe}})
                .its('status').should('eq', 200);
            cy.osgiRequest({method: 'POST', body: {action: 'save', filename: probe, rawContent: 'unrelated = 1\n'}})
                .its('status').should('eq', 200);

            cy.osgiRequest({method: 'POST', body: {action: 'encrypt', value: 'elsewhere-secret'}})
                .then(res => {
                    expect(res.status).to.eq(200);
                    cy.osgiRequest({
                        method: 'POST',
                        body: {action: 'decrypt', value: res.body.encryptedValue, filename: probe}
                    }).then(dec => {
                        expect(dec.status, 'a foreign ciphertext is refused').to.eq(500);
                        expect(dec.body.decryptedValue, 'nothing is decrypted').to.be.undefined;
                    });
                });
        });

        it('S28: rejects a POST missing the X-Requested-With header (403, no side effect)', () => {
            // cy.request is not a browser fetch, so it CAN omit the header a forged cross-site
            // request could never set — which is exactly what makes this simulation faithful.
            cy.osgiRequest({
                method: 'POST',
                headers: {'X-Requested-With': null},
                body: {action: 'create', filename: 'csrf-probe.cfg'}
            }).then(res => {
                expect(res.status, 'missing header is refused').to.eq(403);
            });
            // No side effect: the refused create must not have written the file, so reading it
            // now answers 404 (ConfigNotFoundException) instead of the blanket 500.
            cy.osgiRequest({method: 'GET', url: '/cms/render/default/en/sites/systemsite.osgiConfigManager.do?filename=csrf-probe.cfg'})
                .its('status').should('eq', 404);
        });

        it('S21e: rejects a form-encoded POST (415) but accepts the same JSON payload', () => {
            cy.osgiRequest({
                method: 'POST',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                body: 'action=create&filename=' + probe,
                form: false
            }).its('status').should('eq', 415);

            cy.osgiRequest({method: 'POST', body: {action: 'create', filename: probe}})
                .its('status').should('eq', 200);
        });
    });
});
