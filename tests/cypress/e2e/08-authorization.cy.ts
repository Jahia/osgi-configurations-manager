import {cleanupFiles} from './osgiTestUtils';

/**
 * S22 (G3) + S21e (G4) — authorization negatives and the CSRF JSON-content-type guard through the
 * REAL Jahia security filter + Action servlet.
 *
 * D5 BLOCKER — SCOPED USERS: the module ships permissions.xml only (no roles.xml), and cy.login()
 * with no args logs in as root, who bypasses every permission check. This spec therefore relies on
 * two provisioned, NON-root users (see tests/assets/provision-scoped-users.groovy, wired via
 * tests/assets/provisioning.yml):
 *   - AUTHORIZED_USER: server-admin + a role granting `canManageOsgiConfigurations`
 *   - NEGATIVE_USER:   server-admin (passes the Action's required "admin" permission) but WITHOUT
 *                      `canManageOsgiConfigurations`
 *
 * STAGE-6 TODO: confirm the provisioning actually grants/withholds the permission as intended
 * (the grant could not be validated in Stage 5 — no Docker). If the users are absent, this spec
 * must be skipped, NOT made to pass by weakening the assertions.
 */
const AUTHORIZED_USER = Cypress.env('OSGI_AUTHORIZED_USER') || 'osgi-authorized';
const NEGATIVE_USER = Cypress.env('OSGI_NEGATIVE_USER') || 'osgi-plain-admin';
const SCOPED_PWD = Cypress.env('OSGI_SCOPED_PWD') || 'password';

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
    describe('user WITHOUT canManageOsgiConfigurations', () => {
        beforeEach(() => {
            cy.login(NEGATIVE_USER, SCOPED_PWD);
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
            cy.login(AUTHORIZED_USER, SCOPED_PWD);
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
            // D4: any gate-passer may decrypt; there is no per-file/graded decrypt authorization.
            cy.osgiRequest({method: 'POST', body: {action: 'decrypt', value: 'ENC(x)'}})
                .its('status').should('eq', 200);
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
