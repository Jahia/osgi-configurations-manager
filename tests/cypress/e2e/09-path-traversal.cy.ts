import {createUser, deleteUser, grantRoles} from '@jahia/cypress';

/**
 * S48 (G5) — path-traversal defense and self-config gating through the real filter + GraphQL API.
 *
 * The traversal probes are user-agnostic (validateFilename rejects them for everyone, root
 * included). The self-config gating requires a NON-root user holding canManageOsgiConfigurations,
 * provisioned here (see 08-authorization for the rationale on before()-time provisioning).
 */
const AUTHORIZED_USER = 'osgiTraversalUser';
const PASSWORD = 'OsgiTrav9PwdTest';
const MODULE_ROLE = 'osgi-configurations-manager-administrator';
const SERVER_ADMIN_ROLE = 'server-administrator';
const SELF_CONFIG = 'org.jahia.modules.osgiconfigmanager.cfg';

const TRAVERSAL_NAMES = ['../secret.cfg', '/etc/passwd', 'a/b.cfg', '..\\secret.cfg'];

const NAME = '($name: String!)';
const readFile = (name: string) => cy.osgiQuery('file(name: $name) { rawContent }', NAME, {name});
const saveFile = (name: string) => cy.osgiMutation('save(name: $name, rawContent: "x=1")', NAME, {name});

const expectReadRejected = (name: string) => (res: Cypress.OsgiGqlResult) => {
    expect(res.data, `read ${name} returns nothing`).to.be.null;
    expect(res.code, `read ${name} must be rejected`).to.be.oneOf(['BAD_REQUEST', 'NOT_FOUND', 'FORBIDDEN']);
    expect(String(res.error), `no escape for ${name}`).to.match(/invalid|not found|denied/i);
};

const expectSelfConfigDenied = (res: Cypress.OsgiGqlResult) => {
    // ConfigAccessDeniedException maps to FORBIDDEN; its message is sanitised.
    expect(res.code).to.eq('FORBIDDEN');
    expect(String(res.error)).to.match(/denied|reserved|blacklisted/i);
};

describe('OSGi Configurations Manager - Path traversal & self-config gating', () => {
    describe('traversal probes are rejected (root session)', () => {
        beforeEach(() => cy.login());

        it('rejects traversal / absolute / multi-segment filenames on read', () => {
            TRAVERSAL_NAMES.forEach(name => {
                readFile(name).then(expectReadRejected(name));
            });
        });

        it('rejects traversal filenames on save', () => {
            TRAVERSAL_NAMES.forEach(name => {
                saveFile(name).its('code').should('be.oneOf', ['BAD_REQUEST', 'NOT_FOUND', 'FORBIDDEN']);
            });
        });

        it('root MAY access the self-configuration', () => {
            readFile(SELF_CONFIG).then(res => {
                // The file when it exists, or a plain "File not found" — never an access denial.
                expect(res.code).to.be.oneOf([null, 'NOT_FOUND']);
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
                () => readFile(SELF_CONFIG),
                () => saveFile(SELF_CONFIG),
                () => cy.osgiMutation('toggle(name: $name)', NAME, {name: SELF_CONFIG}),
                () => cy.osgiMutation('delete(name: $name)', NAME, {name: SELF_CONFIG})
            ];
            ops.forEach(op => {
                op().then(expectSelfConfigDenied);
            });
        });
    });
});
