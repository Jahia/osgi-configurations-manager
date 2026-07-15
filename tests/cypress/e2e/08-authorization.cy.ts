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

        it('can list, create, read, save, and decrypt (single-gate authz — D4)', () => {
            cy.osgiRequest({method: 'GET'}).its('status').should('eq', 200);
            cy.osgiRequest({method: 'POST', body: {action: 'create', filename: probe}})
                .its('status').should('eq', 200);
            cy.osgiRequest({method: 'POST', body: {action: 'save', filename: probe, rawContent: 'k=v'}})
                .its('status').should('eq', 200);
            cy.osgiRequest({method: 'GET', url: `/cms/render/default/en/sites/systemsite.osgiConfigManager.do?filename=${probe}`})
                .its('status').should('eq', 200);
            // D4: any gate-passer may encrypt/decrypt (single-gate authz — no per-file/graded
            // decrypt authorization). Round-trip a REAL value: post-SUPPORT-646 the engine fails
            // loudly on a malformed ENC(...) instead of silently returning it, so use a value the
            // backend actually produced.
            cy.osgiRequest({method: 'POST', body: {action: 'encrypt', value: 'probe-secret'}})
                .then(res => {
                    expect(res.status, 'authorized user may encrypt').to.eq(200);
                    cy.osgiRequest({method: 'POST', body: {action: 'decrypt', value: res.body.encryptedValue}})
                        .then(dec => {
                            expect(dec.status, 'authorized user may decrypt').to.eq(200);
                            expect(dec.body.decryptedValue).to.eq('probe-secret');
                        });
                });
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
