/**
 * S48 (G5) — path-traversal defense and self-config gating through the real filter + Action.
 *
 * The traversal probes are user-agnostic (validateFilename rejects them for everyone, root
 * included). The self-config gating requires a NON-root user, so it reuses the scoped users
 * provisioned for 08-authorization (see tests/assets/provision-scoped-users.groovy).
 *
 * STAGE-6 TODO: the self-config `describe` depends on the AUTHORIZED_USER being NON-root with the
 * manage permission. If that provisioning is not yet confirmed, skip that block rather than relax it.
 */
const AUTHORIZED_USER = Cypress.env('OSGI_AUTHORIZED_USER') || 'osgi-authorized';
const SCOPED_PWD = Cypress.env('OSGI_SCOPED_PWD') || 'password';
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
        beforeEach(() => cy.login(AUTHORIZED_USER, SCOPED_PWD));

        it('is denied read/save/toggle/delete of the self-config', () => {
            const ops = [
                {method: 'GET', url: `${ACTION_PATH}?filename=${encodeURIComponent(SELF_CONFIG)}`},
                {method: 'POST', body: {action: 'save', filename: SELF_CONFIG, rawContent: 'x=1'}},
                {method: 'POST', body: {action: 'toggle', filename: SELF_CONFIG}},
                {method: 'POST', body: {action: 'delete', filename: SELF_CONFIG}}
            ];
            ops.forEach(op => {
                cy.osgiRequest(op).then(res => {
                    // access is denied at the service layer (IOException -> 500 with a denial message)
                    expect(res.status).to.eq(500);
                    expect(String(res.body?.error || '')).to.match(/denied|reserved|blacklisted/i);
                });
            });
        });
    });
});
