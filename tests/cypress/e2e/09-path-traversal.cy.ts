import {createUser, deleteUser, grantRoles} from '@jahia/cypress';

/**
 * S48 (G5) — path-traversal defense and self-config gating through the real filter + Action.
 *
 * The traversal probes are user-agnostic (validateFilename rejects them for everyone, root
 * included). The self-config gating requires a NON-root user holding canManageOsgiConfigurations,
 * provisioned here (see 08-authorization for the rationale on before()-time provisioning).
 */
const AUTHORIZED_USER = 'osgiTraversalUser';
const PASSWORD = 'OsgiTrav9PwdTest';
const MODULE_ROLE = 'osgi-configurations-manager-administrator';
const SERVER_ADMIN_ROLE = 'server-administrator';
const ACTION_PATH = '/cms/render/default/en/sites/systemsite.osgiConfigManager.do';
const SELF_CONFIG = 'org.jahia.modules.osgiconfigmanager.cfg';

const TRAVERSAL_NAMES = ['../secret.cfg', '/etc/passwd', 'a/b.cfg', '..\\secret.cfg'];

describe('OSGi Configurations Manager - Path traversal & self-config gating', () => {
    describe('traversal probes are rejected (root session)', () => {
        beforeEach(() => cy.login());

        it('rejects traversal / absolute / multi-segment filenames on read', () => {
            TRAVERSAL_NAMES.forEach(name => {
                cy.osgiRequest({
                    method: 'GET',
                    url: `${ACTION_PATH}?filename=${encodeURIComponent(name)}`
                }).then(res => {
                    expect(res.status, `read ${name} must be rejected`).to.be.oneOf([400, 500]);
                    expect(String(res.body?.error || ''), `no escape for ${name}`).to.match(/invalid|not found|denied/i);
                });
            });
        });

        it('rejects traversal filenames on save', () => {
            TRAVERSAL_NAMES.forEach(name => {
                cy.osgiRequest({
                    method: 'POST',
                    body: {action: 'save', filename: name, rawContent: 'x=1'}
                }).its('status').should('be.oneOf', [400, 500]);
            });
        });

        it('root MAY access the self-configuration', () => {
            cy.osgiRequest({
                method: 'GET',
                url: `${ACTION_PATH}?filename=${encodeURIComponent(SELF_CONFIG)}`
            }).then(res => {
                // 200 when the file exists, or a plain "File not found" (still NOT an access denial).
                expect(res.status).to.be.oneOf([200, 500]);
                if (res.status === 500) {
                    expect(String(res.body?.error || '')).to.match(/not found/i);
                }
            });
        });
    });

    describe('non-root user cannot touch the self-configuration (F8/D6)', () => {
        before(() => {
            cy.login();
            createUser(AUTHORIZED_USER, PASSWORD);
            grantRoles('/', [SERVER_ADMIN_ROLE], AUTHORIZED_USER, 'USER');
            grantRoles('/', [MODULE_ROLE], AUTHORIZED_USER, 'USER');
        });

        after(() => {
            cy.login();
            deleteUser(AUTHORIZED_USER);
        });

        beforeEach(() => cy.login(AUTHORIZED_USER, PASSWORD));

        it('is denied read/save/toggle/delete of the self-config', () => {
            const ops = [
                {method: 'GET', url: `${ACTION_PATH}?filename=${encodeURIComponent(SELF_CONFIG)}`},
                {method: 'POST', body: {action: 'save', filename: SELF_CONFIG, rawContent: 'x=1'}},
                {method: 'POST', body: {action: 'toggle', filename: SELF_CONFIG}},
                {method: 'POST', body: {action: 'delete', filename: SELF_CONFIG}}
            ];
            ops.forEach(op => {
                cy.osgiRequest(op).then(res => {
                    // ConfigAccessDeniedException now maps to 403 rather than the blanket 500 this
                    // used to return; the denial message is still sanitised.
                    expect(res.status).to.eq(403);
                    expect(String(res.body?.error || '')).to.match(/denied|reserved|blacklisted/i);
                });
            });
        });
    });
});
