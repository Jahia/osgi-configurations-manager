import {createUser, deleteUser, grantRoles} from '@jahia/cypress';
import {cleanupFiles} from './osgiTestUtils';

/**
 * S22 (G3) + S21e (G4) — authorization negatives and the CSRF guards, through the REAL Jahia
 * security filter and GraphQL servlet.
 *
 * D5 — the tool ships src/main/import/roles.xml with the server-role
 * `osgi-configurations-manager-administrator` (carries `canManageOsgiConfigurations`). The scoped
 * users are provisioned HERE, in a before() hook, because the module (and hence its roles.xml) is
 * installed AFTER the provisioning manifest runs — so the role only exists once tests start.
 *   - AUTHORIZED_USER: server-administrator (holds "admin" on systemsite) + the module role.
 *   - NEGATIVE_USER:   server-administrator only — holds "admin" but NOT canManageOsgiConfigurations.
 */
const AUTHORIZED_USER = 'osgiAuthorizedUser';
const NEGATIVE_USER = 'osgiPlainAdminUser';
const PASSWORD = 'OsgiPerm9PwdTest';
const MODULE_ROLE = 'osgi-configurations-manager-administrator';
const SERVER_ADMIN_ROLE = 'server-administrator';
const PROBE = 'authz-probe.cfg';

const NAME = '($name: String!)';
const NAME_VALUE = '($name: String!, $value: String!)';

const STATE_CHANGING = [
    {action: 'save', fields: 'save(name: $name, rawContent: "k=v")', params: NAME},
    {action: 'toggle', fields: 'toggle(name: $name)', params: NAME},
    {action: 'delete', fields: 'delete(name: $name)', params: NAME},
    {action: 'markAsDefault', fields: 'markAsDefault(name: $name)', params: NAME},
    {action: 'create', fields: 'create(name: $name)', params: NAME},
    {action: 'encrypt', fields: 'encrypt(value: "secret")', params: ''},
    // The permission check runs in the namespace field, before any operation is dispatched, so a
    // value that is in no file is refused as a denial rather than reaching the file-bound check.
    {action: 'decrypt', fields: 'decrypt(name: $name, value: "ENC(x)")', params: NAME}
];

const create = (name: string) => cy.osgiMutation('create(name: $name)', NAME, {name});
const encrypt = (value: string) => cy.osgiMutation('encrypt(value: $value)', '($value: String!)', {value});
const decrypt = (name: string, value: string) => cy.osgiMutation('decrypt(name: $name, value: $value)', NAME_VALUE, {name, value});

const expectDenied = (label: string) => (res: Cypress.OsgiGqlResult) => {
    expect(res.data, `${label} returns nothing`).to.be.null;
    expect(res.error, `${label} must be refused`).to.match(/denied|permission/i);
};

const expectForeignCiphertextRefused = (dec: Cypress.OsgiGqlResult) => {
    expect(dec.code, 'a foreign ciphertext is refused').to.eq('BAD_REQUEST');
    expect(dec.data, 'nothing is decrypted').to.be.null;
};

const expectNothingWritten = (label: string) => (res: Cypress.Response<Cypress.GraphQLBody>) => {
    expect(res.body?.data?.osgiConfigManager ?? null, `${label} does nothing`).to.be.null;
};

describe('OSGi Configurations Manager - Authorization', () => {
    before(() => {
        cy.login();
        createUser(AUTHORIZED_USER, PASSWORD);
        createUser(NEGATIVE_USER, PASSWORD);
        // Both are server administrators, so both hold "admin" on systemsite
        grantRoles('/', [SERVER_ADMIN_ROLE], AUTHORIZED_USER, 'USER');
        grantRoles('/', [SERVER_ADMIN_ROLE], NEGATIVE_USER, 'USER');
        // Only the authorized user additionally receives canManageOsgiConfigurations (module role)
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

        it('is denied the listing', () => {
            cy.osgiQuery('files { name }').then(expectDenied('the listing'));
        });

        it('is denied every state-changing operation (no side effect)', () => {
            STATE_CHANGING.forEach(({action, fields, params}) => {
                // Only declare $name where it is used: GraphQL rejects an unused variable outright.
                cy.osgiMutation(fields, params, params ? {name: PROBE} : {}).then(expectDenied(action));
            });
            cy.login();
            cy.readOsgiFile(PROBE).its('code').should('eq', 'NOT_FOUND');
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
            cy.osgiQuery('files { name }').its('error').should('be.null');
            create(probe).its('data.create').should('eq', true);
            cy.readOsgiFile(probe).its('error').should('be.undefined');

            // Decryption is FILE-BOUND: the caller names the file the ciphertext came from, and the
            // service requires the value to actually be in it. Round-trip a REAL value — the engine
            // fails loudly on a malformed ENC(...) rather than returning it unchanged.
            encrypt('probe-secret').its('data.encrypt').then((wrapped: string) => {
                // Store it in the probe file, so it genuinely belongs there.
                cy.upsertOsgiFile(probe, `sample.value = ${wrapped}\n`);
                decrypt(probe, wrapped).its('data.decrypt').should('eq', 'probe-secret');
            });
        });

        it('cannot decrypt a value that does not belong to the named file (no oracle)', () => {
            // The ciphertext is genuine and the caller is authorized, but it is not in this file.
            // Before decryption was file-bound this succeeded, which made the API usable to
            // decrypt any ENC(...) obtained elsewhere — a backup, a log, a git history.
            cy.upsertOsgiFile(probe, 'unrelated = 1\n');

            encrypt('elsewhere-secret').its('data.encrypt').then((wrapped: string) => {
                decrypt(probe, wrapped).then(expectForeignCiphertextRefused);
            });
        });

        it('S28: refuses a mutation missing the X-Requested-With header (no side effect)', () => {
            // A cy.request() is not a browser fetch, so it CAN omit the header a forged cross-site
            // request could never set — which is exactly what makes this simulation faithful.
            cy.osgiMutation('create(name: $name)', NAME, {name: 'csrf-probe.cfg'}, {headers: {'X-Requested-With': null}})
                .its('code').should('eq', 'FORBIDDEN');
            cy.readOsgiFile('csrf-probe.cfg').its('code').should('eq', 'NOT_FOUND');
        });

        it('S21e: refuses the same mutation sent as a CORS-simple text/plain body, accepts it as JSON', () => {
            // A text/plain body is what a cross-site form or a no-preflight fetch can send. The
            // GraphQL servlet still parses the JSON inside it, so only the module's media-type
            // check stops it — including the variant that merely CONTAINS "application/json".
            const operation = JSON.stringify({
                query: `mutation${NAME} { osgiConfigManager { create(name: $name) } }`,
                variables: {name: probe}
            });
            ['text/plain', 'text/plain;application/json'].forEach(contentType => {
                cy.osgiGql('', {}, {headers: {'Content-Type': contentType}, body: operation})
                    .then(expectNothingWritten(contentType));
            });
            cy.readOsgiFile(probe).its('code').should('eq', 'NOT_FOUND');

            create(probe).its('data.create').should('eq', true);
        });

        it('the legacy .do Action endpoint no longer serves the API', () => {
            cy.request({url: '/cms/render/default/en/sites/systemsite.osgiConfigManager.do', failOnStatusCode: false})
                .then(res => {
                    expect(res.status, 'the Action is gone').to.not.eq(200);
                    expect(JSON.stringify(res.body || '')).to.not.contain('"files"');
                });
        });
    });
});
